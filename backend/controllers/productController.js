const productModel = require('../models/productModel');
const productIntegrationModel = require('../models/productIntegrationModel');
const productSyncService = require('../services/productSyncService');
const logger = require('../utils/logger');

const productController = {
  list(req, res) {
    try {
      const userId = req.user.id;
      const { search, status } = req.query;

      const products = productModel.findAllByUser(userId, { search, status });
      return res.json({
        success: true,
        count: products.length,
        products
      });
    } catch (err) {
      logger.error('Error listing products', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve products'
      });
    }
  },

  getById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const product = productModel.findById(id, userId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or access denied'
        });
      }

      return res.json({
        success: true,
        product
      });
    } catch (err) {
      logger.error('Error getting product by ID', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve product details'
      });
    }
  },

  async create(req, res) {
    try {
      const userId = req.user.id;
      const { sku, title, description, price, quantity, imageUrl } = req.body || {};

      if (!sku || typeof sku !== 'string' || !sku.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Product SKU is required'
        });
      }

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Product title is required'
        });
      }

      const numPrice = parseFloat(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid positive number'
        });
      }

      const numQty = parseInt(quantity, 10);
      if (isNaN(numQty) || numQty < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be a valid non-negative integer'
        });
      }

      // Check unique SKU for this user
      const existingSku = productModel.findBySku(sku.trim(), userId);
      if (existingSku) {
        return res.status(409).json({
          success: false,
          message: `A product with SKU "${sku.trim().toUpperCase()}" already exists in your account`
        });
      }

      // 1. Create local product record
      const createdProduct = productModel.createProduct({
        userId,
        sku: sku.trim(),
        title: title.trim(),
        description: description ? description.trim() : '',
        price: numPrice,
        quantity: numQty,
        imageUrl: imageUrl || null
      });

      // 2. Perform dual synchronization (Amazon + Sendbox)
      const syncResult = await productSyncService.syncProduct(userId, createdProduct);

      logger.info('Product created and synchronized', {
        userId,
        productId: createdProduct.id,
        sku: createdProduct.sku,
        syncStatus: syncResult.syncStatus
      });

      return res.status(201).json({
        success: true,
        message: syncResult.syncStatus === 'SYNCED'
          ? 'Product created and synchronized successfully'
          : syncResult.syncStatus === 'PARTIAL'
          ? 'Product created with partial synchronization'
          : 'Product created, but synchronization failed',
        product: syncResult.product,
        syncStatus: syncResult.syncStatus,
        amazonStatus: syncResult.amazonResult.status,
        sendboxStatus: syncResult.sendboxResult.status,
        errors: syncResult.product.last_sync_error
      });
    } catch (err) {
      logger.error('Error creating product', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create product'
      });
    }
  },

  async update(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { title, description, price, quantity, imageUrl } = req.body || {};

      const existing = productModel.findById(id, userId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or access denied'
        });
      }

      const updates = {};
      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description ? description.trim() : '';
      if (price !== undefined) {
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice < 0) {
          return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
        }
        updates.price = numPrice;
      }
      if (quantity !== undefined) {
        const numQty = parseInt(quantity, 10);
        if (isNaN(numQty) || numQty < 0) {
          return res.status(400).json({ success: false, message: 'Quantity must be a valid non-negative integer' });
        }
        updates.quantity = numQty;
      }
      if (imageUrl !== undefined) updates.image_url = imageUrl || null;

      // Update product locally
      const updatedProduct = productModel.updateProduct(id, userId, updates);

      // Re-sync with existing integrations
      const existingIntegration = productIntegrationModel.findByProductId(id, userId);
      const syncResult = await productSyncService.syncProduct(userId, updatedProduct, existingIntegration);

      logger.info('Product updated and re-synchronized', {
        userId,
        productId: id,
        syncStatus: syncResult.syncStatus
      });

      return res.json({
        success: true,
        message: 'Product updated successfully',
        product: syncResult.product,
        syncStatus: syncResult.syncStatus
      });
    } catch (err) {
      logger.error('Error updating product', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update product'
      });
    }
  },

  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const existing = productModel.findById(id, userId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or access denied'
        });
      }

      // Deactivate external channels
      await productSyncService.deactivateChannels(userId, existing);

      // Delete locally
      productModel.deleteProduct(id, userId);

      logger.info('Product deleted', { userId, productId: id, sku: existing.sku });

      return res.json({
        success: true,
        message: 'Product deleted and channel listings deactivated successfully'
      });
    } catch (err) {
      logger.error('Error deleting product', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete product'
      });
    }
  },

  async retrySync(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const product = productModel.findById(id, userId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or access denied'
        });
      }

      const existingIntegration = productIntegrationModel.findByProductId(id, userId);
      const syncResult = await productSyncService.syncProduct(userId, product, existingIntegration);

      logger.info('Product sync retried', {
        userId,
        productId: id,
        newStatus: syncResult.syncStatus
      });

      return res.json({
        success: true,
        message: syncResult.syncStatus === 'SYNCED'
          ? 'Synchronization completed successfully'
          : `Synchronization status: ${syncResult.syncStatus}`,
        product: syncResult.product,
        syncStatus: syncResult.syncStatus,
        errors: syncResult.product.last_sync_error
      });
    } catch (err) {
      logger.error('Error retrying product sync', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retry synchronization'
      });
    }
  }
};

module.exports = productController;

const axios = require('axios');
const SendboxServiceInterface = require('./sendboxInterface');
const logger = require('../../utils/logger');

/**
 * Real Sendbox API Service Implementation
 * Built for official Sendbox Logistics & Shipping API.
 * Active when SENDBOX_MODE=real.
 *
 * NOTE ON SENDBOX ECOSYSTEM:
 * Sendbox is a logistics aggregation and shipping fulfillment platform.
 * It does NOT provide a standalone product/inventory catalog API.
 * Product synchronization on Sendbox registers a fulfillment shipment/parcel
 * containing the product item, generating a Sendbox Shipment Code (sendboxShipmentId).
 */
class RealSendboxService extends SendboxServiceInterface {
  constructor() {
    super();
    this.apiUrl = (process.env.SENDBOX_API_URL || 'https://live.sendbox.co').replace(/\/+$/, '');
    this.accessToken = process.env.SENDBOX_ACCESS_TOKEN || '';
    this.clientId = process.env.SENDBOX_CLIENT_ID || '';
    this.clientSecret = process.env.SENDBOX_CLIENT_SECRET || '';
    this.appId = process.env.SENDBOX_APP_ID || '';
    this.region = process.env.SENDBOX_REGION || 'NG';
  }

  /**
   * Helper to ensure the base shipping URL
   */
  getShippingUrl() {
    const base = this.apiUrl.replace(/\/shipping\/?$/, '');
    return `${base}/shipping`;
  }

  /**
   * Checks if required Sendbox credentials are configured in .env
   */
  isConfigured() {
    return Boolean(
      this.accessToken ||
      (this.appId && this.clientSecret) ||
      (this.clientId && this.clientSecret)
    );
  }

  /**
   * Builds standardized headers for Sendbox API requests.
   * Resolves authentication credentials without unreachable branches.
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.accessToken) {
      // Sendbox API expects the raw token in Authorization header
      const rawToken = this.accessToken.replace(/^Bearer\s+/i, '');
      headers['Authorization'] = rawToken;
    }

    if (this.appId) {
      headers['App-Id'] = this.appId;
    }

    if (this.clientId) {
      headers['Client-Id'] = this.clientId;
    }

    if (this.clientSecret) {
      if (this.appId) {
        headers['Secret-Key'] = this.clientSecret;
      } else if (this.clientId) {
        headers['Client-Secret'] = this.clientSecret;
      } else {
        headers['Secret-Key'] = this.clientSecret;
      }
    }

    return headers;
  }

  /**
   * Safe structured logging helper.
   * Logs HTTP metadata and resource IDs while strictly omitting credentials, tokens, and PII.
   */
  logSafe(level, action, data = {}) {
    const safePayload = {
      action,
      method: data.method,
      path: data.path,
      httpStatus: data.httpStatus,
      resourceId: data.resourceId,
      statusMessage: data.statusMessage,
      userId: data.userId,
      sku: data.sku,
      error: data.error
    };

    // Remove undefined keys
    Object.keys(safePayload).forEach((k) => safePayload[k] === undefined && delete safePayload[k]);

    if (level === 'error') {
      logger.error(`Sendbox ${action}`, safePayload);
    } else if (level === 'warn') {
      logger.warn(`Sendbox ${action}`, safePayload);
    } else {
      logger.info(`Sendbox ${action}`, safePayload);
    }
  }

  /**
   * Formats error details with clear HTTP 404 and API contextual messaging.
   */
  formatError(err, path, method = 'GET') {
    const httpStatus = err.response?.status;
    const respData = err.response?.data;
    let detail = err.message;

    if (httpStatus === 404) {
      return `Sendbox Resource Not Found [HTTP 404]: Endpoint or resource '${path}' was not found on Sendbox API.`;
    }

    if (respData) {
      if (typeof respData === 'string') {
        detail = respData;
      } else if (respData.message) {
        detail = respData.message;
      } else if (respData.title) {
        detail = respData.title;
      } else if (typeof respData === 'object') {
        detail = JSON.stringify(respData);
      }
    }

    const statusTag = httpStatus ? ` [HTTP ${httpStatus}]` : '';
    return `Sendbox API Error${statusTag} on ${method} ${path}: ${detail}`;
  }

  /**
   * Gets Sendbox integration status and account connectivity.
   * @param {string} userId - Authenticated user ID
   */
  async getStatus(userId) {
    if (!this.isConfigured()) {
      return {
        connected: false,
        status: 'Credentials Missing',
        mode: 'real',
        provider: 'Sendbox Logistics API',
        configured: false,
        notice: 'Sendbox real mode requires SENDBOX_ACCESS_TOKEN or SENDBOX_APP_ID/SECRET in .env'
      };
    }

    const path = '/shipping/shipments';
    try {
      this.logSafe('info', 'Status Check Initiated', { method: 'GET', path, userId });

      const response = await axios.get(`${this.getShippingUrl()}/shipments?page=1&per_page=1`, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      const data = response.data || {};
      const firstResult = (data.results && data.results[0]) || {};
      const userObj = firstResult.user || {};

      this.logSafe('info', 'Status Check Succeeded', {
        method: 'GET',
        path,
        httpStatus: response.status,
        statusMessage: 'Connected',
        userId
      });

      return {
        connected: true,
        status: 'Connected',
        mode: 'real',
        provider: 'Sendbox Logistics Live API',
        configured: true,
        totalShipments: data.count || 0,
        accountName: userObj.name || `Merchant-${userId.slice(-6).toUpperCase()}`,
        accountEmail: userObj.email || undefined,
        apiUrl: this.apiUrl
      };
    } catch (err) {
      const errorMsg = this.formatError(err, path, 'GET');
      this.logSafe('warn', 'Status Check Failed', {
        method: 'GET',
        path,
        httpStatus: err.response?.status,
        error: errorMsg,
        userId
      });

      return {
        connected: false,
        status: err.response?.status === 401 ? 'Unauthorized' : 'Connection Error',
        mode: 'real',
        provider: 'Sendbox Logistics API',
        configured: true,
        error: errorMsg,
        apiUrl: this.apiUrl
      };
    }
  }

  /**
   * Synchronizes product fulfillment on Sendbox by creating a shipment package.
   * Sendbox does not maintain a standalone product catalog; items are registered as shipment parcels.
   *
   * @param {string} userId - Authenticated user ID
   * @param {object} product - Product details
   */
  async createProduct(userId, product) {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'ERROR',
        error: 'Sendbox real mode selected, but credentials are not configured in .env'
      };
    }

    const path = '/shipping/shipments';
    try {
      const quantity = Math.max(1, parseInt(product.quantity, 10) || 1);
      const price = parseFloat(product.price) || 0;

      const payload = {
        region: this.region,
        origin: {
          first_name: 'Store',
          last_name: 'Inventory',
          street: '10 Industrial Way',
          state: 'Lagos',
          city: 'Ikeja',
          country: this.region,
          phone: '+2348000000001'
        },
        destination: {
          first_name: 'Customer',
          last_name: 'User',
          street: '25 Commercial Ave',
          state: 'Lagos',
          city: 'Yaba',
          country: this.region,
          phone: '+2348000000002'
        },
        weight: Number(product.weight) || 1,
        dimension: { length: 10, width: 10, height: 10 },
        channel_code: 'api',
        package_type: 'general',
        service_type: 'local',
        total_value: price * quantity,
        currency: 'USD',
        items: [
          {
            name: product.title,
            sku: product.sku,
            quantity: quantity,
            value: price,
            item_type: 'general'
          }
        ]
      };

      this.logSafe('info', 'Fulfillment Shipment Registration Initiated', {
        method: 'POST',
        path,
        sku: product.sku,
        userId
      });

      const response = await axios.post(`${this.getShippingUrl()}/shipments`, payload, {
        headers: this.getHeaders(),
        timeout: 15000
      });

      const respData = response.data || {};
      const sendboxShipmentId = respData.code || respData._id || respData.pk;
      const sendboxOrderId = respData.payment_data?.reference_code || respData.code || null;
      const shipmentStatus = respData.status?.code || respData.status?.name || 'drafted';

      if (!sendboxShipmentId) {
        throw new Error('Sendbox API did not return a valid shipment identifier in response');
      }

      this.logSafe('info', 'Fulfillment Shipment Created', {
        method: 'POST',
        path,
        httpStatus: response.status,
        resourceId: sendboxShipmentId,
        statusMessage: shipmentStatus,
        sku: product.sku,
        userId
      });

      return {
        success: true,
        sendboxShipmentId: String(sendboxShipmentId),
        sendboxOrderId: sendboxOrderId ? String(sendboxOrderId) : null,
        sendboxProductId: null, // Sendbox does not issue standalone product IDs
        status: 'SYNCED',
        syncedAt: new Date().toISOString(),
        details: {
          shipmentCode: respData.code,
          shipmentId: respData._id,
          statusName: respData.status?.name || 'Drafted (Book On Hold)',
          totalValue: respData.total_value,
          itemCount: respData.items?.length || 1
        }
      };
    } catch (err) {
      const errorMsg = this.formatError(err, path, 'POST');
      this.logSafe('error', 'Fulfillment Shipment Registration Failed', {
        method: 'POST',
        path,
        httpStatus: err.response?.status,
        error: errorMsg,
        sku: product.sku,
        userId
      });

      return {
        success: false,
        status: 'ERROR',
        error: errorMsg
      };
    }
  }

  /**
   * Updates product synchronization status on Sendbox.
   * Sendbox booked shipments cannot have item details mutated arbitrarily via API;
   * this method verifies the current shipment or returns an accurate status.
   *
   * @param {string} userId - Authenticated user ID
   * @param {string} sendboxIdentifier - Sendbox shipment ID or code
   * @param {object} updates - Updates to apply
   */
  async updateProduct(userId, sendboxIdentifier, updates) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Sendbox real mode credentials are not configured in .env'
      };
    }

    if (!sendboxIdentifier) {
      return {
        success: false,
        error: 'No active Sendbox shipment ID associated with this product'
      };
    }

    const path = `/shipping/shipments/${encodeURIComponent(sendboxIdentifier)}`;
    try {
      this.logSafe('info', 'Shipment Status Verification on Update', {
        method: 'GET',
        path,
        resourceId: sendboxIdentifier,
        userId
      });

      const response = await axios.get(`${this.getShippingUrl()}/shipments/${encodeURIComponent(sendboxIdentifier)}`, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      const respData = response.data || {};
      const statusName = respData.status?.name || 'Active';

      this.logSafe('info', 'Shipment Verified on Update', {
        method: 'GET',
        path,
        httpStatus: response.status,
        resourceId: sendboxIdentifier,
        statusMessage: statusName,
        userId
      });

      return {
        success: true,
        sendboxShipmentId: String(sendboxIdentifier),
        sendboxProductId: null,
        status: 'SYNCED',
        updatedAt: new Date().toISOString(),
        details: {
          shipmentCode: respData.code,
          statusName
        }
      };
    } catch (err) {
      const errorMsg = this.formatError(err, path, 'GET');
      this.logSafe('error', 'Shipment Update/Verification Failed', {
        method: 'GET',
        path,
        httpStatus: err.response?.status,
        resourceId: sendboxIdentifier,
        error: errorMsg,
        userId
      });

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Deactivates or cancels a shipment on Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {string} sendboxIdentifier - Sendbox shipment identifier
   */
  async deleteProduct(userId, sendboxIdentifier) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Sendbox real mode credentials are not configured in .env'
      };
    }

    if (!sendboxIdentifier) {
      return {
        success: true,
        status: 'DEACTIVATED'
      };
    }

    const cancelPath = `/shipping/shipments/${encodeURIComponent(sendboxIdentifier)}/cancel`;
    try {
      this.logSafe('info', 'Shipment Cancellation Initiated', {
        method: 'POST',
        path: cancelPath,
        resourceId: sendboxIdentifier,
        userId
      });

      const response = await axios.post(
        `${this.getShippingUrl()}/shipments/${encodeURIComponent(sendboxIdentifier)}/cancel`,
        {
          reason: 'Product removed from catalog',
          code: String(sendboxIdentifier)
        },
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      this.logSafe('info', 'Shipment Cancelled Succeeded', {
        method: 'POST',
        path: cancelPath,
        httpStatus: response.status,
        resourceId: sendboxIdentifier,
        statusMessage: 'Cancelled',
        userId
      });

      return {
        success: true,
        sendboxShipmentId: String(sendboxIdentifier),
        status: 'DEACTIVATED'
      };
    } catch (err) {
      // If Sendbox cancellation timed out or is unsupported for drafted status, report gracefully
      const errorMsg = this.formatError(err, cancelPath, 'POST');
      this.logSafe('warn', 'Shipment Cancellation Warning', {
        method: 'POST',
        path: cancelPath,
        httpStatus: err.response?.status,
        resourceId: sendboxIdentifier,
        error: errorMsg,
        userId
      });

      return {
        success: true, // Local deactivation completes
        sendboxShipmentId: String(sendboxIdentifier),
        status: 'DEACTIVATED',
        warning: errorMsg
      };
    }
  }

  /**
   * Diagnostic function to verify whether an identifier (SKU, shipment code, ID)
   * exists remotely on Sendbox, reporting its resource type and details.
   *
   * @param {string} identifier - SKU, shipment code, or shipment ID
   */
  async verifyResource(identifier) {
    if (!identifier) {
      return {
        query: identifier,
        found: false,
        resourceType: 'not_found',
        error: 'Identifier is required'
      };
    }

    if (!this.isConfigured()) {
      return {
        query: identifier,
        found: false,
        resourceType: 'unconfigured',
        error: 'Sendbox credentials are not configured in .env'
      };
    }

    const cleanId = String(identifier).trim();
    const headers = this.getHeaders();

    // 1. Check if identifier is a direct Shipment ID
    try {
      const singleRes = await axios.get(
        `${this.getShippingUrl()}/shipments/${encodeURIComponent(cleanId)}`,
        { headers, timeout: 8000 }
      );
      if (singleRes.data && (singleRes.data.code || singleRes.data._id)) {
        const s = singleRes.data;
        return {
          query: cleanId,
          found: true,
          resourceType: 'shipment',
          details: {
            shipmentCode: s.code,
            shipmentId: s._id,
            status: s.status?.name || s.status?.code,
            dateCreated: s.date_created,
            totalValue: s.total_value,
            currency: s.currency?.code || 'USD',
            items: s.items || []
          }
        };
      }
    } catch {
      // Continue to search by SKU/list
    }

    // 2. Search recent shipments for item SKU or shipment code match
    try {
      const listRes = await axios.get(
        `${this.getShippingUrl()}/shipments?page=1&per_page=50`,
        { headers, timeout: 10000 }
      );

      const shipments = listRes.data?.results || [];

      for (const shipment of shipments) {
        // Direct shipment code match
        if (
          shipment.code === cleanId ||
          shipment._id === cleanId ||
          shipment.pk === cleanId
        ) {
          return {
            query: cleanId,
            found: true,
            resourceType: 'shipment',
            details: {
              shipmentCode: shipment.code,
              shipmentId: shipment._id,
              status: shipment.status?.name || shipment.status?.code,
              items: shipment.items || [],
              dateCreated: shipment.date_created
            }
          };
        }

        // Search items inside shipment for matching SKU
        const items = shipment.items || [];
        const matchingItem = items.find(
          (item) =>
            (item.sku && item.sku.toUpperCase() === cleanId.toUpperCase()) ||
            (item.name && item.name.toUpperCase().includes(cleanId.toUpperCase()))
        );

        if (matchingItem) {
          return {
            query: cleanId,
            found: true,
            resourceType: 'shipment_item',
            details: {
              shipmentCode: shipment.code,
              shipmentId: shipment._id,
              shipmentStatus: `${shipment.status?.code || ''} (${shipment.status?.name || ''})`.trim(),
              item: {
                sku: matchingItem.sku || cleanId,
                name: matchingItem.name,
                quantity: matchingItem.quantity,
                value: matchingItem.value,
                pieceId: matchingItem.piece_id
              },
              orderReference: shipment.payment_data?.reference_code || shipment.code
            }
          };
        }
      }

      return {
        query: cleanId,
        found: false,
        resourceType: 'not_found',
        message: `Resource '${cleanId}' was not found as a product, shipment, or order on Sendbox.`
      };
    } catch (err) {
      return {
        query: cleanId,
        found: false,
        resourceType: 'error',
        error: this.formatError(err, '/shipping/shipments', 'GET')
      };
    }
  }
}

module.exports = new RealSendboxService();

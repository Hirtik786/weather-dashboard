const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateUser } = require('../middleware/authMiddleware');

// All product routes strictly enforce authentication and ownership
router.get('/', authenticateUser, productController.list);
router.get('/:id', authenticateUser, productController.getById);
router.post('/', authenticateUser, productController.create);
router.put('/:id', authenticateUser, productController.update);
router.delete('/:id', authenticateUser, productController.delete);
router.post('/:id/sync', authenticateUser, productController.retrySync);

module.exports = router;

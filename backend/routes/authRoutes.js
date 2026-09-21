const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const lwaController = require('../controllers/lwaController');
const { authenticateUser, optionalAuth } = require('../middleware/authMiddleware');

// Standard Email/Password Auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateUser, authController.me);
router.post('/logout', optionalAuth, authController.logout);

// Official Login with Amazon (LWA) OAuth 2.0
router.get('/amazon/login', lwaController.initiateLogin);
router.get('/amazon/callback', (req, res) => lwaController.handleCallback(req, res));
router.get('/amazon/status', optionalAuth, (req, res) => lwaController.getStatus(req, res));
router.post('/amazon/disconnect', optionalAuth, (req, res) => lwaController.disconnect(req, res));

module.exports = router;

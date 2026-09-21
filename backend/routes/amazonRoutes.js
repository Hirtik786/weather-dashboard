const express = require('express');
const router = express.Router();
const lwaController = require('../controllers/lwaController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Amazon authentication status & actions
router.get('/status', optionalAuth, (req, res) => lwaController.getStatus(req, res));
router.get('/login', (req, res) => lwaController.initiateLogin(req, res));
router.post('/connect', (req, res) => lwaController.initiateLogin(req, res));
router.post('/disconnect', optionalAuth, (req, res) => lwaController.disconnect(req, res));

module.exports = router;

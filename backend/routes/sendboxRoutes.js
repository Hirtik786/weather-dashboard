const express = require('express');
const router = express.Router();
const sendboxController = require('../controllers/sendboxController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/status', authenticateUser, sendboxController.getStatus);
router.get('/verify/:identifier', authenticateUser, sendboxController.verifyResource);

module.exports = router;

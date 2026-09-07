const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

// Cities metadata
router.get('/cities', weatherController.getCities);

// Latest weather (strictly from Redis)
router.get('/latest', weatherController.getLatestWeather);

// Fetch fresh weather from Open-Meteo & save to Redis
router.post('/fetch', weatherController.fetchFreshWeather);

// Historical reports from Redis
router.get('/reports', weatherController.getReports);

// Individual historical report by timestamp from Redis
router.get('/report/:timestamp', weatherController.getReportByTimestamp);

module.exports = router;

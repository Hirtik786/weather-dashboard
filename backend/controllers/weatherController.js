const cities = require('../data/cities');
const weatherService = require('../services/weatherService');
const redisService = require('../services/redisService');
const { isRedisConnected } = require('../config/redis');

/**
 * Health check endpoint
 * GET /api/health
 */
async function healthCheck(req, res) {
  const redisStatus = isRedisConnected() ? 'connected' : 'disconnected';

  res.status(200).json({
    success: true,
    message: 'Weather API is running',
    redis: redisStatus
  });
}

/**
 * Get all 20 configured cities
 * GET /api/weather/cities
 */
async function getCities(req, res) {
  res.status(200).json({
    success: true,
    count: cities.length,
    cities
  });
}

/**
 * Get latest weather strictly from Redis
 * GET /api/weather/latest
 */
async function getLatestWeather(req, res, next) {
  try {
    const latest = await redisService.getLatestWeather();

    if (!latest) {
      return res.status(200).json({
        success: false,
        message: 'No weather data available. Please fetch weather data first.'
      });
    }

    res.status(200).json({
      success: true,
      count: latest.count,
      fetchedAt: latest.fetchedAt,
      timestamp: latest.timestamp,
      summary: latest.summary,
      data: latest.data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Fetch fresh weather for all 20 cities concurrently from Open-Meteo,
 * store latest in Redis, save historical report in Redis, and return fresh data.
 * POST /api/weather/fetch
 */
async function fetchFreshWeather(req, res, next) {
  try {
    // 1. Fetch concurrent data from Open-Meteo
    const weatherResult = await weatherService.fetchAllCitiesWeather();

    // 2. Persist latest weather for each city in Redis
    await redisService.saveLatestWeather(weatherResult);

    // 3. Persist new historical report in Redis
    await redisService.saveHistoricalReport(weatherResult);

    // 4. Return fresh data to frontend
    res.status(200).json({
      success: true,
      count: weatherResult.count,
      fetchedAt: weatherResult.fetchedAt,
      timestamp: weatherResult.timestamp,
      summary: weatherResult.summary,
      data: weatherResult.data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get list of historical reports from Redis
 * GET /api/weather/reports
 */
async function getReports(req, res, next) {
  try {
    const reports = await redisService.getHistoricalReports();

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get a specific historical report by timestamp from Redis
 * GET /api/weather/report/:timestamp
 */
async function getReportByTimestamp(req, res, next) {
  try {
    const { timestamp } = req.params;

    // Validate timestamp parameter
    if (!timestamp || isNaN(Number(timestamp))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report timestamp parameter'
      });
    }

    const report = await redisService.getHistoricalReportByTimestamp(timestamp);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Report for timestamp ${timestamp} not found`
      });
    }

    res.status(200).json({
      success: true,
      report
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  healthCheck,
  getCities,
  getLatestWeather,
  fetchFreshWeather,
  getReports,
  getReportByTimestamp
};

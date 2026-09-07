const { getRedisClient, isRedisConnected } = require('../config/redis');
const cities = require('../data/cities');

const REPORTS_LIST_KEY = 'weather:reports';
const MAX_REPORTS = 50;

/**
 * Ensures Redis is connected before performing an operation.
 */
function ensureConnected() {
  const client = getRedisClient();
  if (!client || !client.isOpen) {
    const error = new Error('Redis database is not connected');
    error.statusCode = 503;
    throw error;
  }
  return client;
}

/**
 * Saves the latest weather data for all cities into Redis.
 * Uses keys: weather:latest:<slug>
 */
async function saveLatestWeather(weatherResult) {
  const client = ensureConnected();
  const { data, fetchedAt, timestamp, summary } = weatherResult;

  const pipeline = client.multi();

  for (const cityWeather of data) {
    const key = `weather:latest:${cityWeather.slug}`;
    pipeline.set(key, JSON.stringify(cityWeather));
  }

  // Save metadata for the latest snapshot
  pipeline.set(
    'weather:latest:meta',
    JSON.stringify({
      count: data.length,
      fetchedAt,
      timestamp,
      summary
    })
  );

  await pipeline.exec();
}

/**
 * Reads the latest weather for all cities directly from Redis.
 * Returns null if no data has been fetched yet.
 */
async function getLatestWeather() {
  const client = ensureConnected();

  const metaRaw = await client.get('weather:latest:meta');
  if (!metaRaw) {
    return null;
  }

  const meta = JSON.parse(metaRaw);
  const cityKeys = cities.map((c) => `weather:latest:${c.slug}`);
  const cityValues = await client.mGet(cityKeys);

  const cityList = [];
  for (let i = 0; i < cityValues.length; i++) {
    const val = cityValues[i];
    if (val) {
      try {
        cityList.push(JSON.parse(val));
      } catch (err) {
        console.error('Error parsing city JSON from Redis:', err);
      }
    } else {
      // If a single city wasn't found in latest cache, fill placeholder with static city info
      cityList.push({
        id: cities[i].id,
        city: cities[i].name,
        state: cities[i].state,
        stateCode: cities[i].stateCode,
        slug: cities[i].slug,
        latitude: cities[i].latitude,
        longitude: cities[i].longitude,
        success: false,
        error: 'No cached data'
      });
    }
  }

  return {
    count: cityList.length,
    fetchedAt: meta.fetchedAt,
    timestamp: meta.timestamp,
    summary: meta.summary,
    data: cityList
  };
}

/**
 * Saves a new historical report in Redis and maintains the latest 50 reports list.
 */
async function saveHistoricalReport(weatherResult) {
  const client = ensureConnected();
  const { timestamp, fetchedAt, data, summary } = weatherResult;

  const reportKey = `weather:report:${timestamp}`;
  const reportPayload = {
    timestamp,
    fetchedAt,
    cityCount: data.length,
    status: data.every((c) => c.success) ? 'Complete' : 'Partial',
    summary,
    cities: data
  };

  // 1. Save the full report data
  await client.set(reportKey, JSON.stringify(reportPayload));

  // 2. Add timestamp to reports list
  await client.lPush(REPORTS_LIST_KEY, timestamp.toString());

  // 3. Keep only the latest 50 reports in the list
  const excessTimestamps = await client.lRange(REPORTS_LIST_KEY, MAX_REPORTS, -1);
  if (excessTimestamps && excessTimestamps.length > 0) {
    for (const oldTs of excessTimestamps) {
      await client.del(`weather:report:${oldTs}`);
    }
    await client.lTrim(REPORTS_LIST_KEY, 0, MAX_REPORTS - 1);
  }

  return reportPayload;
}

/**
 * Retrieves the list of historical report headers from Redis.
 */
async function getHistoricalReports() {
  const client = ensureConnected();

  const timestamps = await client.lRange(REPORTS_LIST_KEY, 0, MAX_REPORTS - 1);
  if (!timestamps || timestamps.length === 0) {
    return [];
  }

  const reportKeys = timestamps.map((ts) => `weather:report:${ts}`);
  const rawReports = await client.mGet(reportKeys);

  const reports = [];
  for (let i = 0; i < rawReports.length; i++) {
    const raw = rawReports[i];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        reports.push({
          timestamp: parsed.timestamp,
          fetchedAt: parsed.fetchedAt,
          cityCount: parsed.cityCount,
          status: parsed.status,
          summary: parsed.summary
        });
      } catch (e) {
        console.error('Error parsing report JSON:', e);
      }
    }
  }

  return reports;
}

/**
 * Retrieves a single complete historical report by timestamp from Redis.
 */
async function getHistoricalReportByTimestamp(timestamp) {
  const client = ensureConnected();
  const key = `weather:report:${timestamp}`;
  const raw = await client.get(key);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

module.exports = {
  ensureConnected,
  saveLatestWeather,
  getLatestWeather,
  saveHistoricalReport,
  getHistoricalReports,
  getHistoricalReportByTimestamp
};

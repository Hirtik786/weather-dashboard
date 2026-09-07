/**
 * Weather Dashboard API Client
 * Connects frontend to Express backend endpoints.
 */
const API_BASE =
  window.location.hostname === 'localhost' && window.location.port === '5000'
    ? '/api'
    : 'http://localhost:5000/api';

const WeatherAPI = {
  /**
   * Health check for API and Redis connection
   */
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message, redis: 'disconnected' };
    }
  },

  /**
   * Fetch configured 20 cities metadata
   */
  async getCities() {
    const res = await fetch(`${API_BASE}/weather/cities`);
    if (!res.ok) throw new Error('Failed to retrieve cities list');
    return await res.json();
  },

  /**
   * Fetch latest weather cached in Redis (does NOT call Open-Meteo)
   */
  async getLatestWeather() {
    const res = await fetch(`${API_BASE}/weather/latest`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch latest weather from Redis');
    }
    return await res.json();
  },

  /**
   * Trigger fresh weather fetch from Open-Meteo and store in Redis
   */
  async fetchFreshWeather() {
    const res = await fetch(`${API_BASE}/weather/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch fresh weather data');
    }
    return await res.json();
  },

  /**
   * Fetch historical reports list from Redis
   */
  async getReports() {
    const res = await fetch(`${API_BASE}/weather/reports`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to load historical reports');
    }
    return await res.json();
  },

  /**
   * Fetch full report details by timestamp from Redis
   */
  async getReport(timestamp) {
    const res = await fetch(`${API_BASE}/weather/report/${timestamp}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to load report ${timestamp}`);
    }
    return await res.json();
  }
};

// Export to window
window.WeatherAPI = WeatherAPI;

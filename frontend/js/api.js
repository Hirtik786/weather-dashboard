/**
 * Weather & E-Commerce Dashboard Unified API Client
 * Connects frontend to Express backend endpoints.
 */

const API_BASE =
  window.location.hostname === 'localhost' && window.location.port === '5000'
    ? '/api'
    : 'http://localhost:5000/api';

const TOKEN_STORAGE_KEY = 'weather_dashboard_auth_token';

const AuthStorage = {
  getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },
  removeToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
};

// ==========================================
// 1. Existing Weather API Client (Preserved)
// ==========================================
const WeatherAPI = {
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message, redis: 'disconnected' };
    }
  },

  async getCities() {
    const res = await fetch(`${API_BASE}/weather/cities`);
    if (!res.ok) throw new Error('Failed to retrieve cities list');
    return await res.json();
  },

  async getLatestWeather() {
    const res = await fetch(`${API_BASE}/weather/latest`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch latest weather from Redis');
    }
    return await res.json();
  },

  async fetchFreshWeather() {
    const res = await fetch(`${API_BASE}/weather/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch fresh weather data');
    }
    return await res.json();
  },

  async getReports() {
    const res = await fetch(`${API_BASE}/weather/reports`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to load historical reports');
    }
    return await res.json();
  },

  async getReport(timestamp) {
    const res = await fetch(`${API_BASE}/weather/report/${timestamp}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to load report ${timestamp}`);
    }
    return await res.json();
  }
};

// ==========================================
// 2. Authentication API Client
// ==========================================
const AuthAPI = {
  async register(email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    if (data.token) AuthStorage.setToken(data.token);
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    if (data.token) AuthStorage.setToken(data.token);
    return data;
  },

  async getMe() {
    const token = AuthStorage.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: AuthStorage.getHeaders()
      });
      if (!res.ok) {
        AuthStorage.removeToken();
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: AuthStorage.getHeaders()
      });
    } finally {
      AuthStorage.removeToken();
    }
    return { success: true };
  }
};

// ==========================================
// 3. Amazon Integration API Client
// ==========================================
const AmazonAPI = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/amazon/status`, {
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve Amazon status');
    return data;
  },

  async connect() {
    const res = await fetch(`${API_BASE}/amazon/connect`, {
      method: 'POST',
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to initiate Amazon connection');
    return data;
  },

  async callback(authPayload) {
    const res = await fetch(`${API_BASE}/amazon/callback`, {
      method: 'POST',
      headers: AuthStorage.getHeaders(),
      body: JSON.stringify(authPayload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to complete Amazon authorization');
    return data;
  },

  async disconnect() {
    const res = await fetch(`${API_BASE}/amazon/disconnect`, {
      method: 'POST',
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to disconnect Amazon account');
    return data;
  },

  async setSimulation(mode) {
    const res = await fetch(`${API_BASE}/amazon/simulation`, {
      method: 'POST',
      headers: AuthStorage.getHeaders(),
      body: JSON.stringify({ mode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update simulation mode');
    return data;
  }
};

// ==========================================
// 4. Sendbox Integration API Client
// ==========================================
const SendboxAPI = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/sendbox/status`, {
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve Sendbox status');
    return data;
  },

  async verify(identifier) {
    const res = await fetch(`${API_BASE}/sendbox/verify/${encodeURIComponent(identifier)}`, {
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Failed to verify resource '${identifier}'`);
    return data;
  }
};

// ==========================================
// 5. Products Management API Client
// ==========================================
const ProductsAPI = {
  async list({ search = '', status = 'All' } = {}) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'All') params.set('status', status);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/products${query}`, {
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load products');
    return data;
  },

  async get(id) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve product details');
    return data.product;
  },

  async create(product) {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: AuthStorage.getHeaders(),
      body: JSON.stringify(product)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create product');
    return data;
  },

  async update(id, updates) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: AuthStorage.getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update product');
    return data;
  },

  async delete(id) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete product');
    return data;
  },

  async sync(id) {
    const res = await fetch(`${API_BASE}/products/${id}/sync`, {
      method: 'POST',
      headers: AuthStorage.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to synchronize product');
    return data;
  }
};

// Export to window
window.AuthStorage = AuthStorage;
window.WeatherAPI = WeatherAPI;
window.AuthAPI = AuthAPI;
window.AmazonAPI = AmazonAPI;
window.SendboxAPI = SendboxAPI;
window.ProductsAPI = ProductsAPI;

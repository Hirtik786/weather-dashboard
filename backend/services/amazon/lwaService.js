const axios = require('axios');
const logger = require('../../utils/logger');

/**
 * Official Login with Amazon (LWA) OAuth 2.0 Service
 * Implements customer sign-in without requiring Amazon Seller Central or SP-API.
 */
class LoginWithAmazonService {
  constructor() {
    this.authBaseUrl = 'https://www.amazon.com/ap/oa';
    this.tokenUrl = 'https://api.amazon.com/auth/o2/token';
    this.profileUrl = 'https://api.amazon.com/user/profile';
  }

  getClientId() {
    return process.env.LWA_CLIENT_ID || '';
  }

  getClientSecret() {
    return process.env.LWA_CLIENT_SECRET || '';
  }

  getRedirectUri() {
    return process.env.LWA_REDIRECT_URI || 'http://localhost:5000/api/auth/amazon/callback';
  }

  isConfigured() {
    return Boolean(this.getClientId() && this.getClientSecret());
  }

  /**
   * Generates official LWA OAuth 2.0 authorization URL.
   * @param {string} state - Cryptographic CSRF state token
   */
  getAuthorizationUrl(state) {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri();

    if (!this.isConfigured()) {
      return {
        configured: false,
        authUrl: null,
        message: 'Login with Amazon credentials (LWA_CLIENT_ID, LWA_CLIENT_SECRET) are not configured.'
      };
    }

    const scope = process.env.LWA_SCOPE || 'profile:user_id';

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scope,
      response_type: 'code',
      redirect_uri: redirectUri,
      state
    });

    return {
      configured: true,
      authUrl: `${this.authBaseUrl}?${params.toString()}`,
      redirectUri
    };
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   * @param {string} code - Authorization code received in callback
   */
  async exchangeCodeForTokens(code) {
    if (!this.isConfigured()) {
      throw new Error('LWA_CLIENT_ID or LWA_CLIENT_SECRET is missing in environment variables.');
    }

    logger.info('Exchanging authorization code with Login with Amazon OAuth 2.0');

    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.getClientId(),
          client_secret: this.getClientSecret(),
          redirect_uri: this.getRedirectUri()
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in
      };
    } catch (err) {
      const errDetail = err.response?.data?.error_description || err.response?.data?.error || err.message;
      logger.error('Login with Amazon token exchange failed', { error: errDetail });
      throw new Error(`Amazon token exchange failed: ${errDetail}`);
    }
  }

  /**
   * Fetches customer profile using access token.
   * Scope: profile -> user_id, name, email
   * @param {string} accessToken
   */
  async getAmazonProfile(accessToken) {
    if (!accessToken) {
      throw new Error('Access token is required to fetch Amazon profile');
    }

    try {
      const response = await axios.get(this.profileUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const { user_id, name, email } = response.data;
      return {
        amazonUserId: user_id,
        name: name || 'Amazon Customer',
        email: email || null
      };
    } catch (err) {
      const errDetail = err.response?.data?.error_description || err.response?.data?.error || err.message;
      logger.error('Login with Amazon profile retrieval failed', { error: errDetail });
      throw new Error(`Failed to retrieve Amazon profile: ${errDetail}`);
    }
  }
}

module.exports = new LoginWithAmazonService();

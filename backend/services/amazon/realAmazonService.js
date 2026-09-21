const axios = require('axios');
const AmazonServiceInterface = require('./amazonInterface');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');

/**
 * Real Amazon Selling Partner API Service Implementation
 * Built according to the official Amazon SP-API and Login with Amazon (LWA) specifications.
 * Active when AMAZON_MODE=real.
 */
class RealAmazonService extends AmazonServiceInterface {
  constructor() {
    super();
    this.clientId = process.env.AMAZON_CLIENT_ID;
    this.clientSecret = process.env.AMAZON_CLIENT_SECRET;
    this.redirectUri = process.env.AMAZON_REDIRECT_URI || 'http://localhost:5000/api/amazon/callback';
    this.appId = process.env.AMAZON_APP_ID;
    this.region = process.env.AMAZON_REGION || 'na';
    this.lwaAuthUrl = 'https://api.amazon.com/auth/o2/token';

    // Regional SP-API endpoints
    this.spApiEndpoints = {
      na: 'https://sellingpartnerapi-na.amazon.com',
      eu: 'https://sellingpartnerapi-eu.amazon.com',
      fe: 'https://sellingpartnerapi-fe.amazon.com'
    };
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.appId);
  }

  getEndpoint() {
    return this.spApiEndpoints[this.region] || this.spApiEndpoints.na;
  }

  async getAuthUrl(state, options = {}) {
    if (!this.appId) {
      throw new Error(
        'Amazon SP-API is not configured. Missing AMAZON_APP_ID in environment variables.'
      );
    }

    const consentBase = 'https://sellercentral.amazon.com/apps/authorize/consent';
    const authUrl = `${consentBase}?application_id=${encodeURIComponent(this.appId)}&state=${encodeURIComponent(state)}&version=beta`;

    return {
      authUrl,
      mode: 'real',
      provider: 'Amazon Seller Central'
    };
  }

  async exchangeAuthCode(code, options = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        'Cannot exchange real Amazon authorization code: AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET are not configured in .env'
      );
    }

    logger.info('Exchanging SP-API authorization code with Login with Amazon (LWA)');

    try {
      const response = await axios.post(
        this.lwaAuthUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }
        }
      );

      const { refresh_token, access_token, expires_in } = response.data;
      const sellerId = options.sellingPartnerId || options.sellerId;

      return {
        sellerId,
        marketplaceId: options.marketplaceId || 'ATVPDKIKX0DER',
        region: this.region,
        mode: 'real',
        status: 'CONNECTED',
        refreshToken: refresh_token,
        accessToken: access_token,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000).toISOString()
      };
    } catch (err) {
      logger.error('LWA token exchange failed', err.response?.data || err.message);
      throw new Error(`Amazon authorization exchange failed: ${err.response?.data?.error_description || err.message}`);
    }
  }

  async refreshAccessToken(connection) {
    if (!this.isConfigured()) {
      throw new Error('SP-API credentials are not configured');
    }

    const decryptedRefreshToken = decrypt(connection.refresh_token_encrypted);
    if (!decryptedRefreshToken) {
      throw new Error('Unable to decrypt Amazon refresh token');
    }

    try {
      const response = await axios.post(
        this.lwaAuthUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: decryptedRefreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }
        }
      );

      return response.data.access_token;
    } catch (err) {
      logger.error('Failed to refresh SP-API access token', err.response?.data || err.message);
      throw new Error('Failed to obtain SP-API access token');
    }
  }

  async createListing(connection, product) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Real Amazon integration selected, but credentials (AMAZON_CLIENT_ID, etc.) are not configured in .env'
      };
    }

    try {
      const accessToken = await this.refreshAccessToken(connection);
      const endpoint = this.getEndpoint();
      const sellerId = connection.seller_id;
      const marketplaceId = connection.marketplace_id;

      // Listings Items API: PUT /listings/2021-08-01/items/{sellerId}/{sku}
      const url = `${endpoint}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(product.sku)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;

      const body = {
        productType: 'PRODUCT',
        requirements: 'LISTING',
        attributes: {
          item_name: [{ value: product.title, marketplace_id: marketplaceId }],
          purchasable_offer: [
            {
              currency: 'USD',
              our_price: [{ schedule: [{ value_with_tax: product.price }] }],
              marketplace_id: marketplaceId
            }
          ]
        }
      };

      const response = await axios.put(url, body, {
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        listingId: response.data.submissionId || product.sku,
        sku: product.sku,
        status: response.data.status || 'LISTED',
        syncedAt: new Date().toISOString()
      };
    } catch (err) {
      logger.error('Amazon Listings Items API error', err.response?.data || err.message);
      return {
        success: false,
        error: `Amazon SP-API Error: ${err.response?.data?.errors?.[0]?.message || err.message}`
      };
    }
  }

  async updateListing(connection, listingId, updates) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Real Amazon integration credentials are not configured in .env'
      };
    }

    try {
      const accessToken = await this.refreshAccessToken(connection);
      const endpoint = this.getEndpoint();
      const sellerId = connection.seller_id;
      const marketplaceId = connection.marketplace_id;

      const url = `${endpoint}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(listingId)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;

      const patches = [];
      if (updates.price !== undefined) {
        patches.push({
          op: 'replace',
          path: '/attributes/purchasable_offer/0/our_price/0/schedule/0/value_with_tax',
          value: [updates.price]
        });
      }

      await axios.patch(url, { patches }, {
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, listingId, status: 'LISTED' };
    } catch (err) {
      return {
        success: false,
        error: `Amazon update failed: ${err.response?.data?.errors?.[0]?.message || err.message}`
      };
    }
  }

  async deleteListing(connection, listingId) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Real Amazon integration credentials are not configured in .env'
      };
    }

    try {
      const accessToken = await this.refreshAccessToken(connection);
      const endpoint = this.getEndpoint();
      const sellerId = connection.seller_id;
      const marketplaceId = connection.marketplace_id;

      const url = `${endpoint}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(listingId)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;

      await axios.delete(url, {
        headers: { 'x-amz-access-token': accessToken }
      });

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Amazon deactivation failed: ${err.response?.data?.errors?.[0]?.message || err.message}`
      };
    }
  }

  async getListing(connection, listingId) {
    return { listingId, status: 'UNKNOWN' };
  }
}

module.exports = new RealAmazonService();

/**
 * Amazon Selling Partner API (SP-API) Service Interface
 * Defines the contract that both mockAmazonService and realAmazonService must fulfill.
 */

class AmazonServiceInterface {
  /**
   * Generates the OAuth consent URL.
   * @param {string} state - Cryptographic state to prevent CSRF
   * @param {object} options - Optional parameters
   * @returns {Promise<{ authUrl: string, mode: string }>}
   */
  async getAuthUrl(state, options = {}) {
    throw new Error('Method getAuthUrl() must be implemented');
  }

  /**
   * Exchanges an authorization code for credentials.
   * @param {string} code - OAuth code
   * @param {object} options - Contextual options
   * @returns {Promise<{ sellerId: string, marketplaceId: string, refreshToken?: string, accessToken?: string, mode: string }>}
   */
  async exchangeAuthCode(code, options = {}) {
    throw new Error('Method exchangeAuthCode() must be implemented');
  }

  /**
   * Creates a product listing on Amazon.
   * @param {object} connection - User's Amazon connection record
   * @param {object} product - Product to list
   * @returns {Promise<{ success: boolean, listingId: string, sku: string, asin: string, status: string, error?: string }>}
   */
  async createListing(connection, product) {
    throw new Error('Method createListing() must be implemented');
  }

  /**
   * Updates an existing Amazon product listing.
   * @param {object} connection - User's Amazon connection record
   * @param {string} listingId - Amazon Listing ID
   * @param {object} updates - Attributes to update
   * @returns {Promise<{ success: boolean, listingId: string, status: string, error?: string }>}
   */
  async updateListing(connection, listingId, updates) {
    throw new Error('Method updateListing() must be implemented');
  }

  /**
   * Deactivates or deletes an Amazon product listing.
   * @param {object} connection - User's Amazon connection record
   * @param {string} listingId - Amazon Listing ID
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async deleteListing(connection, listingId) {
    throw new Error('Method deleteListing() must be implemented');
  }

  /**
   * Retrieves status and details of an Amazon listing.
   * @param {object} connection - User's Amazon connection record
   * @param {string} listingId - Amazon Listing ID
   * @returns {Promise<object>}
   */
  async getListing(connection, listingId) {
    throw new Error('Method getListing() must be implemented');
  }
}

module.exports = AmazonServiceInterface;

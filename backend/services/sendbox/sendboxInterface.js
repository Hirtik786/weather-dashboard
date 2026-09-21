/**
 * Sendbox Service Interface
 * Formal contract boundary for Sendbox integration.
 */

class SendboxServiceInterface {
  /**
   * Creates or registers a product in Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {object} product - Product details
   * @returns {Promise<{ success: boolean, sendboxProductId: string, status: string, error?: string }>}
   */
  async createProduct(userId, product) {
    throw new Error('Method createProduct() must be implemented');
  }

  /**
   * Updates an existing product in Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {string} sendboxProductId - Sendbox product identifier
   * @param {object} updates - Updates
   * @returns {Promise<{ success: boolean, sendboxProductId: string, status: string, error?: string }>}
   */
  async updateProduct(userId, sendboxProductId, updates) {
    throw new Error('Method updateProduct() must be implemented');
  }

  /**
   * Deactivates or removes a product from Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {string} sendboxProductId - Sendbox product identifier
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async deleteProduct(userId, sendboxProductId) {
    throw new Error('Method deleteProduct() must be implemented');
  }

  /**
   * Gets Sendbox integration and connection status.
   * @param {string} userId - Authenticated user ID
   * @returns {Promise<object>}
   */
  async getStatus(userId) {
    throw new Error('Method getStatus() must be implemented');
  }
}

module.exports = SendboxServiceInterface;

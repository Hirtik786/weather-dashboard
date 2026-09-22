/**
 * Sendbox Service Interface
 * Formal contract boundary for Sendbox integration.
 */

class SendboxServiceInterface {
  /**
   * Synchronizes product fulfillment / registers shipment on Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {object} product - Product details
   * @returns {Promise<{ success: boolean, sendboxShipmentId?: string, sendboxOrderId?: string, sendboxProductId?: string|null, status: string, error?: string, details?: object }>}
   */
  async createProduct(userId, product) {
    throw new Error('Method createProduct() must be implemented');
  }

  /**
   * Updates an existing product/shipment in Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {string} sendboxIdentifier - Sendbox shipment or product identifier
   * @param {object} updates - Updates
   * @returns {Promise<{ success: boolean, sendboxShipmentId?: string, sendboxProductId?: string|null, status?: string, error?: string }>}
   */
  async updateProduct(userId, sendboxIdentifier, updates) {
    throw new Error('Method updateProduct() must be implemented');
  }

  /**
   * Cancels or deactivates a shipment/product on Sendbox.
   * @param {string} userId - Authenticated user ID
   * @param {string} sendboxIdentifier - Sendbox shipment or product identifier
   * @returns {Promise<{ success: boolean, sendboxShipmentId?: string, status?: string, error?: string }>}
   */
  async deleteProduct(userId, sendboxIdentifier) {
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

  /**
   * Verifies whether a resource (SKU, shipment code, ID, or order) exists on Sendbox.
   * @param {string} identifier - SKU, shipment code, or ID to verify
   * @returns {Promise<{ query: string, found: boolean, resourceType: string, details?: object, error?: string }>}
   */
  async verifyResource(identifier) {
    throw new Error('Method verifyResource() must be implemented');
  }
}

module.exports = SendboxServiceInterface;

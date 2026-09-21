const sendboxService = require('../services/sendbox/sendboxService');

const sendboxController = {
  async getStatus(req, res) {
    try {
      const userId = req.user.id;
      const status = await sendboxService.getStatus(userId);
      return res.json({
        success: true,
        ...status
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Sendbox status'
      });
    }
  }
};

module.exports = sendboxController;

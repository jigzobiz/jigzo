const express = require('express');
const router = express.Router();

/**
 * GET /api/features/status
 * Exposes runtime feature status flags to the frontend securely.
 */
router.get('/status', (req, res) => {
  res.json({
    checkoutEnabled: process.env.CHECKOUT_ENABLED === 'true',
    whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
    // Authenticated staging owners discover test creation through /api/test/status.
    testRevealEnabled: false
  });
});

module.exports = router;

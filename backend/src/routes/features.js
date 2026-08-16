const express = require('express');
const router = express.Router();
const { isTestModeAllowed } = require('../utils/testModeGuard');

/**
 * GET /api/features/status
 * Exposes runtime feature status flags to the frontend securely.
 */
router.get('/status', (req, res) => {
  res.json({
    checkoutEnabled: process.env.CHECKOUT_ENABLED === 'true',
    whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
    // Visibility is safe to expose; creation remains owner-authenticated and
    // CSRF-protected on /api/test/reveals.
    testRevealEnabled: isTestModeAllowed(req)
  });
});

module.exports = router;

const express = require('express');
const crypto = require('crypto');
const { reconcileStaleAccepted } = require('../../services/whatsappReconciliationService');

const router = express.Router();

function safeTokenEqual(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return receivedBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

router.get('/', async (req, res, next) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = req.headers.authorization || '';
    if (!cronSecret || !safeTokenEqual(authorization, `Bearer ${cronSecret}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const results = await reconcileStaleAccepted({ limit: 50 });
    const summary = results.reduce((acc, result) => {
      const key = result.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      checked: results.length,
      summary
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

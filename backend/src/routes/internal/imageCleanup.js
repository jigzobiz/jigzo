const express = require('express');
const crypto = require('crypto');
const { runImageCleanup } = require('../../utils/cleanup');

const router = express.Router();

// Mirrors the CRON_SECRET mechanism used by the WhatsApp reconciliation
// route: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
function safeTokenEqual(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return receivedBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

router.get('/', async (req, res, next) => {
  try {
    // Authenticate BEFORE any database work.
    const cronSecret = process.env.CRON_SECRET;
    const authorization = req.headers.authorization || '';
    if (!cronSecret || !safeTokenEqual(authorization, `Bearer ${cronSecret}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const summary = await runImageCleanup();

    // Safe aggregate counts only — never identifiers or customer data.
    return res.json({
      success: true,
      scanned: summary.scanned,
      deleted: summary.deleted,
      alreadyMissing: summary.alreadyMissing,
      failed: summary.failed,
      remaining: summary.remaining
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

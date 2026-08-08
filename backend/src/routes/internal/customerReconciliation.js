const express = require('express');
const crypto = require('crypto');
const { runCustomerReconciliationAudit } = require('../../services/customerReconciliationAudit');

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
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    if (process.env.VERCEL_ENV !== 'production') return res.status(404).json({ error: 'Not found' });
    const secret = process.env.CUSTOMER_RECONCILIATION_SECRET;
    if (!secret || !safeTokenEqual(req.headers.authorization, `Bearer ${secret}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json(await runCustomerReconciliationAudit());
  } catch (error) {
    next(error);
  }
});

module.exports = router;

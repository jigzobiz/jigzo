const express = require('express');
const crypto = require('crypto');
const { runCustomerReconciliationAudit } = require('../../services/customerReconciliationAudit');
const {
  dryRunCustomerReconciliation,
  applyCustomerReconciliation
} = require('../../services/customerHistoricalReconciliation');

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

router.get('/dry-run', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    if (process.env.VERCEL_ENV !== 'production') return res.status(404).json({ error: 'Not found' });
    const secret = process.env.CUSTOMER_RECONCILIATION_SECRET;
    if (!secret || !safeTokenEqual(req.headers.authorization, `Bearer ${secret}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json(await dryRunCustomerReconciliation());
  } catch (error) {
    next(error);
  }
});

router.post('/apply', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    if (process.env.VERCEL_ENV !== 'production') return res.status(404).json({ error: 'Not found' });
    const secret = process.env.CUSTOMER_RECONCILIATION_SECRET;
    if (!secret || !safeTokenEqual(req.headers.authorization, `Bearer ${secret}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.body || req.body.confirm !== true) return res.status(400).json({ error: 'Confirmation required' });
    return res.json(await applyCustomerReconciliation());
  } catch (error) {
    if (error && error.code === 'RECONCILIATION_BLOCKED') {
      return res.status(409).json({ error: 'Reconciliation blocked', ...error.counts });
    }
    next(error);
  }
});

module.exports = router;

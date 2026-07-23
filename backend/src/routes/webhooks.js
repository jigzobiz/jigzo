const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const paymentService = require('../services/paymentService');
const { markOrderAndPuzzlePaid } = require('../services/paymentCompletion');

/**
 * POST /api/webhooks/payment
 * Processes webhook messages from Tap payment gateway.
 */
router.post('/payment', async (req, res, next) => {
  try {
    const signature = req.headers['hashstring'];

    // Tap Webhook verification
    if (!signature) {
      return res.status(401).json({ error: 'Missing hashstring signature.' });
    }

    const rawBody = req.body;
    const isValid = paymentService.verifyWebhook(rawBody, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const { id: chargeId, amount, currency, reference, live_mode, status } = rawBody;

    if (!chargeId || !reference || !reference.order) {
      return res.status(400).json({ error: 'Invalid webhook payload structure.' });
    }

    const orderId = reference.order;

    // Find the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Verify charge details match order
    const amountMatch = Number(amount) === Number(order.total);
    const currencyMatch = currency && currency.toUpperCase() === order.currency.toUpperCase();
    
    let expectedLiveMode;
    try {
      expectedLiveMode = paymentService.getExpectedLiveMode();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'System configuration error.' });
    }
    const liveModeMatch = live_mode === expectedLiveMode;
    const isKnownCharge = order.providerChargeId === chargeId ||
      order.paymentAttempts.some(att => att.providerChargeId === chargeId);

    if (!amountMatch || !currencyMatch || !liveModeMatch || !isKnownCharge) {
      return res.status(400).json({ error: 'Webhook payload verification mismatch.' });
    }

    // Find and update current payment attempt status
    const attempt = order.paymentAttempts.find(att => att.providerChargeId === chargeId);
    if (attempt) {
      attempt.providerStatus = status;
      attempt.updatedAt = new Date();
    }
    order.providerStatus = status;

    if (status === 'CAPTURED') {
      await markOrderAndPuzzlePaid(order, chargeId, reference.transaction);
      res.json({ success: true, message: 'Webhook processed, order marked paid.' });
    } else if (['INITIATED', 'PENDING', 'IN_PROGRESS'].includes(status)) {
      order.paymentStatus = 'pending';
      await order.save();
      res.json({ success: true, message: 'Webhook processed, order remains pending.' });
    } else {
      order.paymentStatus = 'failed';
      order.failedAt = new Date();
      order.lastPaymentError = (rawBody.response && rawBody.response.message) || `Tap status: ${status}`;
      if (attempt) {
        attempt.safeFailureCode = (rawBody.response && rawBody.response.code) || '';
        attempt.safeFailureMessage = (rawBody.response && rawBody.response.message) || '';
      }
      await order.save();
      res.json({ success: true, message: 'Webhook processed, order marked failed.' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

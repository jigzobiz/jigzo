const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');
const whatsappService = require('../services/whatsappService');

/**
 * POST /api/webhooks/payment
 * Processes mock webhook messages from payment gateway.
 */
router.post('/payment', async (req, res, next) => {
  try {
    const signature = req.headers['x-jigzo-signature'];
    const bodyString = JSON.stringify(req.body);

    // Verify webhook signature
    const isValid = paymentService.verifyWebhook(bodyString, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const { orderId, paymentStatus, paymentReference } = req.body;

    if (!orderId || paymentStatus !== 'success') {
      return res.status(400).json({ error: 'Invalid payload.' });
    }

    // Find and update the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    order.paymentStatus = 'paid';
    order.paymentReference = paymentReference || order.paymentReference;
    await order.save();

    // Find and update the associated puzzle
    const puzzle = await Puzzle.findOne({ publicId: order.puzzleId });
    if (puzzle) {
      puzzle.status = 'paid';
      
      // Update delivery statuses and send messages via WhatsApp Service
      for (let i = 0; i < puzzle.recipients.length; i++) {
        const rec = puzzle.recipients[i];
        rec.deliveryStatus = 'delivered';
        
        // Trigger simulated WhatsApp dispatch
        if (rec.phone) {
          // Pass the recipient phone and custom link param (publicId + r index)
          await whatsappService.sendPuzzle(
            `${rec.countryCode || ''}${rec.phone}`,
            `${puzzle.publicId}?r=${i}`,
            puzzle.senderName
          );
        }
      }
      
      puzzle.status = 'delivered';
      await puzzle.save();
    }

    res.json({ success: true, message: 'Webhook processed, puzzle delivery triggered.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

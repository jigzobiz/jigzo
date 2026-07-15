const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');
const whatsappService = require('../services/whatsappService');
const emailService = require('../services/emailService');

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
      if (puzzle.status === 'draft' || puzzle.status === 'pending_payment') {
        puzzle.status = 'paid';
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';

      // Deliver per recipient. Idempotent across webhook retries: a recipient
      // already marked delivered is skipped, and the email path also uses a
      // stable idempotency key so a retry never sends a duplicate message.
      for (let i = 0; i < puzzle.recipients.length; i++) {
        const rec = puzzle.recipients[i];

        // Skip recipients already handled so a retried webhook never re-sends.
        // Email recipients rest at 'sent' (Resend accepted), WhatsApp at 'delivered'.
        if (rec.deliveryStatus === 'delivered' || rec.deliveryStatus === 'sent') {
          continue;
        }

        // Legacy recipients without deliveryMethod are treated as WhatsApp.
        const method = rec.deliveryMethod === 'email' ? 'email' : 'whatsapp';
        const revealLink = `${frontendUrl}/p/${puzzle.publicId}?r=${i}`;

        if (method === 'email') {
          const result = await emailService.sendRevealEmail({
            to: rec.email,
            recipientName: rec.name,
            senderName: puzzle.revealIdentity ? puzzle.senderName : '',
            revealLink,
            idempotencyKey: `puzzle-reveal/${puzzle._id}/${i}`
          });

          if (result.success) {
            // Resend accepted the message. That confirms sent, not delivered;
            // actual delivery would require a provider delivery webhook (not in scope).
            rec.deliveryStatus = 'sent';
            rec.sentAt = new Date();
            rec.providerMessageId = result.providerMessageId || '';
            rec.lastError = '';
          } else {
            rec.deliveryStatus = 'failed';
            rec.lastError = result.error || 'Email delivery failed.';
          }
        } else if (whatsappEnabled) {
          // Only attempt automated WhatsApp dispatch when the flag is on.
          try {
            const wa = await whatsappService.sendPuzzle(
              rec.phoneE164 || `${rec.countryCode || ''}${rec.phone}`,
              `${puzzle.publicId}?r=${i}`,
              puzzle.senderName
            );

            if (wa && wa.status !== 'disabled') {
              rec.deliveryStatus = 'delivered';
              rec.sentAt = new Date();
              rec.lastError = '';
            } else {
              rec.deliveryStatus = 'pending';
              rec.lastError = 'Automated WhatsApp delivery is not enabled.';
            }
          } catch (waError) {
            rec.deliveryStatus = 'failed';
            rec.lastError = String(waError.message || 'WhatsApp delivery failed.').slice(0, 500);
          }
        } else {
          // WHATSAPP_ENABLED is false: never mark delivered. Keep it pending and
          // record an internal note so an admin can provide the link manually.
          rec.deliveryStatus = 'pending';
          rec.lastError = 'Automated WhatsApp delivery is not enabled.';
        }
      }

      // Derive puzzle status from recipient delivery outcomes.
      const total = puzzle.recipients.length;
      const deliveredCount = puzzle.recipients.filter(r => r.deliveryStatus === 'delivered').length;
      if (total > 0 && deliveredCount === total) {
        puzzle.status = 'delivered';
      } else if (deliveredCount > 0) {
        puzzle.status = 'partially_delivered';
      }

      await puzzle.save();
    }

    res.json({ success: true, message: 'Webhook processed, puzzle delivery triggered.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

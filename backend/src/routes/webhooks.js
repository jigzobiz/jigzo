const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');
const whatsappService = require('../services/whatsappService');
const emailService = require('../services/emailService');
const { getFrontendOrigin } = require('../utils/runtimeConfig');

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

      const frontendUrl = getFrontendOrigin();
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
        } else {
          if (process.env.WHATSAPP_ENABLED === 'true') {
            try {
              await whatsappService.claimAndSendPuzzleDelivery({
                puzzleId: puzzle.publicId,
                recipientIndex: i
              });
            } catch (waError) {
              console.error('[PaymentWebhook] WhatsApp delivery error:', waError.message);
            }
          }
        }
      }

      // Reload puzzle to integrate all database updates made by the delivery service
      const reloadedPuzzle = await Puzzle.findById(puzzle._id);
      const total = reloadedPuzzle.recipients.length;
      const deliveredCount = reloadedPuzzle.recipients.filter(rec => {
        const method = rec.deliveryMethod === 'email' ? 'email' : 'whatsapp';
        if (method === 'email') {
          return rec.deliveryStatus === 'sent' || rec.deliveryStatus === 'delivered';
        } else {
          return rec.whatsappSendStatus === 'delivered' || rec.whatsappSendStatus === 'read';
        }
      }).length;
      if (total > 0 && deliveredCount === total) {
        reloadedPuzzle.status = 'delivered';
      } else if (deliveredCount > 0) {
        reloadedPuzzle.status = 'partially_delivered';
      }

      await reloadedPuzzle.save();
    }

    res.json({ success: true, message: 'Webhook processed, puzzle delivery triggered.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

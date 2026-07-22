const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');
const { getFrontendOrigin } = require('../utils/runtimeConfig');

/**
 * Idempotently marks the order and associated puzzle as paid,
 * and handles recipient delivery triggers.
 */
async function markOrderAndPuzzlePaid(order, providerChargeId, transactionReference) {
  // 1. Mark Order Paid Idempotently
  if (order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.paidAt = new Date();
  }
  order.providerChargeId = providerChargeId || order.providerChargeId;
  order.paymentReference = providerChargeId || order.paymentReference; // Keep paymentReference in sync
  if (transactionReference) {
    order.providerTransactionReference = transactionReference;
  }
  await order.save();

  // 2. Find and update the associated puzzle
  const puzzle = await Puzzle.findOne({ publicId: order.puzzleId });
  if (puzzle) {
    if (puzzle.status === 'draft' || puzzle.status === 'pending_payment') {
      puzzle.status = 'paid';
      await puzzle.save();
    }

    const frontendUrl = getFrontendOrigin();
    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';

    // Deliver per recipient.
    for (let i = 0; i < puzzle.recipients.length; i++) {
      const rec = puzzle.recipients[i];

      // Skip recipients already handled so a retried webhook/redirect never re-sends.
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
          rec.deliveryStatus = 'sent';
          rec.sentAt = new Date();
          rec.providerMessageId = result.providerMessageId || '';
          rec.lastError = '';
        } else {
          rec.deliveryStatus = 'failed';
          rec.lastError = result.error || 'Email delivery failed.';
        }
      } else {
        if (whatsappEnabled) {
          try {
            await whatsappService.claimAndSendPuzzleDelivery({
              puzzleId: puzzle.publicId,
              recipientIndex: i
            });
          } catch (waError) {
            console.error('[PaymentCompletion] WhatsApp delivery error:', waError.message);
          }
        }
      }
    }

    await puzzle.save();

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

  return order;
}

module.exports = {
  markOrderAndPuzzlePaid
};

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const WhatsAppWebhookEvent = require('../../models/WhatsAppWebhookEvent');
const WhatsAppMessage = require('../../models/WhatsAppMessage');
const whatsappService = require('../../services/whatsappService');

router.post('/', async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const idempotencyKey = req.headers['x-idempotency-key'];
    const eventType = req.headers['x-webhook-event'];

    if (!signature || !idempotencyKey || !eventType) {
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[WhatsAppWebhook] KAPSO_WEBHOOK_SECRET is not configured.');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Verify HMAC-SHA256 signature on raw body buffer
    const rawBody = req.body; // Buffer from express.raw
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse JSON safely
    let payload;
    const rawBodyString = rawBody.toString('utf8');
    try {
      payload = JSON.parse(rawBodyString);
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Deduplicate webhook event atomically using WhatsAppWebhookEvent unique index
    const payloadHash = crypto.createHash('sha256').update(rawBodyString).digest('hex');
    
    // Parse message metadata from payload
    const statusObj = payload.statuses?.[0] || {};
    const providerMessageId = statusObj.id;
    const eventStatus = statusObj.status; // sent, delivered, read, failed
    const occurredAt = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp) * 1000) : null;
    
    if (!providerMessageId || !eventStatus) {
      return res.status(400).json({ error: 'Invalid payload structure: missing message status info' });
    }

    // Atomically reserve the event
    let webhookEvent;
    try {
      webhookEvent = new WhatsAppWebhookEvent({
        idempotencyKey,
        eventType,
        providerMessageId,
        phoneNumberId: payload.metadata?.phone_number_id || '',
        eventStatus,
        occurredAt,
        receivedAt: new Date(),
        payloadHash
      });
      await webhookEvent.save();
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        // Already processed
        return res.status(200).json({ success: true, note: 'duplicate_webhook_ignored' });
      }
      throw dbErr;
    }

    // Process status update monotonically
    // Match recipient primarily using providerMessageId
    const messageRecord = await WhatsAppMessage.findOne({ providerMessageId });
    if (!messageRecord) {
      webhookEvent.processingStatus = 'failed';
      webhookEvent.processingError = 'Unmatched providerMessageId';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();
      return res.status(200).json({ success: true, note: 'unmatched_message_id_logged' });
    }

    const priority = {
      'pending': 0,
      'claimed': 1,
      'sending': 2,
      'accepted': 3,
      'sent': 4,
      'delivered': 5,
      'read': 6
    };

    const currentPriority = priority[messageRecord.status] || 0;
    const incomingPriority = priority[eventStatus] || 0;

    if (incomingPriority > currentPriority) {
      // Upgrade status monotonically
      messageRecord.status = eventStatus;
      messageRecord.lastStatusAt = new Date();

      const snapshotUpdate = {
        status: eventStatus,
        lastStatusAt: new Date()
      };

      if (eventStatus === 'sent') {
        messageRecord.sentAt = occurredAt || new Date();
        snapshotUpdate.sentAt = messageRecord.sentAt;
      } else if (eventStatus === 'delivered') {
        messageRecord.deliveredAt = occurredAt || new Date();
        snapshotUpdate.deliveredAt = messageRecord.deliveredAt;
      } else if (eventStatus === 'read') {
        messageRecord.readAt = occurredAt || new Date();
        snapshotUpdate.readAt = messageRecord.readAt;
      }

      await messageRecord.save();
      
      // Update Puzzle recipient snapshot
      await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, snapshotUpdate);
    } else if (eventStatus === 'failed') {
      // Record failure independently without deleting earlier timestamps
      messageRecord.status = 'failed';
      messageRecord.failedAt = occurredAt || new Date();
      messageRecord.lastErrorCode = statusObj.errors?.[0]?.code || 'PROVIDER_FAILED';
      messageRecord.lastErrorMessage = statusObj.errors?.[0]?.message || 'Message delivery failed';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, {
        status: 'failed',
        failedAt: messageRecord.failedAt,
        errorCode: messageRecord.lastErrorCode,
        errorMessage: messageRecord.lastErrorMessage
      });
    }

    webhookEvent.processingStatus = 'processed';
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[WhatsAppWebhook] Exception:', err.message);
    next(err);
  }
});

module.exports = router;

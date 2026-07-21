const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const WhatsAppWebhookEvent = require('../../models/WhatsAppWebhookEvent');
const WhatsAppMessage = require('../../models/WhatsAppMessage');
const whatsappService = require('../../services/whatsappService');

router.post('/', async (req, res, next) => {
  try {
    // 1. Validate the webhook payload version
    const payloadVersion = req.headers['x-webhook-payload-version'];
    if (!payloadVersion || payloadVersion.trim().toLowerCase() !== 'v2') {
      return res.status(400).json({ error: 'Unsupported or missing webhook payload version' });
    }

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

    // Parse message metadata from Kapso-specific payload structure
    const providerMessageId = payload.message?.id;
    const kapsoObj = payload.message?.kapso || {};
    const eventStatus = kapsoObj.status; // sent, delivered, read, failed
    const occurredAt = payload.message?.timestamp ? new Date(parseInt(payload.message.timestamp) * 1000) : null;

    if (!providerMessageId || !eventStatus) {
      return res.status(400).json({ error: 'Invalid payload structure: missing message status info' });
    }

    // Validate that the normalized status agrees with the event header
    const eventToStatusMap = {
      'whatsapp.message.sent': 'sent',
      'whatsapp.message.delivered': 'delivered',
      'whatsapp.message.read': 'read',
      'whatsapp.message.failed': 'failed'
    };

    if (eventToStatusMap[eventType] !== eventStatus) {
      return res.status(400).json({ error: 'Mismatch between X-Webhook-Event and kapso.status' });
    }

    // 1. Attempt to insert the event as queued
    try {
      const initialEvent = new WhatsAppWebhookEvent({
        idempotencyKey,
        eventType,
        providerMessageId,
        phoneNumberId: payload.phone_number_id || '',
        eventStatus,
        occurredAt,
        receivedAt: new Date(),
        payloadHash,
        processingStatus: 'queued'
      });
      await initialEvent.save();
    } catch (dbErr) {
      if (dbErr.code !== 11000) {
        throw dbErr;
      }
    }

    // 2. Atomically claim with a lease-based findOneAndUpdate
    const leaseCutoff = new Date(Date.now() - 120000);
    const claimedEvent = await WhatsAppWebhookEvent.findOneAndUpdate(
      {
        idempotencyKey,
        $or: [
          { processingStatus: 'queued' },
          { processingStatus: 'failed' },
          {
            processingStatus: 'processing',
            processingStartedAt: { $lt: leaseCutoff }
          }
        ]
      },
      {
        $set: {
          processingStatus: 'processing',
          processingStartedAt: new Date(),
          lastProcessingError: ''
        },
        $inc: {
          processingAttempts: 1
        }
      },
      { new: true }
    );

    if (!claimedEvent) {
      // Fetch the existing event to return the accurate state code
      const existing = await WhatsAppWebhookEvent.findOne({ idempotencyKey });
      if (!existing) {
        return res.status(500).json({ error: 'Failed to claim or retrieve event' });
      }
      if (existing.processingStatus === 'processed') {
        return res.status(200).json({ success: true, note: 'duplicate_webhook_ignored' });
      }
      if (existing.processingStatus === 'processing') {
        return res.status(200).json({ success: true, note: 'lease_active_skip' });
      }
      return res.status(500).json({ error: 'Unexpected processing state retryable' });
    }

    let webhookEvent = claimedEvent;

    // Process status update monotonically
    // Match recipient primarily using providerMessageId
    const messageRecord = await WhatsAppMessage.findOne({ providerMessageId });
    if (!messageRecord) {
      webhookEvent.processingStatus = 'failed';
      webhookEvent.lastProcessingError = 'Unmatched providerMessageId';
      webhookEvent.processedAt = null;
      await webhookEvent.save();

      // Return HTTP 500 so Kapso retries the delivery
      return res.status(500).json({ error: 'Unmatched providerMessageId retryable' });
    }

    try {
      const priority = {
        'pending': 0,
        'disabled': 0,
        'claimed': 1,
        'sending': 2,
        'accepted': 3,
        'sent': 4,
        'delivered': 5,
        'read': 6
      };

      const currentPriority = priority[messageRecord.status] || 0;
      const incomingPriority = priority[eventStatus] || 0;

      if (eventStatus === 'failed') {
        const statusesArray = kapsoObj.statuses || [];
        const failedStatus = statusesArray.find(s => s.status === 'failed') || {};
        const errorObj = failedStatus.errors?.[0] || {};

        messageRecord.failedAt = occurredAt || new Date();
        messageRecord.lastErrorCode = errorObj.code || 'PROVIDER_FAILED';
        let errorMsg = errorObj.message || 'Message delivery failed';
        if (errorObj.error_data?.details) {
          errorMsg += ` (${errorObj.error_data.details})`;
        }
        messageRecord.lastErrorMessage = String(errorMsg).slice(0, 500);

        if (currentPriority < priority['sent']) {
          messageRecord.status = 'failed';
          await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, {
            status: 'failed',
            failedAt: messageRecord.failedAt,
            errorCode: messageRecord.lastErrorCode,
            errorMessage: messageRecord.lastErrorMessage
          });
        } else {
          await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, {
            failedAt: messageRecord.failedAt,
            errorCode: messageRecord.lastErrorCode,
            errorMessage: messageRecord.lastErrorMessage
          });
        }
        messageRecord.updatedAt = new Date();
        await messageRecord.save();
      } else if (incomingPriority > currentPriority) {
        // Upgrade status monotonically
        messageRecord.status = eventStatus;
        messageRecord.lastStatusAt = new Date();

        const snapshotUpdate = {
          status: eventStatus,
          lastStatusAt: new Date(),
          occurredAt
        };

        if (eventStatus === 'sent') {
          messageRecord.sentAt = occurredAt || new Date();
        } else if (eventStatus === 'delivered') {
          messageRecord.deliveredAt = occurredAt || new Date();
        } else if (eventStatus === 'read') {
          messageRecord.readAt = occurredAt || new Date();
        }

        await messageRecord.save();

        // Update Puzzle recipient snapshot
        await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, snapshotUpdate);
      }

      webhookEvent.processingStatus = 'processed';
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();

      return res.status(200).json({ success: true });
    } catch (processErr) {
      webhookEvent.processingStatus = 'failed';
      webhookEvent.lastProcessingError = String(processErr.message).slice(0, 500);
      await webhookEvent.save();

      return res.status(500).json({ error: 'Processing exception occurred' });
    }
  } catch (err) {
    console.error('[WhatsAppWebhook] Exception:', err.message);
    next(err);
  }
});

module.exports = router;

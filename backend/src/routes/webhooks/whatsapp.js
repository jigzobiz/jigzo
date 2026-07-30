const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const WhatsAppWebhookEvent = require('../../models/WhatsAppWebhookEvent');
const {
  getHeader,
  verifyKapsoWebhookSignature
} = require('../../utils/kapsoWebhookSignature');
const {
  normalizeKapsoMessage,
  persistNormalizedStatus
} = require('../../services/whatsappStatusService');

router.post('/', async (req, res, next) => {
  try {
    // 1. Validate the webhook payload version
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[WhatsAppWebhook] KAPSO_WEBHOOK_SECRET is not configured.');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const authentication = verifyKapsoWebhookSignature(req, secret);
    if (!authentication.valid) {
      console.warn('[WhatsAppWebhook] Authentication failed', authentication.diagnostics);
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const rawBody = authentication.rawBody;

    const payloadVersion = getHeader(req, 'X-Webhook-Payload-Version');
    const idempotencyKey = getHeader(req, 'X-Idempotency-Key');
    const eventType = getHeader(req, 'X-Webhook-Event');

    if (!payloadVersion || payloadVersion.trim().toLowerCase() !== 'v2') {
      return res.status(400).json({ error: 'Unsupported or missing webhook payload version' });
    }
    if (!idempotencyKey || !eventType) {
      return res.status(400).json({ error: 'Missing required webhook headers' });
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
    const normalized = normalizeKapsoMessage(payload, eventType);
    const {
      providerMessageId,
      providerStatus: eventStatus,
      occurredAt
    } = normalized;
    
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
        phoneNumberId: normalized.phoneNumberId,
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

    try {
      const persistence = await persistNormalizedStatus(normalized);
      if (persistence.reason === 'unmatched_provider_message_id') {
        // Authenticated provider test/admin-originated events may legitimately
        // have no JIGZO WhatsAppMessage. Record and acknowledge the no-op so
        // Kapso does not retry it indefinitely. Never create a fake message.
        webhookEvent.processingStatus = 'processed';
        webhookEvent.lastProcessingError = 'unmatched_provider_message_id_ignored';
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();
        return res.status(200).json({
          success: true,
          note: 'authenticated_unmatched_message_ignored'
        });
      }

      if (normalized.failure) {
        const failure = normalized.failure;
        webhookEvent.errorCode = failure.code;
        webhookEvent.errorTitle = failure.title;
        webhookEvent.errorMessage = failure.message;
        webhookEvent.errorDetails = failure.details;
        webhookEvent.providerFailureMetadata = failure.metadata;
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

const crypto = require('crypto');
const DeliveryWebhookEvent = require('../models/DeliveryWebhookEvent');
const Puzzle = require('../models/Puzzle');

const RANK = {
  queued: 0,
  accepted: 1,
  delayed: 2,
  sent: 2,
  delivered: 3,
  opened: 4,
  clicked: 4,
  failed: 5,
  bounced: 5,
  complained: 5,
  suppressed: 5
};

function webhookSecret() {
  return String(process.env.RESEND_WEBHOOK_SECRET || '');
}

function verifySignature({ rawBody, id, timestamp, signature, now = Date.now() }) {
  const secret = webhookSecret();
  if (!secret || !id || !timestamp || !signature || !Buffer.isBuffer(rawBody)) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds * 1000) > 5 * 60 * 1000) return false;
  let key;
  try {
    key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  } catch {
    return false;
  }
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest('base64');
  return String(signature).split(' ').some((part) => {
    const value = part.startsWith('v1,') ? part.slice(3) : '';
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  });
}

function mapping(type, at) {
  const providerStatus = String(type || '').replace('email.', '');
  const status = providerStatus === 'delivery_delayed' ? 'delayed' : providerStatus;
  const fields = { status, providerStatus, lastEventAt: at };
  if (status === 'sent') fields.sentAt = at;
  if (status === 'delivered') fields.deliveredAt = at;
  if (status === 'opened') fields.openedAt = at;
  if (status === 'clicked') fields.clickedAt = at;
  if (status === 'delayed') fields.delayedAt = at;
  if (status === 'bounced') fields.bouncedAt = at;
  if (status === 'complained') fields.complainedAt = at;
  if (status === 'suppressed' || status === 'failed') fields.failedAt = at;
  return { status, fields };
}

function extractResendError(payload, status) {
  const data = payload?.data || {};
  if (status === 'bounced') {
    const bounce = data.bounce || {};
    const parts = [
      bounce.message,
      bounce.subType && bounce.subType !== 'General' ? `(${bounce.subType})` : null,
      bounce.diagnosticCode
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' - ').slice(0, 500);
    return String(data.reason || data.message || 'Email bounced').slice(0, 500);
  }
  if (status === 'suppressed') {
    const suppressed = data.suppressed || {};
    const parts = [
      suppressed.message,
      suppressed.type ? `[${suppressed.type}]` : null
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ').slice(0, 500);
    return String(data.reason || data.message || 'Email suppressed by provider').slice(0, 500);
  }
  if (status === 'failed') {
    const failed = data.failed || {};
    const reason = failed.reason || data.reason || data.message || 'Email delivery failed';
    return String(reason).slice(0, 500);
  }
  if (status === 'complained') {
    return String(data.reason || data.message || 'Email marked as spam/complaint').slice(0, 500);
  }
  return '';
}

function canTransitionConsumerEmail(currentStatus, incomingStatus) {
  if (currentStatus === incomingStatus) return false;

  if (['bounced', 'failed', 'suppressed', 'complained'].includes(currentStatus)) {
    return false;
  }

  if (currentStatus === 'delivered') {
    return incomingStatus === 'complained';
  }

  if (currentStatus === 'pending') {
    return ['sent', 'delayed', 'delivered', 'bounced', 'failed', 'suppressed', 'complained'].includes(incomingStatus);
  }

  if (currentStatus === 'sent' || currentStatus === 'delayed') {
    return ['delayed', 'delivered', 'bounced', 'failed', 'suppressed', 'complained'].includes(incomingStatus);
  }

  return false;
}

async function processEvent(payload, eventId) {
  let event;
  try {
    event = await DeliveryWebhookEvent.create({
      provider: 'resend',
      eventId,
      eventType: payload.type,
      providerMessageId: payload.data?.email_id || null
    });
  } catch (e) {
    if (e.code === 11000) return { duplicate: true };
    throw e;
  }

  const providerMessageId = payload.data?.email_id;

  // Consumer Reveal Puzzle Recipient Reconciliation
  if (providerMessageId) {
    const puzzle = await Puzzle.findOne({ 'recipients.providerMessageId': providerMessageId });
    if (puzzle) {
      const rec = (puzzle.recipients || []).find((r) => r.providerMessageId === providerMessageId);
      if (rec) {
        const at = payload.created_at ? new Date(payload.created_at) : new Date();
        const { status } = mapping(payload.type, at);
        if (!(status in RANK)) {
          event.processedAt = new Date();
          event.matched = true;
          await event.save();
          return { matched: true, ignored: true };
        }

        const currentStatus = rec.deliveryStatus || 'pending';

        if (canTransitionConsumerEmail(currentStatus, status)) {
          if (status === 'delivered') {
            rec.deliveryStatus = 'delivered';
            rec.deliveredAt = rec.deliveredAt || at;
            rec.lastError = '';
          } else if (status === 'sent') {
            rec.deliveryStatus = 'sent';
            if (!rec.sentAt) rec.sentAt = at;
          } else if (status === 'delayed') {
            rec.deliveryStatus = 'delayed';
          } else if (status === 'complained') {
            rec.deliveryStatus = 'complained';
            rec.lastError = extractResendError(payload, 'complained');
          } else if (['failed', 'bounced', 'suppressed'].includes(status)) {
            rec.deliveryStatus = status;
            rec.lastError = extractResendError(payload, status);
          }

          await puzzle.save();
        }

        event.processedAt = new Date();
        event.matched = true;
        await event.save();
        return { matched: true };
      }
    }
  }

  // Unmatched event
  event.processedAt = new Date();
  event.matched = false;
  await event.save();
  return { matched: false };
}

module.exports = {
  RANK,
  verifySignature,
  mapping,
  processEvent,
  extractResendError,
  canTransitionConsumerEmail
};

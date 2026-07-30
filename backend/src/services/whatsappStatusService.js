const WhatsAppMessage = require('../models/WhatsAppMessage');
const whatsappService = require('./whatsappService');

const STATUS_PRIORITY = {
  pending: 0,
  disabled: 0,
  failed: 0,
  verification_required: 0,
  claimed: 1,
  sending: 2,
  accepted: 3,
  sent: 4,
  delivered: 5,
  read: 6
};

function maskProviderRecipient(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 4 ? '****' : `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function normalizeKapsoMessage(payload, eventType = '') {
  const root = payload && payload.data ? payload.data : payload;
  const message = root && root.message ? root.message : root;
  const kapso = message && message.kapso;
  const providerStatus = kapso && kapso.status;
  const statuses = Array.isArray(kapso && kapso.statuses) ? kapso.statuses : [];
  const statusEntry = statuses.find((entry) => entry && entry.status === providerStatus) || {};
  const error = Array.isArray(statusEntry.errors) ? (statusEntry.errors[0] || {}) : {};
  const rawTimestamp = statusEntry.timestamp || (message && message.timestamp);
  const timestampSeconds = Number.parseInt(rawTimestamp, 10);
  const occurredAt = Number.isFinite(timestampSeconds) ? new Date(timestampSeconds * 1000) : null;

  return {
    providerMessageId: message && message.id,
    providerStatus,
    processingStatus: kapso && kapso.processing_status,
    eventType,
    occurredAt,
    phoneNumberId: (root && root.phone_number_id) || '',
    statuses,
    failure: providerStatus === 'failed'
      ? {
          code: error.code == null ? 'PROVIDER_FAILED' : String(error.code),
          title: String(error.title || '').slice(0, 200),
          message: String(error.message || 'Message delivery failed').slice(0, 500),
          details: String((error.error_data && error.error_data.details) || '').slice(0, 500),
          metadata: {
            status: String(statusEntry.status || providerStatus),
            timestamp: occurredAt,
            recipientIdMasked: maskProviderRecipient(statusEntry.recipient_id),
            href: String(error.href || '').slice(0, 500)
          }
        }
      : null
  };
}

async function persistNormalizedStatus(normalized) {
  const { providerMessageId, providerStatus, occurredAt } = normalized;
  if (!providerMessageId || !['sent', 'delivered', 'read', 'failed'].includes(providerStatus)) {
    return { updated: false, reason: 'no_later_provider_state' };
  }

  let messageRecord = await WhatsAppMessage.findOne({ providerMessageId });
  if (!messageRecord) {
    return { updated: false, reason: 'unmatched_provider_message_id' };
  }
  if (messageRecord.status === 'correcting') {
    return { updated: false, reason: 'correction_in_progress', messageRecord };
  }
  if (messageRecord.retryStartedAt && ['claimed', 'sending'].includes(messageRecord.status)) {
    return { updated: false, reason: 'historical_provider_message_id', messageRecord };
  }
  if ((messageRecord.retryHistory || []).some((attempt) => attempt.providerMessageId === providerMessageId)) {
    return { updated: false, reason: 'historical_provider_message_id', messageRecord };
  }

  const currentPriority = STATUS_PRIORITY[messageRecord.status] || 0;
  const incomingPriority = STATUS_PRIORITY[providerStatus] || 0;

  if (providerStatus === 'failed') {
    const failure = normalized.failure;
    const failureSet = {
      providerStatus: 'failed',
      failedAt: occurredAt || new Date(),
      lastStatusAt: new Date(),
      lastErrorCode: failure.code,
      lastErrorTitle: failure.title,
      lastErrorMessage: failure.message,
      lastErrorDetails: failure.details,
      providerFailureMetadata: failure.metadata,
      updatedAt: new Date()
    };

    if (currentPriority < STATUS_PRIORITY.delivered) {
      failureSet.status = 'failed';
    }

    const transitionQuery = currentPriority < STATUS_PRIORITY.delivered
      ? {
          providerMessageId,
          status: { $in: ['pending', 'claimed', 'sending', 'accepted', 'sent', 'verification_required', 'failed'] }
        }
      : { providerMessageId };

    messageRecord = await WhatsAppMessage.findOneAndUpdate(
      transitionQuery,
      { $set: failureSet },
      { new: true }
    );

    if (!messageRecord && failureSet.status) {
      delete failureSet.status;
      messageRecord = await WhatsAppMessage.findOneAndUpdate(
        { providerMessageId },
        { $set: failureSet },
        { new: true }
      );
    }

    if (!messageRecord) {
      throw new Error('WhatsApp message disappeared during failed status update');
    }

    await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, {
      status: currentPriority < STATUS_PRIORITY.delivered ? 'failed' : undefined,
      failedAt: failureSet.failedAt,
      errorCode: failure.code,
      errorTitle: failure.title,
      errorMessage: failure.message,
      errorDetails: failure.details
    });

    return { updated: true, messageRecord, appliedStatus: messageRecord.status };
  }

  if (incomingPriority <= currentPriority) {
    return { updated: false, reason: 'already_at_same_or_later_state', messageRecord };
  }

  const lowerStatuses = Object.keys(STATUS_PRIORITY)
    .filter((status) => STATUS_PRIORITY[status] < incomingPriority);
  const timestampField = providerStatus === 'sent'
    ? 'sentAt'
    : providerStatus === 'delivered'
      ? 'deliveredAt'
      : 'readAt';
  const now = new Date();
  const statusSet = {
    status: providerStatus,
    providerStatus,
    lastStatusAt: now,
    updatedAt: now,
    [timestampField]: occurredAt || now
  };

  messageRecord = await WhatsAppMessage.findOneAndUpdate(
    { providerMessageId, status: { $in: lowerStatuses } },
    { $set: statusSet },
    { new: true }
  );

  if (!messageRecord) {
    messageRecord = await WhatsAppMessage.findOne({ providerMessageId });
    return { updated: false, reason: 'concurrent_same_or_later_state', messageRecord };
  }

  await whatsappService.updateRecipientSnapshot(messageRecord.puzzleId, messageRecord.recipientIndex, {
    status: providerStatus,
    lastStatusAt: now,
    occurredAt
  });

  return { updated: true, messageRecord, appliedStatus: providerStatus };
}

module.exports = {
  STATUS_PRIORITY,
  normalizeKapsoMessage,
  persistNormalizedStatus
};

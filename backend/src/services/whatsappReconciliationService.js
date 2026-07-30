const WhatsAppMessage = require('../models/WhatsAppMessage');
const {
  getStaleAcceptedMinutes,
  isStaleAcceptedMessage
} = require('../utils/whatsappLifecycle');
const {
  normalizeKapsoMessage,
  persistNormalizedStatus
} = require('./whatsappStatusService');

const RECONCILABLE_PROVIDER_STATUSES = ['sent', 'delivered', 'read', 'failed'];

async function fetchProviderMessage(providerMessageId) {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) {
    throw new Error('Kapso reconciliation credentials are not configured');
  }

  const encodedPhoneNumberId = encodeURIComponent(phoneNumberId);
  const encodedMessageId = encodeURIComponent(providerMessageId);
  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${encodedPhoneNumberId}/messages/${encodedMessageId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(10000)
  });
  const responseText = await response.text();
  let responseJson;
  try {
    responseJson = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Kapso reconciliation returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`Kapso reconciliation lookup failed (HTTP ${response.status})`);
  }
  return responseJson;
}

async function reconcileMessage(messageRecord) {
  if (!messageRecord || !messageRecord.providerMessageId) {
    return { reconciled: false, status: 'reconciliation_required', reason: 'missing_provider_message_id' };
  }

  try {
    const providerPayload = await fetchProviderMessage(messageRecord.providerMessageId);
    const normalized = normalizeKapsoMessage(providerPayload);
    if (normalized.providerMessageId && normalized.providerMessageId !== messageRecord.providerMessageId) {
      return { reconciled: false, status: 'reconciliation_required', reason: 'provider_message_id_mismatch' };
    }
    if (!RECONCILABLE_PROVIDER_STATUSES.includes(normalized.providerStatus)) {
      return { reconciled: false, status: 'reconciliation_required', reason: 'no_later_provider_state' };
    }

    const result = await persistNormalizedStatus({
      ...normalized,
      providerMessageId: messageRecord.providerMessageId
    });
    return {
      reconciled: result.updated || result.reason === 'already_at_same_or_later_state',
      status: normalized.providerStatus,
      reason: result.reason || null
    };
  } catch (error) {
    return {
      reconciled: false,
      status: 'reconciliation_required',
      reason: String(error.message).slice(0, 300)
    };
  }
}

async function reconcileStaleAccepted({ limit = 50, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - getStaleAcceptedMinutes() * 60 * 1000);
  const candidates = await WhatsAppMessage.find({
    idempotencyKey: /^puzzle-delivery:/,
    providerMessageId: { $type: 'string', $gt: '' },
    acceptedAt: { $lte: cutoff },
    $or: [{ status: 'accepted' }, { providerStatus: 'accepted' }]
  }).sort({ acceptedAt: 1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 100));

  const results = [];
  for (const message of candidates) {
    if (!isStaleAcceptedMessage(message, now)) continue;
    const result = await reconcileMessage(message);
    results.push({
      idempotencyKey: message.idempotencyKey,
      providerMessageIdPresent: !!message.providerMessageId,
      ...result
    });
  }
  return results;
}

module.exports = {
  RECONCILABLE_PROVIDER_STATUSES,
  fetchProviderMessage,
  reconcileMessage,
  reconcileStaleAccepted
};

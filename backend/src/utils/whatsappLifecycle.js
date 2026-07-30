const DEFAULT_STALE_ACCEPTED_MINUTES = 30;

function getStaleAcceptedMinutes() {
  const configured = Number(process.env.WHATSAPP_STALE_ACCEPTED_MINUTES);
  return Number.isFinite(configured) && configured >= 15
    ? configured
    : DEFAULT_STALE_ACCEPTED_MINUTES;
}

function isStaleAcceptedMessage(message, now = new Date(), timeoutMinutes = getStaleAcceptedMinutes()) {
  const isAccepted = message &&
    (message.status === 'accepted' || message.providerStatus === 'accepted');
  if (!isAccepted || !message.providerMessageId || !message.acceptedAt) {
    return false;
  }

  if (message.sentAt || message.deliveredAt || message.readAt || message.failedAt) {
    return false;
  }

  const acceptedAt = new Date(message.acceptedAt).getTime();
  const nowMs = new Date(now).getTime();
  return Number.isFinite(acceptedAt) &&
    Number.isFinite(nowMs) &&
    nowMs - acceptedAt >= timeoutMinutes * 60 * 1000;
}

function getReconciliationStatus(message, now = new Date()) {
  return isStaleAcceptedMessage(message, now)
    ? 'reconciliation_required'
    : 'not_required';
}

module.exports = {
  DEFAULT_STALE_ACCEPTED_MINUTES,
  getStaleAcceptedMinutes,
  isStaleAcceptedMessage,
  getReconciliationStatus
};

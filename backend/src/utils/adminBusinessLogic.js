/**
 * Shared admin business-logic utilities.
 *
 * Every admin surface (Home, Customers, Customer Detail, Orders & Puzzles,
 * Delivery Centre, Finance) MUST derive its figures from these helpers so the
 * whole portal counts, dedupes and converts money identically.
 *
 * Money rules:
 *  - The authoritative BHD sale amount is the amount actually captured by Tap,
 *    stored on the order as `finalBhdFils` (integer minor units, 1 BHD = 1000).
 *  - A localised display amount (e.g. AED 35) is NEVER multiplied by an
 *    unrelated USD->BHD rate to produce the BHD sale value.
 *  - Historical expense-workbook FX rates are for expense records only and are
 *    never used as the live sale/checkout pricing engine.
 */

const THREE_DECIMAL_CURRENCIES = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];

/** A completed order is one whose payment was actually captured. */
function isCompletedPaidOrder(order) {
  return !!order && order.paymentStatus === 'paid';
}

/**
 * An abandoned / incomplete checkout: a real attempt (customer info exists)
 * that never captured payment.
 */
function isAbandonedCheckout(order) {
  return !!order && (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');
}

/**
 * The authoritative BHD amount for a sale, taken from what Tap actually
 * captured. Returns a 3-decimal string, or null when it cannot be determined
 * WITHOUT inventing a conversion.
 *
 * This is the GROSS captured customer payment, used for gross sales reporting.
 * It is deliberately NOT sale.confirmedSettlementBHD (that stays empty until a
 * future Tap monthly statement is reconciled).
 *
 * Precedence (all are real captured values, never an FX guess):
 *  1. sale.capturedAmountBHD       — gross captured payment (set by the Sale
 *     repair from the live Tap charge, e.g. BHD 3.600)
 *  2. order.finalBhdFils / 1000    — immutable BHD snapshot from checkout
 *  3. order.total when the charge currency itself was BHD
 *  4. sale.calculatedAmountBHD/netCalculatedBHD when the sale's original
 *     currency was BHD (so no cross-rate was involved)
 */
function getAuthoritativeBhdSaleAmount(order, sale) {
  const pos = (v) => v !== undefined && v !== null && !isNaN(Number(v)) && Number(v) > 0;

  if (sale && pos(sale.capturedAmountBHD)) {
    return Number(sale.capturedAmountBHD.toString()).toFixed(3);
  }
  if (order && order.finalBhdFils !== undefined && order.finalBhdFils !== null && !isNaN(Number(order.finalBhdFils)) && Number(order.finalBhdFils) > 0) {
    return (Number(order.finalBhdFils) / 1000).toFixed(3);
  }
  if (order && order.currency === 'BHD' && order.total !== undefined && order.total !== null) {
    return Number(order.total).toFixed(3);
  }
  if (sale && String(sale.originalCurrency).toUpperCase() === 'BHD') {
    const v = sale.netCalculatedBHD || sale.calculatedAmountBHD;
    if (pos(v)) return Number(v.toString()).toFixed(3);
  }
  return null; // Unknown — never fabricate via an unrelated FX rate.
}

/** Normalised customer identity key: digits of the sender phone (E.164-ish). */
function normalizeCustomerIdentity(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * The single successful puzzle document for a PAID order. Failed/abandoned
 * duplicate puzzle attempts (a second puzzle doc for the same sender) are not
 * returned, because they are not the puzzle the paid order points at.
 */
function getSuccessfulPuzzleForOrder(order, puzzleByPublicId) {
  if (!isCompletedPaidOrder(order)) return null;
  const pz = puzzleByPublicId instanceof Map ? puzzleByPublicId.get(order.puzzleId) : puzzleByPublicId[order.puzzleId];
  return pz || null;
}

/**
 * Count of paid recipient-specific puzzles: recipients belonging only to the
 * puzzles of captured/paid orders. One paid order with five recipients = 5.
 * A duplicate failed puzzle attempt for the same customer does NOT add to this.
 */
function countPaidRecipientPuzzles(orders, puzzleByPublicId) {
  let n = 0;
  for (const order of orders) {
    const pz = getSuccessfulPuzzleForOrder(order, puzzleByPublicId);
    if (pz) n += (pz.recipients && pz.recipients.length) || 0;
  }
  return n;
}

/**
 * Operational state of a recipient, using the strict priority:
 *   Solved > Opened > Delivered > Sent > Failed > Pending
 * A solved/opened state is authoritative even if provider delivery
 * confirmation was never recorded.
 */
function hasCurrentTerminalProviderFailure(message) {
  return Boolean(
    message &&
    message.providerStatus === 'failed' &&
    message.providerMessageId &&
    !message.deliveredAt &&
    !message.readAt &&
    !['delivered', 'read'].includes(message.status)
  );
}

function getRecipientOperationalState(r, message) {
  if (!r) return 'pending';
  if (r.completedAt) return 'solved';
  if (r.openedAt) return 'opened';
  if (hasCurrentTerminalProviderFailure(message) && !r.whatsappDeliveredAt && !r.whatsappReadAt) return 'failed';
  const ds = r.deliveryStatus || 'pending';
  if (ds === 'delivered') return 'delivered';
  if (ds === 'sent' || r.sentAt) return 'sent';
  if (ds === 'failed' || r.whatsappSendStatus === 'failed' || r.whatsappFailedAt) return 'failed';
  return 'pending';
}

/**
 * True data conflicts only — logically impossible / genuinely contradictory
 * data. A missing WhatsApp delivery confirmation while the recipient has
 * opened/solved is NOT a conflict.
 */
function detectRecipientConflicts(r, puzzle) {
  const conflicts = [];
  if (!r) return conflicts;
  const created = puzzle && puzzle.createdAt ? new Date(puzzle.createdAt).getTime() : null;
  const solved = r.completedAt ? new Date(r.completedAt).getTime() : null;
  const opened = r.openedAt ? new Date(r.openedAt).getTime() : null;

  if (created && solved && solved < created) {
    conflicts.push('Solved timestamp is before the puzzle was created.');
  }
  if (created && opened && opened < created) {
    conflicts.push('Opened timestamp is before the puzzle was created.');
  }
  if (solved && opened && solved < opened) {
    conflicts.push('Solved timestamp is before the opened timestamp.');
  }
  return conflicts;
}

/**
 * Delivery-tracking label describing the provider confirmation, shown
 * separately from the (stronger) operational state.
 */
function getDeliveryTracking(r, message) {
  if (!r) return 'Unknown';
  if (hasCurrentTerminalProviderFailure(message)) return 'Failed';
  if (r.whatsappSendStatus === 'failed' || r.whatsappFailedAt) return 'Failed';
  if (r.deliveryStatus === 'delivered' || r.whatsappDeliveredAt) return 'Delivered';
  if (r.deliveryStatus === 'sent' || r.sentAt) return 'Sent';
  return 'Unconfirmed';
}

/**
 * Format a monetary amount for display in its OWN currency.
 *  - BHD/KWD/OMR (and other 3-decimal currencies): three decimals.
 *  - Everything else: two decimals.
 * Returns just the number string (no currency label, no 6-decimal noise).
 */
function formatCurrencyAmount(amount, currency) {
  const n = Number(amount);
  if (!isFinite(n)) return (THREE_DECIMAL_CURRENCIES.includes(currency) ? '0.000' : '0.00');
  return THREE_DECIMAL_CURRENCIES.includes(String(currency || '').toUpperCase())
    ? n.toFixed(3)
    : n.toFixed(2);
}

module.exports = {
  THREE_DECIMAL_CURRENCIES,
  isCompletedPaidOrder,
  isAbandonedCheckout,
  getAuthoritativeBhdSaleAmount,
  normalizeCustomerIdentity,
  getSuccessfulPuzzleForOrder,
  countPaidRecipientPuzzles,
  getRecipientOperationalState,
  hasCurrentTerminalProviderFailure,
  detectRecipientConflicts,
  getDeliveryTracking,
  formatCurrencyAmount
};

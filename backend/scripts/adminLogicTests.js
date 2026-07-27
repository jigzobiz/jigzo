/**
 * Pure-logic tests for the shared admin business logic (no DB required).
 * Proves the QA-flagged corrections at the unit level.
 */
const Big = require('big.js');
const L = require('../src/utils/adminBusinessLogic');

let pass = 0, fail = 0;
function assert(name, cond, extra = '') {
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? ' — ' + extra : ''}`);
  cond ? pass++ : fail++;
}

// --- Fixtures modelling the real production situation -----------------------
// Z.D: one PAID order (AED 35 display, BHD 3.600 captured) with a puzzle of 5
// recipients, PLUS a failed duplicate puzzle attempt also with 5 recipients.
const paidPuzzle = {
  publicId: 'PZ-PAID', senderPhone: '+97333333333', createdAt: '2026-06-01T10:00:00Z',
  recipients: [1, 2, 3, 4, 5].map((i) => ({ name: `R${i}`, openedAt: '2026-06-02T10:00:00Z', completedAt: '2026-06-02T11:00:00Z', deliveryStatus: 'pending' }))
};
const failedPuzzle = {
  publicId: 'PZ-FAILED', senderPhone: '+97333333333', createdAt: '2026-05-31T10:00:00Z',
  recipients: [1, 2, 3, 4, 5].map((i) => ({ name: `F${i}`, deliveryStatus: 'pending' }))
};
const walaaPuzzle = {
  publicId: 'PZ-WALAA', senderPhone: '+97344444444', createdAt: '2026-06-05T10:00:00Z',
  recipients: [{ name: 'W1', deliveryStatus: 'pending' }]
};

const paidOrder = { orderId: 'JZ-ORD-1', puzzleId: 'PZ-PAID', paymentStatus: 'paid', currency: 'AED', total: 35, finalBhdFils: 3600, checkoutDisplayCurrency: 'AED', checkoutDisplayAmount: '35' };
const failedOrder = { orderId: 'JZ-ORD-2', puzzleId: 'PZ-FAILED', paymentStatus: 'failed', currency: 'AED', total: 35, finalBhdFils: 3600 };
const walaaOrder = { orderId: 'JZ-ORD-3', puzzleId: 'PZ-WALAA', paymentStatus: 'pending', currency: 'AED', total: 35, finalBhdFils: 3600 };

const orders = [paidOrder, failedOrder, walaaOrder];
const puzzleByPublicId = new Map([[paidPuzzle.publicId, paidPuzzle], [failedPuzzle.publicId, failedPuzzle], [walaaPuzzle.publicId, walaaPuzzle]]);

// 1. AED 35 is never multiplied by USD rate 0.376
const wrong = Number(new Big(35).times(0.376).toFixed(3)); // 13.16
const saleBhd = L.getAuthoritativeBhdSaleAmount(paidOrder);
assert('AED 35 sale is NOT 13.160 (no USD-rate multiply)', saleBhd !== '13.160' && Number(saleBhd) !== wrong, `got ${saleBhd}`);

// 2. Known sale reports BHD 3.600 from captured finalBhdFils
assert('Known sale reports BHD 3.600', saleBhd === '3.600', `got ${saleBhd}`);

// 3. Original display remains AED 35 (two decimals, no 6-dp noise)
assert('Display formats as 35.00 AED', L.formatCurrencyAmount(35, 'AED') === '35.00', L.formatCurrencyAmount(35, 'AED'));
assert('BHD formats to three decimals', L.formatCurrencyAmount(3.6, 'BHD') === '3.600', L.formatCurrencyAmount(3.6, 'BHD'));

// 4. Completed orders = 1
const completed = orders.filter(L.isCompletedPaidOrder);
assert('Exactly one completed order', completed.length === 1, `got ${completed.length}`);

// 5. Abandoned checkouts identified (failed + pending), not counted as orders
const abandoned = orders.filter(L.isAbandonedCheckout);
assert('Two abandoned/incomplete attempts', abandoned.length === 2, `got ${abandoned.length}`);

// 6. Five paid recipient puzzles; failed duplicate does not double the count
const paidPuzzles = L.countPaidRecipientPuzzles(orders, puzzleByPublicId);
assert('Paid recipient puzzles = 5 (failed dup excluded)', paidPuzzles === 5, `got ${paidPuzzles}`);

// 7. Net result = sales - expenses = 3.600 - 930.538 = -926.938
const salesTotal = new Big(saleBhd);
const expensesTotal = new Big('930.538');
const net = salesTotal.minus(expensesTotal).toFixed(3);
assert('Net result = -926.938', net === '-926.938', `got ${net}`);

// 8. Solved overrides pending delivery state
assert('Solved overrides pending', L.getRecipientOperationalState(paidPuzzle.recipients[0]) === 'solved');

// 9. Missing delivery confirmation while solved is NOT a conflict
const conflictsSolvedPending = L.detectRecipientConflicts(paidPuzzle.recipients[0], paidPuzzle);
assert('Solved + pending delivery is NOT a conflict', conflictsSolvedPending.length === 0, `got ${conflictsSolvedPending.length}`);

// 10. Genuine conflict IS detected (solved before created)
const impossible = L.detectRecipientConflicts({ completedAt: '2026-05-01T00:00:00Z', openedAt: '2026-05-01T00:00:00Z' }, { createdAt: '2026-06-01T00:00:00Z' });
assert('Impossible solved-before-created IS a conflict', impossible.length > 0, `got ${impossible.length}`);

// 11. All five paid recipients resolve to solved (0 pending final state)
const finalPending = paidPuzzle.recipients.filter((r) => L.getRecipientOperationalState(r) === 'pending').length;
assert('Zero recipients left pending on paid order', finalPending === 0, `got ${finalPending}`);

// 12. Delivery tracking shown separately as Unconfirmed (not a conflict)
assert('Delivery tracking = Unconfirmed for solved+no-confirm', L.getDeliveryTracking(paidPuzzle.recipients[0]) === 'Unconfirmed', L.getDeliveryTracking(paidPuzzle.recipients[0]));

// 13. Abandoned customer (Walaa) has zero completed orders / spend
const walaaCompleted = orders.filter((o) => o.puzzleId === 'PZ-WALAA' && L.isCompletedPaidOrder(o));
const walaaPaidPuzzles = L.countPaidRecipientPuzzles(orders.filter((o) => o.puzzleId === 'PZ-WALAA'), puzzleByPublicId);
assert('Walaa: 0 completed orders', walaaCompleted.length === 0);
assert('Walaa: 0 paid puzzles / BHD 0.000 spend', walaaPaidPuzzles === 0);

// 14. getSuccessfulPuzzleForOrder returns null for a failed order
assert('Failed order yields no successful puzzle', L.getSuccessfulPuzzleForOrder(failedOrder, puzzleByPublicId) === null);

// 15. USD/EUR/AED/BHD display formatting decimals
assert('USD two decimals', L.formatCurrencyAmount(5, 'USD') === '5.00');
assert('EUR two decimals', L.formatCurrencyAmount(4.5, 'EUR') === '4.50');
assert('No six-decimal noise (35.000000 -> 35.00)', L.formatCurrencyAmount('35.000000', 'AED') === '35.00');

// 16. normalizeCustomerIdentity strips non-digits
assert('normalizeCustomerIdentity strips symbols', L.normalizeCustomerIdentity('+973 3333-3333') === '97333333333');

console.log(`\nADMIN LOGIC TESTS: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);

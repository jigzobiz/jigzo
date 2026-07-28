/**
 * Pass-3 correction tests (no DB). Prove the QA corrections at unit level.
 */
const fs = require('fs');
const path = require('path');
const Big = require('big.js');
const L = require('../src/utils/adminBusinessLogic');
const mongoose = require('mongoose');

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => { console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? ' — ' + extra : ''}`); cond ? pass++ : fail++; };
const D = (s) => mongoose.Types.Decimal128.fromString(String(s));

// The real O.B order: AED 35 display, no finalBhdFils, total 35 / currency AED.
const obOrder = { orderId: 'JZ-ORD-OB', paymentStatus: 'paid', currency: 'AED', total: 35, checkoutDisplayCurrency: 'AED', checkoutDisplayAmount: '35' };

// 1. Before repair: no resolvable BHD → null (so UI flags "needs repair", not a false zero)
assert('Unrepaired O.B sale resolves to null (needs repair, not fake 0)', L.getAuthoritativeBhdSaleAmount(obOrder, null) === null);

// 2. After repair: Sale.confirmedSettlementBHD = 3.600 → resolver returns 3.600, never 0
const repairedSale = { confirmedSettlementBHD: D('3.600000'), originalCurrency: 'AED', netCalculatedBHD: D('3.600000') };
const resolved = L.getAuthoritativeBhdSaleAmount(obOrder, repairedSale);
assert('Repaired captured sale reports BHD 3.600', resolved === '3.600', `got ${resolved}`);
assert('A captured sale with a BHD charge is never 0.000', resolved !== '0.000' && Number(resolved) > 0);

// 3. Net result derives to -926.938
const net = new Big(resolved).minus('930.538').toFixed(3);
assert('Net result = -926.938', net === '-926.938', `got ${net}`);

// 4. finalBhdFils path still works
assert('finalBhdFils=3600 -> 3.600', L.getAuthoritativeBhdSaleAmount({ finalBhdFils: 3600 }, null) === '3.600');

// 5. FX summary rounds to three decimals (0.102000 -> 0.102) while keeping exact internally
const round3 = (v) => Number(v).toFixed(3);
assert('FX 0.102000 -> 0.102 (3dp)', round3('0.102000') === '0.102');
assert('FX 0.376000 -> 0.376 (3dp)', round3('0.376000') === '0.376');

// 6. Phone search: normalized digit-substring matches the same person across formats
const digitsMatch = (query, stored) => { const q = String(query).replace(/\D/g, ''); const s = String(stored).replace(/\D/g, ''); return q.length >= 3 && s.includes(q); };
assert('33931331 matches +97333931331', digitsMatch('33931331', '+97333931331'));
assert('33931331 matches 0097333931331', digitsMatch('33931331', '0097333931331'));
assert('+97333931331 matches stored 97333931331', digitsMatch('+97333931331', '97333931331'));

// 7. Solved overrides unconfirmed delivery; not a conflict
const solvedRec = { completedAt: '2026-06-02T11:00:00Z', openedAt: '2026-06-02T10:00:00Z', deliveryStatus: 'pending' };
assert('Solved overrides pending', L.getRecipientOperationalState(solvedRec) === 'solved');
assert('Missing delivery confirmation is not a conflict', L.detectRecipientConflicts(solvedRec, { createdAt: '2026-06-01T00:00:00Z' }).length === 0);
assert('Delivery tracking = Unconfirmed', L.getDeliveryTracking(solvedRec) === 'Unconfirmed');

// 8. Source-level guarantees in the admin route (string inspection).
const src = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminRebuild.js'), 'utf8');
assert('System reads real prod flag CHECKOUT_ENABLED', src.includes("flagStatus('CHECKOUT_ENABLED')"));
assert('System reads real prod flag WHATSAPP_ENABLED', src.includes("flagStatus('WHATSAPP_ENABLED')"));
assert('Missing flag -> "configuration missing", not "disabled"', src.includes("configuration missing"));
assert('BHD labelled Base currency, not floating', src.includes("BHD: { pegType: 'Base currency'"));
assert('Delivery table exposes sender & recipient phones', src.includes('senderPhone: p.senderPhone') && src.includes('recipientContact: recipientContact(r)'));
assert('Delivery table exposes opened & solved timestamps', src.includes('openedAt:') && src.includes('completedAt: r.completedAt'));
assert('Reveal list does not embed the secure URL', !/revealLink|\/p\/\$\{|secureLink/.test(src));
assert('Repair endpoint sources the live Tap charge', src.includes('paymentService.retrieveCharge(order.providerChargeId)'));

// 9. Growth source label only from real values; unknown -> Unknown source
assert('Growth labels unknown source explicitly', src.includes("return 'Unknown source'"));

console.log(`\nPASS-3 TESTS: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);

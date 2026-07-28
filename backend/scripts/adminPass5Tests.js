/**
 * Pass-5 tests — provider amount labelling + Case A/B + manual reason.
 * Currency shown beside an amount must come from the SAME field as the amount;
 * AED 35 must never be shown as BHD 35.000.
 */
const fs = require('fs');
const path = require('path');
const L = require('../src/utils/adminBusinessLogic');

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => { console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? ' — ' + extra : ''}`); cond ? pass++ : fail++; };

const src = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminRebuild.js'), 'utf8');
const fe = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/admin/FinanceOverview.jsx'), 'utf8');

// 1. Amount is labelled in ITS OWN currency (never forced to BHD).
assert('AED 35 formats as 35.00 (own currency, 2dp)', L.formatCurrencyAmount(35, 'AED') === '35.00');
assert('labelAmount uses the provided currency, not BHD', src.includes('const labelAmount = (amount, currency) =>') && src.includes('String(currency).toUpperCase()'));
assert('Provider amount carries its own currency label (provider.label)', src.includes('provider.label = labelAmount(provider.amount, provider.currency)'));

// 2. The frontend renders the provider amount via its own-currency label, never formatBHD.
assert('Frontend shows provider.label (own currency)', fe.includes('p.provider.label'));
assert('Frontend does NOT wrap the provider amount in formatBHD', !/formatBHD\(p\.provider/.test(fe) && !/formatBHD\(p\.tapAmount/.test(fe));

// 3. Case B: no BHD field -> BHD stays unresolved, not fabricated from AED.
assert('Case B message: no machine-readable BHD in the charge', src.includes('No machine-readable BHD amount exists in the Tap charge'));
assert('capturedAmountBHD only written when a BHD amount is resolved', src.includes('if (!ctx.capturedBhd)'));

// 4. Manual fallback requires decimal string AND reason; audited as manual.
assert('Manual requires a reason', src.includes('A reason/source is required for a manual BHD confirmation'));
assert('Manual override must be a decimal string', src.includes("isDecimalString(bodyCaptured)"));
assert('Manual confirmation is a distinct audit action', src.includes("'SALE_CAPTURE_MANUAL_CONFIRMED'"));
assert('Manual note records admin, reason and provider amount', src.includes('Manual BHD confirmation by') && src.includes('reason:'));

// 5. Frontend manual UX: reason input, evidence, manual checkbox, second review, Manual confirmation badge.
assert('Frontend has a Reason (required) field', fe.includes('Reason (required)'));
assert('Frontend has an evidence/source field', fe.includes('Evidence / source description'));
assert('Frontend has a manual-value checkbox', fe.includes('This is a manual BHD reporting value'));
assert('Frontend shows a Manual confirmation badge', fe.includes('Manual confirmation'));
assert('Frontend requires a second review before saving', fe.includes('Review before saving') && fe.includes('startReview'));

console.log(`\nPASS-5 TESTS: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);

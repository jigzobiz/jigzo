/**
 * Pass-4 accounting-model tests (no DB).
 * Gross captured payment lives in capturedAmountBHD; confirmedSettlementBHD is
 * reserved for reconciled Tap statements and must NOT drive gross sales.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const L = require('../src/utils/adminBusinessLogic');

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => { console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? ' — ' + extra : ''}`); cond ? pass++ : fail++; };
const D = (s) => mongoose.Types.Decimal128.fromString(String(s));

const obOrder = { orderId: 'JZ-ORD-OB', paymentStatus: 'paid', currency: 'AED', total: 35 };

// 1. Gross sales come from capturedAmountBHD
assert('capturedAmountBHD=3.600 -> gross 3.600', L.getAuthoritativeBhdSaleAmount(obOrder, { capturedAmountBHD: D('3.600000') }) === '3.600');

// 2. confirmedSettlementBHD alone must NOT drive gross sales (kept for reconciliation)
assert('confirmedSettlementBHD alone does NOT set gross (returns null)',
  L.getAuthoritativeBhdSaleAmount(obOrder, { confirmedSettlementBHD: D('3.600000') }) === null);

// 3. Source-level guarantees in the repair endpoint
const src = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminRebuild.js'), 'utf8');
assert('Repair stores capturedAmountBHD', src.includes('capturedAmountBHD: toDecimal128(capturedBhd)'));
assert('Repair does NOT set confirmedSettlementBHD', !/confirmedSettlementBHD:\s*toDecimal128/.test(src));
assert('Repair leaves reconciliation Awaiting Statement', src.includes("reconciliationStatus: 'Awaiting Statement'"));
assert('Repair requires explicit confirmation', src.includes('body.confirm !== true'));
assert('Manual override must be a decimal string (not a JS number)', src.includes("typeof v === 'string' && /^\\d+(\\.\\d{1,6})?$/.test"));
assert('Preview endpoint exists', src.includes("router.get('/finance/repair-sale/:orderId/preview'"));
assert('Preview validates Tap status captured', src.includes("String(provider.status).toUpperCase() === 'CAPTURED'"));
assert('Preview scans the full charge for BHD evidence', src.includes('function findBhdAmount('));
assert('Identity is the puzzle sender (order owner), not a recipient', src.includes('customerName = pz.senderName') || src.includes('Sender = the customer'));
assert('Sale model has capturedAmountBHD field', fs.readFileSync(path.resolve(__dirname, '../src/models/Sale.js'), 'utf8').includes('capturedAmountBHD'));

// 4. Decimal-string validator behaviour (mirror of the endpoint rule)
const isDecimalString = (v) => typeof v === 'string' && /^\d+(\.\d{1,6})?$/.test(String(v).trim());
assert('"3.600" is a valid decimal string', isDecimalString('3.600'));
assert('number 3.6 is rejected (must be string)', !isDecimalString(3.6));
assert('"abc" is rejected', !isDecimalString('abc'));

console.log(`\nPASS-4 TESTS: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);

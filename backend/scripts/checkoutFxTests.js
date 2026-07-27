/**
 * Checkout FX tests — prove the live pricing engine converts a localised
 * display amount to BHD via the correct cross-rate (rateBhd/rateCur), and
 * never by multiplying the display amount by the USD->BHD rate (0.376).
 */
const { convertToBhdFils, createQuote } = require('../src/utils/checkoutQuote');

// Peg-consistent reference rates (USD base): 1 USD = 0.376 BHD = 3.67 AED = 0.92 EUR.
const rates = { USD: 1.0, BHD: 0.376, AED: 3.67, EUR: 0.92, GBP: 0.79, SAR: 3.75 };

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => { console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? ' — ' + extra : ''}`); cond ? pass++ : fail++; };
const bhd = (fils) => (fils / 1000).toFixed(3);

// The invalid computation the QA flagged: display * 0.376.
const invalidAed = Math.round(35 * 0.376 * 1000); // 13160 fils = 13.160 BHD

// 1. AED display -> BHD via cross rate, NOT display*0.376
const aedFils = convertToBhdFils(35, 'AED', rates);
assert('AED 35 does NOT convert to BHD 13.160', aedFils !== invalidAed, `got ${bhd(aedFils)}`);
assert('AED 35 -> ~BHD 3.586 via cross-rate', Math.abs(aedFils - 3586) <= 2, `got ${bhd(aedFils)}`);

// 2. USD display -> BHD (5 USD * 0.376 = 1.880) — here USD IS the base, so 0.376 is correct
const usdFils = convertToBhdFils(5, 'USD', rates);
assert('USD 5 -> BHD 1.880', bhd(usdFils) === '1.880', `got ${bhd(usdFils)}`);

// 3. EUR display -> BHD via cross rate (10 EUR * (0.376/0.92) = 4.087)
const eurFils = convertToBhdFils(10, 'EUR', rates);
assert('EUR 10 -> ~BHD 4.087 (cross-rate, not 10*0.376=3.760)', bhd(eurFils) !== '3.760' && Math.abs(eurFils - 4087) <= 2, `got ${bhd(eurFils)}`);

// 4. BHD display -> unchanged BHD
const bhdFils = convertToBhdFils(3.6, 'BHD', rates);
assert('BHD 3.600 display -> BHD 3.600 charge unchanged', bhd(bhdFils) === '3.600', `got ${bhd(bhdFils)}`);

// 5. Final quote: the formatted BHD equals finalBhdFils/1000 that is sent to Tap
const q = createQuote('celebration', false, 'AED', rates);
assert('Quote formattedBhdAmount equals finalBhdFils/1000 (final page == Tap charge)', q.formattedBhdAmount === (q.finalBhdFils / 1000).toFixed(3), `${q.formattedBhdAmount} vs ${(q.finalBhdFils / 1000).toFixed(3)}`);

// 6. Quote never uses display*0.376 for the BHD charge
const displayTimes0376 = Math.round(q.selectedTotal * 0.376 * 1000);
assert('Quote BHD charge is not display*0.376', q.finalBhdFils !== displayTimes0376 || q.selectedCurrency === 'USD', `fils ${q.finalBhdFils} vs invalid ${displayTimes0376}`);

console.log(`\nCHECKOUT FX TESTS: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);

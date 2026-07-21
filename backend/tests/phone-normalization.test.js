// Focused tests for the shared phone normalizer + validatePhone.
//
// Guards the Arabic-mobile bug: JS \d is ASCII-only, so the old validatePhone
// stripped Arabic-Indic/Persian digits to an empty subscriber number and
// rejected numbers that work fine when typed with English digits. These tests
// assert English and Arabic input produce the SAME E.164.
//
// Run: node tests/phone-normalization.test.js

const assert = require('assert');
const { normalizePhoneInput, validatePhone } = require('../src/utils/contactValidation');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}\n   ${err.message}`);
    process.exitCode = 1;
  }
}

// Digit-string helpers
const AR = { 0: '٠', 1: '١', 2: '٢', 3: '٣', 4: '٤', 5: '٥', 6: '٦', 7: '٧', 8: '٨', 9: '٩' };
const FA = { 0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹' };
const toArabic = (s) => String(s).replace(/[0-9]/g, (d) => AR[d]);
const toPersian = (s) => String(s).replace(/[0-9]/g, (d) => FA[d]);

// Canonical valid subscriber numbers
const UAE_LOCAL = '501234567';   // +9715........  (9 digits) => valid UAE mobile
const UAE_E164 = '+971501234567';
const BH_LOCAL = '33123456';     // +9733.......   (8 digits) => valid Bahrain mobile
const BH_E164 = '+97333123456';

// ---- normalizePhoneInput unit coverage -------------------------------------
check('normalize: Arabic-Indic digits -> ASCII', () => {
  assert.strictEqual(normalizePhoneInput(toArabic(BH_LOCAL)), BH_LOCAL);
});
check('normalize: Persian digits -> ASCII', () => {
  assert.strictEqual(normalizePhoneInput(toPersian(UAE_LOCAL)), UAE_LOCAL);
});
check('normalize: strips spaces, hyphens and brackets', () => {
  assert.strictEqual(normalizePhoneInput(' (33) 12-34 56 '), '33123456');
});
check('normalize: strips RTL/LTR/bidi control marks', () => {
  // RLM + LRM + Arabic Letter Mark + zero-width space wrapped around digits
  const wrapped = '‏‎؜33123456​';
  assert.strictEqual(normalizePhoneInput(wrapped), '33123456');
});
check('normalize: preserves a single leading + and drops extras', () => {
  assert.strictEqual(normalizePhoneInput('+9+73'), '+973');
  assert.strictEqual(normalizePhoneInput('+٩٧٣'), '+973');
});

// ---- validatePhone: per-country, per-script ---------------------------------
check('UAE with English digits validates to E.164', () => {
  const r = validatePhone(UAE_LOCAL, '+971');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, UAE_E164);
});
check('UAE with Arabic-Indic digits validates to E.164', () => {
  const r = validatePhone(toArabic(UAE_LOCAL), '+971');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, UAE_E164);
});
check('Bahrain with English digits validates to E.164', () => {
  const r = validatePhone(BH_LOCAL, '+973');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, BH_E164);
});
check('Bahrain with Arabic-Indic digits validates to E.164', () => {
  const r = validatePhone(toArabic(BH_LOCAL), '+973');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, BH_E164);
});
check('Persian digits validate to E.164', () => {
  const r = validatePhone(toPersian(BH_LOCAL), '+973');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, BH_E164);
});
check('Arabic-Indic dial code also normalizes', () => {
  const r = validatePhone(toArabic(BH_LOCAL), toArabic('+973'));
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, BH_E164);
});
check('copied number with spaces and hyphens validates', () => {
  const r = validatePhone(' 33-12 34 56 ', '+973');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, BH_E164);
});
check('copied Arabic number with spaces/hyphens + RTL marks validates', () => {
  const messy = '‏' + toArabic('33') + '-' + toArabic('12') + ' ' + toArabic('34') + '-' + toArabic('56');
  const r = validatePhone(messy, '+973');
  assert.ok(r.valid, 'expected valid');
  assert.strictEqual(r.e164, BH_E164);
});

// ---- English vs Arabic "page mode" parity ----------------------------------
check('EN and AR page input produce identical final E.164 (Bahrain)', () => {
  const en = validatePhone(BH_LOCAL, '+973');
  const ar = validatePhone(toArabic(BH_LOCAL), '+973');
  assert.ok(en.valid && ar.valid);
  assert.strictEqual(en.e164, ar.e164);
});
check('EN and AR page input produce identical final E.164 (UAE)', () => {
  const en = validatePhone(UAE_LOCAL, '+971');
  const ar = validatePhone(toArabic(UAE_LOCAL), '+971');
  assert.ok(en.valid && ar.valid);
  assert.strictEqual(en.e164, ar.e164);
});
check('sender-style full number (dial+phone concatenated) parity', () => {
  // Mirrors the payload: normalizePhoneInput(`${dial}${phone}`) then validate.
  const enFull = normalizePhoneInput('+973' + BH_LOCAL);
  const arFull = normalizePhoneInput('+973' + toArabic(BH_LOCAL));
  assert.strictEqual(enFull, arFull);
  assert.strictEqual(validatePhone(enFull).e164, BH_E164);
  assert.strictEqual(validatePhone(arFull).e164, BH_E164);
});

// ---- negative case: still rejects genuinely invalid input -------------------
check('empty / junk input remains invalid', () => {
  assert.strictEqual(validatePhone('', '+973').valid, false);
  assert.strictEqual(validatePhone('١٢', '+973').valid, false); // too short
});

console.log(`\n${passed} phone-normalization checks passed.`);
if (process.exitCode) {
  console.error('Phone normalization tests FAILED.');
} else {
  console.log('All phone normalization tests passed.');
}

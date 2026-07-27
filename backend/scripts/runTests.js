const mongoose = require('mongoose');
const Big = require('big.js');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();

const { validatePhone } = require('../src/utils/contactValidation');
const { toDecimal128, multiplyToBHD, sumBHD } = require('../src/utils/money');

// Mock mongoose schemas
const Category = require('../src/models/Category');
const Vendor = require('../src/models/Vendor');
const FxRate = require('../src/models/FxRate');
const Expense = require('../src/models/Expense');
const Customer = require('../src/models/Customer');
const Sale = require('../src/models/Sale');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');

async function testSuite() {
  console.log('--- STARTING AUTOMATED VALIDATION TEST SUITE ---');

  let passed = 0;
  let failed = 0;

  function assert(title, condition) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  }

  // 1. Big.js decimal accuracy tests
  const v1 = new Big('23.00');
  const v2 = new Big('0.376');
  const mult = v1.mul(v2).toFixed(3);
  assert('Big.js Multiplication (23.00 * 0.376 = 8.648)', mult === '8.648');

  // 2. Reject native JS numbers for financial input
  try {
    toDecimal128(23.00);
    assert('Reject native JS numbers for financial input', false);
  } catch (e) {
    assert('Reject native JS numbers for financial input', e.message.includes('must not accept native JS numbers'));
  }

  // 3. String validation passes cleanly
  try {
    const dec = toDecimal128('23.00');
    assert('Accept valid decimal strings', dec instanceof mongoose.Types.Decimal128);
  } catch (e) {
    assert('Accept valid decimal strings', false);
  }


  // 4. Phone normalization checks
  const phoneNormal = validatePhone('+97339999999');
  assert('Phone normalization valid', phoneNormal.valid === true && phoneNormal.e164 === '+97339999999');

  console.log(`\nTEST SUITE SUMMARY: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testSuite().catch(console.error);

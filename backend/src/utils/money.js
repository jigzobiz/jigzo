const Big = require('big.js');
const mongoose = require('mongoose');

function checkValueType(val) {
  if (typeof val === 'number') {
    throw new TypeError('Financial calculations must not accept native JS numbers. Use strings or Decimal128.');
  }
}

// Computes original amount * FX rate to BHD with strict precision
function multiplyToBHD(amountVal, rateVal) {
  if (amountVal == null || rateVal == null) return '0.000';
  checkValueType(amountVal);
  checkValueType(rateVal);
  
  const amountStr = typeof amountVal === 'object' ? amountVal.toString() : amountVal;
  const rateStr = typeof rateVal === 'object' ? rateVal.toString() : rateVal;

  const amount = new Big(amountStr);
  const rate = new Big(rateStr);
  return amount.times(rate).toFixed(3);
}

// Convert string/Decimal128 safely to Decimal128
function toDecimal128(val) {
  if (val == null) return mongoose.Types.Decimal128.fromString('0.000000');
  checkValueType(val);
  const str = typeof val === 'object' ? val.toString() : val;
  return mongoose.Types.Decimal128.fromString(new Big(str || 0).toFixed(6));
}

// Sum array of BHD amounts (represented as string or Decimal128)
function sumBHD(amounts) {
  let total = new Big(0);
  for (const amt of amounts) {
    if (amt == null) continue;
    checkValueType(amt);
    const val = typeof amt === 'object' ? amt.toString() : String(amt);
    total = total.plus(new Big(val || 0));
  }
  return total.toFixed(3);
}

module.exports = { multiplyToBHD, toDecimal128, sumBHD };

const Counter = require('../models/Counter');

async function getNextId(key, prefix) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const padded = String(counter.seq).padStart(6, '0');
  return `${prefix}-${padded}`;
}

async function getNextExpenseId(year) {
  const key = `expense-${year}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const padded = String(counter.seq).padStart(6, '0');
  return `JZ-EXP-${year}-${padded}`;
}

module.exports = { getNextId, getNextExpenseId };

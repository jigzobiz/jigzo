const Customer = require('../models/Customer');
const Counter = require('../models/Counter');
const { canonicalizeCustomerPhone } = require('../utils/contactValidation');

function orderActivityAt(order) {
  return order.paidAt || order.failedAt || order.createdAt || new Date();
}

async function findExistingCustomer(normalizedPhone) {
  const digits = normalizedPhone.replace(/^\+/, '');
  const variants = [normalizedPhone, digits, `00${digits}`];
  return Customer.findOne({
    $or: [
      { normalizedPhone: { $in: variants } },
      { primaryPhone: { $in: variants } }
    ]
  });
}

async function updateExisting(customer, order) {
  const orderDate = order.createdAt || orderActivityAt(order);
  const activityAt = orderActivityAt(order);
  const update = {
    $min: { firstOrderAt: orderDate },
    $max: { latestOrderAt: activityAt },
    $set: { updatedAt: new Date() }
  };
  return Customer.findOneAndUpdate(
    { _id: customer._id },
    update,
    { new: true }
  );
}

async function allocateCustomerId() {
  const counter = await Counter.findOneAndUpdate(
    { key: 'customer' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `JZ-CUS-${String(counter.seq).padStart(5, '0')}`;
}

/**
 * Idempotently creates/updates the purchaser represented by a real Order and
 * its authoritative Puzzle. Archive/suppression/account fields are untouched.
 */
async function upsertCustomerFromPuzzleOrder({ puzzle, order }) {
  if (!puzzle || !order) return null;
  const normalizedPhone = canonicalizeCustomerPhone(puzzle.senderPhone);
  if (!normalizedPhone) return null;

  let existing = await findExistingCustomer(normalizedPhone);
  if (existing) return updateExisting(existing, order);

  const customerId = await allocateCustomerId();
  const orderDate = order.createdAt || orderActivityAt(order);
  const activityAt = orderActivityAt(order);
  try {
    return await Customer.create({
      customerId,
      primaryPhone: normalizedPhone,
      normalizedPhone,
      name: puzzle.senderName || 'Unknown Customer',
      countryName: 'Unknown',
      accountStatus: 'none',
      firstOrderAt: orderDate,
      latestOrderAt: activityAt,
      createdAt: orderDate,
      updatedAt: new Date()
    });
  } catch (error) {
    // Redirect verification and webhook processing can race. The unique phone
    // index chooses the winner; the loser updates that same Customer.
    if (error && error.code === 11000) {
      existing = await findExistingCustomer(normalizedPhone);
      if (existing) return updateExisting(existing, order);
    }
    throw error;
  }
}

module.exports = { upsertCustomerFromPuzzleOrder, orderActivityAt, findExistingCustomer };

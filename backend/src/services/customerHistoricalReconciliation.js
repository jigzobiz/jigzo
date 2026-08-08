const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const L = require('../utils/adminBusinessLogic');
const { canonicalizeCustomerPhone } = require('../utils/contactValidation');
const { upsertCustomerFromPuzzleOrder } = require('./customerService');

const time = (value) => new Date(value).getTime();
const sameDate = (a, b) => (!!a === !!b) && (!a || time(a) === time(b));
const activityAt = (order) => order.paidAt || order.failedAt || order.createdAt;

function customerCanonicalIdentity(customer) {
  const normalized = canonicalizeCustomerPhone(customer.normalizedPhone);
  const primary = canonicalizeCustomerPhone(customer.primaryPhone);
  return {
    phone: normalized || primary,
    ambiguous: !!(normalized && primary && normalized !== primary)
  };
}

function buildPlan({ orders, puzzles, customers }) {
  const puzzleById = new Map(puzzles.map((p) => [p.publicId, p]));
  const customerGroups = new Map();
  let ambiguousPhoneMatches = 0;
  for (const customer of customers) {
    const identity = customerCanonicalIdentity(customer);
    if (identity.ambiguous) ambiguousPhoneMatches += 1;
    if (!identity.phone) continue;
    if (!customerGroups.has(identity.phone)) customerGroups.set(identity.phone, []);
    customerGroups.get(identity.phone).push(customer);
  }

  const histories = new Map();
  let unmatchableRecords = 0;
  let unmatchablePaidRecords = 0;
  for (const order of orders) {
    const paid = L.isCompletedPaidOrder(order);
    const abandoned = L.isAbandonedCheckout(order);
    if (!paid && !abandoned) continue;
    const puzzle = puzzleById.get(order.puzzleId);
    const phone = canonicalizeCustomerPhone(puzzle && puzzle.senderPhone);
    if (!puzzle || !phone || !order.createdAt || !activityAt(order)) {
      unmatchableRecords += 1;
      if (paid) unmatchablePaidRecords += 1;
      continue;
    }
    if (!histories.has(phone)) histories.set(phone, { phone, paid: false, records: [] });
    const history = histories.get(phone);
    history.paid = history.paid || paid;
    history.records.push({ order, puzzle });
  }

  const duplicateNormalizedCustomers = [...customerGroups.values()]
    .reduce((total, group) => total + Math.max(0, group.length - 1), 0);
  const creates = [];
  const updates = [];
  for (const history of histories.values()) {
    history.records.sort((a, b) => time(a.order.createdAt) - time(b.order.createdAt));
    const orders = history.records.map((record) => record.order);
    const firstOrderAt = orders[0].createdAt;
    const latestOrderAt = orders.reduce((latest, order) => (
      time(activityAt(order)) > time(latest) ? activityAt(order) : latest
    ), activityAt(orders[0]));
    const matches = customerGroups.get(history.phone) || [];
    if (matches.length === 0) {
      creates.push({ ...history, firstOrderAt, latestOrderAt });
      continue;
    }
    if (matches.length > 1) continue;
    const customer = matches[0];
    const material = customer.normalizedPhone !== history.phone ||
      customer.primaryPhone !== history.phone ||
      !sameDate(customer.firstOrderAt, firstOrderAt) ||
      !sameDate(customer.latestOrderAt, latestOrderAt);
    if (material) updates.push({ customer, phone: history.phone, firstOrderAt, latestOrderAt });
  }

  return {
    creates,
    updates,
    counts: {
      customersToCreateFromPaidOrders: creates.filter((item) => item.paid).length,
      customersToCreateFromAbandonedCheckouts: creates.filter((item) => !item.paid).length,
      existingCustomersToUpdate: updates.length,
      duplicateNormalizedCustomers,
      unmatchableRecords,
      unmatchablePaidRecords,
      ambiguousPhoneMatches
    }
  };
}

async function loadPlan() {
  const [orders, puzzles, customers] = await Promise.all([
    Order.find().lean(),
    Puzzle.find({}, { publicId: 1, senderPhone: 1, senderName: 1, createdAt: 1 }).lean(),
    Customer.find().lean()
  ]);
  return buildPlan({ orders, puzzles, customers });
}

async function dryRunCustomerReconciliation() {
  const plan = await loadPlan();
  return plan.counts;
}

async function applyCustomerReconciliation() {
  const plan = await loadPlan();
  const { counts } = plan;
  if (counts.duplicateNormalizedCustomers > 0 || counts.unmatchablePaidRecords > 0 || counts.ambiguousPhoneMatches > 0) {
    const error = new Error('Customer reconciliation safety check failed.');
    error.code = 'RECONCILIATION_BLOCKED';
    error.counts = counts;
    throw error;
  }

  let created = 0;
  let updated = 0;
  for (const item of plan.creates) {
    for (const record of item.records) {
      await upsertCustomerFromPuzzleOrder(record);
    }
    created += 1;
  }
  for (const item of plan.updates) {
    const result = await Customer.updateOne(
      { _id: item.customer._id },
      { $set: {
        normalizedPhone: item.phone,
        primaryPhone: item.phone,
        firstOrderAt: item.firstOrderAt,
        latestOrderAt: item.latestOrderAt,
        updatedAt: new Date()
      } }
    );
    if (result.modifiedCount > 0) updated += 1;
  }
  return { created, updated, ...counts };
}

module.exports = {
  buildPlan,
  dryRunCustomerReconciliation,
  applyCustomerReconciliation,
  customerCanonicalIdentity
};

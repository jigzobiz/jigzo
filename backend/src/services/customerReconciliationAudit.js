const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const L = require('../utils/adminBusinessLogic');
const { sumBHD } = require('../utils/money');
const { canonicalizeCustomerPhone } = require('../utils/contactValidation');

const digitKey = (value) => String(value || '').replace(/\D/g, '');
const addToMap = (map, key, value) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};
const dateMs = (value) => {
  const n = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(n) ? n : null;
};
const maxDate = (values) => {
  const dates = values.map(dateMs).filter((v) => v !== null);
  return dates.length ? Math.max(...dates) : null;
};

const currentAdminPhoneKey = (customer) => digitKey(customer.primaryPhone || customer.normalizedPhone);
const canonicalCustomerPhoneKey = (customer) => canonicalizeCustomerPhone(customer.normalizedPhone || customer.primaryPhone);

function aggregateCustomer({ customer, canonical, ordersByPhone, puzzlesByPhone, puzzleById, saleByOrderId }) {
  const key = canonical
    ? canonicalCustomerPhoneKey(customer)
    : currentAdminPhoneKey(customer);
  const orders = ordersByPhone.get(key) || [];
  const puzzles = puzzlesByPhone.get(key) || [];
  const completed = orders.filter(L.isCompletedPaidOrder);
  const abandoned = orders.filter(L.isAbandonedCheckout);
  return {
    completed: completed.length,
    abandoned: abandoned.length,
    paidPuzzles: L.countPaidRecipientPuzzles(completed, puzzleById),
    totalSpend: sumBHD(completed.map((o) => L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || '0.000')),
    latestActivity: maxDate([
      customer.latestOrderAt,
      customer.createdAt,
      ...puzzles.map((p) => p.createdAt),
      ...orders.map((o) => o.paidAt || o.failedAt || o.createdAt)
    ])
  };
}

async function runCustomerReconciliationAudit() {
  const [orders, puzzles, sales, customers] = await Promise.all([
    Order.find().lean(),
    Puzzle.find({}, { publicId: 1, senderPhone: 1, recipients: 1, createdAt: 1 }).lean(),
    Sale.find().lean(),
    Customer.find().lean()
  ]);
  const puzzleById = new Map(puzzles.map((p) => [p.publicId, p]));
  const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));
  const paidOrders = orders.filter(L.isCompletedPaidOrder);

  const customerGroups = new Map();
  for (const customer of customers) {
    addToMap(customerGroups, canonicalCustomerPhoneKey(customer), customer);
  }
  const customerPhones = new Set(customerGroups.keys());

  const paidPhones = new Set();
  let unmatchablePaidOrders = 0;
  for (const order of paidOrders) {
    const puzzle = puzzleById.get(order.puzzleId);
    const phone = canonicalizeCustomerPhone(puzzle && puzzle.senderPhone);
    if (!puzzle || !phone) unmatchablePaidOrders += 1;
    else paidPhones.add(phone);
  }

  const abandonedPhones = new Set();
  for (const order of orders.filter(L.isAbandonedCheckout)) {
    const puzzle = puzzleById.get(order.puzzleId);
    const phone = canonicalizeCustomerPhone(puzzle && puzzle.senderPhone);
    if (phone) abandonedPhones.add(phone);
  }

  const digitOrders = new Map();
  const canonicalOrders = new Map();
  const digitPuzzles = new Map();
  const canonicalPuzzles = new Map();
  for (const puzzle of puzzles) {
    addToMap(digitPuzzles, digitKey(puzzle.senderPhone), puzzle);
    addToMap(canonicalPuzzles, canonicalizeCustomerPhone(puzzle.senderPhone), puzzle);
  }
  for (const order of orders) {
    const puzzle = puzzleById.get(order.puzzleId);
    addToMap(digitOrders, digitKey(puzzle && puzzle.senderPhone), order);
    addToMap(canonicalOrders, canonicalizeCustomerPhone(puzzle && puzzle.senderPhone), order);
  }

  let stalePaidPuzzleTotals = 0;
  let staleTotalSpendTotals = 0;
  let staleLatestActivity = 0;
  let staleCompletedTotals = 0;
  let staleAbandonedTotals = 0;
  for (const customer of customers) {
    const current = aggregateCustomer({ customer, canonical: false, ordersByPhone: digitOrders, puzzlesByPhone: digitPuzzles, puzzleById, saleByOrderId });
    const canonical = aggregateCustomer({ customer, canonical: true, ordersByPhone: canonicalOrders, puzzlesByPhone: canonicalPuzzles, puzzleById, saleByOrderId });
    if (current.paidPuzzles !== canonical.paidPuzzles) stalePaidPuzzleTotals += 1;
    if (current.totalSpend !== canonical.totalSpend) staleTotalSpendTotals += 1;
    if (current.latestActivity !== canonical.latestActivity) staleLatestActivity += 1;
    if (current.completed !== canonical.completed) staleCompletedTotals += 1;
    if (current.abandoned !== canonical.abandoned) staleAbandonedTotals += 1;
  }

  return {
    successfulPaidOrders: paidOrders.length,
    saleRecords: sales.length,
    customerRecords: customers.length,
    uniqueNormalizedPaidPhones: paidPhones.size,
    missingPaidCustomers: [...paidPhones].filter((phone) => !customerPhones.has(phone)).length,
    stalePaidPuzzleTotals,
    staleTotalSpendTotals,
    staleLatestActivity,
    staleCompletedTotals,
    staleAbandonedTotals,
    duplicateNormalizedCustomers: [...customerGroups.values()].reduce((n, group) => n + Math.max(0, group.length - 1), 0),
    unmatchablePaidOrders,
    genuineAbandonedCheckoutPhonesMissingFromCustomer: [...abandonedPhones].filter((phone) => !customerPhones.has(phone)).length
  };
}

module.exports = { runCustomerReconciliationAudit };

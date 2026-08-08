const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const PaymentTransaction = require('../models/PaymentTransaction');
const Sale = require('../models/Sale');
const JourneyEvent = require('../models/JourneyEvent');
const AnonymousSession = require('../models/AnonymousSession');
const { canonicalizeCustomerPhone } = require('../utils/contactValidation');

const canonicalCustomerPhone = (customer) => {
  const normalized = canonicalizeCustomerPhone(customer && customer.normalizedPhone);
  const primary = canonicalizeCustomerPhone(customer && customer.primaryPhone);
  if (normalized && primary && normalized !== primary) return { ambiguous: true, phone: null };
  return { ambiguous: false, phone: normalized || primary };
};

function containsCaptured(value, seen = new Set()) {
  if (typeof value === 'string') return value.toUpperCase() === 'CAPTURED';
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => containsCaptured(item, seen));
}

function assessFinancialHistory({ customer, puzzles, orders, paymentTransactions, sales }) {
  const identity = canonicalCustomerPhone(customer).phone;
  const puzzleIds = new Set(puzzles.map((puzzle) => puzzle.publicId));
  const orderIds = new Set(orders.map((order) => order.orderId));
  const orderMongoIds = new Set(orders.map((order) => String(order._id || '')));
  const paidOrder = orders.some((order) => ['paid', 'refunded'].includes(order.paymentStatus) ||
    String(order.providerStatus || '').toUpperCase() === 'CAPTURED' ||
    (order.paymentAttempts || []).some((attempt) => String(attempt.providerStatus || '').toUpperCase() === 'CAPTURED'));
  const paidPuzzle = puzzles.some((puzzle) =>
    ['paid', 'preparing', 'ready', 'partially_delivered', 'delivered'].includes(puzzle.status));
  const capturedTransaction = paymentTransactions.some((transaction) =>
    (puzzleIds.has(transaction.puzzleId) || orderMongoIds.has(String(transaction.orderId || ''))) &&
    (transaction.status === 'succeeded' || containsCaptured(transaction.rawResponse)));
  const financialSale = sales.some((sale) =>
    sale.customerId === customer.customerId || orderIds.has(sale.orderId) ||
    canonicalizeCustomerPhone(sale.customerPhone) === identity);
  return { blocked: paidOrder || paidPuzzle || capturedTransaction || financialSale };
}

async function loadDeletionContext(customerId, session) {
  const customer = await Customer.findOne({ customerId }).session(session).lean();
  if (!customer) return { customer: null };
  const identity = canonicalCustomerPhone(customer);
  if (identity.ambiguous || !identity.phone) return { customer, identity, ambiguous: true };

  const allCustomers = await Customer.find({}, { normalizedPhone: 1, primaryPhone: 1 }).session(session).lean();
  const identityMatches = allCustomers.filter((candidate) => canonicalCustomerPhone(candidate).phone === identity.phone);
  if (identityMatches.length !== 1) return { customer, identity, ambiguous: true };

  const allPuzzles = await Puzzle.find({}, {
    _id: 1, publicId: 1, senderPhone: 1, status: 1, customerIdentityRedacted: 1
  }).session(session).lean();
  const puzzles = allPuzzles.filter((puzzle) =>
    !puzzle.customerIdentityRedacted && canonicalizeCustomerPhone(puzzle.senderPhone) === identity.phone);
  const puzzleIds = puzzles.map((puzzle) => puzzle.publicId);
  const orders = puzzleIds.length
    ? await Order.find({ puzzleId: { $in: puzzleIds } }).session(session).lean()
    : [];
  const orderMongoIds = orders.map((order) => order._id).filter(Boolean);
  const paymentTransactions = (puzzleIds.length || orderMongoIds.length)
    ? await PaymentTransaction.find({ $or: [
      { puzzleId: { $in: puzzleIds } }, { orderId: { $in: orderMongoIds } }
    ] }).session(session).lean()
    : [];
  const sales = await Sale.find().session(session).lean();
  return { customer, identity, puzzles, orders, paymentTransactions, sales };
}

async function deleteCustomerSafely(customerId) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const context = await loadDeletionContext(customerId, session);
      if (!context.customer) {
        result = { success: true, alreadyDeleted: true, redactedPuzzles: 0 };
        return;
      }
      if (context.ambiguous) {
        const error = new Error('Customer identity is ambiguous and cannot be safely deleted.');
        error.code = 'CUSTOMER_IDENTITY_AMBIGUOUS';
        throw error;
      }
      if (assessFinancialHistory(context).blocked) {
        const error = new Error('Customers with payment history cannot be permanently deleted.');
        error.code = 'CUSTOMER_HAS_PAID_HISTORY';
        throw error;
      }

      const puzzleMongoIds = context.puzzles.map((puzzle) => puzzle._id);
      if (puzzleMongoIds.length) {
        await Puzzle.updateMany(
          { _id: { $in: puzzleMongoIds }, status: { $ne: 'paid' } },
          { $set: {
            senderName: '', senderPhone: '', customerIdentityRedacted: true,
            customerIdentityRedactedAt: new Date(), customerIdentityRedactionReason: 'admin_test_customer_deletion'
          } }, { session }
        );
      }
      await JourneyEvent.updateMany({ customerId: context.customer._id }, { $set: { customerId: null } }, { session });
      await AnonymousSession.updateMany({ customerId: context.customer._id }, { $set: { customerId: null } }, { session });
      const deletion = await Customer.deleteOne({ _id: context.customer._id }, { session });
      if (deletion.deletedCount !== 1) throw new Error('Customer deletion did not complete.');
      result = { success: true, alreadyDeleted: false, redactedPuzzles: puzzleMongoIds.length };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  assessFinancialHistory,
  canonicalCustomerPhone,
  containsCaptured,
  deleteCustomerSafely,
  loadDeletionContext
};

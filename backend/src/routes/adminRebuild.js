/**
 * Rebuilt JIGZO Admin API (v2).
 *
 * Reads are strictly derived through the shared business-logic utilities in
 * utils/adminBusinessLogic so every surface counts, dedupes and converts money
 * identically. Money is always the authoritative BHD amount actually captured
 * by Tap (order.finalBhdFils) — a localised display amount (e.g. AED 35) is
 * never multiplied by an unrelated USD->BHD rate.
 *
 * Write endpoints are limited to ADMIN-ONLY collections:
 *  - expenses      (founder expense management; soft-delete/archive + audit)
 *  - customers     (admin archive/suppress only; operational records untouched)
 * Operational customer-facing collections (puzzles, recipients, orders,
 * payments, notificationrequests) are never mutated here, so live checkout /
 * WhatsApp / puzzle / reveal behaviour is untouched.
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const PaymentTransaction = require('../models/PaymentTransaction');
const Expense = require('../models/Expense');
const Sale = require('../models/Sale');
const FxRate = require('../models/FxRate');
const Category = require('../models/Category');
const Vendor = require('../models/Vendor');
const ReconciliationBatch = require('../models/ReconciliationBatch');
const WaitlistAdminMeta = require('../models/WaitlistAdminMeta');
const NotificationRequest = require('../models/NotificationRequest');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');

const { resolveJwtSecret } = require('../utils/runtimeConfig');
const { sumBHD, toDecimal128, multiplyToBHD } = require('../utils/money');
const L = require('../utils/adminBusinessLogic');
const paymentService = require('../services/paymentService');

const JWT_SECRET = resolveJwtSecret();

// --- Auth (same JWT as the existing admin login) ---
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });
  const token = authHeader.split(' ')[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
};

// --- helpers ---
const dec = (v) => {
  if (v === null || v === undefined) return null;
  try { return typeof v === 'object' ? v.toString() : String(v); } catch (e) { return null; }
};
const bhd3 = (v) => { const s = dec(v); if (!s) return '0.000'; try { return sumBHD([s]); } catch (e) { return '0.000'; } };
const digits = L.normalizeCustomerIdentity;

const audit = (req, action, targetModel, targetId, reason, before, after) => {
  new AuditLog({
    adminUserId: (req.admin && req.admin.id) || new mongoose.Types.ObjectId(),
    action, targetModel, targetId: targetId ? String(targetId) : undefined,
    reason: reason || '', beforeValues: before || {}, afterValues: after || {},
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '', userAgent: req.headers['user-agent'] || ''
  }).save().catch((e) => console.error(`Audit ${action} failed:`, e.message));
};

// A customer we recognise: has a real sender phone (>= 7 digits). Waitlist
// email-only rows are NOT customers and are excluded here.
const hasValidIdentity = (c) => digits(c.normalizedPhone || c.primaryPhone).length >= 7;

/** Build the per-customer aggregate from orders + puzzles keyed by phone. */
function buildCustomerStats(customers, orders, puzzles, saleByOrderId = new Map()) {
  const puzzleByPublicId = new Map(puzzles.map((p) => [p.publicId, p]));
  // orders grouped by sender phone (resolved through their puzzle)
  const ordersByPhone = new Map();
  for (const o of orders) {
    const pz = puzzleByPublicId.get(o.puzzleId);
    const phone = digits(pz && pz.senderPhone);
    if (!phone) continue;
    if (!ordersByPhone.has(phone)) ordersByPhone.set(phone, []);
    ordersByPhone.get(phone).push(o);
  }
  const puzzlesByPhone = new Map();
  for (const p of puzzles) {
    const phone = digits(p.senderPhone);
    if (!phone) continue;
    if (!puzzlesByPhone.has(phone)) puzzlesByPhone.set(phone, []);
    puzzlesByPhone.get(phone).push(p);
  }

  return customers.map((c) => {
    const phone = digits(c.normalizedPhone || c.primaryPhone);
    const myOrders = ordersByPhone.get(phone) || [];
    const completed = myOrders.filter(L.isCompletedPaidOrder);
    const abandoned = myOrders.filter(L.isAbandonedCheckout);
    const paidPuzzles = L.countPaidRecipientPuzzles(completed, puzzleByPublicId);
    const spend = sumBHD(completed.map((o) => L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || '0.000'));
    const myPuzzles = puzzlesByPhone.get(phone) || [];
    const activityDates = [c.latestOrderAt, c.createdAt, ...myPuzzles.map((p) => p.createdAt), ...myOrders.map((o) => o.paidAt || o.createdAt)]
      .filter(Boolean).map((d) => new Date(d).getTime());
    const latestActivity = activityDates.length ? new Date(Math.max(...activityDates)) : c.createdAt;

    let status;
    if (c.isArchived) status = c.adminSuppressed ? 'Archived test customer' : 'Archived';
    else if (completed.length > 0) status = 'Paying customer';
    else if (abandoned.length > 0) status = 'Abandoned checkout';
    else status = 'No completed purchase';

    return {
      customerId: c.customerId,
      name: c.name || 'Unknown',
      primaryPhone: c.primaryPhone,
      countryName: c.countryName || 'Unknown',
      email: c.email || '',
      completedOrders: completed.length,
      abandonedCheckouts: abandoned.length,
      paidPuzzles,
      totalSpendBHD: spend,
      latestActivity,
      status,
      isArchived: !!c.isArchived,
      createdAt: c.createdAt,
      _phone: phone
    };
  });
}

// ============================================================================
// HOME
// ============================================================================
router.get('/home', authenticateAdmin, async (req, res, next) => {
  try {
    const [orders, puzzles, expenses, customers, sales] = await Promise.all([
      Order.find().lean(),
      Puzzle.find({}, { publicId: 1, senderPhone: 1, recipients: 1, createdAt: 1 }).lean(),
      Expense.find({ isArchived: { $ne: true } }).lean(),
      Customer.find({ isArchived: { $ne: true } }).lean(),
      Sale.find().lean()
    ]);
    const puzzleByPublicId = new Map(puzzles.map((p) => [p.publicId, p]));
    const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));

    const paidOrders = orders.filter(L.isCompletedPaidOrder);
    const abandonedOrders = orders.filter(L.isAbandonedCheckout);

    const salesBHD = sumBHD(paidOrders.map((o) => L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || '0.000'));
    const expensesBHD = sumBHD(expenses.map((e) => dec(e.amountBHD)));
    const netBHD = sumBHD([salesBHD, '-' + expensesBHD]);
    const paidPuzzles = L.countPaidRecipientPuzzles(paidOrders, puzzleByPublicId);

    const validCustomers = customers.filter(hasValidIdentity);
    const stats = buildCustomerStats(validCustomers, orders, puzzles, saleByOrderId);
    const payingCustomers = stats.filter((s) => s.completedOrders > 0).length;
    const noPurchase = stats.length - payingCustomers;

    // Expense charts (real data)
    const byCategory = {};
    for (const e of expenses) { const k = e.category || 'Other'; byCategory[k] = sumBHD([byCategory[k] || '0.000', dec(e.amountBHD)]); }
    const byMonth = {};
    for (const e of expenses) { if (!e.date) continue; const d = new Date(e.date); const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; byMonth[k] = sumBHD([byMonth[k] || '0.000', dec(e.amountBHD)]); }

    res.json({
      success: true,
      currency: 'BHD',
      totals: { salesBHD, expensesBHD, netBHD, capturedSales: paidOrders.length, expenseCount: expenses.length },
      counts: {
        completedOrders: paidOrders.length,
        abandonedCheckouts: abandonedOrders.length,
        paidPuzzles,
        customers: validCustomers.length,
        payingCustomers,
        customersWithoutPurchase: noPurchase
      },
      charts: {
        expensesByCategory: Object.entries(byCategory).map(([category, amountBHD]) => ({ category, amountBHD })).sort((a, b) => parseFloat(b.amountBHD) - parseFloat(a.amountBHD)),
        expenseTrend: Object.entries(byMonth).map(([month, amountBHD]) => ({ month, amountBHD })).sort((a, b) => a.month.localeCompare(b.month))
      }
    });
  } catch (err) { next(err); }
});

// ============================================================================
// CUSTOMERS
// ============================================================================
router.get('/customers', authenticateAdmin, async (req, res, next) => {
  try {
    const filter = req.query.filter || 'active'; // active | archived | all
    const [customers, orders, puzzles, sales] = await Promise.all([
      Customer.find().sort({ createdAt: -1 }).lean(),
      Order.find().lean(),
      Puzzle.find({}, { publicId: 1, senderPhone: 1, recipients: 1, createdAt: 1 }).lean(),
      Sale.find().lean()
    ]);
    const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));
    const valid = customers.filter(hasValidIdentity);
    let stats = buildCustomerStats(valid, orders, puzzles, saleByOrderId);
    if (filter === 'active') stats = stats.filter((s) => !s.isArchived);
    else if (filter === 'archived') stats = stats.filter((s) => s.isArchived);

    stats.forEach((s) => delete s._phone);
    res.json({ success: true, currency: 'BHD', count: stats.length, filter, list: stats });
  } catch (err) { next(err); }
});

router.get('/customers/:customerId', authenticateAdmin, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    const phone = digits(customer.normalizedPhone || customer.primaryPhone);

    const [orders, puzzles, sales] = await Promise.all([Order.find().lean(), Puzzle.find().lean(), Sale.find().lean()]);
    const puzzleByPublicId = new Map(puzzles.map((p) => [p.publicId, p]));
    const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));
    const myOrders = orders.filter((o) => { const pz = puzzleByPublicId.get(o.puzzleId); return digits(pz && pz.senderPhone) === phone; });
    const completed = myOrders.filter(L.isCompletedPaidOrder);
    const abandoned = myOrders.filter(L.isAbandonedCheckout);
    const myPuzzles = puzzles.filter((p) => digits(p.senderPhone) === phone);

    const paidPuzzleIds = new Set(completed.map((o) => o.puzzleId));
    const mapPuzzle = (p, paid) => ({
      publicId: p.publicId, status: p.status, occasion: p.occasion || '',
      recipientCount: (p.recipients && p.recipients.length) || 0, paid,
      recipients: (p.recipients || []).map((r) => ({ name: r.name, deliveryMethod: r.deliveryMethod || 'whatsapp', state: L.getRecipientOperationalState(r), deliveryTracking: L.getDeliveryTracking(r) })),
      createdAt: p.createdAt
    });

    res.json({
      success: true,
      currency: 'BHD',
      customer: {
        customerId: customer.customerId, name: customer.name || 'Unknown', primaryPhone: customer.primaryPhone,
        countryName: customer.countryName || 'Unknown', email: customer.email || '', accountStatus: customer.accountStatus,
        isArchived: !!customer.isArchived, createdAt: customer.createdAt
      },
      totals: {
        completedOrders: completed.length,
        abandonedCheckouts: abandoned.length,
        paidPuzzles: L.countPaidRecipientPuzzles(completed, puzzleByPublicId),
        totalSpendBHD: sumBHD(completed.map((o) => L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || '0.000'))
      },
      sales: completed.map((o) => ({
        orderId: o.orderId, saleReference: o.providerChargeId || o.paymentReference || o.orderId, date: o.paidAt || o.createdAt,
        amountBHD: L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || '0.000',
        displayAmount: o.checkoutDisplayAmount ? L.formatCurrencyAmount(o.checkoutDisplayAmount, o.checkoutDisplayCurrency) : null,
        displayCurrency: o.checkoutDisplayCurrency || o.currency
      })),
      paidHistory: myPuzzles.filter((p) => paidPuzzleIds.has(p.publicId)).map((p) => mapPuzzle(p, true)),
      failedAttempts: myPuzzles.filter((p) => !paidPuzzleIds.has(p.publicId)).map((p) => mapPuzzle(p, false))
    });
  } catch (err) { next(err); }
});

// Archive (soft) — always allowed. Excludes from default lists; restorable.
router.post('/customers/:customerId/archive', authenticateAdmin, async (req, res, next) => {
  try {
    const c = await Customer.findOne({ customerId: req.params.customerId });
    if (!c) return res.status(404).json({ error: 'Customer not found.' });
    c.isArchived = true; c.updatedAt = new Date();
    await c.save();
    audit(req, 'ADMIN_CUSTOMER_ARCHIVED', 'Customer', c.customerId, 'Archived from admin', { isArchived: false }, { isArchived: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/customers/:customerId/restore', authenticateAdmin, async (req, res, next) => {
  try {
    const c = await Customer.findOne({ customerId: req.params.customerId });
    if (!c) return res.status(404).json({ error: 'Customer not found.' });
    c.isArchived = false; c.adminSuppressed = false; c.updatedAt = new Date();
    await c.save();
    audit(req, 'ADMIN_CUSTOMER_RESTORED', 'Customer', c.customerId, 'Restored from admin', { isArchived: true }, { isArchived: false });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Delete a TEST customer that has never captured a payment. Suppresses the
// admin record (isArchived + adminSuppressed) so operational records are
// preserved and a routine refresh will not resurface it. Refuses if any
// captured/paid order exists — the caller must archive instead.
router.delete('/customers/:customerId', authenticateAdmin, async (req, res, next) => {
  try {
    const c = await Customer.findOne({ customerId: req.params.customerId });
    if (!c) return res.status(404).json({ error: 'Customer not found.' });
    const phone = digits(c.normalizedPhone || c.primaryPhone);
    const puzzles = await Puzzle.find({}, { publicId: 1, senderPhone: 1 }).lean();
    const myPuzzleIds = puzzles.filter((p) => digits(p.senderPhone) === phone).map((p) => p.publicId);
    const paid = await Order.findOne({ puzzleId: { $in: myPuzzleIds }, paymentStatus: 'paid' }).lean();
    if (paid) {
      return res.status(409).json({ error: 'This customer has a captured sale. Archive instead of deleting to preserve financial and order history.' });
    }
    c.isArchived = true; c.adminSuppressed = true; c.updatedAt = new Date();
    await c.save();
    audit(req, 'ADMIN_TEST_CUSTOMER_DELETED', 'Customer', c.customerId, 'Deleted test customer (no captured payment); admin record suppressed, operational records preserved', { isArchived: false }, { isArchived: true, adminSuppressed: true });
    res.json({ success: true, suppressed: true });
  } catch (err) { next(err); }
});

// ============================================================================
// ORDERS & PUZZLES  (?status=completed|abandoned|all, default completed)
// ============================================================================
router.get('/orders', authenticateAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'completed';
    const [orders, puzzles, sales] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).lean(),
      Puzzle.find().lean(),
      Sale.find().lean()
    ]);
    const puzzleByPublicId = new Map(puzzles.map((p) => [p.publicId, p]));
    const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));

    let filtered = orders;
    if (status === 'completed') filtered = orders.filter(L.isCompletedPaidOrder);
    else if (status === 'abandoned') filtered = orders.filter(L.isAbandonedCheckout);

    const map = (o) => {
      const pz = puzzleByPublicId.get(o.puzzleId);
      const recipients = (pz && pz.recipients) || [];
      const paid = L.isCompletedPaidOrder(o);
      return {
        orderId: o.orderId, puzzleId: o.puzzleId, packageId: o.packageId, paymentStatus: o.paymentStatus,
        completed: paid,
        // Only paid orders contribute paid puzzles; abandoned show attempt count.
        puzzleCount: recipients.length,
        amountBHD: paid ? (L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || null) : null,
        displayAmount: o.checkoutDisplayAmount ? L.formatCurrencyAmount(o.checkoutDisplayAmount, o.checkoutDisplayCurrency) : null,
        displayCurrency: o.checkoutDisplayCurrency || o.currency,
        createdAt: o.createdAt, paidAt: o.paidAt || null,
        recipients: recipients.map((r) => r.name)
      };
    };

    const counts = {
      completed: orders.filter(L.isCompletedPaidOrder).length,
      abandoned: orders.filter(L.isAbandonedCheckout).length,
      all: orders.length
    };
    res.json({ success: true, currency: 'BHD', status, counts, count: filtered.length, list: filtered.map(map) });
  } catch (err) { next(err); }
});

// Order detail — resilient. 404 for unknown, never 500 on a bad cast.
router.get('/orders/:orderId', authenticateAdmin, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const puzzle = await Puzzle.findOne({ publicId: order.puzzleId }).lean();
    const sale = await Sale.findOne({ orderId: order.orderId }).lean();
    // PaymentTransaction.orderId is an ObjectId ref — only query it with the
    // order's ObjectId, never the public string id (which would CastError->500).
    let payment = null;
    try {
      if (order._id) payment = await PaymentTransaction.findOne({ orderId: order._id }).lean();
    } catch (e) { payment = null; }

    const paid = L.isCompletedPaidOrder(order);
    res.json({
      success: true,
      currency: 'BHD',
      order: {
        orderId: order.orderId, puzzleId: order.puzzleId, packageId: order.packageId,
        recipientCount: order.recipientCount, paymentStatus: order.paymentStatus, completed: paid,
        createdAt: order.createdAt, paidAt: order.paidAt || null
      },
      payment: {
        amountBHD: L.getAuthoritativeBhdSaleAmount(order, sale) || null,
        displayAmount: order.checkoutDisplayAmount ? L.formatCurrencyAmount(order.checkoutDisplayAmount, order.checkoutDisplayCurrency) : null,
        displayCurrency: order.checkoutDisplayCurrency || order.currency,
        saleReference: (sale && sale.saleReference) || order.providerChargeId || null,
        paymentStatus: order.paymentStatus,
        providerStatus: (payment && payment.status) || order.providerStatus || null
      },
      puzzles: puzzle
        ? (puzzle.recipients || []).map((r, i) => ({
            index: i, recipientName: r.name, deliveryMethod: r.deliveryMethod || 'whatsapp',
            state: L.getRecipientOperationalState(r), deliveryTracking: L.getDeliveryTracking(r),
            openedAt: r.openedAt || null, completedAt: r.completedAt || null, sentAt: r.sentAt || null
          }))
        : []
    });
  } catch (err) { next(err); }
});

// ============================================================================
// DELIVERY CENTRE  (?scope=completed|abandoned|all, default completed)
// ============================================================================
router.get('/delivery', authenticateAdmin, async (req, res, next) => {
  try {
    const scope = req.query.scope || 'completed';
    const [orders, puzzles] = await Promise.all([Order.find().lean(), Puzzle.find().sort({ createdAt: -1 }).lean()]);

    const orderByPuzzleId = new Map();
    for (const o of orders) { if (!orderByPuzzleId.has(o.puzzleId)) orderByPuzzleId.set(o.puzzleId, o); }
    const paidPuzzleIds = new Set(orders.filter(L.isCompletedPaidOrder).map((o) => o.puzzleId));
    const abandonedPuzzleIds = new Set(orders.filter(L.isAbandonedCheckout).map((o) => o.puzzleId));

    let scoped = puzzles;
    if (scope === 'completed') scoped = puzzles.filter((p) => paidPuzzleIds.has(p.publicId));
    else if (scope === 'abandoned') scoped = puzzles.filter((p) => abandonedPuzzleIds.has(p.publicId) && !paidPuzzleIds.has(p.publicId));

    const recipientContact = (r) => (r.deliveryMethod === 'email' ? (r.email || '') : (r.phoneE164 || `${r.countryCode || ''}${r.phone || ''}`.trim()));

    const rows = [];
    const summary = { total: 0, pending: 0, delivered: 0, sent: 0, opened: 0, solved: 0, conflicts: 0, failed: 0, manuallyProvided: 0 };
    for (const p of scoped) {
      const order = orderByPuzzleId.get(p.publicId);
      for (let i = 0; i < (p.recipients || []).length; i++) {
        const r = p.recipients[i];
        const state = L.getRecipientOperationalState(r);
        const conflicts = L.detectRecipientConflicts(r, p);
        const tracking = L.getDeliveryTracking(r);
        summary.total++;
        if (summary[state] !== undefined) summary[state]++;
        if (conflicts.length) summary.conflicts++;
        if (tracking === 'Failed') summary.failed++;
        if (r.manualLinkProvidedAt) summary.manuallyProvided++;
        rows.push({
          orderId: order ? order.orderId : null,
          orderPaid: order ? L.isCompletedPaidOrder(order) : false,
          puzzleId: p.publicId, puzzleMongoId: String(p._id), recipientIndex: i,
          senderName: p.senderName || '', senderPhone: p.senderPhone || '',
          recipientName: r.name, recipientContact: recipientContact(r),
          deliveryMethod: r.deliveryMethod || 'whatsapp',
          state, deliveryTracking: tracking,
          providerSendStatus: r.whatsappSendStatus || r.deliveryStatus || 'pending',
          providerMessageId: r.providerMessageId || '',
          sentAt: r.sentAt || r.whatsappSentAt || null,
          deliveredAt: r.whatsappDeliveredAt || null,
          openedAt: r.openedAt || r.whatsappReadAt || null,
          completedAt: r.completedAt || null,
          completionSeconds: r.completionSeconds != null ? r.completionSeconds : null,
          manualLinkProvidedAt: r.manualLinkProvidedAt || null,
          manualLinkProvidedByUsername: r.manualLinkProvidedByUsername || '',
          lastError: r.whatsappLastErrorMessage || r.lastError || '',
          tapReference: order ? (order.providerChargeId || '') : '',
          conflicts
        });
      }
    }
    res.json({ success: true, scope, summary, list: rows });
  } catch (err) { next(err); }
});

// ============================================================================
// FINANCE  (sales derived from authoritative captured BHD, not migrated Sale)
// ============================================================================
router.get('/finance/overview', authenticateAdmin, async (req, res, next) => {
  try {
    const [orders, expenses, sales] = await Promise.all([Order.find().lean(), Expense.find({ isArchived: { $ne: true } }).lean(), Sale.find().lean()]);
    const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));
    const paidOrders = orders.filter(L.isCompletedPaidOrder);
    const salesBHD = sumBHD(paidOrders.map((o) => L.getAuthoritativeBhdSaleAmount(o, saleByOrderId.get(o.orderId)) || '0.000'));
    const expensesBHD = sumBHD(expenses.map((e) => dec(e.amountBHD)));
    const byCategory = {};
    for (const e of expenses) { const k = e.category || 'Other'; byCategory[k] = sumBHD([byCategory[k] || '0.000', dec(e.amountBHD)]); }
    res.json({
      success: true, currency: 'BHD', salesBHD, expensesBHD, netBHD: sumBHD([salesBHD, '-' + expensesBHD]),
      capturedSaleCount: paidOrders.length, expenseCount: expenses.length,
      expensesByCategory: Object.entries(byCategory).map(([category, amountBHD]) => ({ category, amountBHD })).sort((a, b) => parseFloat(b.amountBHD) - parseFloat(a.amountBHD))
    });
  } catch (err) { next(err); }
});

router.get('/finance/sales', authenticateAdmin, async (req, res, next) => {
  try {
    const [orders, puzzles, sales] = await Promise.all([
      Order.find({ paymentStatus: 'paid' }).sort({ paidAt: -1 }).lean(),
      Puzzle.find({}, { publicId: 1, senderName: 1, senderPhone: 1 }).lean(),
      Sale.find().lean()
    ]);
    const pById = new Map(puzzles.map((p) => [p.publicId, p]));
    const saleByOrder = new Map(sales.map((s) => [s.orderId, s]));
    const list = orders.map((o) => {
      const pz = pById.get(o.puzzleId); const s = saleByOrder.get(o.orderId);
      return {
        orderId: o.orderId, saleReference: (s && s.saleReference) || o.providerChargeId || o.orderId,
        customerName: (pz && pz.senderName) || (s && s.customerName) || 'Unknown',
        date: o.paidAt || o.createdAt,
        amountBHD: L.getAuthoritativeBhdSaleAmount(o, s) || '0.000',
        displayAmount: o.checkoutDisplayAmount ? L.formatCurrencyAmount(o.checkoutDisplayAmount, o.checkoutDisplayCurrency) : null,
        displayCurrency: o.checkoutDisplayCurrency || o.currency,
        paymentStatus: 'captured',
        reconciliationStatus: (s && s.reconciliationStatus) || 'Awaiting Statement',
        // A captured sale that cannot resolve a BHD amount needs the idempotent repair.
        needsRepair: L.getAuthoritativeBhdSaleAmount(o, s) === null
      };
    });
    res.json({ success: true, currency: 'BHD', count: list.length, capturedCount: list.length, totalBHD: sumBHD(list.map((s) => s.amountBHD)), list });
  } catch (err) { next(err); }
});

router.get('/finance/expenses', authenticateAdmin, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const q = includeArchived ? {} : { isArchived: { $ne: true } };
    const expenses = await Expense.find(q).sort({ date: -1 }).lean();
    const list = expenses.map((e) => ({
      expenseId: e.expenseId, date: e.date, category: e.category, vendor: e.vendor, description: e.description,
      amountBHD: bhd3(e.amountBHD),
      originalAmount: L.formatCurrencyAmount(dec(e.originalAmount), e.currency), currency: e.currency,
      fxRateToBHD: dec(e.fxRateToBHD), fxRateDate: e.fxRateDate || e.date, fxRateSource: e.fxRateSource || 'manual',
      paymentMethod: e.paymentMethod || '', paidBy: e.paidBy || 'JIGZO', status: e.status,
      comments: e.comments || '', isArchived: !!e.isArchived,
      isRecurring: !!e.isRecurring, nextRenewalDate: e.nextRenewalDate || null,
      fxRateWasOverridden: !!e.fxRateWasOverridden
    }));
    res.json({
      success: true, currency: 'BHD', count: list.filter((e) => !e.isArchived).length,
      totalBHD: sumBHD(list.filter((e) => !e.isArchived).map((e) => e.amountBHD)), list
    });
  } catch (err) { next(err); }
});

router.get('/finance/reconciliation', authenticateAdmin, async (req, res, next) => {
  try {
    const [batches, orders, sales] = await Promise.all([
      ReconciliationBatch.find().sort({ createdAt: -1 }).lean(),
      Order.find({ paymentStatus: 'paid' }).lean(),
      Sale.find().lean()
    ]);
    const saleByOrder = new Map(sales.map((s) => [s.orderId, s]));
    const awaiting = orders.filter((o) => { const s = saleByOrder.get(o.orderId); return !s || s.reconciliationStatus === 'Awaiting Statement'; })
      .map((o) => ({ saleReference: o.providerChargeId || o.orderId, orderId: o.orderId, date: o.paidAt || o.createdAt, amountBHD: L.getAuthoritativeBhdSaleAmount(o, saleByOrder.get(o.orderId)) || '0.000' }));
    const byStatus = {};
    for (const o of orders) { const s = saleByOrder.get(o.orderId); const k = (s && s.reconciliationStatus) || 'Awaiting Statement'; byStatus[k] = (byStatus[k] || 0) + 1; }
    res.json({
      success: true, currency: 'BHD',
      batches: batches.map((b) => ({ reconciliationId: b.reconciliationId, settlementPeriod: b.settlementPeriod, settlementReference: b.settlementReference, totalCalculatedBHD: bhd3(b.totalCalculatedBHD), totalSettledBHD: bhd3(b.totalSettledBHD), differenceBHD: bhd3(b.differenceBHD), status: b.status, reconciledAt: b.reconciledAt })),
      salesByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      awaiting
    });
  } catch (err) { next(err); }
});

/**
 * Idempotent repair of the derived admin Sale record for a captured order.
 * Reads the ACTUAL captured amount from the live Tap charge (the source of
 * truth) or an owner-confirmed value; never touches the order, payment or Tap
 * record. Safe to run repeatedly.
 */
router.post('/finance/repair-sale/:orderId', authenticateAdmin, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!L.isCompletedPaidOrder(order)) return res.status(400).json({ error: 'Order is not a captured/paid order.' });

    // Display (localised) amount + currency from the immutable checkout snapshot.
    const displayCurrency = order.checkoutDisplayCurrency || order.currency || 'BHD';
    const displayAmount = order.checkoutDisplayAmount != null ? String(order.checkoutDisplayAmount) : (order.total != null ? String(order.total) : null);

    // Resolve the captured BHD from the authoritative source, in order.
    let capturedBhd = null;
    let source = null;
    if (req.body && req.body.capturedBhd != null && !isNaN(Number(req.body.capturedBhd)) && Number(req.body.capturedBhd) > 0) {
      capturedBhd = Number(req.body.capturedBhd).toFixed(3); source = 'owner-confirmed';
    }
    if (!capturedBhd && order.providerChargeId) {
      try {
        const charge = await paymentService.retrieveCharge(order.providerChargeId);
        if (charge && charge.currency && String(charge.currency).toUpperCase() === 'BHD' && Number(charge.amount) > 0) {
          capturedBhd = Number(charge.amount).toFixed(3); source = 'tap-charge';
        }
      } catch (e) { /* Tap unreachable — fall through to snapshot */ }
    }
    if (!capturedBhd && order.finalBhdFils != null && Number(order.finalBhdFils) > 0) {
      capturedBhd = (Number(order.finalBhdFils) / 1000).toFixed(3); source = 'order-snapshot';
    }
    if (!capturedBhd) {
      return res.status(422).json({ error: 'Could not confirm a captured BHD amount from Tap or the order snapshot. Provide the confirmed capturedBhd value to repair.' });
    }

    // Enrich customer identity from the puzzle sender where available.
    let customerName = '', customerPhone = '', customerId = 'Unlinked';
    const pz = await Puzzle.findOne({ publicId: order.puzzleId }, { senderName: 1, senderPhone: 1 }).lean();
    if (pz) {
      customerName = pz.senderName || '';
      const ph = digits(pz.senderPhone);
      if (ph) {
        const cust = await Customer.findOne({ normalizedPhone: new RegExp(ph + '$') }).lean();
        if (cust) { customerId = cust.customerId; customerPhone = cust.normalizedPhone; }
      }
    }

    let sale = await Sale.findOne({ orderId: order.orderId });
    const fxRate = (displayAmount && Number(displayAmount) > 0) ? (Number(capturedBhd) / Number(displayAmount)).toFixed(6) : '1.000000';
    const before = sale ? { calculatedAmountBHD: dec(sale.calculatedAmountBHD), confirmedSettlementBHD: dec(sale.confirmedSettlementBHD) } : {};

    // Idempotent: nothing to do if already confirmed at this amount.
    if (sale && dec(sale.confirmedSettlementBHD) && Number(sale.confirmedSettlementBHD.toString()).toFixed(3) === capturedBhd) {
      return res.json({ success: true, changed: false, capturedBhd, displayAmount, displayCurrency, source });
    }

    if (!sale) {
      sale = new Sale({
        saleReference: order.providerChargeId || order.orderId,
        orderId: order.orderId, customerId, customerName, customerPhone,
        date: order.paidAt || order.createdAt,
        originalAmount: toDecimal128(displayAmount || capturedBhd), originalCurrency: displayCurrency,
        fxRateToBHD: toDecimal128(fxRate),
        calculatedAmountBHD: toDecimal128(capturedBhd), netCalculatedBHD: toDecimal128(capturedBhd),
        confirmedSettlementBHD: toDecimal128(capturedBhd),
        tapReference: order.providerChargeId || undefined,
        paymentStatus: 'captured', reconciliationStatus: 'Reconciled'
      });
    } else {
      sale.originalAmount = toDecimal128(displayAmount || capturedBhd);
      sale.originalCurrency = displayCurrency;
      sale.fxRateToBHD = toDecimal128(fxRate);
      sale.calculatedAmountBHD = toDecimal128(capturedBhd);
      sale.netCalculatedBHD = toDecimal128(capturedBhd);
      sale.confirmedSettlementBHD = toDecimal128(capturedBhd);
      sale.paymentStatus = 'captured';
      if (order.providerChargeId && !sale.tapReference) sale.tapReference = order.providerChargeId;
      sale.updatedAt = new Date();
    }
    await sale.save();
    audit(req, 'SALE_REPAIRED', 'Sale', order.orderId, `Captured BHD confirmed from ${source}`, before, { capturedBhd, displayAmount: `${displayAmount} ${displayCurrency}` });
    res.json({ success: true, changed: true, capturedBhd, displayAmount, displayCurrency, source });
  } catch (err) { next(err); }
});

// ---- EXPENSE CRUD (admin-only 'expenses' collection) ----------------------
const EXPENSE_STATUSES = ['Paid', 'Pending', 'Refunded', 'Partially Refunded', 'Cancelled'];

function computeExpenseBHD(originalAmount, currency, fxRateToBHD) {
  if (String(currency).toUpperCase() === 'BHD') return sumBHD([String(originalAmount)]);
  return multiplyToBHD(String(originalAmount), String(fxRateToBHD));
}

router.post('/finance/expenses', authenticateAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ['date', 'category', 'vendor', 'description', 'originalAmount', 'currency'];
    for (const f of required) if (b[f] === undefined || b[f] === '' || b[f] === null) return res.status(400).json({ error: `Missing field: ${f}` });
    const currency = String(b.currency).toUpperCase();
    const fxRate = currency === 'BHD' ? '1.000000' : String(b.fxRateToBHD || '');
    if (currency !== 'BHD' && (!b.fxRateToBHD || isNaN(Number(b.fxRateToBHD)))) return res.status(400).json({ error: 'fxRateToBHD is required for non-BHD expenses.' });
    if (b.fxRateWasOverridden && !b.overrideReason) return res.status(400).json({ error: 'A reason is required when overriding the FX rate.' });

    const amountBHD = computeExpenseBHD(b.originalAmount, currency, fxRate);
    const year = new Date(b.date).getUTCFullYear();
    const countRec = await Counter.findOneAndUpdate({ key: `expense_${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
    const expenseId = `EXP-${year}-${String(countRec.seq).padStart(4, '0')}`;

    const exp = new Expense({
      expenseId, date: new Date(b.date), category: b.category, vendor: b.vendor, description: b.description,
      originalAmount: toDecimal128(String(b.originalAmount)), currency,
      fxRateToBHD: toDecimal128(fxRate), fxRateDate: b.fxRateDate ? new Date(b.fxRateDate) : new Date(b.date),
      fxRateSource: b.fxRateSource || 'manual', fxRateLockedAt: new Date(), fxRateWasOverridden: !!b.fxRateWasOverridden,
      amountBHD: toDecimal128(amountBHD), paymentMethod: b.paymentMethod || '', paidBy: b.paidBy || 'JIGZO',
      status: EXPENSE_STATUSES.includes(b.status) ? b.status : 'Paid', comments: b.comments || '',
      isRecurring: !!b.isRecurring, nextRenewalDate: b.nextRenewalDate ? new Date(b.nextRenewalDate) : undefined,
      createdBy: req.admin.username || 'admin'
    });
    await exp.save();
    audit(req, 'EXPENSE_CREATED', 'Expense', expenseId, b.overrideReason || 'Expense created', {}, { expenseId, amountBHD });
    res.json({ success: true, expenseId, amountBHD });
  } catch (err) { next(err); }
});

router.put('/finance/expenses/:expenseId', authenticateAdmin, async (req, res, next) => {
  try {
    const exp = await Expense.findOne({ expenseId: req.params.expenseId });
    if (!exp) return res.status(404).json({ error: 'Expense not found.' });
    const before = { category: exp.category, vendor: exp.vendor, description: exp.description, originalAmount: dec(exp.originalAmount), currency: exp.currency, fxRateToBHD: dec(exp.fxRateToBHD), amountBHD: dec(exp.amountBHD), status: exp.status };
    const b = req.body || {};
    ['category', 'vendor', 'description', 'paymentMethod', 'paidBy', 'comments'].forEach((f) => { if (b[f] !== undefined) exp[f] = b[f]; });
    if (b.date) exp.date = new Date(b.date);
    if (b.status && EXPENSE_STATUSES.includes(b.status)) exp.status = b.status;
    if (b.isRecurring !== undefined) exp.isRecurring = !!b.isRecurring;
    if (b.nextRenewalDate) exp.nextRenewalDate = new Date(b.nextRenewalDate);

    // Recompute BHD only if amount/currency/rate changed; require override reason if rate changed.
    const changingMoney = b.originalAmount !== undefined || b.currency !== undefined || b.fxRateToBHD !== undefined;
    if (changingMoney) {
      const currency = String(b.currency || exp.currency).toUpperCase();
      const originalAmount = b.originalAmount !== undefined ? String(b.originalAmount) : dec(exp.originalAmount);
      const fxRate = currency === 'BHD' ? '1.000000' : String(b.fxRateToBHD !== undefined ? b.fxRateToBHD : dec(exp.fxRateToBHD));
      if (b.fxRateToBHD !== undefined && !b.overrideReason) return res.status(400).json({ error: 'A reason is required when changing the FX rate.' });
      exp.currency = currency; exp.originalAmount = toDecimal128(originalAmount); exp.fxRateToBHD = toDecimal128(fxRate);
      exp.amountBHD = toDecimal128(computeExpenseBHD(originalAmount, currency, fxRate));
      if (b.fxRateToBHD !== undefined) { exp.fxRateWasOverridden = true; exp.fxRateLockedAt = new Date(); }
    }
    exp.updatedBy = req.admin.username || 'admin'; exp.updatedAt = new Date();
    await exp.save();
    audit(req, 'EXPENSE_UPDATED', 'Expense', exp.expenseId, b.overrideReason || 'Expense edited', before, { amountBHD: dec(exp.amountBHD), status: exp.status });
    res.json({ success: true, expenseId: exp.expenseId, amountBHD: dec(exp.amountBHD) });
  } catch (err) { next(err); }
});

// Soft-delete / archive (never destroys financial history).
router.delete('/finance/expenses/:expenseId', authenticateAdmin, async (req, res, next) => {
  try {
    const exp = await Expense.findOne({ expenseId: req.params.expenseId });
    if (!exp) return res.status(404).json({ error: 'Expense not found.' });
    exp.isArchived = true; exp.updatedBy = req.admin.username || 'admin'; exp.updatedAt = new Date();
    await exp.save();
    audit(req, 'EXPENSE_ARCHIVED', 'Expense', exp.expenseId, req.body && req.body.reason || 'Archived', { isArchived: false }, { isArchived: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/finance/expenses/:expenseId/restore', authenticateAdmin, async (req, res, next) => {
  try {
    const exp = await Expense.findOne({ expenseId: req.params.expenseId });
    if (!exp) return res.status(404).json({ error: 'Expense not found.' });
    exp.isArchived = false; exp.updatedAt = new Date();
    await exp.save();
    audit(req, 'EXPENSE_RESTORED', 'Expense', exp.expenseId, 'Restored', { isArchived: true }, { isArchived: false });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ============================================================================
// GROWTH — waitlist (read-only) + admin metadata
// ============================================================================
router.get('/growth', authenticateAdmin, async (req, res, next) => {
  try {
    // All interest signups, not only the launch waitlist.
    const [waitlist, meta] = await Promise.all([
      NotificationRequest.find().sort({ createdAt: -1 }).lean(),
      WaitlistAdminMeta.find().lean()
    ]);
    const metaBySource = new Map(meta.map((m) => [String(m.waitlistSourceId), m]));

    // Map the stored interestType to a founder-friendly source label. Only real
    // stored values are labelled; anything unrecognised is "Unknown source".
    const SOURCE_LABELS = {
      jigzo_launch: 'Launch signup',
      jigzo_waitlist: 'Main JIGZO waitlist',
      waitlist: 'Main JIGZO waitlist',
      video_reveal: 'Video Reveal interest',
      physical_puzzle: 'Physical Puzzle interest',
      test: 'Test record'
    };
    const labelFor = (w) => {
      if (w.interestType && SOURCE_LABELS[w.interestType]) return SOURCE_LABELS[w.interestType];
      if (w.interestType) return w.interestType; // show the raw stored type rather than guessing
      return 'Unknown source';
    };

    // Duplicate detection by normalised email.
    const emailCounts = {};
    for (const w of waitlist) { const e = String(w.email || '').trim().toLowerCase(); if (e) emailCounts[e] = (emailCounts[e] || 0) + 1; }

    const list = waitlist.map((w) => {
      const m = metaBySource.get(String(w._id));
      const emailKey = String(w.email || '').trim().toLowerCase();
      return {
        id: String(w._id), email: w.email || '', phone: w.phone || '', country: w.country || '',
        signupSource: labelFor(w), interestType: w.interestType || '', sourceUrl: w.sourceUrl || '',
        createdAt: w.createdAt, sendStatus: w.sendStatus,
        contactStatus: (m && m.contactStatus) || (w.sendStatus === 'sent' ? 'contacted' : 'uncontacted'),
        lastContactedDate: (m && m.lastContactedDate) || w.sentAt || null,
        linkedCustomerId: (m && m.linkedCustomerId) || null,
        converted: m ? m.convertedStatus : !!w.converted,
        isDuplicate: emailKey ? emailCounts[emailKey] > 1 : false
      };
    });
    const byContactStatus = {};
    for (const r of list) byContactStatus[r.contactStatus] = (byContactStatus[r.contactStatus] || 0) + 1;
    const bySource = {};
    for (const r of list) bySource[r.signupSource] = (bySource[r.signupSource] || 0) + 1;
    res.json({
      success: true, count: list.length,
      byContactStatus: Object.entries(byContactStatus).map(([status, count]) => ({ status, count })),
      bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })),
      duplicateEmails: Object.values(emailCounts).filter((c) => c > 1).length,
      list
    });
  } catch (err) { next(err); }
});

// ============================================================================
// SYSTEM — service status, FX rates (with peg metadata), categories/vendors, audit
// ============================================================================
// BHD is the base currency; the Gulf pegs are relative to USD.
const PEG_METADATA = {
  BHD: { pegType: 'Base currency', pegged: false },
  USD: { pegType: 'BHD is pegged to USD', pegged: true },
  AED: { pegType: 'Pegged to USD', pegged: true },
  SAR: { pegType: 'Pegged to USD', pegged: true },
  OMR: { pegType: 'Pegged to USD', pegged: true },
  QAR: { pegType: 'Pegged to USD', pegged: true },
  KWD: { pegType: 'Pegged to a currency basket', pegged: true },
  EUR: { pegType: 'Floating', pegged: false },
  GBP: { pegType: 'Floating', pegged: false }
};

// A boolean env flag that is present (defined) is authoritative; a missing flag
// is reported as "configuration missing", never silently "disabled".
const flagStatus = (name) => {
  const raw = process.env[name];
  if (raw === undefined) return 'configuration missing';
  return raw === 'true' ? 'enabled' : (raw === 'paused' ? 'configured but paused' : 'disabled');
};
const present = (...names) => names.every((n) => !!process.env[n]);

router.get('/system', authenticateAdmin, async (req, res, next) => {
  try {
    const [fxRates, categories, vendors, auditLogs] = await Promise.all([
      FxRate.find().sort({ currency: 1 }).lean(),
      Category.find({ isArchived: { $ne: true } }).sort({ name: 1 }).lean(),
      Vendor.find({ isArchived: { $ne: true } }).sort({ name: 1 }).lean(),
      AuditLog.find().sort({ timestamp: -1 }).limit(100).lean()
    ]);

    // Status derived from the ACTUAL production runtime flags (CHECKOUT_ENABLED /
    // WHATSAPP_ENABLED) plus provider-configuration presence — never guessed.
    const services = [
      { name: 'Checkout / Payments', status: flagStatus('CHECKOUT_ENABLED'), config: present('TAP_SECRET_KEY', 'TAP_MERCHANT_ID') ? 'Tap configured' : 'Tap configuration missing' },
      { name: 'WhatsApp delivery', status: flagStatus('WHATSAPP_ENABLED'), config: present('KAPSO_API_KEY', 'KAPSO_PHONE_NUMBER_ID') ? 'Provider configured' : 'Provider configuration missing' },
      { name: 'Email (Resend)', status: process.env.RESEND_API_KEY ? 'enabled' : 'configuration missing', config: process.env.RESEND_API_KEY ? 'Resend configured' : 'Resend configuration missing' }
    ];

    // Round to three decimals for the summary; keep full precision on the record.
    const round3 = (v) => { const n = Number(dec(v)); return isFinite(n) ? n.toFixed(3) : dec(v); };

    res.json({
      success: true, currency: 'BHD', services,
      tapMode: process.env.TAP_MODE || null,
      // Historical/reference rates used as expense defaults — NOT the live checkout engine.
      expenseReferenceRates: fxRates.map((f) => {
        const peg = PEG_METADATA[f.currency] || { pegType: 'Unknown', pegged: false };
        return { currency: f.currency, rateToBHD: round3(f.rateToBHD), rateExact: dec(f.rateToBHD), source: f.source, pegType: peg.pegType, pegged: peg.pegged, isBase: f.currency === 'BHD', effectiveDate: f.effectiveDate };
      }),
      liveCheckoutPricing: {
        engine: 'Signed checkout quote — live rates (open.er-api.com), BHD computed via cross-rate rateBhd/rateCurrency',
        status: flagStatus('CHECKOUT_ENABLED'),
        note: 'This is separate from the historical expense/reference FX rates below, which are workbook defaults for expense records only and are NOT used to price live checkouts.'
      },
      categories: categories.map((c) => c.name),
      vendors: vendors.map((v) => v.name),
      auditLogs: auditLogs.map((a) => ({ action: a.action, targetModel: a.targetModel || '', targetId: a.targetId || '', reason: a.reason || '', timestamp: a.timestamp }))
    });
  } catch (err) { next(err); }
});

module.exports = router;

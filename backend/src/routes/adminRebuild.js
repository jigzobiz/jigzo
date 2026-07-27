/**
 * Rebuilt JIGZO Admin API (v2) — READ ONLY.
 *
 * Serves the rebuilt founder-facing admin portal (Home, Customers,
 * Orders & Puzzles, Delivery Centre, Finance, Growth, System).
 *
 * Every route here is strictly read-only. No route in this file writes to
 * MongoDB. Operational customer-facing collections (puzzles, recipients,
 * orders, waitlist/notificationrequests) are only ever read, never mutated,
 * so live checkout / WhatsApp / reveal behaviour is untouched.
 *
 * Auth reuses the existing admin JWT issued by POST /api/admin/auth/login.
 */

const express = require('express');
const router = express.Router();
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

const { resolveJwtSecret } = require('../utils/runtimeConfig');
const { sumBHD } = require('../utils/money');

const JWT_SECRET = resolveJwtSecret();

// --- Auth (same JWT as the existing admin login) ---
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
};

// --- Money helpers -----------------------------------------------------------
// Mongoose Decimal128 serialises to an object; always emit clean strings.
const dec = (v) => {
  if (v === null || v === undefined) return null;
  try {
    return typeof v === 'object' ? v.toString() : String(v);
  } catch (e) {
    return null;
  }
};
// Force a BHD value into a 3-decimal string (display standard for the portal).
const bhd3 = (v) => {
  const s = dec(v);
  if (s === null || s === '') return '0.000';
  try {
    return sumBHD([s]); // sumBHD returns a toFixed(3) string
  } catch (e) {
    return '0.000';
  }
};

const CAPTURED_SALE_FILTER = { paymentStatus: 'captured' };

// Count of individual recipient-puzzles across all puzzle documents.
// One puzzle document with two recipients counts as two puzzles.
const countRecipientPuzzles = (puzzles) =>
  puzzles.reduce((n, p) => n + ((p.recipients && p.recipients.length) || 0), 0);

// ============================================================================
// HOME — plain-language production summary
// ============================================================================
router.get('/home', authenticateAdmin, async (req, res, next) => {
  try {
    const [sales, expenses, customersCount, ordersCount, puzzles] = await Promise.all([
      Sale.find(CAPTURED_SALE_FILTER).lean(),
      Expense.find({ isArchived: { $ne: true } }).lean(),
      Customer.countDocuments({ isArchived: { $ne: true } }),
      Order.countDocuments(),
      Puzzle.find({}, { recipients: 1, createdAt: 1, status: 1 }).lean()
    ]);

    const salesTotalBHD = sumBHD(sales.map((s) => dec(s.netCalculatedBHD || s.calculatedAmountBHD)));
    const expenseTotalBHD = sumBHD(expenses.map((e) => dec(e.amountBHD)));
    const netBHD = sumBHD([salesTotalBHD, '-' + expenseTotalBHD]);

    const puzzleCount = countRecipientPuzzles(puzzles);

    // Expense breakdown by category (real data → drives a chart).
    const byCategory = {};
    for (const e of expenses) {
      const key = e.category || 'Other';
      byCategory[key] = sumBHD([byCategory[key] || '0.000', dec(e.amountBHD)]);
    }
    const expensesByCategory = Object.entries(byCategory)
      .map(([category, amountBHD]) => ({ category, amountBHD }))
      .sort((a, b) => parseFloat(b.amountBHD) - parseFloat(a.amountBHD));

    // Expense trend by month (YYYY-MM).
    const byMonth = {};
    for (const e of expenses) {
      const d = e.date ? new Date(e.date) : null;
      if (!d) continue;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = sumBHD([byMonth[key] || '0.000', dec(e.amountBHD)]);
    }
    const expenseTrend = Object.entries(byMonth)
      .map(([month, amountBHD]) => ({ month, amountBHD }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      success: true,
      currency: 'BHD',
      totals: {
        salesBHD: salesTotalBHD,
        expensesBHD: expenseTotalBHD,
        netBHD,
        capturedSales: sales.length,
        expenseCount: expenses.length
      },
      counts: {
        orders: ordersCount,
        puzzles: puzzleCount,
        customers: customersCount
      },
      charts: {
        expensesByCategory,
        expenseTrend
      }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CUSTOMERS
// ============================================================================
router.get('/customers', authenticateAdmin, async (req, res, next) => {
  try {
    const [customers, orders, puzzles, sales] = await Promise.all([
      Customer.find({ isArchived: { $ne: true } }).sort({ createdAt: -1 }).lean(),
      Order.find().lean(),
      Puzzle.find({}, { publicId: 1, senderPhone: 1, recipients: 1 }).lean(),
      Sale.find(CAPTURED_SALE_FILTER).lean()
    ]);

    // Map orders → sender phone via puzzle for spend aggregation.
    const puzzleByPublicId = new Map(puzzles.map((p) => [p.publicId, p]));

    const digits = (s) => String(s || '').replace(/\D/g, '');
    const spendByCustomer = {}; // customerId -> array of BHD strings
    const orderCountByCustomer = {};
    for (const sale of sales) {
      if (sale.customerId && sale.customerId !== 'Unlinked') {
        spendByCustomer[sale.customerId] = spendByCustomer[sale.customerId] || [];
        spendByCustomer[sale.customerId].push(dec(sale.netCalculatedBHD || sale.calculatedAmountBHD));
      }
    }

    // Order & puzzle counts keyed by normalized sender phone.
    const orderCountByPhone = {};
    const puzzleCountByPhone = {};
    for (const o of orders) {
      const pz = puzzleByPublicId.get(o.puzzleId);
      const phone = digits(pz && pz.senderPhone);
      if (!phone) continue;
      orderCountByPhone[phone] = (orderCountByPhone[phone] || 0) + 1;
    }
    for (const p of puzzles) {
      const phone = digits(p.senderPhone);
      if (!phone) continue;
      puzzleCountByPhone[phone] = (puzzleCountByPhone[phone] || 0) + ((p.recipients && p.recipients.length) || 0);
    }

    const list = customers.map((c) => {
      const phone = digits(c.normalizedPhone || c.primaryPhone);
      return {
        customerId: c.customerId,
        name: c.name || 'Unknown',
        primaryPhone: c.primaryPhone,
        countryName: c.countryName || 'Unknown',
        countryCode: c.countryCode || '',
        email: c.email || '',
        orderCount: orderCountByPhone[phone] || 0,
        puzzleCount: puzzleCountByPhone[phone] || 0,
        totalSpendBHD: sumBHD(spendByCustomer[c.customerId] || ['0.000']),
        firstOrderAt: c.firstOrderAt || null,
        latestOrderAt: c.latestOrderAt || null,
        createdAt: c.createdAt
      };
    });

    res.json({ success: true, currency: 'BHD', count: list.length, list });
  } catch (err) {
    next(err);
  }
});

router.get('/customers/:customerId', authenticateAdmin, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const digits = (s) => String(s || '').replace(/\D/g, '');
    const phone = digits(customer.normalizedPhone || customer.primaryPhone);

    const [puzzles, sales] = await Promise.all([
      Puzzle.find().lean(),
      Sale.find({ customerId: customer.customerId }).lean()
    ]);

    const myPuzzles = puzzles.filter((p) => digits(p.senderPhone) === phone);
    const puzzlePublicIds = myPuzzles.map((p) => p.publicId);
    const orders = await Order.find({ puzzleId: { $in: puzzlePublicIds } }).lean();

    const history = myPuzzles.map((p) => ({
      publicId: p.publicId,
      status: p.status,
      occasion: p.occasion || '',
      recipientCount: (p.recipients && p.recipients.length) || 0,
      recipients: (p.recipients || []).map((r) => ({
        name: r.name,
        deliveryMethod: r.deliveryMethod || 'whatsapp',
        deliveryStatus: r.deliveryStatus || 'pending',
        completedAt: r.completedAt || null
      })),
      createdAt: p.createdAt
    }));

    res.json({
      success: true,
      currency: 'BHD',
      customer: {
        customerId: customer.customerId,
        name: customer.name || 'Unknown',
        primaryPhone: customer.primaryPhone,
        countryName: customer.countryName || 'Unknown',
        email: customer.email || '',
        accountStatus: customer.accountStatus,
        firstOrderAt: customer.firstOrderAt || null,
        latestOrderAt: customer.latestOrderAt || null,
        createdAt: customer.createdAt
      },
      totals: {
        orders: orders.length,
        puzzles: myPuzzles.reduce((n, p) => n + ((p.recipients && p.recipients.length) || 0), 0),
        totalSpendBHD: sumBHD(sales.filter((s) => s.paymentStatus === 'captured').map((s) => dec(s.netCalculatedBHD || s.calculatedAmountBHD)) || ['0.000'])
      },
      sales: sales.map((s) => ({
        saleReference: s.saleReference,
        orderId: s.orderId,
        date: s.date,
        amountBHD: bhd3(s.netCalculatedBHD || s.calculatedAmountBHD),
        originalAmount: dec(s.originalAmount),
        originalCurrency: s.originalCurrency,
        paymentStatus: s.paymentStatus
      })),
      history
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ORDERS & PUZZLES — one order may hold multiple recipient puzzles
// ============================================================================
router.get('/orders', authenticateAdmin, async (req, res, next) => {
  try {
    const [orders, puzzles, sales] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).lean(),
      Puzzle.find().lean(),
      Sale.find().lean()
    ]);
    const puzzleByPublicId = new Map(puzzles.map((p) => [p.publicId, p]));
    const saleByOrderId = new Map(sales.map((s) => [s.orderId, s]));

    const list = orders.map((o) => {
      const pz = puzzleByPublicId.get(o.puzzleId);
      const recipients = (pz && pz.recipients) || [];
      const sale = saleByOrderId.get(o.orderId);
      return {
        orderId: o.orderId,
        puzzleId: o.puzzleId,
        packageId: o.packageId,
        paymentStatus: o.paymentStatus,
        recipientCount: o.recipientCount,
        // Number of distinct recipient-puzzles inside this order.
        puzzleCount: recipients.length,
        total: o.total,
        currency: o.currency,
        amountBHD: sale ? bhd3(sale.netCalculatedBHD || sale.calculatedAmountBHD) : null,
        createdAt: o.createdAt,
        paidAt: o.paidAt || null,
        puzzles: recipients.map((r, i) => ({
          index: i,
          recipientName: r.name,
          deliveryMethod: r.deliveryMethod || 'whatsapp',
          deliveryStatus: r.deliveryStatus || 'pending',
          openedAt: r.openedAt || null,
          completedAt: r.completedAt || null
        }))
      };
    });

    res.json({ success: true, currency: 'BHD', count: list.length, list });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:orderId', authenticateAdmin, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const [puzzle, sale, payment] = await Promise.all([
      Puzzle.findOne({ publicId: order.puzzleId }).lean(),
      Sale.findOne({ orderId: order.orderId }).lean(),
      PaymentTransaction.findOne({ $or: [{ orderId: order.orderId }, { providerChargeId: order.providerChargeId }] }).lean()
    ]);

    res.json({
      success: true,
      currency: 'BHD',
      order: {
        orderId: order.orderId,
        puzzleId: order.puzzleId,
        packageId: order.packageId,
        recipientCount: order.recipientCount,
        paymentStatus: order.paymentStatus,
        total: order.total,
        currency: order.currency,
        checkoutDisplayCurrency: order.checkoutDisplayCurrency || null,
        checkoutDisplayAmount: order.checkoutDisplayAmount || null,
        createdAt: order.createdAt,
        paidAt: order.paidAt || null
      },
      payment: {
        amountBHD: sale ? bhd3(sale.netCalculatedBHD || sale.calculatedAmountBHD) : null,
        originalAmount: sale ? dec(sale.originalAmount) : (order.total != null ? String(order.total) : null),
        originalCurrency: sale ? sale.originalCurrency : order.currency,
        saleReference: sale ? sale.saleReference : null,
        paymentStatus: sale ? sale.paymentStatus : order.paymentStatus,
        providerStatus: payment ? payment.status : (order.providerStatus || null)
      },
      puzzles: puzzle
        ? (puzzle.recipients || []).map((r, i) => ({
            index: i,
            recipientName: r.name,
            deliveryMethod: r.deliveryMethod || 'whatsapp',
            deliveryStatus: r.deliveryStatus || 'pending',
            openedAt: r.openedAt || null,
            completedAt: r.completedAt || null,
            sentAt: r.sentAt || null
          }))
        : []
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELIVERY CENTRE — read-only delivery / open / solved states + conflicts
// ============================================================================
router.get('/delivery', authenticateAdmin, async (req, res, next) => {
  try {
    const puzzles = await Puzzle.find().sort({ createdAt: -1 }).lean();

    const rows = [];
    let delivered = 0;
    let opened = 0;
    let solved = 0;
    let pending = 0;

    for (const p of puzzles) {
      for (let i = 0; i < (p.recipients || []).length; i++) {
        const r = p.recipients[i];
        const deliveryStatus = r.deliveryStatus || 'pending';
        const isOpened = !!r.openedAt;
        const isSolved = !!r.completedAt;

        // Conflict detection: sources disagreeing about state.
        const conflicts = [];
        if (isSolved && !isOpened) {
          conflicts.push('Marked solved but never recorded as opened.');
        }
        if (isSolved && deliveryStatus === 'pending') {
          conflicts.push('Marked solved while delivery status is still pending.');
        }
        if (isOpened && deliveryStatus === 'pending') {
          conflicts.push('Opened but delivery status still pending.');
        }
        if ((r.whatsappSendStatus === 'failed' || r.whatsappFailedAt) && (isOpened || isSolved)) {
          conflicts.push('WhatsApp send failed yet recipient shows engagement.');
        }

        if (isSolved) solved++;
        else if (isOpened) opened++;
        else if (deliveryStatus !== 'pending') delivered++;
        else pending++;

        rows.push({
          puzzleId: p.publicId,
          recipientIndex: i,
          recipientName: r.name,
          deliveryMethod: r.deliveryMethod || 'whatsapp',
          deliveryStatus,
          whatsappSendStatus: r.whatsappSendStatus || '',
          sentAt: r.sentAt || null,
          openedAt: r.openedAt || null,
          completedAt: r.completedAt || null,
          state: isSolved ? 'solved' : isOpened ? 'opened' : deliveryStatus !== 'pending' ? 'delivered' : 'pending',
          conflicts
        });
      }
    }

    res.json({
      success: true,
      summary: { total: rows.length, pending, delivered, opened, solved, conflicts: rows.filter((r) => r.conflicts.length).length },
      list: rows
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// FINANCE
// ============================================================================
router.get('/finance/overview', authenticateAdmin, async (req, res, next) => {
  try {
    const [sales, expenses] = await Promise.all([
      Sale.find(CAPTURED_SALE_FILTER).lean(),
      Expense.find({ isArchived: { $ne: true } }).lean()
    ]);
    const salesBHD = sumBHD(sales.map((s) => dec(s.netCalculatedBHD || s.calculatedAmountBHD)));
    const expensesBHD = sumBHD(expenses.map((e) => dec(e.amountBHD)));

    const byCategory = {};
    for (const e of expenses) {
      const key = e.category || 'Other';
      byCategory[key] = sumBHD([byCategory[key] || '0.000', dec(e.amountBHD)]);
    }

    res.json({
      success: true,
      currency: 'BHD',
      salesBHD,
      expensesBHD,
      netBHD: sumBHD([salesBHD, '-' + expensesBHD]),
      capturedSaleCount: sales.length,
      expenseCount: expenses.length,
      expensesByCategory: Object.entries(byCategory)
        .map(([category, amountBHD]) => ({ category, amountBHD }))
        .sort((a, b) => parseFloat(b.amountBHD) - parseFloat(a.amountBHD))
    });
  } catch (err) {
    next(err);
  }
});

router.get('/finance/sales', authenticateAdmin, async (req, res, next) => {
  try {
    const sales = await Sale.find().sort({ date: -1 }).lean();
    const list = sales.map((s) => ({
      saleReference: s.saleReference,
      orderId: s.orderId,
      customerId: s.customerId,
      customerName: s.customerName,
      date: s.date,
      amountBHD: bhd3(s.calculatedAmountBHD),
      netAmountBHD: bhd3(s.netCalculatedBHD || s.calculatedAmountBHD),
      originalAmount: dec(s.originalAmount),
      originalCurrency: s.originalCurrency,
      fxRateToBHD: dec(s.fxRateToBHD),
      paymentStatus: s.paymentStatus,
      reconciliationStatus: s.reconciliationStatus,
      tapReference: s.tapReference || ''
    }));
    res.json({
      success: true,
      currency: 'BHD',
      count: list.length,
      capturedCount: list.filter((s) => s.paymentStatus === 'captured').length,
      totalBHD: sumBHD(list.filter((s) => s.paymentStatus === 'captured').map((s) => s.netAmountBHD)),
      list
    });
  } catch (err) {
    next(err);
  }
});

router.get('/finance/expenses', authenticateAdmin, async (req, res, next) => {
  try {
    const expenses = await Expense.find({ isArchived: { $ne: true } }).sort({ date: -1 }).lean();
    const list = expenses.map((e) => ({
      expenseId: e.expenseId,
      date: e.date,
      category: e.category,
      vendor: e.vendor,
      description: e.description,
      amountBHD: bhd3(e.amountBHD),
      originalAmount: dec(e.originalAmount),
      currency: e.currency,
      fxRateToBHD: dec(e.fxRateToBHD),
      paymentMethod: e.paymentMethod || '',
      status: e.status,
      comments: e.comments || ''
    }));
    res.json({
      success: true,
      currency: 'BHD',
      count: list.length,
      totalBHD: sumBHD(list.map((e) => e.amountBHD)),
      list
    });
  } catch (err) {
    next(err);
  }
});

router.get('/finance/reconciliation', authenticateAdmin, async (req, res, next) => {
  try {
    const [batches, sales] = await Promise.all([
      ReconciliationBatch.find().sort({ createdAt: -1 }).lean(),
      Sale.find().lean()
    ]);

    const byStatus = {};
    for (const s of sales) {
      const key = s.reconciliationStatus || 'Unknown';
      byStatus[key] = (byStatus[key] || 0) + 1;
    }

    res.json({
      success: true,
      currency: 'BHD',
      batches: batches.map((b) => ({
        reconciliationId: b.reconciliationId,
        settlementPeriod: b.settlementPeriod,
        settlementReference: b.settlementReference,
        totalCalculatedBHD: bhd3(b.totalCalculatedBHD),
        totalSettledBHD: bhd3(b.totalSettledBHD),
        differenceBHD: bhd3(b.differenceBHD),
        status: b.status,
        reconciledAt: b.reconciledAt
      })),
      salesByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      awaiting: sales
        .filter((s) => s.reconciliationStatus === 'Awaiting Statement')
        .map((s) => ({
          saleReference: s.saleReference,
          orderId: s.orderId,
          date: s.date,
          amountBHD: bhd3(s.netCalculatedBHD || s.calculatedAmountBHD)
        }))
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GROWTH — waitlist (read-only) enriched with admin-only metadata
// ============================================================================
router.get('/growth', authenticateAdmin, async (req, res, next) => {
  try {
    const [waitlist, meta] = await Promise.all([
      NotificationRequest.find({ interestType: 'jigzo_launch' }).sort({ createdAt: -1 }).lean(),
      WaitlistAdminMeta.find().lean()
    ]);
    const metaBySource = new Map(meta.map((m) => [String(m.waitlistSourceId), m]));

    const list = waitlist.map((w) => {
      const m = metaBySource.get(String(w._id));
      return {
        id: String(w._id),
        email: w.email || '',
        phone: w.phone || '',
        country: w.country || '',
        createdAt: w.createdAt,
        sendStatus: w.sendStatus,
        // Admin-only metadata (from the separate WaitlistAdminMeta collection).
        contactStatus: m ? m.contactStatus : 'uncontacted',
        lastContactedDate: m ? m.lastContactedDate : null,
        linkedCustomerId: m ? m.linkedCustomerId : null,
        converted: m ? m.convertedStatus : !!w.converted
      };
    });

    const byContactStatus = {};
    for (const row of list) {
      byContactStatus[row.contactStatus] = (byContactStatus[row.contactStatus] || 0) + 1;
    }

    res.json({
      success: true,
      count: list.length,
      byContactStatus: Object.entries(byContactStatus).map(([status, count]) => ({ status, count })),
      list
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// SYSTEM — service status, FX rates, categories & vendors, audit log
// ============================================================================
router.get('/system', authenticateAdmin, async (req, res, next) => {
  try {
    const [fxRates, categories, vendors, auditLogs] = await Promise.all([
      FxRate.find().sort({ currency: 1 }).lean(),
      Category.find({ isArchived: { $ne: true } }).sort({ name: 1 }).lean(),
      Vendor.find({ isArchived: { $ne: true } }).sort({ name: 1 }).lean(),
      AuditLog.find().sort({ timestamp: -1 }).limit(100).lean()
    ]);

    const services = [
      { name: 'Checkout / Payments', status: process.env.ENABLE_CHECKOUT === 'true' ? 'enabled' : 'disabled' },
      { name: 'WhatsApp delivery', status: process.env.ENABLE_WHATSAPP === 'true' ? 'enabled' : 'disabled' },
      { name: 'Email (Resend)', status: process.env.RESEND_API_KEY ? 'configured' : 'not configured' }
    ];

    res.json({
      success: true,
      currency: 'BHD',
      services,
      fxRates: fxRates.map((f) => ({
        currency: f.currency,
        rateToBHD: dec(f.rateToBHD),
        source: f.source,
        isPegged: f.isPegged,
        effectiveDate: f.effectiveDate
      })),
      categories: categories.map((c) => c.name),
      vendors: vendors.map((v) => v.name),
      auditLogs: auditLogs.map((a) => ({
        action: a.action,
        targetModel: a.targetModel || '',
        targetId: a.targetId || '',
        reason: a.reason || '',
        timestamp: a.timestamp
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

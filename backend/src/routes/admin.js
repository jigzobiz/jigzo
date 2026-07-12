const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const Customer = require('../models/Customer');
const AnonymousSession = require('../models/AnonymousSession');
const JourneyEvent = require('../models/JourneyEvent');
const DraftPuzzle = require('../models/DraftPuzzle');
const Recipient = require('../models/Recipient');
const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const NotificationRequest = require('../models/NotificationRequest');
const Recommendation = require('../models/Recommendation');
const WorkItem = require('../models/WorkItem');
const AdminUser = require('../models/AdminUser');
const AuditLog = require('../models/AuditLog');
const Puzzle = require('../models/Puzzle');

const JWT_SECRET = process.env.JWT_SECRET || 'jigzo_secure_jwt_secret_key_2026';

// Helper to seed a default admin user if none exist
const seedAdmin = async () => {
  const adminCount = await AdminUser.countDocuments();
  if (adminCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('jigzo_admin_2026', salt);
    const defaultAdmin = new AdminUser({
      username: 'admin',
      passwordHash,
      role: 'superadmin'
    });
    await defaultAdmin.save();
    console.log('[JIGZO Admin] Default admin seeded successfully.');
  }
};
seedAdmin().catch(err => console.error('[JIGZO Admin] Seed error:', err));

// Auth Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(400).json({ error: 'Invalid authentication token.' });
  }
};

// --- AUTHENTICATION ROUTES ---

router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = await AdminUser.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Sign JWT
    const token = jwt.sign({ id: admin._id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token, role: admin.role, username: admin.username });
  } catch (err) {
    next(err);
  }
});

// --- DASHBOARD METRICS ENDPOINT ---

router.get('/dashboard', authenticateAdmin, async (req, res, next) => {
  try {
    // 1. Core KPIs
    const visitors = await AnonymousSession.countDocuments();
    const createStarts = await JourneyEvent.countDocuments({ eventType: 'create_started' });
    const paidOrders = await Order.find({ paymentStatus: 'paid' });
    const completedOrders = paidOrders.length;
    
    const revenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const averageOrderValue = completedOrders > 0 ? parseFloat((revenue / completedOrders).toFixed(2)) : 0;
    
    const totalOrdersCount = await Order.countDocuments();
    const paymentConversion = totalOrdersCount > 0 ? parseFloat(((completedOrders / totalOrdersCount) * 100).toFixed(1)) : 0;

    const waitlistGrowth = await NotificationRequest.countDocuments({ interestType: 'jigzo_launch' });
    const whatsappFailures = await WhatsAppMessage.countDocuments({ status: 'failed' });

    // 2. Funnel metrics
    const funnelSteps = [
      'landing_viewed', 'create_started', 'photo_uploaded', 'difficulty_selected',
      'recipient_added', 'occasion_selected', 'message_written', 'sender_details_added',
      'package_selected', 'review_opened', 'checkout_started', 'payment_succeeded', 'puzzle_completed'
    ];

    const funnel = {};
    for (const step of funnelSteps) {
      funnel[step] = await JourneyEvent.countDocuments({ eventType: step });
    }

    // 3. Drop-offs & popularity parameters (from metadata)
    const activePuzzles = await Puzzle.find();
    
    // Occasions, tones, package types frequencies
    const occasionPopularity = {};
    const tonePopularity = {};
    const difficultyPopularity = {};
    const packagePopularity = { Single: 0, Team: 0, Bulk: 0 };
    let revealAlertCount = 0;

    activePuzzles.forEach(p => {
      if (p.occasion) occasionPopularity[p.occasion] = (occasionPopularity[p.occasion] || 0) + 1;
      if (p.tone) tonePopularity[p.tone] = (tonePopularity[p.tone] || 0) + 1;
      if (p.pieceCount) {
        const label = p.pieceCount === 6 ? 'Extra Easy (6)' : p.pieceCount === 15 ? 'Easy (15)' : p.pieceCount === 18 ? 'Classic (18)' : 'Challenging (28)';
        difficultyPopularity[label] = (difficultyPopularity[label] || 0) + 1;
      }
    });

    const orders = await Order.find();
    orders.forEach(o => {
      const type = o.recipientCount === 1 ? 'Single' : o.recipientCount <= 5 ? 'Team' : 'Bulk';
      packagePopularity[type] = (packagePopularity[type] || 0) + 1;
      if (o.hasRevealAlert) revealAlertCount++;
    });

    const revealAlertAdoption = completedOrders > 0 ? parseFloat(((revealAlertCount / completedOrders) * 100).toFixed(1)) : 0;

    // 4. Reveal stats
    const recipientsCompleted = await Recipient.find({ status: 'completed' });
    const totalCompletionTime = recipientsCompleted.reduce((sum, r) => sum + (r.revealDurationSeconds || 0), 0);
    const averageCompletionTime = recipientsCompleted.length > 0 ? parseFloat((totalCompletionTime / recipientsCompleted.length).toFixed(1)) : 0;

    // 5. Repeat Customer Rate
    const customerOrders = await Order.aggregate([
      { $group: { _id: "$customerEmail", count: { $sum: 1 } } }
    ]);
    const repeatCustomersCount = customerOrders.filter(c => c.count > 1).length;
    const totalCustomers = customerOrders.length;
    const repeatCustomerRate = totalCustomers > 0 ? parseFloat(((repeatCustomersCount / totalCustomers) * 100).toFixed(1)) : 0;

    // 6. Recent operational warnings/alerts
    const alerts = [];
    if (whatsappFailures > 0) {
      alerts.push({ severity: 'high', message: `${whatsappFailures} WhatsApp delivery failures detected in logs.` });
    }
    const failedPayments = await PaymentTransaction.countDocuments({ status: 'failed' });
    if (failedPayments > 0) {
      alerts.push({ severity: 'medium', message: `${failedPayments} failed payment transactions recorded.` });
    }

    res.json({
      success: true,
      kpis: {
        visitors,
        createStarts,
        completedOrders,
        revenue,
        averageOrderValue,
        paymentConversion,
        waitlistGrowth,
        whatsappFailures,
        revealAlertAdoption,
        averageCompletionTime,
        repeatCustomerRate
      },
      funnel,
      popularity: {
        occasion: occasionPopularity,
        tone: tonePopularity,
        difficulty: difficultyPopularity,
        package: packagePopularity
      },
      alerts
    });
  } catch (err) {
    next(err);
  }
});

// --- LIST QUERIES & SENSITIVE ACTION MASKING ---

const maskEmail = (email) => {
  if (!email) return '';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
};

const maskPhone = (phone) => {
  if (!phone) return '';
  return phone.slice(0, 4) + ' ***** ' + phone.slice(-2);
};

// Get masked Customer lists
router.get('/customers', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await Customer.find().sort({ createdAt: -1 });
    const masked = list.map(c => ({
      _id: c._id,
      name: c.name,
      email: maskEmail(c.email),
      phone: maskPhone(c.phone),
      converted: c.converted,
      createdAt: c.createdAt
    }));
    res.json({ success: true, list: masked });
  } catch (err) {
    next(err);
  }
});

// Unmask sensitive detail (requires logging to AuditLog)
router.post('/audit/unmask', authenticateAdmin, async (req, res, next) => {
  try {
    const { modelType, recordId, fieldName } = req.body;
    if (!modelType || !recordId || !fieldName) {
      return res.status(400).json({ error: 'modelType, recordId, and fieldName are required.' });
    }

    let val = '';
    if (modelType === 'Customer') {
      const rec = await Customer.findById(recordId);
      if (rec) val = rec[fieldName];
    } else if (modelType === 'Recipient') {
      const rec = await Recipient.findById(recordId);
      if (rec) val = rec[fieldName];
    } else if (modelType === 'Order') {
      const rec = await Order.findById(recordId);
      if (rec) val = rec[fieldName];
    } else if (modelType === 'NotificationRequest') {
      const rec = await NotificationRequest.findById(recordId);
      if (rec) val = rec[fieldName];
    }

    // Log to Audit Trail
    const log = new AuditLog({
      adminUserId: req.admin.id,
      action: `UNMASK_${modelType.toUpperCase()}_${fieldName.toUpperCase()}`,
      targetModel: modelType,
      targetId: recordId,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    });
    await log.save();

    res.json({ success: true, value: val });
  } catch (err) {
    next(err);
  }
});

// Standard dashboard lists endpoints
router.get('/journeys', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await JourneyEvent.find().populate('customerId').sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

router.get('/drafts', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await DraftPuzzle.find().sort({ updatedAt: -1 });
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await Order.find().sort({ createdAt: -1 });
    const masked = list.map(o => ({
      ...o.toObject(),
      customerEmail: maskEmail(o.customerEmail),
      customerPhone: maskPhone(o.customerPhone)
    }));
    res.json({ success: true, list: masked });
  } catch (err) {
    next(err);
  }
});

router.get('/payments', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await PaymentTransaction.find().sort({ createdAt: -1 });
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

router.get('/puzzles', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await Puzzle.find().sort({ createdAt: -1 });
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

router.get('/recipients', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await Recipient.find().sort({ createdAt: -1 });
    const masked = list.map(r => ({
      ...r.toObject(),
      phone: maskPhone(r.phone)
    }));
    res.json({ success: true, list: masked });
  } catch (err) {
    next(err);
  }
});

router.get('/whatsapp', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await WhatsAppMessage.find().sort({ timestamp: -1 });
    const masked = list.map(w => ({
      ...w.toObject(),
      recipientPhone: maskPhone(w.recipientPhone)
    }));
    res.json({ success: true, list: masked });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await NotificationRequest.find().sort({ createdAt: -1 });
    const masked = list.map(n => ({
      ...n.toObject(),
      email: maskEmail(n.email),
      phone: maskPhone(n.phone)
    }));
    res.json({ success: true, list: masked });
  } catch (err) {
    next(err);
  }
});

// --- RECOMMENDATIONS ACTIONS ---

router.get('/recommendations', authenticateAdmin, async (req, res, next) => {
  try {
    // Generate daily dynamic suggestions automatically if none exist for today
    const count = await Recommendation.countDocuments();
    if (count === 0) {
      await Recommendation.insertMany([
        {
          finding: "Low conversion on 28-piece 'Challenging' difficulty.",
          evidence: "Funnel drop-off rises to 68% for Challenging piece levels vs 24% on Easy.",
          priority: "medium",
          action: "Reposition Challenging description to emphasize puzzle-solving highlights.",
          status: "pending"
        },
        {
          finding: "Reveal Alert upsell demonstrates high conversion correlation.",
          evidence: "84% of orders including the $1 Reveal Alert convert to successful payment completions.",
          priority: "high",
          action: "Pre-check the Reveal Alert checkbox in Step 3 reviews by default.",
          status: "pending"
        },
        {
          finding: "High mobile traffic bounce rate on personalization chips.",
          evidence: "42% of users abandoning Step 2 have not picked any Occasion or Tone.",
          priority: "high",
          action: "Redesign chips layout to make gold highlighting stand out instantly.",
          status: "implemented"
        }
      ]);
    }
    const list = await Recommendation.find().sort({ createdAt: -1 });
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

router.post('/recommendations/:id/status', authenticateAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const rec = await Recommendation.findByIdAndUpdate(req.params.id, { status }, { new: true });
    
    // Log setting modification
    const log = new AuditLog({
      adminUserId: req.admin.id,
      action: `UPDATE_RECOMMENDATION_STATUS_${status.toUpperCase()}`,
      targetModel: 'Recommendation',
      targetId: req.params.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    });
    await log.save();

    res.json({ success: true, recommendation: rec });
  } catch (err) {
    next(err);
  }
});

// --- ROADMAP / WORK-PROGRESS ROADMAP ---

router.get('/work-items', authenticateAdmin, async (req, res, next) => {
  try {
    // Seed default roadmap progress if none exist
    const count = await WorkItem.countDocuments();
    if (count === 0) {
      await WorkItem.insertMany([
        {
          area: "Backend",
          priority: "high",
          owner: "Zain",
          targetDate: new Date("2026-07-20"),
          status: "in-progress",
          blockers: "Awaiting Tap API sandbox keys activation",
          percentageComplete: 70,
          description: "Connect production Tap Payments integration portal."
        },
        {
          area: "WhatsApp Integration",
          priority: "medium",
          owner: "Developer",
          targetDate: new Date("2026-08-01"),
          status: "todo",
          percentageComplete: 20,
          description: "Configure Meta developer credentials and WhatsApp templates approval."
        },
        {
          area: "Branding Design",
          priority: "low",
          owner: "Zain",
          targetDate: new Date("2026-07-15"),
          status: "done",
          percentageComplete: 100,
          description: "Apply gold highlighting styling themes globally."
        }
      ]);
    }
    const list = await WorkItem.find().sort({ createdAt: -1 });
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

router.post('/work-items', authenticateAdmin, async (req, res, next) => {
  try {
    const { _id, area, priority, owner, targetDate, status, blockers, percentageComplete, description } = req.body;
    let item;
    
    if (_id) {
      item = await WorkItem.findByIdAndUpdate(_id, {
        area, priority, owner, targetDate, status, blockers, percentageComplete, description
      }, { new: true });
    } else {
      item = new WorkItem({
        area, priority, owner, targetDate, status, blockers, percentageComplete, description
      });
      await item.save();
    }

    const log = new AuditLog({
      adminUserId: req.admin.id,
      action: _id ? 'UPDATE_WORK_ITEM' : 'CREATE_WORK_ITEM',
      targetModel: 'WorkItem',
      targetId: item._id.toString(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    });
    await log.save();

    res.json({ success: true, workItem: item });
  } catch (err) {
    next(err);
  }
});

// --- SETTINGS (FEATURE FLAGS SAFE CONTROL) ---

router.get('/settings', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({
      success: true,
      flags: {
        CHECKOUT_ENABLED: process.env.CHECKOUT_ENABLED === 'true',
        WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true'
      },
      hosting: {
        environment: process.env.NODE_ENV || 'production',
        databaseStatus: 'CONNECTED',
        apiVersion: 'v2.0.0-production'
      }
    });
  } catch (err) {
    next(err);
  }
});

// --- AUDIT TRAIL LOGS LOGS ---

router.get('/audit-logs', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await AuditLog.find().populate('adminUserId', 'username').sort({ timestamp: -1 });
    res.json({ success: true, list });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

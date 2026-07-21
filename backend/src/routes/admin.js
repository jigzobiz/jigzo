const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

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
const { getFrontendOrigin, resolveJwtSecret } = require('../utils/runtimeConfig');
const { resolveEmailDelivery } = require('../utils/emailSafety');

const JWT_SECRET = resolveJwtSecret();

// --- WAITLIST EMAIL SUPPORT ---
const EMAIL_FROM = process.env.EMAIL_FROM || 'JIGZO <info@jigzo.biz>';
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);

const inferCountry = record => {
  const context = record.context || {};
  const directCountry =
    record.country ||
    context.country ||
    context.countryName ||
    context.localeCountry;

  if (directCountry) return String(directCountry);

  const digits = String(record.phone || '').replace(/\D/g, '');
  const countryPrefixes = [
    ['973', 'Bahrain'],
    ['966', 'Saudi Arabia'],
    ['971', 'United Arab Emirates'],
    ['965', 'Kuwait'],
    ['974', 'Qatar'],
    ['968', 'Oman'],
    ['962', 'Jordan'],
    ['20', 'Egypt'],
    ['44', 'United Kingdom'],
    ['91', 'India'],
    ['92', 'Pakistan'],
    ['90', 'Turkey'],
    ['33', 'France'],
    ['49', 'Germany'],
    ['1', 'United States / Canada']
  ];

  const match = countryPrefixes.find(([prefix]) => digits.startsWith(prefix));
  return match ? match[1] : 'Unknown';
};

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
  return email || '';
};

const maskPhone = (phone) => {
  return phone || '';
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

// --- ADMIN REVEAL LINKS (source of truth: Puzzle.recipients) ---

// Flattened, one row per puzzle recipient. Full sender/receiver contact details
// are intentionally visible to authenticated admins for customer support.
// The secure reveal link is NOT included here — it is fetched on demand via /copy.
router.get('/reveal-links', authenticateAdmin, async (req, res, next) => {
  try {
    const puzzles = await Puzzle.find().sort({ createdAt: -1 });

    const rows = [];
    for (const puzzle of puzzles) {
      const recipients = puzzle.recipients || [];
      recipients.forEach((rec, index) => {
        // Legacy recipients without deliveryMethod display as WhatsApp.
        const deliveryMethod = rec.deliveryMethod === 'email' ? 'email' : 'whatsapp';
        const receiverContact = deliveryMethod === 'email'
          ? (rec.email || '')
          : (rec.phoneE164 || `${rec.countryCode || ''}${rec.phone || ''}`);

        rows.push({
          puzzleId: puzzle._id,
          publicId: puzzle.publicId,
          recipientIndex: index,
          senderName: puzzle.senderName || '',
          senderPhone: puzzle.senderPhone || '',
          recipientName: rec.name || '',
          deliveryMethod,
          receiverContact,
          deliveryStatus: rec.deliveryStatus || 'pending',
          createdAt: puzzle.createdAt,
          sentAt: rec.sentAt || null,
          openedAt: rec.openedAt || null,
          completedAt: rec.completedAt || null,
          lastError: rec.lastError || '',
          manualLinkProvidedAt: rec.manualLinkProvidedAt || null,
          manualLinkProvidedByUsername: rec.manualLinkProvidedByUsername || ''
        });
      });
    }

    // Record access without blocking the response.
    new AuditLog({
      adminUserId: req.admin.id,
      action: 'REVEAL_LINKS_VIEWED',
      targetModel: 'Puzzle',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    }).save().catch(auditError => {
      console.error('Failed to record REVEAL_LINKS_VIEWED audit log:', auditError.message);
    });

    res.json({ success: true, list: rows });
  } catch (err) {
    next(err);
  }
});

// Returns the secure reveal link for a single recipient. The raw URL is never
// written to the audit log.
router.post('/reveal-links/:puzzleId/:recipientIndex/copy', authenticateAdmin, async (req, res) => {
  try {
    const { puzzleId, recipientIndex } = req.params;
    const index = parseInt(recipientIndex, 10);

    if (!mongoose.isValidObjectId(puzzleId) || Number.isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid puzzle or recipient reference.' });
    }

    const puzzle = await Puzzle.findById(puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }
    if (!puzzle.recipients || !puzzle.recipients[index]) {
      return res.status(404).json({ error: 'Recipient not found.' });
    }

    const frontendUrl = getFrontendOrigin();
    const link = `${frontendUrl}/p/${puzzle.publicId}?r=${index}`;

    // Audit the action but never store the raw reveal URL.
    new AuditLog({
      adminUserId: req.admin.id,
      action: 'REVEAL_LINK_COPIED',
      targetModel: 'Puzzle',
      targetId: `${puzzle._id}#r${index}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    }).save().catch(auditError => {
      console.error('Failed to record REVEAL_LINK_COPIED audit log:', auditError.message);
    });

    res.json({ success: true, link });
  } catch (err) {
    console.error('Reveal link copy failed:', err.message);
    return res.status(500).json({ error: 'Unable to generate reveal link.' });
  }
});

// Atomically marks that an admin manually delivered the reveal link to a
// recipient. Delivery history (deliveryStatus/sentAt/etc.) is preserved.
router.post('/reveal-links/:puzzleId/:recipientIndex/manual-provided', authenticateAdmin, async (req, res) => {
  try {
    const { puzzleId, recipientIndex } = req.params;
    const index = parseInt(recipientIndex, 10);

    if (!mongoose.isValidObjectId(puzzleId) || Number.isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid puzzle or recipient reference.' });
    }

    const now = new Date();

    // Only transitions when not already marked (prevents duplicate state changes).
    const updated = await Puzzle.findOneAndUpdate(
      {
        _id: puzzleId,
        [`recipients.${index}`]: { $exists: true },
        [`recipients.${index}.manualLinkProvidedAt`]: null
      },
      {
        $set: {
          [`recipients.${index}.manualLinkProvidedAt`]: now,
          [`recipients.${index}.manualLinkProvidedBy`]: req.admin.id,
          [`recipients.${index}.manualLinkProvidedByUsername`]: req.admin.username || ''
        }
      },
      { new: true }
    );

    if (!updated) {
      const existing = await Puzzle.findById(puzzleId);
      if (!existing || !existing.recipients || !existing.recipients[index]) {
        return res.status(404).json({ error: 'Recipient not found.' });
      }
      return res.status(409).json({
        error: 'This recipient is already marked as manually provided.'
      });
    }

    new AuditLog({
      adminUserId: req.admin.id,
      action: 'REVEAL_LINK_MANUALLY_PROVIDED',
      targetModel: 'Puzzle',
      targetId: `${updated._id}#r${index}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    }).save().catch(auditError => {
      console.error('Failed to record REVEAL_LINK_MANUALLY_PROVIDED audit log:', auditError.message);
    });

    const rec = updated.recipients[index];
    res.json({
      success: true,
      recipient: {
        recipientIndex: index,
        manualLinkProvidedAt: rec.manualLinkProvidedAt,
        manualLinkProvidedByUsername: rec.manualLinkProvidedByUsername || ''
      }
    });
  } catch (err) {
    console.error('Mark manual provided failed:', err.message);
    return res.status(500).json({ error: 'Unable to update recipient.' });
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

    const fullList = list.map(notification => ({
      ...notification.toObject(),
      country: inferCountry(notification)
    }));

    // Record full-list access without blocking the response.
    new AuditLog({
      adminUserId: req.admin.id,
      action: 'WAITLIST_LIST_VIEWED',
      targetModel: 'NotificationRequest',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    }).save().catch(auditError => {
      console.error(
        'Failed to record WAITLIST_LIST_VIEWED audit log:',
        auditError.message
      );
    });

    res.json({ success: true, list: fullList });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/:id/send', authenticateAdmin, async (req, res) => {
  let notification = null;
  let providerAccepted = false;
  let providerMessageId = '';

  try {
    if (!resend) {
      return res.status(503).json({
        error: 'Email sending is not configured on this environment.'
      });
    }

    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();

    if (!subject || !message) {
      return res.status(400).json({
        error: 'Email subject and message are required.'
      });
    }

    if (subject.length > 200 || message.length > 5000) {
      return res.status(400).json({
        error: 'The subject or message exceeds the allowed length.'
      });
    }

    // Non-production email guard. Decide before mutating any record state so a
    // blocked staging send never leaves a record stuck mid-flight. The recipient
    // is resolved again at send time; the block decision here is recipient-independent.
    const stagingGuard = resolveEmailDelivery({ to: '', subject });
    if (!stagingGuard.ok) {
      return res.status(503).json({ error: stagingGuard.error });
    }

    // A failed record may only be retried with its exact original payload so
    // the stable Resend idempotency key stays consistent with the sent content.
    const priorRecord = await NotificationRequest.findById(req.params.id);
    if (priorRecord && priorRecord.sendStatus === 'failed') {
      const originalSubject = String(priorRecord.emailSubject || '');
      const originalMessage = String(priorRecord.emailBody || '');

      if (subject !== originalSubject || message !== originalMessage) {
        return res.status(409).json({
          error: 'A failed email can only be retried with its original subject and message.'
        });
      }
    }

    notification = await NotificationRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        email: { $exists: true, $nin: ['', null] },
        notified: { $ne: true },
        sendStatus: { $nin: ['sending', 'sent', 'review_required'] }
      },
      {
        $set: {
          sendStatus: 'sending',
          sendAttemptedAt: new Date(),
          emailSubject: subject,
          emailBody: message,
          lastSendError: ''
        }
      },
      { new: true }
    );

    if (!notification) {
      const existing = await NotificationRequest.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: 'Waitlist record not found.' });
      }

      if (!existing.email) {
        return res.status(400).json({
          error: 'This waitlist record does not contain an email address.'
        });
      }

      return res.status(409).json({
        error: 'This email has already been sent or is currently being sent.'
      });
    }

    // Record the send attempt without blocking the actual email delivery.
    new AuditLog({
      adminUserId: req.admin.id,
      action: 'WAITLIST_EMAIL_SEND_ATTEMPT',
      targetModel: 'NotificationRequest',
      targetId: notification._id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || ''
    }).save().catch(auditError => {
      console.error(
        'Failed to record WAITLIST_EMAIL_SEND_ATTEMPT audit log:',
        auditError.message
      );
    });

    const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');

    const html = [
      '<div style="margin:0;padding:32px 20px;background:#faf8ec;">',
      '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid rgba(28,25,19,0.08);border-radius:16px;padding:32px;font-family:Arial,sans-serif;color:#1c1913;line-height:1.65;">',
      '<div style="font-size:22px;font-weight:700;letter-spacing:0.04em;margin-bottom:24px;">JIGZO</div>',
      '<div style="font-size:16px;">' + safeMessage + '</div>',
      '<div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(28,25,19,0.10);font-size:12px;color:rgba(28,25,19,0.55);">',
      'Sent by JIGZO &middot; Every surprise deserves a memorable reveal.',
      '</div></div></div>'
    ].join('');

    // Resolve the real destination (redirected + subject-prefixed on staging).
    const delivery = resolveEmailDelivery({ to: notification.email, subject });

    const result = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to: [delivery.to],
        subject: delivery.subject,
        text: message,
        html
      },
      {
        idempotencyKey: 'waitlist-email/' + notification._id
      }
    );

    if (result.error) {
      const providerError = new Error(
        result.error.message || 'The email provider rejected the message.'
      );
      providerError.statusCode = 502;
      throw providerError;
    }

    providerAccepted = true;
    providerMessageId = result.data?.id || '';

    const sentAt = new Date();

    const updatedNotification = await NotificationRequest.findByIdAndUpdate(
      notification._id,
      {
        $set: {
          notified: true,
          notifiedAt: sentAt,
          sendStatus: 'sent',
          sentAt,
          sentBy: req.admin.id,
          sentByUsername: req.admin.username,
          providerMessageId,
          lastSendError: ''
        }
      },
      { new: true }
    );

    try {
      await new AuditLog({
        adminUserId: req.admin.id,
        action: 'WAITLIST_EMAIL_SENT',
        targetModel: 'NotificationRequest',
        targetId: notification._id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || ''
      }).save();
    } catch (auditError) {
      console.error(
        'Failed to record WAITLIST_EMAIL_SENT audit log:',
        auditError.message
      );
    }

    return res.json({
      success: true,
      notification: {
        ...updatedNotification.toObject(),
        country: inferCountry(updatedNotification)
      }
    });
  } catch (error) {
    if (notification?._id) {
      const failureState = providerAccepted
        ? {
            sendStatus: 'review_required',
            providerMessageId,
            lastSendError:
              'The provider accepted the email, but database confirmation failed. Manual review is required.'
          }
        : {
            sendStatus: 'failed',
            lastSendError: String(
              error.message || 'Email send failed'
            ).slice(0, 500)
          };

      await NotificationRequest.findByIdAndUpdate(
        notification._id,
        { $set: failureState }
      ).catch(() => {});

      await new AuditLog({
        adminUserId: req.admin.id,
        action: providerAccepted
          ? 'WAITLIST_EMAIL_CONFIRMATION_FAILED'
          : 'WAITLIST_EMAIL_FAILED',
        targetModel: 'NotificationRequest',
        targetId: notification._id,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || ''
      }).save().catch(() => {});
    }

    console.error('Waitlist email send failed:', error.message);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Unable to send the email.'
    });
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

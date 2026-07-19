const express = require('express');
const router = express.Router();
const AnonymousSession = require('../models/AnonymousSession');
const JourneyEvent = require('../models/JourneyEvent');
const Customer = require('../models/Customer');
const DraftPuzzle = require('../models/DraftPuzzle');

const ALLOWED_EVENTS = new Set([
  'landing_viewed', 'hero_cta_clicked', 'pricing_viewed', 'create_page_viewed',
  'create_started', 'photo_uploaded', 'difficulty_selected', 'occasion_selected',
  'tone_selected', 'message_written', 'recipient_added', 'sender_details_added',
  'create_validation_failed', 'checkout_viewed', 'checkout_blocked', 'checkout_started',
  'payment_succeeded', 'payment_failed', 'payment_cancelled', 'puzzle_created',
  'whatsapp_accepted', 'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read', 'whatsapp_failed',
  'puzzle_opened', 'puzzle_started', 'puzzle_completed', 'reveal_viewed',
  'save_share_clicked', 'share_completed', 'replay_clicked', 'create_your_puzzle_clicked',
  'occasion_card_click', 'photo_cropped', 'review_opened', 'payment_started', 'waitlist_joined'
]);

const METADATA_SCHEMAS = {
  landing_viewed: {},
  hero_cta_clicked: {},
  pricing_viewed: {},
  create_page_viewed: {},
  create_started: {},
  photo_uploaded: {},
  photo_cropped: {},
  message_written: {},
  sender_details_added: {},
  whatsapp_accepted: {},
  whatsapp_sent: {},
  whatsapp_delivered: {},
  whatsapp_read: {},
  whatsapp_failed: {},
  puzzle_started: {
    pieceCount: { type: 'number', min: 1, max: 1000 }
  },
  puzzle_opened: {
    pieceCount: { type: 'number', min: 1, max: 1000 }
  },
  reveal_viewed: {},
  save_share_clicked: {},
  replay_clicked: {},
  create_your_puzzle_clicked: {},
  occasion_card_click: {
    occasion: { type: 'string', maxLength: 100 }
  },
  difficulty_selected: {
    pieceCount: { type: 'number', min: 1, max: 1000 }
  },
  occasion_selected: {
    occasion: { type: 'string', maxLength: 100 },
    tone: { type: 'string', maxLength: 100 }
  },
  recipient_added: {
    recipientCount: { type: 'number', min: 1, max: 100 }
  },
  create_validation_failed: {
    step: { type: 'number', min: 1, max: 10 },
    reasonCode: { type: 'string', maxLength: 100 }
  },
  review_opened: {
    difficulty: { type: 'number', min: 1, max: 1000 },
    hasRevealAlert: { type: 'boolean' },
    recipientsCount: { type: 'number', min: 1, max: 100 }
  },
  checkout_viewed: {
    difficulty: { type: 'number', min: 1, max: 1000 },
    hasRevealAlert: { type: 'boolean' },
    recipientsCount: { type: 'number', min: 1, max: 100 }
  },
  checkout_blocked: {
    reason: { type: 'string', maxLength: 100 }
  },
  checkout_started: {
    amount: { type: 'number', min: 0, max: 1000000 },
    recipientsCount: { type: 'number', min: 1, max: 100 }
  },
  payment_started: {
    isLocalTest: { type: 'boolean' }
  },
  payment_succeeded: {
    isLocalTest: { type: 'boolean' }
  },
  payment_failed: {
    isLocalTest: { type: 'boolean' }
  },
  payment_cancelled: {
    isLocalTest: { type: 'boolean' }
  },
  puzzle_created: {
    recipientCount: { type: 'number', min: 1, max: 100 },
    hasRevealAlert: { type: 'boolean' },
    currency: { type: 'string', maxLength: 10 }
  },
  puzzle_completed: {
    pieceCount: { type: 'number', min: 1, max: 1000 },
    durationSeconds: { type: 'number', min: 0, max: 1000000 }
  },
  share_completed: {
    method: { type: 'string', enum: ['native_share', 'download'], maxLength: 50 }
  },
  waitlist_joined: {
    interestType: { type: 'string', maxLength: 100 }
  }
};

function validateAndSanitizeMetadata(eventType, metadata) {
  const schema = METADATA_SCHEMAS[eventType];
  if (!schema) return {};

  const sanitized = {};
  for (const [key, rule] of Object.entries(schema)) {
    const val = metadata[key];
    if (val === undefined || val === null) continue;

    if (rule.type === 'number') {
      const num = Number(val);
      if (!isNaN(num)) {
        if (rule.min !== undefined && num < rule.min) continue;
        if (rule.max !== undefined && num > rule.max) continue;
        sanitized[key] = num;
      }
    } else if (rule.type === 'string') {
      let str = String(val);
      if (rule.maxLength !== undefined && str.length > rule.maxLength) {
        str = str.substring(0, rule.maxLength);
      }
      if (rule.enum && !rule.enum.includes(str)) continue;
      sanitized[key] = str;
    } else if (rule.type === 'boolean') {
      sanitized[key] = Boolean(val);
    }
  }
  return sanitized;
}

function normalizePath(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '/';
  
  if (urlOrPath.length > 2000) {
    urlOrPath = urlOrPath.substring(0, 2000);
  }

  let pathname = urlOrPath;
  try {
    if (urlOrPath.includes('://')) {
      const parsed = new URL(urlOrPath);
      pathname = parsed.pathname;
    } else {
      pathname = urlOrPath.split('?')[0].split('#')[0];
    }
  } catch (err) {
    pathname = '/';
  }

  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }

  if (pathname.startsWith('/p/')) {
    return '/p/:publicId';
  }

  const cleanPath = pathname.trim();
  if (cleanPath === '/' || cleanPath === '') return '/';
  if (cleanPath === '/create') return '/create';
  if (cleanPath === '/terms') return '/terms';
  if (cleanPath === '/admin') return '/admin';

  return '/';
}

// Event Ingestion Endpoint
router.post('/events', async (req, res, next) => {
  try {
    const { anonymousId, sessionId, eventType, pageUrl, metadata = {}, eventId, identity = {} } = req.body;

    if (!anonymousId || !sessionId || !eventType) {
      return res.status(400).json({ error: 'anonymousId, sessionId, and eventType are required.' });
    }

    if (!ALLOWED_EVENTS.has(eventType)) {
      return res.status(400).json({ error: 'Unsupported or disallowed eventType.' });
    }

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required.' });
    }

    // Idempotency check
    const existingEvent = await JourneyEvent.findOne({ eventId });
    if (existingEvent) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    // Reject raw incoming metadata larger than 4 KB before sanitization
    const rawMetaStr = JSON.stringify(metadata);
    if (rawMetaStr.length > 4096) {
      return res.status(400).json({ error: 'Raw metadata exceeds size limit.' });
    }

    const sanitizedMetadata = validateAndSanitizeMetadata(eventType, metadata);
    const sanitizedMetaStr = JSON.stringify(sanitizedMetadata);
    if (sanitizedMetaStr.length > 1024) {
      return res.status(400).json({ error: 'Sanitized metadata exceeds size limit.' });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
    const userAgent = req.headers['user-agent'] || '';

    // 1. Ensure Anonymous Session is registered
    let session = await AnonymousSession.findOne({ sessionId });
    if (!session) {
      session = new AnonymousSession({
        anonymousId,
        sessionId,
        ipAddress,
        userAgent
      });
      await session.save();
    } else {
      session.updatedAt = new Date();
      await session.save();
    }

    // 2. Manage identified Customer mapping if details exist
    let customerId = session.customerId || null;
    let identityName = '';
    let identityEmail = '';
    let identityPhone = '';

    const allowedIdentityEvents = new Set(['waitlist_joined', 'checkout_started', 'payment_succeeded', 'puzzle_created']);
    if (allowedIdentityEvents.has(eventType) && identity && typeof identity === 'object') {
      const { validatePhone, validateEmail } = require('../utils/contactValidation');
      if (identity.name) {
        identityName = String(identity.name).trim().substring(0, 100);
      }
      if (identity.email) {
        const emailCheck = validateEmail(identity.email);
        if (emailCheck.valid) {
          identityEmail = emailCheck.email;
        }
      }
      if (identity.phone) {
        const phoneCheck = validatePhone(identity.phone);
        if (phoneCheck.valid) {
          identityPhone = phoneCheck.e164;
        }
      }
    }

    if (identityEmail || identityPhone) {
      let customer;
      if (identityEmail) {
        customer = await Customer.findOne({ email: identityEmail });
      }
      if (!customer && identityPhone) {
        customer = await Customer.findOne({ phone: identityPhone });
      }

      if (!customer) {
        customer = new Customer({
          name: identityName || '',
          email: identityEmail || undefined,
          phone: identityPhone || undefined,
          anonymousIds: [anonymousId],
          sessionIds: [sessionId]
        });
      } else {
        if (identityName && !customer.name) customer.name = identityName;
        if (identityEmail && !customer.email) customer.email = identityEmail;
        if (identityPhone && !customer.phone) customer.phone = identityPhone;
        
        if (!customer.anonymousIds.includes(anonymousId)) {
          customer.anonymousIds.push(anonymousId);
        }
        if (!customer.sessionIds.includes(sessionId)) {
          customer.sessionIds.push(sessionId);
        }
      }

      if (['payment_succeeded', 'puzzle_created'].includes(eventType)) {
        customer.converted = true;
      }

      await customer.save();
      customerId = customer._id;

      session.customerId = customerId;
      await session.save();

      await JourneyEvent.updateMany(
        { anonymousId, customerId: null },
        { $set: { customerId } }
      );
    }

    const normalizedPath = normalizePath(pageUrl);

    // 3. Save Funnel Journey Event
    const journeyEvent = new JourneyEvent({
      anonymousId,
      sessionId,
      customerId,
      eventType,
      pageUrl: normalizedPath,
      metadata: sanitizedMetadata,
      eventId
    });
    await journeyEvent.save();

    // 4. Update Draft Puzzle state cache if within wizard steps
    if (['create_started', 'photo_uploaded', 'difficulty_selected', 'recipient_added', 'occasion_selected', 'tone_selected', 'message_written', 'sender_details_added'].includes(eventType)) {
      const stepMapping = {
        'create_started': 1,
        'photo_uploaded': 1,
        'difficulty_selected': 1,
        'occasion_selected': 2,
        'tone_selected': 2,
        'message_written': 2,
        'recipient_added': 3,
        'sender_details_added': 3
      };

      const step = stepMapping[eventType] || 1;
      await DraftPuzzle.findOneAndUpdate(
        { anonymousId },
        {
          sessionId,
          stepsCompleted: step,
          $set: { currentStepData: sanitizedMetadata },
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    // Remove draft puzzle cache once order completes successfully
    if (['payment_succeeded', 'puzzle_created'].includes(eventType)) {
      await DraftPuzzle.deleteOne({ anonymousId });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

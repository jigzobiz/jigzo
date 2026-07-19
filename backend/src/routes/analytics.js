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
  'save_share_clicked', 'share_completed', 'replay_clicked', 'create_your_puzzle_clicked'
]);

const ALLOWED_METADATA_KEYS = new Set([
  'occasion', 'tone', 'difficulty', 'hasRevealAlert', 'recipientsCount',
  'recipientCount', 'amount', 'orderId', 'isLocalTest', 'durationSeconds',
  'reason', 'interestType', 'currency'
]);

// Event Ingestion Endpoint
router.post('/events', async (req, res, next) => {
  try {
    const { anonymousId, sessionId, eventType, pageUrl, metadata = {} } = req.body;

    if (!anonymousId || !sessionId || !eventType) {
      return res.status(400).json({ error: 'anonymousId, sessionId, and eventType are required.' });
    }

    if (!ALLOWED_EVENTS.has(eventType)) {
      return res.status(400).json({ error: 'Unsupported or disallowed eventType.' });
    }

    const sanitizedMetadata = {};
    if (metadata && typeof metadata === 'object') {
      for (const key of Object.keys(metadata)) {
        if (ALLOWED_METADATA_KEYS.has(key)) {
          sanitizedMetadata[key] = metadata[key];
        }
      }
    }

    if (JSON.stringify(sanitizedMetadata).length > 1000) {
      return res.status(400).json({ error: 'Metadata size limit exceeded.' });
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
    const { email, phone, name } = metadata;

    if (email || phone) {
      let customer;
      // Search for existing Customer matching email or phone
      if (email) {
        customer = await Customer.findOne({ email });
      }
      if (!customer && phone) {
        customer = await Customer.findOne({ phone });
      }

      if (!customer) {
        // Create new Customer
        customer = new Customer({
          name: name || '',
          email: email || undefined,
          phone: phone || undefined,
          anonymousIds: [anonymousId],
          sessionIds: [sessionId]
        });
      } else {
        // Merge identifiers
        if (name && !customer.name) customer.name = name;
        if (email && !customer.email) customer.email = email;
        if (phone && !customer.phone) customer.phone = phone;
        
        if (!customer.anonymousIds.includes(anonymousId)) {
          customer.anonymousIds.push(anonymousId);
        }
        if (!customer.sessionIds.includes(sessionId)) {
          customer.sessionIds.push(sessionId);
        }
      }

      // If completing an order, mark conversion
      if (['payment_succeeded', 'puzzle_created'].includes(eventType)) {
        customer.converted = true;
      }

      await customer.save();
      customerId = customer._id;

      // Link session and update previous events matching this anonymous ID
      session.customerId = customerId;
      await session.save();

      await JourneyEvent.updateMany(
        { anonymousId, customerId: null },
        { $set: { customerId } }
      );
    }

    // 3. Save Funnel Journey Event
    const journeyEvent = new JourneyEvent({
      anonymousId,
      sessionId,
      customerId,
      eventType,
      pageUrl,
      metadata: sanitizedMetadata
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

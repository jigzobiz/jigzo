const express = require('express');
const router = express.Router();
const AnonymousSession = require('../models/AnonymousSession');
const JourneyEvent = require('../models/JourneyEvent');
const DraftPuzzle = require('../models/DraftPuzzle');
const { sanitizePageUrl, derivePuzzleRef, scrubMetadata } = require('../utils/analyticsSanitize');

// Event Ingestion Endpoint
router.post('/events', async (req, res, next) => {
  try {
    const { anonymousId, sessionId, eventType, pageUrl, metadata = {} } = req.body;

    if (!anonymousId || !sessionId || !eventType) {
      return res.status(400).json({ error: 'anonymousId, sessionId, and eventType are required.' });
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

    // Customer lifecycle is authoritative only from real Order + Puzzle data.
    // Analytics may retain an existing historical session link, but never
    // creates or mutates Customer rows from event metadata.
    let customerId = session.customerId || null;

    // 3. Sanitize BEFORE persistence — the backend never trusts the client.
    // puzzleRef is derived first (one-way keyed hash), then every capability
    // identifier, token, URL, phone number and personal detail is removed.
    // Personal metadata is never written to the event log itself.
    const safePageUrl = sanitizePageUrl(pageUrl);
    const safePuzzleRef = derivePuzzleRef(metadata, pageUrl);
    const safeMetadata = scrubMetadata(metadata);

    // Save Funnel Journey Event
    const journeyEvent = new JourneyEvent({
      anonymousId,
      sessionId,
      customerId,
      eventType,
      pageUrl: safePageUrl,
      puzzleRef: safePuzzleRef,
      metadata: safeMetadata
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
          // Scrubbed copy only — the draft cache must not hold capability
          // identifiers or personal details either.
          $set: { currentStepData: safeMetadata },
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

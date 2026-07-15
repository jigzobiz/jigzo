const express = require('express');
const router = express.Router();
const NotificationRequest = require('../models/NotificationRequest');
const JourneyEvent = require('../models/JourneyEvent');

router.post('/', async (req, res, next) => {
  try {
    const { email, phone, country = '', interestType = 'jigzo_launch', sourceUrl = '', context = {}, anonymousId, sessionId } = req.body;
    
    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone number is required.' });
    }

    // Save interest entry to NotificationRequest collection
    const request = new NotificationRequest({
      email,
      phone,
      country,
      interestType,
      sourceUrl,
      context
    });
    await request.save();

    // Trigger waitlist_joined analytics event if anonymous context is provided
    if (anonymousId && sessionId) {
      const event = new JourneyEvent({
        anonymousId,
        sessionId,
        eventType: 'waitlist_joined',
        pageUrl: sourceUrl,
        metadata: { email, phone, country, interestType }
      });
      await event.save();
    }

    res.status(201).json({
      success: true,
      message: "You're on the list! We'll notify you soon."
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Puzzle = require('../models/Puzzle');
const Order = require('../models/Order');
const imageService = require('../services/imageService');
const whatsappService = require('../services/whatsappService');
const { validatePhone, validateEmail } = require('../utils/contactValidation');

/**
 * POST /api/puzzles
 * Creates a new draft puzzle.
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      cropData,
      message,
      senderName,
      senderPhone,
      revealIdentity,
      occasion,
      tone,
      pieceCount,
      recipients
    } = req.body;

    if (!cropData) {
      return res.status(400).json({ error: 'cropData (base64 image) is required.' });
    }

    // --- Sender phone validation + E.164 normalization ---
    const senderCheck = validatePhone(senderPhone);
    if (!senderCheck.valid) {
      return res.status(400).json({
        error: 'Enter a valid phone number for the sender.',
        field: 'senderPhone'
      });
    }
    const normalizedSenderPhone = senderCheck.e164;

    // --- Recipient validation, normalization and de-duplication ---
    const incomingRecipients = Array.isArray(recipients) ? recipients : [];
    if (incomingRecipients.length === 0) {
      return res.status(400).json({
        error: 'At least one recipient is required.',
        field: 'recipients'
      });
    }

    const formattedRecipients = [];
    const seenIdentities = new Set();

    for (let i = 0; i < incomingRecipients.length; i++) {
      const r = incomingRecipients[i] || {};
      const name = String(r.name || '').trim();

      if (!name) {
        return res.status(400).json({
          error: `Recipient #${i + 1} is missing a name.`,
          field: `recipients[${i}].name`
        });
      }

      // Legacy payloads without deliveryMethod are treated as WhatsApp.
      const deliveryMethod = r.deliveryMethod === 'email' ? 'email' : 'whatsapp';

      if (deliveryMethod === 'email') {
        const emailCheck = validateEmail(r.email);
        if (!emailCheck.valid) {
          return res.status(400).json({
            error: `Enter a valid email address for recipient #${i + 1}.`,
            field: `recipients[${i}].email`
          });
        }

        if (seenIdentities.has('email:' + emailCheck.email)) {
          return res.status(400).json({
            error: `Recipient #${i + 1} duplicates another recipient's email.`,
            field: `recipients[${i}].email`
          });
        }
        seenIdentities.add('email:' + emailCheck.email);

        formattedRecipients.push({
          name,
          deliveryMethod: 'email',
          email: emailCheck.email,
          countryCode: '',
          phone: '',
          phoneE164: '',
          deliveryStatus: 'pending'
        });
      } else {
        const phoneCheck = validatePhone(r.phone, r.countryCode);
        if (!phoneCheck.valid) {
          return res.status(400).json({
            error: `Enter a valid phone number for recipient #${i + 1}.`,
            field: `recipients[${i}].phone`
          });
        }

        if (seenIdentities.has('phone:' + phoneCheck.e164)) {
          return res.status(400).json({
            error: `Recipient #${i + 1} duplicates another recipient's phone number.`,
            field: `recipients[${i}].phone`
          });
        }
        seenIdentities.add('phone:' + phoneCheck.e164);

        formattedRecipients.push({
          name,
          deliveryMethod: 'whatsapp',
          email: '',
          countryCode: r.countryCode || '',
          phone: r.phone || '',
          phoneE164: phoneCheck.e164,
          deliveryStatus: 'pending'
        });
      }
    }

    const publicId = uuidv4().replace(/-/g, '').substring(0, 16);

    // Save image to local disk
    const cropImageUrl = await imageService.saveCropImage(cropData, publicId);

    const puzzle = new Puzzle({
      publicId,
      status: 'draft',
      cropImageUrl,
      message: message || '',
      senderName: senderName || '',
      senderPhone: normalizedSenderPhone,
      revealIdentity: revealIdentity !== false,
      occasion: occasion || '',
      tone: tone || '',
      pieceCount: parseInt(pieceCount) || 12,
      recipients: formattedRecipients
    });

    await puzzle.save();

    res.status(201).json({
      success: true,
      puzzle: {
        publicId: puzzle.publicId,
        status: puzzle.status,
        cropImageUrl: puzzle.cropImageUrl,
        message: puzzle.message,
        senderName: puzzle.senderName,
        revealIdentity: puzzle.revealIdentity,
        pieceCount: puzzle.pieceCount,
        recipients: puzzle.recipients.map(r => ({
          name: r.name,
          deliveryStatus: r.deliveryStatus
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/puzzles/:publicId
 * Returns receiver-safe puzzle data.
 * Strips senderPhone, recipient phone numbers, and MongoDB IDs.
 */
router.get('/:publicId', async (req, res, next) => {
  try {
    const puzzle = await Puzzle.findOne({ publicId: req.params.publicId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    // Format safe recipient fields
    const safeRecipients = puzzle.recipients.map((r, index) => ({
      index,
      name: r.name,
      deliveryStatus: r.deliveryStatus,
      openedAt: r.openedAt,
      completedAt: r.completedAt,
      completionSeconds: r.completionSeconds
    }));

    res.json({
      success: true,
      puzzle: {
        publicId: puzzle.publicId,
        status: puzzle.status,
        cropImageUrl: puzzle.cropImageUrl,
        message: puzzle.message,
        senderName: puzzle.revealIdentity ? puzzle.senderName : 'Anonymous',
        revealIdentity: puzzle.revealIdentity,
        pieceCount: puzzle.pieceCount,
        recipients: safeRecipients
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/puzzles/:publicId
 * Updates draft puzzle data before payment.
 */
router.patch('/:publicId', async (req, res, next) => {
  try {
    const puzzle = await Puzzle.findOne({ publicId: req.params.publicId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    if (puzzle.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft puzzles can be modified.' });
    }

    const { message, senderName, senderPhone, revealIdentity, pieceCount, recipients } = req.body;

    if (message !== undefined) puzzle.message = message;
    if (senderName !== undefined) puzzle.senderName = senderName;
    if (senderPhone !== undefined) puzzle.senderPhone = senderPhone;
    if (revealIdentity !== undefined) puzzle.revealIdentity = revealIdentity;
    if (pieceCount !== undefined) puzzle.pieceCount = parseInt(pieceCount) || puzzle.pieceCount;

    if (recipients !== undefined) {
      puzzle.recipients = recipients.map(r => ({
        name: r.name,
        countryCode: r.countryCode || '',
        phone: r.phone || '',
        deliveryStatus: 'pending'
      }));
    }

    await puzzle.save();

    res.json({
      success: true,
      puzzle: {
        publicId: puzzle.publicId,
        status: puzzle.status,
        cropImageUrl: puzzle.cropImageUrl,
        message: puzzle.message,
        senderName: puzzle.senderName,
        revealIdentity: puzzle.revealIdentity,
        pieceCount: puzzle.pieceCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/puzzles/:publicId/open
 * Logs when a recipient opens the puzzle link.
 */
router.post('/:publicId/open', async (req, res, next) => {
  try {
    const puzzle = await Puzzle.findOne({ publicId: req.params.publicId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    // Determine recipient index (fallback to first recipient)
    const recipientIndex = parseInt(req.query.r) || 0;
    const recipient = puzzle.recipients[recipientIndex];

    if (recipient) {
      if (!recipient.openedAt) {
        recipient.openedAt = new Date();
        await puzzle.save();
      }
      return res.json({ success: true, openedAt: recipient.openedAt });
    }

    res.status(400).json({ error: 'Recipient index out of bounds.' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/puzzles/:publicId/complete
 * Logs puzzle completion metrics and alerts sender.
 */
router.post('/:publicId/complete', async (req, res, next) => {
  try {
    const { durationSeconds } = req.body;
    const puzzle = await Puzzle.findOne({ publicId: req.params.publicId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    const recipientIndex = parseInt(req.query.r) || 0;
    const recipient = puzzle.recipients[recipientIndex];

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient index out of bounds.' });
    }

    if (!recipient.completedAt) {
      recipient.completedAt = new Date();
      recipient.completionSeconds = parseInt(durationSeconds) || 0;
      await puzzle.save();

      // Check if Reveal Alert addon was purchased for this puzzle order
      const order = await Order.findOne({ puzzleId: puzzle.publicId, paymentStatus: 'paid' });
      const hasRevealAlert = order && order.addOns > 0;

      if (hasRevealAlert && puzzle.senderPhone) {
        // Trigger Reveal Alert WhatsApp message
        await whatsappService.sendRevealAlert(puzzle.senderPhone, {
          recipientName: recipient.name,
          durationSeconds: recipient.completionSeconds,
          completedAt: recipient.completedAt
        });
      }
    }

    res.json({
      success: true,
      completedAt: recipient.completedAt,
      completionSeconds: recipient.completionSeconds
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

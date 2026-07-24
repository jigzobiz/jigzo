const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Puzzle = require('../models/Puzzle');
const Order = require('../models/Order');
const imageService = require('../services/imageService');
const whatsappService = require('../services/whatsappService');
const { validatePhone, validateEmail } = require('../utils/contactValidation');
const storageService = require('../services/storageService');

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
      recipients,
      experienceLanguage,
      checkoutAttemptId
    } = req.body;

    if (checkoutAttemptId) {
      const existing = await Puzzle.findOne({ checkoutAttemptId });
      if (existing) {
        return res.status(200).json({
          success: true,
          puzzle: {
            publicId: existing.publicId,
            status: existing.status,
            cropImageUrl: existing.cropImageUrl,
            message: existing.message,
            senderName: existing.senderName,
            revealIdentity: existing.revealIdentity,
            pieceCount: existing.pieceCount,
            recipients: existing.recipients.map(r => ({
              name: r.name,
              deliveryStatus: r.deliveryStatus
            }))
          }
        });
      }
    }

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

    const publicId = require('crypto').randomBytes(16).toString('hex');

    // Save image to GridFS
    if (!cropData || typeof cropData !== 'string' || !cropData.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid cropData format. Expected base64 image data URL.' });
    }

    const matches = cropData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Could not parse base64 image content.' });
    }

    const detectedMime = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');
    const ext = detectedMime.split('/')[1] || 'jpg';
    const filename = `${publicId}.${ext}`;

    const imageStorageId = await storageService.saveImage(buffer, {
      filename,
      contentType: detectedMime,
      publicId
    });

    const puzzle = new Puzzle({
      publicId,
      status: 'draft',
      cropImageUrl: `/api/puzzles/${publicId}/image`,
      imageStorageId,
      imageMimeType: detectedMime,
      message: message || '',
      senderName: senderName || '',
      senderPhone: normalizedSenderPhone,
      revealIdentity: revealIdentity !== false,
      occasion: occasion || '',
      tone: tone || '',
      pieceCount: parseInt(pieceCount) || 12,
      experienceLanguage: (experienceLanguage === 'ar' || experienceLanguage === 'en') ? experienceLanguage : 'en',
      recipients: formattedRecipients,
      checkoutAttemptId: checkoutAttemptId || undefined
    });

    try {
      await puzzle.save();
    } catch (err) {
      if (err.code === 11000 || err.message.includes('duplicate key') || err.message.includes('E11000')) {
        const existing = await Puzzle.findOne({ checkoutAttemptId });
        if (existing) {
          return res.status(200).json({
            success: true,
            puzzle: {
              publicId: existing.publicId,
              status: existing.status,
              cropImageUrl: existing.cropImageUrl,
              message: existing.message,
              senderName: existing.senderName,
              revealIdentity: existing.revealIdentity,
              pieceCount: existing.pieceCount,
              recipients: existing.recipients.map(r => ({
                name: r.name,
                deliveryStatus: r.deliveryStatus
              }))
            }
          });
        }
      }
      throw err;
    }

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
 * POST /api/puzzles/recovery
 * Safely recovers details of a puzzle/order by checkoutAttemptId.
 * Does not expose recipient details or puzzle content.
 */
router.post('/recovery', async (req, res, next) => {
  try {
    const { checkoutAttemptId } = req.body;
    if (!checkoutAttemptId) {
      return res.status(400).json({ error: 'checkoutAttemptId is required.' });
    }

    const puzzle = await Puzzle.findOne({ checkoutAttemptId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    const Order = require('../models/Order');
    const order = await Order.findOne({ puzzleId: puzzle.publicId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      puzzle: {
        publicId: puzzle.publicId,
        status: puzzle.status,
        orderId: order ? order.orderId : null,
        paymentStatus: order ? order.paymentStatus : 'unpaid',
        checkoutUrl: order ? order.paymentReference : null
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

    // Expiry check
    if (puzzle.expiresAt && new Date() > puzzle.expiresAt) {
      return res.status(410).json({ error: 'Puzzle link has expired.' });
    }

    // Status / TestMode check
    if (puzzle.status === 'ready' && !puzzle.testMode) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const rQuery = req.query.r;
    let recipientIndex;
    if (rQuery === undefined || rQuery === null || rQuery === '') {
      if (puzzle.recipients.length === 1) {
        recipientIndex = 0;
      } else {
        return res.status(400).json({ error: 'Invalid or missing recipient index.' });
      }
    } else {
      recipientIndex = parseInt(rQuery, 10);
      if (isNaN(recipientIndex) || recipientIndex < 0 || recipientIndex >= puzzle.recipients.length) {
        return res.status(400).json({ error: 'Invalid or missing recipient index.' });
      }
    }

    const recipient = puzzle.recipients[recipientIndex];
    const safeRecipient = {
      index: recipientIndex,
      name: recipient.name,
      openedAt: recipient.openedAt,
      completedAt: recipient.completedAt
    };

    // Format safe recipients list showing ONLY the requested index
    const safeRecipients = [];
    safeRecipients[recipientIndex] = safeRecipient;

    res.json({
      success: true,
      puzzle: {
        publicId: puzzle.publicId,
        cropImageUrl: `${puzzle.cropImageUrl}?r=${recipientIndex}`,
        senderName: puzzle.senderName,
        revealIdentity: puzzle.revealIdentity,
        pieceCount: puzzle.pieceCount,
        experienceLanguage: puzzle.experienceLanguage || 'en',
        recipient: safeRecipient,
        recipients: safeRecipients
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/puzzles/:publicId/image
 * Streams GridFS image or falls back to legacy path redirect.
 */
router.get('/:publicId/image', async (req, res, next) => {
  try {
    const puzzle = await Puzzle.findOne({ publicId: req.params.publicId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    if (puzzle.expiresAt && new Date() > puzzle.expiresAt) {
      return res.status(410).json({ error: 'Puzzle link has expired.' });
    }

    // Status / TestMode check
    if (puzzle.status === 'ready' && !puzzle.testMode) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (puzzle.status === 'ready' && puzzle.testMode) {
      const rQuery = req.query.r;
      let recipientIndex;
      if (rQuery === undefined || rQuery === null || rQuery === '') {
        if (puzzle.recipients.length === 1) {
          recipientIndex = 0;
        } else {
          return res.status(400).json({ error: 'Invalid or missing recipient index.' });
        }
      } else {
        recipientIndex = parseInt(rQuery, 10);
        if (isNaN(recipientIndex) || recipientIndex < 0 || recipientIndex >= puzzle.recipients.length) {
          return res.status(400).json({ error: 'Invalid or missing recipient index.' });
        }
      }
    }

    if (puzzle.imageStorageId) {
      res.setHeader('Content-Type', puzzle.imageMimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      const stream = storageService.getImageStream(puzzle.imageStorageId);
      stream.on('error', (err) => {
        console.error('[ImageRoute] GridFS Stream error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Image not found.' });
        }
      });
      stream.pipe(res);
    } else if (puzzle.cropImageUrl) {
      // Legacy compatibility: redirect only to trusted local same-origin paths
      const cleanUrl = String(puzzle.cropImageUrl).trim();
      if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('/assets/')) {
        return res.redirect(cleanUrl);
      }
      return res.status(404).json({ error: 'Image not found.' });
    } else {
      return res.status(404).json({ error: 'Image not found.' });
    }
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

    const { message, senderName, senderPhone, revealIdentity, pieceCount, recipients, experienceLanguage } = req.body;

    if (message !== undefined) puzzle.message = message;
    if (senderName !== undefined) puzzle.senderName = senderName;
    if (senderPhone !== undefined) puzzle.senderPhone = senderPhone;
    if (revealIdentity !== undefined) puzzle.revealIdentity = revealIdentity;
    if (pieceCount !== undefined) puzzle.pieceCount = parseInt(pieceCount) || puzzle.pieceCount;
    if (experienceLanguage !== undefined) {
      if (experienceLanguage === 'ar' || experienceLanguage === 'en') {
        puzzle.experienceLanguage = experienceLanguage;
      }
    }

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
        pieceCount: puzzle.pieceCount,
        experienceLanguage: puzzle.experienceLanguage || 'en'
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

    // Status / TestMode check
    if (puzzle.status === 'ready' && !puzzle.testMode) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Determine recipient index
    const rQuery = req.query.r;
    let recipientIndex;
    if (rQuery === undefined || rQuery === null || rQuery === '') {
      if (puzzle.recipients.length === 1) {
        recipientIndex = 0;
      } else {
        return res.status(400).json({ error: 'Invalid or missing recipient index.' });
      }
    } else {
      recipientIndex = parseInt(rQuery, 10);
      if (isNaN(recipientIndex) || recipientIndex < 0 || recipientIndex >= puzzle.recipients.length) {
        return res.status(400).json({ error: 'Invalid or missing recipient index.' });
      }
    }

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

    if (puzzle.expiresAt && new Date() > puzzle.expiresAt) {
      return res.status(410).json({ error: 'Puzzle link has expired.' });
    }

    // Status / TestMode check
    if (puzzle.status === 'ready' && !puzzle.testMode) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const rQuery = req.query.r;
    let recipientIndex;
    if (rQuery === undefined || rQuery === null || rQuery === '') {
      if (puzzle.recipients.length === 1) {
        recipientIndex = 0;
      } else {
        return res.status(400).json({ error: 'Invalid or missing recipient index.' });
      }
    } else {
      recipientIndex = parseInt(rQuery, 10);
      if (isNaN(recipientIndex) || recipientIndex < 0 || recipientIndex >= puzzle.recipients.length) {
        return res.status(400).json({ error: 'Invalid or missing recipient index.' });
      }
    }

    const recipient = puzzle.recipients[recipientIndex];

    let completionRecorded = false;

    if (!recipient.completedAt) {
      recipient.completedAt = new Date();
      recipient.completionSeconds = parseInt(durationSeconds) || 0;
      await puzzle.save();
      completionRecorded = true;

      // Check if Reveal Alert addon was purchased for this puzzle order
      const order = await Order.findOne({ puzzleId: puzzle.publicId, paymentStatus: 'paid' });
      const hasRevealAlert = order && order.addOns > 0;

      if (hasRevealAlert && puzzle.senderPhone) {
        // Trigger Reveal Alert WhatsApp message
        await whatsappService.sendRevealAlert({
          puzzleId: puzzle.publicId,
          recipientIndex,
          senderPhone: puzzle.senderPhone,
          recipientName: recipient.name,
          durationSeconds: recipient.completionSeconds
        });
      }
    }

    res.json({
      success: true,
      completionRecorded,
      message: puzzle.message,
      senderName: puzzle.senderName,
      completedAt: recipient.completedAt
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

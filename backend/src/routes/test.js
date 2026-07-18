const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const { isTestModeAllowed } = require('../utils/testModeGuard');
const { saveImage, deleteImage } = require('../services/storageService');
const Puzzle = require('../models/Puzzle');
const { validatePhone, validateEmail } = require('../utils/contactValidation');
const { getFrontendOrigin } = require('../utils/runtimeConfig');

// Conservative limits
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_SENDER_NAME = 100;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_RECIPIENT_COUNT = 50;
const ALLOWED_DIFFICULTIES = new Set([6, 15, 18, 28]);

/**
 * Helper to validate file signature / magic bytes.
 * @param {Buffer} buffer
 * @returns {string|null} Detected MIME type or null.
 */
function detectMimeType(buffer) {
  if (buffer.length < 8) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  return null;
}

/**
 * GET /api/test/status
 * Returns if test reveal mode is available.
 */
router.get('/status', (req, res) => {
  if (isTestModeAllowed(req)) {
    return res.json({ enabled: true });
  }
  return res.json({ enabled: false });
});

/**
 * POST /api/test/reveals
 * Creates an active, unpaid, direct test puzzle.
 */
router.post('/reveals', async (req, res, next) => {
  let createdStorageId = null;
  try {
    // 1. Authoritative Guard check
    if (!isTestModeAllowed(req)) {
      return res.status(403).json({ error: 'Staging test reveals are not allowed in this environment.' });
    }

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

    // 2. Base Validation
    if (!cropData || typeof cropData !== 'string') {
      return res.status(400).json({ error: 'cropData (base64 data URL) is required.' });
    }

    const matches = cropData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Could not parse base64 image data URL structure.' });
    }

    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // 3. Image validation
    if (buffer.length > MAX_IMAGE_SIZE) {
      return res.status(400).json({ error: 'Image exceeds 5MB size limit.' });
    }

    const detectedMime = detectMimeType(buffer);
    if (!detectedMime) {
      return res.status(400).json({ error: 'Invalid file signature. Only JPEG and PNG are allowed.' });
    }

    // 4. Input Limits & Field validation
    const cleanSenderName = String(senderName || '').trim();
    if (cleanSenderName.length > MAX_SENDER_NAME) {
      return res.status(400).json({ error: `Sender name must be under ${MAX_SENDER_NAME} characters.` });
    }

    const cleanMessage = String(message || '').trim();
    if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Hidden message must be under ${MAX_MESSAGE_LENGTH} characters.` });
    }

    const cleanPieceCount = parseInt(pieceCount);
    if (!ALLOWED_DIFFICULTIES.has(cleanPieceCount)) {
      return res.status(400).json({ error: 'Unsupported puzzle difficulty level.' });
    }

    const incomingRecipients = Array.isArray(recipients) ? recipients : [];
    if (incomingRecipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required.' });
    }
    if (incomingRecipients.length > MAX_RECIPIENT_COUNT) {
      return res.status(400).json({ error: `Recipient count exceeds limit of ${MAX_RECIPIENT_COUNT}.` });
    }

    // Validate phone for sender
    const senderCheck = validatePhone(senderPhone);
    if (!senderCheck.valid) {
      return res.status(400).json({ error: 'Enter a valid phone number for the sender.' });
    }
    const normalizedSenderPhone = senderCheck.e164;

    // Validate recipients
    const formattedRecipients = [];
    const seenIdentities = new Set();

    for (let i = 0; i < incomingRecipients.length; i++) {
      const r = incomingRecipients[i] || {};
      const name = String(r.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: `Recipient #${i + 1} is missing a name.` });
      }

      const deliveryMethod = r.deliveryMethod === 'email' ? 'email' : 'whatsapp';
      if (deliveryMethod === 'email') {
        const emailCheck = validateEmail(r.email);
        if (!emailCheck.valid) {
          return res.status(400).json({ error: `Enter a valid email address for recipient #${i + 1}.` });
        }
        const identityKey = `email:${emailCheck.email}`;
        if (seenIdentities.has(identityKey)) {
          return res.status(400).json({ error: `Recipient #${i + 1} duplicates another recipient's email.` });
        }
        seenIdentities.add(identityKey);

        formattedRecipients.push({
          name,
          deliveryMethod: 'email',
          email: emailCheck.email,
          deliveryStatus: 'delivered', // Auto-delivered in test mode
          sentAt: new Date()
        });
      } else {
        const phoneCheck = validatePhone(r.phone, r.countryCode);
        if (!phoneCheck.valid) {
          return res.status(400).json({ error: `Enter a valid phone number for recipient #${i + 1}.` });
        }
        const identityKey = `phone:${phoneCheck.e164}`;
        if (seenIdentities.has(identityKey)) {
          return res.status(400).json({ error: `Recipient #${i + 1} duplicates another recipient's phone number.` });
        }
        seenIdentities.add(identityKey);

        formattedRecipients.push({
          name,
          deliveryMethod: 'whatsapp',
          countryCode: r.countryCode || '',
          phone: r.phone || '',
          phoneE164: phoneCheck.e164,
          deliveryStatus: 'delivered', // Auto-delivered in test mode
          sentAt: new Date()
        });
      }
    }

    const publicId = require('crypto').randomBytes(16).toString('hex');

    // 5. GridFS Storage
    const filename = `${publicId}.${detectedMime === 'image/png' ? 'png' : 'jpg'}`;
    createdStorageId = await saveImage(buffer, {
      filename,
      contentType: detectedMime,
      publicId
    });

    // 6. Create Puzzle Record (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // We set status directly to 'ready' to accurately represent staging state.
    const puzzle = new Puzzle({
      publicId,
      status: 'ready',
      cropImageUrl: `/api/puzzles/${publicId}/image`,
      imageStorageId: createdStorageId,
      imageMimeType: detectedMime,
      testMode: true,
      message: cleanMessage,
      senderName: cleanSenderName,
      senderPhone: normalizedSenderPhone,
      revealIdentity: revealIdentity !== false,
      occasion: occasion || '',
      tone: tone || '',
      pieceCount: cleanPieceCount,
      recipients: formattedRecipients,
      expiresAt
    });

    await puzzle.save();

    const origin = getFrontendOrigin();
    const recipientLinks = puzzle.recipients.map((r, index) => ({
      recipientIndex: index,
      recipientName: r.name,
      revealUrl: `${origin}/p/${puzzle.publicId}?r=${index}`
    }));

    res.status(201).json({
      success: true,
      publicId: puzzle.publicId,
      revealUrl: recipientLinks[0]?.revealUrl || `${origin}/p/${puzzle.publicId}?r=0`,
      testMode: true,
      expiresAt: puzzle.expiresAt,
      recipientLinks
    });
  } catch (error) {
    // If GridFS write succeeded but database save failed, delete GridFS file to avoid orphans
    if (createdStorageId) {
      try {
        await deleteImage(createdStorageId);
      } catch (delError) {
        console.error('[TestRoute] Failed to clean up orphan GridFS file:', delError);
      }
    }
    next(error);
  }
});

module.exports = router;

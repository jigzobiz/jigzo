const { getFrontendOrigin } = require('../utils/runtimeConfig');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Puzzle = require('../models/Puzzle');
const crypto = require('crypto');

function maskPhone(phone) {
  if (!phone) return 'unknown';
  const str = String(phone);
  if (str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

class WhatsAppService {
  /**
   * Helper to normalize destination phone number format
   */
  normalizePhone(phone, countryCode) {
    let clean = String(phone || '').replace(/[^\d]/g, '');
    let cc = String(countryCode || '').replace(/[^\d]/g, '');
    if (!cc) cc = '973'; // Default to Bahrain

    // If phone already starts with country code, don't prefix it again
    if (clean.startsWith(cc)) {
      return `+${clean}`;
    }
    return `+${cc}${clean}`;
  }

  /**
   * Safe wrapper to update the UI/Admin convenience status snapshot on Puzzle recipient
   */
  async updateRecipientSnapshot(puzzleId, recipientIndex, fields) {
    try {
      const puzzle = await Puzzle.findOne({ publicId: puzzleId });
      if (puzzle && puzzle.recipients[recipientIndex]) {
        const rec = puzzle.recipients[recipientIndex];

        // Monotonic mapping priority
        const priority = {
          'pending': 0,
          'disabled': 0,
          'claimed': 1,
          'sending': 2,
          'accepted': 3,
          'sent': 4,
          'delivered': 5,
          'read': 6
        };

        if (fields.status) {
          const currentPriority = priority[rec.whatsappSendStatus] || 0;
          const incomingPriority = priority[fields.status] || 0;
          if (incomingPriority > currentPriority) {
            rec.whatsappSendStatus = fields.status;
          }
        }

        if (fields.providerMessageId) rec.providerMessageId = fields.providerMessageId;

        // Strict event semantics: Only set status-specific fields on webhook events
        if (fields.status === 'sent') {
          rec.whatsappSentAt = fields.occurredAt || new Date();
          rec.deliveryStatus = 'sent';
          rec.sentAt = fields.occurredAt || new Date();
        } else if (fields.status === 'delivered') {
          rec.whatsappDeliveredAt = fields.occurredAt || new Date();
          rec.deliveryStatus = 'delivered';
        } else if (fields.status === 'read') {
          rec.whatsappReadAt = fields.occurredAt || new Date();
          rec.deliveryStatus = 'delivered';
        }

        // Failure tracking fields can be updated independently of status transitions
        if (fields.failedAt || fields.status === 'failed') {
          rec.whatsappFailedAt = fields.failedAt || fields.occurredAt || new Date();
          rec.whatsappLastErrorCode = fields.errorCode || '';
          rec.whatsappLastErrorMessage = fields.errorMessage || '';
          rec.lastError = fields.errorMessage || '';

          // Only update whatsappSendStatus to failed if not already sent/delivered/read
          const currentPriority = priority[rec.whatsappSendStatus] || 0;
          if (currentPriority < priority['sent']) {
            rec.whatsappSendStatus = 'failed';
            rec.deliveryStatus = 'failed';
          }
        }

        if (fields.lastStatusAt) rec.whatsappLastStatusAt = fields.lastStatusAt;

        await puzzle.save();
      }
    } catch (err) {
      console.error('[WhatsAppService] Error updating recipient snapshot:', err.message);
    }
  }

  /**
   * Atomically claims and sends a puzzle template message to a specific recipient.
   */
  async claimAndSendPuzzleDelivery({ puzzleId, recipientIndex }) {
    // Phase 1 check: Keep WHATSAPP_ENABLED false check first to prevent any DB claims
    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    if (!whatsappEnabled) {
      return { success: true, status: 'disabled' };
    }

    const puzzle = await Puzzle.findOne({ publicId: puzzleId });
    if (!puzzle) {
      throw new Error(`Puzzle not found: ${puzzleId}`);
    }

    const rec = puzzle.recipients[recipientIndex];
    if (!rec) {
      throw new Error(`Recipient at index ${recipientIndex} not found on puzzle ${puzzleId}`);
    }

    const phoneRaw = rec.phoneE164 || `${rec.countryCode || ''}${rec.phone}`;
    const destinationPhone = this.normalizePhone(phoneRaw, rec.countryCode);
    const destinationMasked = maskPhone(destinationPhone);

    const idempotencyKey = `puzzle-delivery:${puzzleId}:${recipientIndex}:jigzo_puzzle_delivery:v1`;
    let messageRecord;

    try {
      // Step 1: Create atomic claim using unique index
      messageRecord = new WhatsAppMessage({
        puzzleId,
        recipientIndex,
        recipientSubdocumentId: rec._id,
        idempotencyKey,
        destinationMasked,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await messageRecord.save();
    } catch (err) {
      if (err.code === 11000) {
        // Already claimed or sent
        const existing = await WhatsAppMessage.findOne({ idempotencyKey });
        return { success: false, reason: 'duplicate_request', status: existing.status, providerMessageId: existing.providerMessageId };
      }
      throw err;
    }

    // Step 2: Acquire claim
    messageRecord.status = 'claimed';
    messageRecord.claimedAt = new Date();
    await messageRecord.save();

    // Validate environment variables
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
    if (!apiKey || !phoneId) {
      messageRecord.status = 'failed';
      messageRecord.lastErrorCode = 'MISSING_CREDENTIALS';
      messageRecord.lastErrorMessage = 'Staging environment is missing Kapso credentials.';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      await this.updateRecipientSnapshot(puzzleId, recipientIndex, {
        status: 'failed',
        errorCode: 'MISSING_CREDENTIALS',
        errorMessage: 'Staging environment is missing Kapso credentials.'
      });

      return { success: false, error: 'MISSING_CREDENTIALS' };
    }

    // Step 4: Perform network request
    messageRecord.status = 'sending';
    messageRecord.attemptCount += 1;
    messageRecord.requestStartedAt = new Date();
    await messageRecord.save();

    const senderDisplayName = puzzle.revealIdentity ? (puzzle.senderName || '').trim() : 'Someone';
    const suffix = `${puzzleId}?r=${recipientIndex}`;

    // English Marketing versions are approved. Arabic templates are prepared but not enabled.
    const isArabicConfirmed = false; // Set to true once verified
    const langCode = (puzzle.experienceLanguage === 'ar' && isArabicConfirmed) ? 'ar' : 'en_US';

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinationPhone,
      type: 'template',
      template: {
        name: 'jigzo_puzzle_delivery',
        language: {
          code: langCode
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: rec.name || '' },
              { type: 'text', text: senderDisplayName || 'Someone' }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [
              { type: 'text', text: suffix }
            ]
          }
        ]
      },
      biz_opaque_callback_data: idempotencyKey
    };

    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex');
    messageRecord.payloadHash = payloadHash;
    await messageRecord.save();

    const apiVersion = 'v24.0';
    const url = `https://api.kapso.ai/meta/whatsapp/${apiVersion}/${phoneId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000) // 10s request timeout
      });

      const resBodyText = await response.text();
      let resJson;
      try {
        resJson = JSON.parse(resBodyText);
      } catch (parseErr) {
        throw new Error(`Invalid JSON response: ${resBodyText.slice(0, 200)}`);
      }

      if (response.ok && resJson.messages && resJson.messages[0]) {
        const providerMessageId = resJson.messages[0].id;

        messageRecord.status = 'accepted';
        messageRecord.providerMessageId = providerMessageId;
        messageRecord.acceptedAt = new Date();
        messageRecord.updatedAt = new Date();
        await messageRecord.save();

        await this.updateRecipientSnapshot(puzzleId, recipientIndex, {
          status: 'accepted',
          providerMessageId
        });

        return { success: true, status: 'accepted', providerMessageId };
      } else {
        const errCode = resJson.error?.code || 'API_ERROR';
        const errMsg = resJson.error?.message || 'Failed to send template message';

        messageRecord.status = 'failed';
        messageRecord.lastErrorCode = String(errCode);
        messageRecord.lastErrorMessage = String(errMsg).slice(0, 500);
        messageRecord.updatedAt = new Date();
        await messageRecord.save();

        await this.updateRecipientSnapshot(puzzleId, recipientIndex, {
          status: 'failed',
          errorCode: String(errCode),
          errorMessage: String(errMsg).slice(0, 500)
        });

        return { success: false, error: errMsg };
      }
    } catch (networkErr) {
      console.error('[WhatsAppService] Send request network exception:', networkErr.message);

      messageRecord.status = 'verification_required';
      messageRecord.lastErrorCode = 'NETWORK_ERROR';
      messageRecord.lastErrorMessage = String(networkErr.message).slice(0, 500);
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      await this.updateRecipientSnapshot(puzzleId, recipientIndex, {
        status: 'verification_required',
        errorCode: 'NETWORK_ERROR',
        errorMessage: String(networkErr.message).slice(0, 500)
      });

      return { success: false, error: 'ambiguous_network_failure' };
    }
  }

  /**
   * Sends a reveal alert WhatsApp template message to the sender when a recipient solves the puzzle.
   */
  async sendRevealAlert({ puzzleId, recipientIndex, senderPhone, recipientName, durationSeconds }) {
    // Phase 1 check: Keep WHATSAPP_ENABLED false check first to prevent any DB claims
    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    if (!whatsappEnabled) {
      return { success: true, status: 'disabled' };
    }

    const puzzle = await Puzzle.findOne({ publicId: puzzleId });
    const senderDisplayName = puzzle ? (puzzle.senderName || 'Someone') : 'Someone';
    const occasionName = puzzle ? (puzzle.occasion || 'occasion') : 'occasion';

    const destinationPhone = this.normalizePhone(senderPhone);
    const destinationMasked = maskPhone(destinationPhone);

    const idempotencyKey = `puzzle-solved:${puzzleId}:${recipientIndex}:jigzo_puzzle_solved:v1`;
    let messageRecord;

    try {
      // Step 1: Create atomic claim using unique index
      messageRecord = new WhatsAppMessage({
        puzzleId,
        recipientIndex,
        idempotencyKey,
        destinationMasked,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await messageRecord.save();
    } catch (err) {
      if (err.code === 11000) {
        // Attempt to atomically claim the record for a retry if its status is failed/verification_required
        const existing = await WhatsAppMessage.findOneAndUpdate(
          {
            idempotencyKey,
            status: { $in: ['failed', 'verification_required'] }
          },
          {
            $set: {
              status: 'claimed',
              claimedAt: new Date()
            }
          },
          { new: true }
        );

        if (existing) {
          // Add previous attempt to retryHistory
          existing.retryHistory.push({
            attemptNumber: existing.attemptCount,
            requestStartedAt: existing.requestStartedAt || existing.createdAt,
            failedAt: existing.failedAt || existing.updatedAt,
            errorCode: existing.lastErrorCode,
            errorMessage: existing.lastErrorMessage,
            payloadHash: existing.payloadHash
          });
          existing.retryStartedAt = new Date();
          messageRecord = existing;
        } else {
          // If already accepted/sent/delivered or currently claimed/sending
          const finalRecord = await WhatsAppMessage.findOne({ idempotencyKey });
          return { success: false, reason: 'duplicate_request', status: finalRecord.status, providerMessageId: finalRecord.providerMessageId };
        }
      } else {
        throw err;
      }
    }

    // Step 2: Acquire claim (only needed if it wasn't a retry)
    if (messageRecord.status !== 'claimed') {
      messageRecord.status = 'claimed';
      messageRecord.claimedAt = new Date();
      await messageRecord.save();
    }

    // Validate environment variables
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
    if (!apiKey || !phoneId) {
      messageRecord.status = 'failed';
      messageRecord.lastErrorCode = 'MISSING_CREDENTIALS';
      messageRecord.lastErrorMessage = 'Staging environment is missing Kapso credentials.';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      return { success: false, error: 'MISSING_CREDENTIALS' };
    }

    // Step 4: Perform network request
    messageRecord.status = 'sending';
    messageRecord.attemptCount += 1;
    messageRecord.requestStartedAt = new Date();
    await messageRecord.save();

    const m = Math.floor(durationSeconds / 60);
    const s = durationSeconds % 60;
    const durationText = m > 0 ? `${m}m ${s}s` : `${s}s`;

    // English Marketing versions are approved. Arabic templates are prepared but not enabled.
    const isArabicConfirmed = false; // Set to true once verified
    const langCode = isArabicConfirmed ? 'ar' : 'en_US';

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinationPhone,
      type: 'template',
      template: {
        name: 'jigzo_puzzle_solved',
        language: {
          code: langCode
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: senderDisplayName },
              { type: 'text', text: recipientName || '' },
              { type: 'text', text: occasionName },
              { type: 'text', text: durationText },
              { type: 'text', text: `https://jigzo.biz/p/${puzzleId}?r=${recipientIndex}` }
            ]
          }
        ]
      },
      biz_opaque_callback_data: idempotencyKey
    };

    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex');
    messageRecord.payloadHash = payloadHash;
    await messageRecord.save();

    const apiVersion = 'v24.0';
    const url = `https://api.kapso.ai/meta/whatsapp/${apiVersion}/${phoneId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000)
      });

      const resBodyText = await response.text();
      let resJson;
      try {
        resJson = JSON.parse(resBodyText);
      } catch (parseErr) {
        throw new Error(`Invalid JSON response: ${resBodyText.slice(0, 200)}`);
      }

      if (response.ok && resJson.messages && resJson.messages[0]) {
        const providerMessageId = resJson.messages[0].id;

        messageRecord.status = 'accepted';
        messageRecord.providerMessageId = providerMessageId;
        messageRecord.acceptedAt = new Date();
        messageRecord.updatedAt = new Date();
        await messageRecord.save();

        return { success: true, status: 'accepted', providerMessageId };
      } else {
        const errCode = resJson.error?.code || 'API_ERROR';
        const errMsg = resJson.error?.message || 'Failed to send template message';

        messageRecord.status = 'failed';
        messageRecord.lastErrorCode = String(errCode);
        messageRecord.lastErrorMessage = String(errMsg).slice(0, 500);
        messageRecord.updatedAt = new Date();
        await messageRecord.save();

        return { success: false, error: errMsg };
      }
    } catch (networkErr) {
      console.error('[WhatsAppService] Send alert request network exception:', networkErr.message);

      messageRecord.status = 'verification_required';
      messageRecord.lastErrorCode = 'NETWORK_ERROR';
      messageRecord.lastErrorMessage = String(networkErr.message).slice(0, 500);
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      return { success: false, error: 'ambiguous_network_failure' };
    }
  }
}

module.exports = new WhatsAppService();

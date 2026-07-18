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
        
        if (fields.status) rec.whatsappSendStatus = fields.status;
        if (fields.providerMessageId) rec.providerMessageId = fields.providerMessageId;
        if (fields.sentAt) rec.whatsappSentAt = fields.sentAt;
        if (fields.deliveredAt) rec.whatsappDeliveredAt = fields.deliveredAt;
        if (fields.readAt) rec.whatsappReadAt = fields.readAt;
        if (fields.failedAt) rec.whatsappFailedAt = fields.failedAt;
        if (fields.lastStatusAt) rec.whatsappLastStatusAt = fields.lastStatusAt;
        if (fields.errorCode) rec.whatsappLastErrorCode = fields.errorCode;
        if (fields.errorMessage) rec.whatsappLastErrorMessage = fields.errorMessage;

        // Sync old delivery status fields for backward compatibility
        if (fields.status === 'read' || fields.status === 'delivered') {
          rec.deliveryStatus = 'delivered';
        } else if (fields.status === 'failed') {
          rec.deliveryStatus = 'failed';
        } else if (fields.status === 'accepted' || fields.status === 'sent') {
          rec.deliveryStatus = 'sent';
        }

        if (fields.sentAt) rec.sentAt = fields.sentAt;
        if (fields.providerMessageId) rec.providerMessageId = fields.providerMessageId;
        if (fields.errorMessage) rec.lastError = fields.errorMessage;

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

    // Step 3: Check feature flag before network dispatch
    const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
    if (!whatsappEnabled) {
      messageRecord.status = 'disabled';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      await this.updateRecipientSnapshot(puzzleId, recipientIndex, {
        status: 'disabled',
        errorMessage: 'Automated WhatsApp delivery is disabled.'
      });

      return { success: true, status: 'disabled' };
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

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinationPhone,
      type: 'template',
      template: {
        name: 'jigzo_puzzle_delivery',
        language: {
          code: 'en_US'
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
          providerMessageId,
          sentAt: new Date()
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
}

module.exports = new WhatsAppService();

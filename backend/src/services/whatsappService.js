const { getFrontendOrigin } = require('../utils/runtimeConfig');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Puzzle = require('../models/Puzzle');
const Order = require('../models/Order');
const crypto = require('crypto');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { normalizePhoneInput, validatePhone } = require('../utils/contactValidation');
const { isArabic, getAnonymousSender, formatCompletionDateTimeArabic, formatDurationArabic } = require('../utils/localization');

function maskPhone(phone) {
  if (!phone) return 'unknown';
  const str = String(phone);
  if (str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

class WhatsAppService {
  puzzleDeliveryKey(puzzleId, recipientIndex) {
    return `puzzle-delivery:${puzzleId}:${recipientIndex}:jigzo_puzzle_delivery:v1`;
  }

  utilityDeliveryKey(puzzleId, recipientIndex) {
    return `puzzle-delivery:${puzzleId}:${recipientIndex}:utility:v1`;
  }

  isLegacyUtilityRecord(messageRecord) {
    return Boolean(messageRecord && messageRecord.messageType === 'puzzle_delivery' &&
      ['jigzo_puzzle_delivery_v2', 'jigzo_arabic_puzzle_delivery_v2'].includes(messageRecord.templateName));
  }

  hasDeliveryEvidence(messageRecord) {
    return Boolean(messageRecord && (
      messageRecord.deliveredAt || messageRecord.readAt ||
      ['delivered', 'read'].includes(messageRecord.status) ||
      (messageRecord.retryHistory || []).some(attempt =>
        attempt.deliveredAt || attempt.readAt || ['delivered', 'read'].includes(attempt.status))
    ));
  }

  isCurrentTerminalPuzzleDeliveryFailure(messageRecord, recipient) {
    return Boolean(
      messageRecord &&
      ['puzzle_delivery', 'puzzle_delivery_fallback'].includes(messageRecord.messageType) &&
      messageRecord.providerStatus === 'failed' &&
      messageRecord.providerMessageId &&
      !this.hasDeliveryEvidence(messageRecord) &&
      !['delivered', 'read'].includes(messageRecord.status) &&
      recipient &&
      !recipient.openedAt &&
      !recipient.completedAt &&
      !recipient.whatsappReadAt &&
      !recipient.whatsappDeliveredAt
    );
  }

  isMetaRestrictionError(messageRecord) {
    if (!messageRecord) return false;
    const code = String(messageRecord.lastErrorCode || '');
    const msg = String(messageRecord.lastErrorMessage || '');
    return code === '131049' ||
      code === '130472' ||
      /part of an experiment/i.test(msg) ||
      /healthy ecosystem/i.test(msg);
  }

  isInitialPuzzleDeliveryRetryable(messageRecord, recipient) {
    return Boolean(
      this.isCurrentTerminalPuzzleDeliveryFailure(messageRecord, recipient) &&
      messageRecord.messageType === 'puzzle_delivery' &&
      messageRecord.status === 'failed' &&
      messageRecord.providerStatus === 'failed' &&
      !this.isMetaRestrictionError(messageRecord)
    );
  }

  isInitialPuzzleDeliveryCorrectable(messageRecord, recipient) {
    return Boolean(
      this.isCurrentTerminalPuzzleDeliveryFailure(messageRecord, recipient) &&
      messageRecord.messageType === 'puzzle_delivery' &&
      !this.isMetaRestrictionError(messageRecord)
    );
  }

  manualRetryMode(marketing, utility, recipient) {
    if (!marketing || !recipient || recipient.openedAt || recipient.completedAt ||
        recipient.whatsappReadAt || recipient.whatsappDeliveredAt ||
        this.hasDeliveryEvidence(marketing) || this.hasDeliveryEvidence(utility)) return null;
    if (utility) {
      return this.isCurrentTerminalPuzzleDeliveryFailure(utility, recipient) &&
        utility.status === 'failed' && utility.providerStatus === 'failed'
        ? 'utility_retry' : null;
    }
    if (!this.isCurrentTerminalPuzzleDeliveryFailure(marketing, recipient) ||
        marketing.status !== 'failed' || marketing.providerStatus !== 'failed') return null;
    if (this.isLegacyUtilityRecord(marketing)) {
      return this.isMetaRestrictionError(marketing) ? null : 'legacy_utility_retry';
    }
    if (['131049', '130472'].includes(String(marketing.lastErrorCode))) return 'utility_fallback';
    return this.isInitialPuzzleDeliveryRetryable(marketing, recipient) ? 'marketing_retry' : null;
  }

  async correctPuzzleDeliveryRecipient({ puzzleId, recipientIndex, phone, adminId }) {
    const normalizedInput = normalizePhoneInput(phone);
    if (!normalizedInput.startsWith('+')) {
      return { success: false, reason: 'invalid_phone' };
    }
    const phoneCheck = validatePhone(normalizedInput);
    const parsed = phoneCheck.valid && phoneCheck.e164
      ? parsePhoneNumberFromString(phoneCheck.e164)
      : null;
    if (!phoneCheck.valid || !parsed) {
      return { success: false, reason: 'invalid_phone' };
    }

    const puzzle = await Puzzle.findOne({ publicId: puzzleId });
    const recipient = puzzle && puzzle.recipients[recipientIndex];
    if (!recipient) return { success: false, reason: 'not_found' };
    if (recipient.openedAt || recipient.completedAt || recipient.whatsappReadAt || recipient.whatsappDeliveredAt) {
      return { success: false, reason: 'recipient_already_opened_or_solved' };
    }

    const utilityCheck = await WhatsAppMessage.findOne({ idempotencyKey: this.utilityDeliveryKey(puzzleId, recipientIndex) });
    const idempotencyKey = utilityCheck
      ? this.utilityDeliveryKey(puzzleId, recipientIndex)
      : this.puzzleDeliveryKey(puzzleId, recipientIndex);
    const existingCheck = await WhatsAppMessage.findOne({ idempotencyKey });
    if (existingCheck && (this.hasDeliveryEvidence(existingCheck) ||
        (!utilityCheck && this.isMetaRestrictionError(existingCheck)))) {
      return { success: false, reason: 'not_correctable' };
    }

    const correctionTime = new Date();
    const messageRecord = await WhatsAppMessage.findOneAndUpdate(
      {
        idempotencyKey,
        puzzleId,
        recipientIndex,
        messageType: utilityCheck ? 'puzzle_delivery_fallback' : 'puzzle_delivery',
        status: { $in: ['failed', 'sent', 'accepted'] },
        providerStatus: 'failed',
        providerMessageId: { $type: 'string', $gt: '' },
        lastErrorCode: { $nin: utilityCheck ? [] : ['131049', '130472'] },
        deliveredAt: null,
        readAt: null
      },
      {
        $set: {
          status: 'correcting',
          updatedAt: correctionTime
        }
      },
      { new: true }
    );

    if (!messageRecord) {
      const current = await WhatsAppMessage.findOne({ idempotencyKey });
      return {
        success: false,
        reason: current && ['claimed', 'sending', 'correcting'].includes(current.status)
          ? 'already_in_progress'
          : 'not_correctable'
      };
    }

    const oldDestinationMasked = messageRecord.retryDestinationMasked || messageRecord.destinationMasked || maskPhone(
      recipient.phoneE164 || `${recipient.countryCode || ''}${recipient.phone || ''}`
    );
    const newDestinationMasked = maskPhone(phoneCheck.e164);
    const oldE164 = this.normalizePhone(
      recipient.phoneE164 || `${recipient.countryCode || ''}${recipient.phone || ''}`,
      recipient.countryCode
    );

    if (oldE164 === phoneCheck.e164) {
      messageRecord.status = 'failed';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();
      return { success: false, reason: 'number_unchanged' };
    }

    try {
      const currentPuzzle = await Puzzle.findOne({ publicId: puzzleId });
      const currentRecipient = currentPuzzle && currentPuzzle.recipients[recipientIndex];
      if (
        !currentRecipient ||
        currentRecipient.openedAt ||
        currentRecipient.completedAt ||
        currentRecipient.whatsappReadAt ||
        (
          messageRecord.recipientSubdocumentId &&
          String(currentRecipient._id) !== String(messageRecord.recipientSubdocumentId)
        )
      ) {
        messageRecord.status = 'failed';
        messageRecord.updatedAt = new Date();
        await messageRecord.save();
        return { success: false, reason: 'recipient_changed_or_completed' };
      }

      currentRecipient.phoneE164 = phoneCheck.e164;
      currentRecipient.countryCode = parsed.countryCallingCode;
      currentRecipient.phone = parsed.nationalNumber;
      currentRecipient.whatsappSendStatus = 'failed';
      currentRecipient.deliveryStatus = 'failed';
      await currentPuzzle.save();

      messageRecord.retryDestinationMasked = newDestinationMasked;
      messageRecord.destinationCorrectionHistory.push({
        oldDestinationMasked,
        newDestinationMasked,
        correctedAt: correctionTime,
        correctedByAdminId: adminId ? String(adminId) : undefined
      });
      messageRecord.status = 'failed';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      return {
        success: true,
        status: 'failed',
        oldEnding: oldDestinationMasked.slice(-4),
        newEnding: newDestinationMasked.slice(-4)
      };
    } catch (error) {
      messageRecord.status = 'failed';
      messageRecord.updatedAt = new Date();
      await messageRecord.save().catch(() => {});
      throw error;
    }
  }

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
          rec.whatsappLastErrorTitle = fields.errorTitle || '';
          rec.whatsappLastErrorMessage = fields.errorMessage || '';
          rec.whatsappLastErrorDetails = fields.errorDetails || '';
          rec.lastError = fields.errorMessage || '';

          // Only update whatsappSendStatus to failed if not already sent/delivered/read
          const currentPriority = priority[rec.whatsappSendStatus] || 0;
          if (currentPriority < priority['delivered']) {
            rec.whatsappSendStatus = 'failed';
            rec.deliveryStatus = 'failed';
          }
        }

        if (fields.lastStatusAt) rec.whatsappLastStatusAt = fields.lastStatusAt;
        if (fields.deliveryState) rec.deliveryState = fields.deliveryState;
        if (fields.deliveryReason) rec.deliveryReason = fields.deliveryReason;

        await puzzle.save();
      }
    } catch (err) {
      console.error('[WhatsAppService] Error updating recipient snapshot:', err.message);
    }
  }

  /**
   * Atomically claims and sends a puzzle template message to a specific recipient.
   */
  async claimAndSendPuzzleDelivery({ puzzleId, recipientIndex, retryFailed = false, orderId, deliveryRole = 'marketing' }) {
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

    let resolvedOrderId = orderId;
    if (!resolvedOrderId) {
      const matchedOrder = await Order.findOne({ puzzleId: puzzle.publicId, paymentStatus: 'paid' });
      if (matchedOrder && matchedOrder.orderId) {
        resolvedOrderId = matchedOrder.orderId;
      }
    }

    if (!resolvedOrderId) {
      return {
        success: false,
        reason: 'missing_order_reference',
        status: 'failed',
        error: 'Order reference could not be resolved for delivery template.'
      };
    }

    const isLangArabic = isArabic(puzzle.experienceLanguage);
    const isFallback = deliveryRole === 'utility';
    const isUtility = isFallback || deliveryRole === 'legacy_utility';
    const deliveryTemplateName = isUtility
      ? (isLangArabic ? 'jigzo_arabic_puzzle_delivery_v2' : 'jigzo_puzzle_delivery_v2')
      : 'jigzo_puzzle_delivery';
    const deliveryLangCode = isLangArabic ? 'ar' : (isUtility ? 'en' : 'en_US');

    const phoneRaw = rec.phoneE164 || `${rec.countryCode || ''}${rec.phone}`;
    const destinationPhone = this.normalizePhone(phoneRaw, rec.countryCode);
    const destinationMasked = maskPhone(destinationPhone);

    const idempotencyKey = isFallback
      ? this.utilityDeliveryKey(puzzleId, recipientIndex)
      : this.puzzleDeliveryKey(puzzleId, recipientIndex);
    let messageRecord;

    if (isFallback) {
      const marketing = await WhatsAppMessage.findOne({ idempotencyKey: this.puzzleDeliveryKey(puzzleId, recipientIndex) });
      if (!marketing || this.hasDeliveryEvidence(marketing) ||
          !this.isCurrentTerminalPuzzleDeliveryFailure(marketing, rec) ||
          !['131049', '130472'].includes(String(marketing.lastErrorCode))) {
        return { success: false, reason: 'not_retryable', status: 'not_retryable' };
      }
    }

    if (retryFailed && (rec.openedAt || rec.completedAt || rec.whatsappReadAt)) {
      return { success: false, reason: 'recipient_already_opened_or_solved', status: 'not_retryable' };
    }

    try {
      // Step 1: Create atomic claim using unique index
      messageRecord = new WhatsAppMessage({
        puzzleId,
        recipientIndex,
        recipientSubdocumentId: rec._id,
        idempotencyKey,
        messageType: isFallback ? 'puzzle_delivery_fallback' : 'puzzle_delivery',
        attemptRole: isUtility ? 'utility' : 'marketing',
        parentIdempotencyKey: isFallback ? this.puzzleDeliveryKey(puzzleId, recipientIndex) : undefined,
        destinationMasked,
        templateName: deliveryTemplateName,
        languageCode: deliveryLangCode,
        status: 'pending',
        providerStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await messageRecord.save();
    } catch (err) {
      if (err.code === 11000) {
        if (!retryFailed) {
          const existing = await WhatsAppMessage.findOne({ idempotencyKey });
          return { success: false, reason: 'duplicate_request', status: existing.status, providerMessageId: existing.providerMessageId };
        }

        const claimTime = new Date();
        const previous = await WhatsAppMessage.findOne({ idempotencyKey });
        if (!previous || !previous.providerMessageId) {
          return { success: false, reason: 'not_retryable', status: previous?.status || 'not_found' };
        }
        const archivedAttempt = {
          attemptNumber: previous.attemptCount,
          attemptRole: this.isLegacyUtilityRecord(previous) ? 'utility' : (previous.attemptRole || deliveryRole),
          templateName: previous.templateName,
          providerMessageId: previous.providerMessageId,
          destinationMasked: previous.destinationMasked,
          status: previous.status,
          providerStatus: previous.providerStatus,
          languageCode: previous.languageCode,
          claimedAt: previous.claimedAt,
          requestStartedAt: previous.requestStartedAt,
          acceptedAt: previous.acceptedAt,
          sentAt: previous.sentAt,
          deliveredAt: previous.deliveredAt,
          readAt: previous.readAt,
          failedAt: previous.failedAt,
          errorCode: previous.lastErrorCode,
          errorTitle: previous.lastErrorTitle,
          errorMessage: previous.lastErrorMessage,
          errorDetails: previous.lastErrorDetails,
          providerFailureMetadata: previous.providerFailureMetadata,
          payloadHash: previous.payloadHash
        };
        const existing = await WhatsAppMessage.findOneAndUpdate(
          {
            idempotencyKey,
            puzzleId,
            recipientIndex,
            messageType: isFallback ? 'puzzle_delivery_fallback' : 'puzzle_delivery',
            status: 'failed',
            providerStatus: 'failed',
            providerMessageId: previous.providerMessageId,
            lastErrorCode: { $nin: isUtility ? [] : ['131049', '130472'] }
          },
          {
            $push: { retryHistory: archivedAttempt },
            $set: {
              status: 'claimed',
              providerStatus: 'claimed',
              retryStartedAt: claimTime,
              destinationMasked,
              updatedAt: claimTime
            },
            $unset: {
              providerMessageId: 1,
              retryDestinationMasked: 1,
              acceptedAt: 1,
              sentAt: 1,
              deliveredAt: 1,
              readAt: 1,
              failedAt: 1,
              lastErrorCode: 1,
              lastErrorTitle: 1,
              lastErrorMessage: 1,
              lastErrorDetails: 1,
              providerFailureMetadata: 1
            }
          },
          { new: true }
        );

        if (!existing) {
          const current = await WhatsAppMessage.findOne({ idempotencyKey });
          if (current && this.isMetaRestrictionError(current)) {
            return {
              success: false,
              reason: 'not_retryable',
              status: current.status,
              error: 'Delivery cannot be retried due to a Meta platform restriction.'
            };
          }
          const alreadyClaimed = current && ['claimed', 'sending', 'correcting'].includes(current.status);
          return {
            success: false,
            reason: alreadyClaimed ? 'already_claimed' : 'not_retryable',
            status: current ? current.status : 'not_found'
          };
        }

        messageRecord = existing;
      } else {
        throw err;
      }
    }

    // Step 2: Acquire claim
    messageRecord.status = 'claimed';
    messageRecord.providerStatus = 'claimed';
    messageRecord.claimedAt = new Date();
    await messageRecord.save();

    if (isFallback) {
      const marketing = await WhatsAppMessage.findOne({ idempotencyKey: this.puzzleDeliveryKey(puzzleId, recipientIndex) });
      const currentPuzzle = await Puzzle.findOne({ publicId: puzzleId });
      const currentRecipient = currentPuzzle && currentPuzzle.recipients[recipientIndex];
      if (!marketing || this.hasDeliveryEvidence(marketing) || !currentRecipient ||
          currentRecipient.openedAt || currentRecipient.completedAt || currentRecipient.whatsappReadAt ||
          currentRecipient.whatsappDeliveredAt) {
        messageRecord.status = 'failed';
        messageRecord.providerStatus = 'failed';
        messageRecord.lastErrorCode = 'FALLBACK_CANCELLED';
        messageRecord.failedAt = new Date();
        await messageRecord.save();
        return { success: false, reason: 'not_retryable', status: 'failed' };
      }
    }

    if (retryFailed) {
      const latestPuzzle = await Puzzle.findOne({ publicId: puzzleId });
      const latestRecipient = latestPuzzle && latestPuzzle.recipients[recipientIndex];
      if (!latestRecipient || latestRecipient.openedAt || latestRecipient.completedAt || latestRecipient.whatsappReadAt) {
        messageRecord.status = 'failed';
        messageRecord.providerStatus = 'failed';
        messageRecord.lastErrorCode = 'RECIPIENT_ALREADY_OPENED_OR_SOLVED';
        messageRecord.lastErrorMessage = 'Retry cancelled because the recipient already opened or solved the puzzle.';
        messageRecord.failedAt = new Date();
        messageRecord.updatedAt = new Date();
        await messageRecord.save();
        return { success: false, reason: 'recipient_already_opened_or_solved', status: 'failed' };
      }
    }

    // Validate environment variables
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
    if (!apiKey || !phoneId) {
      messageRecord.status = 'failed';
      messageRecord.providerStatus = 'failed';
      messageRecord.lastErrorCode = 'MISSING_CREDENTIALS';
      messageRecord.lastErrorMessage = 'Staging environment is missing Kapso credentials.';
      messageRecord.failedAt = new Date();
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
    messageRecord.providerStatus = 'sending';
    messageRecord.attemptCount += 1;
    messageRecord.requestStartedAt = new Date();
    await messageRecord.save();

    const senderDisplayName = puzzle.revealIdentity
      ? (puzzle.senderName || '').trim()
      : getAnonymousSender(deliveryLangCode);
    let finalSenderName = senderDisplayName || getAnonymousSender(deliveryLangCode);
    if (isLangArabic && finalSenderName === 'Someone') {
      finalSenderName = 'شخص ما';
    }

    const suffix = `${puzzleId}?r=${recipientIndex}`;
    messageRecord.templateName = deliveryTemplateName;
    messageRecord.languageCode = deliveryLangCode;
    await messageRecord.save();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinationPhone,
      type: 'template',
      template: {
        name: deliveryTemplateName,
        language: {
          code: deliveryLangCode
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: rec.name || '' },
              ...(isUtility ? [{ type: 'text', text: String(resolvedOrderId) }] : []),
              { type: 'text', text: finalSenderName }
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
        messageRecord.providerStatus = 'accepted';
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
        let errMsg = resJson.error?.message || 'Failed to send template message';

        if (String(errCode) === '130472' || /part of an experiment/i.test(errMsg)) {
          errMsg = "Meta experiment restriction — WhatsApp error 130472. Recipient is part of a Meta marketing experiment; use manual puzzle link.";
        } else if (String(errCode) === '131049' || /healthy ecosystem/i.test(errMsg)) {
          errMsg = "Meta delivery limit — WhatsApp error 131049. Do not retry for 24 hours; use the approved fallback channel.";
        }

        messageRecord.status = 'failed';
        messageRecord.providerStatus = 'failed';
        messageRecord.lastErrorCode = String(errCode);
        messageRecord.lastErrorMessage = String(errMsg).slice(0, 500);
        messageRecord.failedAt = new Date();
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
      messageRecord.providerStatus = 'verification_required';
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
    const isLangArabic = isArabic(puzzle ? puzzle.experienceLanguage : 'en_US');
    const solvedTemplateName = isLangArabic ? 'jigzo_puzzle_solved_v2' : 'jigzo_puzzle_solved';
    const solvedLangCode = isLangArabic ? 'ar' : 'en_US';
    let senderDisplayName = puzzle && puzzle.senderName ? puzzle.senderName.trim() : getAnonymousSender(solvedLangCode);
    if (isLangArabic && senderDisplayName === 'Someone') {
      senderDisplayName = 'شخص ما';
    }
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
        templateName: solvedTemplateName,
        languageCode: solvedLangCode,
        status: 'pending',
        providerStatus: 'pending',
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
              providerStatus: 'claimed',
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
      messageRecord.providerStatus = 'claimed';
      messageRecord.claimedAt = new Date();
      await messageRecord.save();
    }

    // Validate environment variables
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
    if (!apiKey || !phoneId) {
      messageRecord.status = 'failed';
      messageRecord.providerStatus = 'failed';
      messageRecord.lastErrorCode = 'MISSING_CREDENTIALS';
      messageRecord.lastErrorMessage = 'Staging environment is missing Kapso credentials.';
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      return { success: false, error: 'MISSING_CREDENTIALS' };
    }

    // Step 4: Perform network request
    messageRecord.status = 'sending';
    messageRecord.providerStatus = 'sending';
    messageRecord.attemptCount += 1;
    messageRecord.requestStartedAt = new Date();
    await messageRecord.save();

    let completedAt = new Date();
    if (puzzle && puzzle.recipients && puzzle.recipients[recipientIndex]) {
      completedAt = puzzle.recipients[recipientIndex].completedAt || new Date();
    }

    messageRecord.templateName = solvedTemplateName;
    messageRecord.languageCode = solvedLangCode;
    await messageRecord.save();

    let parameters;
    if (isLangArabic) {
      const completionDateArabic = new Intl.DateTimeFormat(
        'ar-BH-u-nu-arab',
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Bahrain'
        }
      ).format(completedAt);

      const completionTimeArabic = new Intl.DateTimeFormat(
        'ar-BH-u-nu-arab',
        {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Bahrain'
        }
      ).format(completedAt);

      const durationArabic = formatDurationArabic(durationSeconds);

      parameters = [
        { type: 'text', text: senderDisplayName },
        { type: 'text', text: recipientName || '' },
        { type: 'text', text: completionDateArabic },
        { type: 'text', text: completionTimeArabic },
        { type: 'text', text: durationArabic }
      ];
    } else {
      const m = Math.floor(durationSeconds / 60);
      const s = durationSeconds % 60;
      const durationText = m > 0 ? `${m}m ${s}s` : `${s}s`;

      const completionDateText = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bahrain'
      }).format(completedAt);

      const completionTimeText = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Bahrain'
      }).format(completedAt).toLowerCase();

      parameters = [
        { type: 'text', text: senderDisplayName },
        { type: 'text', text: recipientName || '' },
        { type: 'text', text: completionDateText },
        { type: 'text', text: completionTimeText },
        { type: 'text', text: durationText }
      ];
    }

    if (!Array.isArray(parameters) || parameters.length !== 5) {
      throw new Error(
        `Invalid jigzo_puzzle_solved payload: expected 5 parameters, received ${parameters?.length}`
      );
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinationPhone,
      type: 'template',
      template: {
        name: solvedTemplateName,
        language: {
          code: solvedLangCode
        },
        components: [
          {
            type: 'body',
            parameters
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
        messageRecord.providerStatus = 'accepted';
        messageRecord.providerMessageId = providerMessageId;
        messageRecord.acceptedAt = new Date();
        messageRecord.updatedAt = new Date();
        await messageRecord.save();

        return { success: true, status: 'accepted', providerMessageId };
      } else {
        const errCode = resJson.error?.code || 'API_ERROR';
        const errMsg = resJson.error?.message || 'Failed to send template message';

        messageRecord.status = 'failed';
        messageRecord.providerStatus = 'failed';
        messageRecord.lastErrorCode = String(errCode);
        messageRecord.lastErrorMessage = String(errMsg).slice(0, 500);
        messageRecord.updatedAt = new Date();
        await messageRecord.save();

        return { success: false, error: errMsg };
      }
    } catch (networkErr) {
      console.error('[WhatsAppService] Send alert request network exception:', networkErr.message);

      messageRecord.status = 'verification_required';
      messageRecord.providerStatus = 'verification_required';
      messageRecord.lastErrorCode = 'NETWORK_ERROR';
      messageRecord.lastErrorMessage = String(networkErr.message).slice(0, 500);
      messageRecord.updatedAt = new Date();
      await messageRecord.save();

      return { success: false, error: 'ambiguous_network_failure' };
    }
  }

  async retryPuzzleDelivery({ puzzleId, recipientIndex, orderId }) {
    const puzzle = await Puzzle.findOne({ publicId: puzzleId });
    const recipient = puzzle && puzzle.recipients[recipientIndex];
    if (!recipient || recipient.openedAt || recipient.completedAt || recipient.whatsappReadAt || recipient.whatsappDeliveredAt) {
      return { success: false, reason: 'not_retryable', status: 'not_retryable' };
    }
    const [marketing, utility] = await Promise.all([
      WhatsAppMessage.findOne({ idempotencyKey: this.puzzleDeliveryKey(puzzleId, recipientIndex) }),
      WhatsAppMessage.findOne({ idempotencyKey: this.utilityDeliveryKey(puzzleId, recipientIndex) })
    ]);
    if (!marketing || this.hasDeliveryEvidence(marketing) || this.hasDeliveryEvidence(utility)) {
      return { success: false, reason: 'not_retryable', status: 'not_retryable' };
    }
    if (!utility && this.isLegacyUtilityRecord(marketing)) {
      return this.manualRetryMode(marketing, null, recipient) === 'legacy_utility_retry'
        ? this.claimAndSendPuzzleDelivery({ puzzleId, recipientIndex, retryFailed: true, orderId, deliveryRole: 'legacy_utility' })
        : { success: false, reason: 'not_retryable', status: marketing.status };
    }
    if (utility) {
      if (!this.isCurrentTerminalPuzzleDeliveryFailure(utility, recipient) ||
          utility.status !== 'failed' || utility.providerStatus !== 'failed') {
        return { success: false, reason: 'not_retryable', status: utility.status };
      }
      return this.claimAndSendPuzzleDelivery({ puzzleId, recipientIndex, retryFailed: true, orderId, deliveryRole: 'utility' });
    }
    if (this.isCurrentTerminalPuzzleDeliveryFailure(marketing, recipient) &&
        ['131049', '130472'].includes(String(marketing.lastErrorCode))) {
      return this.claimAndSendPuzzleDelivery({ puzzleId, recipientIndex, orderId, deliveryRole: 'utility' });
    }
    if (!this.isInitialPuzzleDeliveryRetryable(marketing, recipient)) {
      return { success: false, reason: 'not_retryable', status: marketing.status };
    }
    return this.claimAndSendPuzzleDelivery({ puzzleId, recipientIndex, retryFailed: true, orderId });
  }
}

module.exports = new WhatsAppService();

const mongoose = require('mongoose');

const RecipientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Legacy WhatsApp fields. No longer required at the schema level so that
  // Email recipients (which have no phone) remain valid, while old records
  // that only carry countryCode/phone continue to load unchanged.
  countryCode: { type: String, default: '' },
  phone: { type: String, default: '' },

  // Delivery channel. Absent on legacy records -> treated as 'whatsapp'.
  deliveryMethod: { type: String, enum: ['whatsapp', 'email', 'share'], default: 'whatsapp' },
  deliverySelection: { type: String, enum: ['send_to_me', 'share_myself', 'send_via_whatsapp'], default: 'send_via_whatsapp' },
  purchaserConsent: { type: Boolean, default: false },
  consentWordingVersion: { type: String },
  consentTimestamp: { type: Date },
  consentIp: { type: String },
  consentUserAgent: { type: String },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phoneE164: { type: String, default: '' },

  deliveryStatus: { type: String, default: 'pending' },
  sentAt: { type: Date, default: null },
  providerMessageId: { type: String, default: '' },
  lastError: { type: String, default: '' },

  // WhatsApp UI/Admin convenience status snapshot fields
  whatsappSendStatus: { type: String, default: 'pending' },
  whatsappSentAt: { type: Date, default: null },
  whatsappDeliveredAt: { type: Date, default: null },
  whatsappReadAt: { type: Date, default: null },
  whatsappFailedAt: { type: Date, default: null },
  whatsappLastStatusAt: { type: Date, default: null },
  whatsappLastErrorCode: { type: String, default: '' },
  whatsappLastErrorTitle: { type: String, default: '' },
  whatsappLastErrorMessage: { type: String, default: '' },
  whatsappLastErrorDetails: { type: String, default: '' },
  deliveryState: { type: String, default: '' },
  deliveryReason: { type: String, default: '' },

  openedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completionSeconds: { type: Number, default: null },

  manualLinkProvidedAt: { type: Date, default: null },
  manualLinkProvidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  manualLinkProvidedByUsername: { type: String, default: '' }
});

const PuzzleSchema = new mongoose.Schema({
  publicId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_payment',
      'paid',
      'preparing',
      'ready',
      'partially_delivered',
      'delivered',
      'failed',
      'expired'
    ],
    default: 'draft'
  },
  cropImageUrl: { type: String, required: true },
  imageStorageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  imageMimeType: { type: String, default: '' },
  testMode: { type: Boolean, default: false },
  message: { type: String, default: '' },
  senderName: { type: String, default: '' },
  senderPhone: { type: String, default: '' },
  revealIdentity: { type: Boolean, default: true },
  occasion: { type: String, default: '' },
  tone: { type: String, default: '' },
  pieceCount: { type: Number, default: 12 },
  experienceLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
  recipients: [RecipientSchema],
  checkoutAttemptId: { type: String, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },

  // --- Image retention (see utils/imageRetention.js) ---
  // When the image binary was written to GridFS. createdAt is only a
  // backfill substitute for records that predate this field.
  imageStoredAt: { type: Date, default: null },
  // Set once, when every intended recipient has completed the puzzle.
  allRecipientsCompletedAt: { type: Date, default: null },
  // min(imageStoredAt + 30d, allRecipientsCompletedAt + 7d). Only ever
  // moves earlier ($min), never later.
  imageDeletionDueAt: { type: Date, default: null },
  imageDeletedAt: { type: Date, default: null },
  imageDeletionStatus: {
    type: String,
    enum: ['scheduled', 'blocked', 'deleted', 'failed'],
    default: null
  },
  imageDeletionFailureReason: { type: String, default: '' }
});

// Efficient cleanup lookup: only puzzles still holding a GridFS binary.
// Deliberately NOT a TTL index — TTL would delete the Puzzle document,
// orphaning the GridFS file and destroying delivery/transaction history.
PuzzleSchema.index(
  { imageDeletionDueAt: 1 },
  { partialFilterExpression: { imageStorageId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Puzzle', PuzzleSchema);

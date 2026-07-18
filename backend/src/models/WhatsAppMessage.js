const mongoose = require('mongoose');

const WhatsAppMessageSchema = new mongoose.Schema({
  puzzleId: { type: String, required: true },
  recipientIndex: { type: Number, required: true },
  recipientSubdocumentId: { type: mongoose.Schema.Types.ObjectId },
  messageType: { type: String, default: 'puzzle_delivery' },
  templateName: { type: String, default: 'jigzo_puzzle_delivery' },
  languageCode: { type: String, default: 'en_US' },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: [
      'pending',
      'claimed',
      'sending',
      'accepted',
      'sent',
      'delivered',
      'read',
      'failed',
      'verification_required',
      'disabled'
    ],
    default: 'pending'
  },
  providerMessageId: { type: String, sparse: true, unique: true },
  destinationMasked: { type: String, required: true },
  attemptCount: { type: Number, default: 0 },
  claimedAt: { type: Date },
  requestStartedAt: { type: Date },
  acceptedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  lastStatusAt: { type: Date },
  lastErrorCode: { type: String },
  lastErrorMessage: { type: String },
  payloadHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WhatsAppMessage', WhatsAppMessageSchema);

const mongoose = require('mongoose');

const RetryAttemptSchema = new mongoose.Schema({
  attemptNumber: { type: Number, required: true },
  providerMessageId: { type: String },
  destinationMasked: { type: String },
  status: { type: String },
  providerStatus: { type: String },
  languageCode: { type: String },
  claimedAt: { type: Date },
  requestStartedAt: { type: Date },
  acceptedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  errorCode: { type: String },
  errorTitle: { type: String },
  errorMessage: { type: String },
  errorDetails: { type: String },
  providerFailureMetadata: {
    status: { type: String },
    timestamp: { type: Date },
    recipientIdMasked: { type: String },
    href: { type: String }
  },
  payloadHash: { type: String }
});

const DestinationCorrectionSchema = new mongoose.Schema({
  oldDestinationMasked: { type: String, required: true },
  newDestinationMasked: { type: String, required: true },
  correctedAt: { type: Date, required: true },
  correctedByAdminId: { type: String }
}, { _id: false });

const WhatsAppMessageSchema = new mongoose.Schema({
  puzzleId: { type: String, required: true },
  recipientIndex: { type: Number, required: true },
  recipientSubdocumentId: { type: mongoose.Schema.Types.ObjectId },
  messageType: { type: String, default: 'puzzle_delivery' },
  templateName: { type: String, default: 'jigzo_puzzle_delivery' },
  languageCode: { type: String, default: 'en_US' },
  idempotencyKey: { type: String, required: true },
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
  providerStatus: {
    type: String,
    enum: [
      'pending',
      'claimed',
      'correcting',
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
  providerMessageId: { type: String },
  destinationMasked: { type: String, required: true },
  retryDestinationMasked: { type: String },
  deliveryState: { type: String },
  deliveryReason: { type: String },
  destinationCorrectionHistory: [DestinationCorrectionSchema],
  attemptCount: { type: Number, default: 0 },
  claimedAt: { type: Date },
  requestStartedAt: { type: Date },
  retryStartedAt: { type: Date },
  retryHistory: [RetryAttemptSchema],
  acceptedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  lastStatusAt: { type: Date },
  lastErrorCode: { type: String },
  lastErrorTitle: { type: String },
  lastErrorMessage: { type: String },
  lastErrorDetails: { type: String },
  providerFailureMetadata: {
    status: { type: String },
    timestamp: { type: Date },
    recipientIdMasked: { type: String },
    href: { type: String }
  },
  payloadHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WhatsAppMessageSchema.index(
  { idempotencyKey: 1 },
  {
    name: 'whatsapp_idempotency_unique',
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: 'string' }
    }
  }
);

WhatsAppMessageSchema.index({ status: 1, acceptedAt: 1 });

WhatsAppMessageSchema.index(
  { providerMessageId: 1 },
  {
    name: 'whatsapp_provider_message_unique',
    unique: true,
    partialFilterExpression: {
      providerMessageId: {
        $type: 'string',
        $gt: ''
      }
    }
  }
);

module.exports = mongoose.model('WhatsAppMessage', WhatsAppMessageSchema);

const mongoose = require('mongoose');

const WhatsAppWebhookEventSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  providerMessageId: { type: String, required: true, index: true },
  phoneNumberId: { type: String },
  eventStatus: { type: String, required: true },
  occurredAt: { type: Date, default: null },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
  processingStatus: {
    type: String,
    enum: ['queued', 'processing', 'processed', 'failed'],
    default: 'queued'
  },
  processingStartedAt: { type: Date, default: null },
  processingAttempts: { type: Number, default: 0 },
  lastProcessingError: { type: String, default: '' },
  payloadHash: { type: String, required: true },
  errorCode: { type: String },
  errorTitle: { type: String },
  errorMessage: { type: String },
  processingError: { type: String }
});

module.exports = mongoose.model('WhatsAppWebhookEvent', WhatsAppWebhookEventSchema);

const mongoose = require('mongoose');

const DeliveryWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, default: '' },
    providerMessageId: { type: String, default: null },
    processedAt: { type: Date, default: null },
    matched: { type: Boolean, default: false },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

DeliveryWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports =
  mongoose.models.DeliveryWebhookEvent ||
  mongoose.model('DeliveryWebhookEvent', DeliveryWebhookEventSchema);

const mongoose = require('mongoose');

const JourneyEventSchema = new mongoose.Schema({
  anonymousId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  eventType: { type: String, required: true, index: true },
  pageUrl: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
  eventId: { type: String }
});

JourneyEventSchema.index(
  { eventId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      eventId: { $type: "string" }
    }
  }
);

module.exports = mongoose.model('JourneyEvent', JourneyEventSchema);

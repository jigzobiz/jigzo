const mongoose = require('mongoose');

const JourneyEventSchema = new mongoose.Schema({
  anonymousId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  eventType: { type: String, required: true, index: true },
  // Sanitized route template only (e.g. "/p/:puzzleId") — never a full URL.
  pageUrl: { type: String },
  // One-way keyed reference (utils/puzzleRef.js); never the raw publicId.
  puzzleRef: { type: String, default: null, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('JourneyEvent', JourneyEventSchema);

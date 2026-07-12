const mongoose = require('mongoose');

const AnonymousSessionSchema = new mongoose.Schema({
  anonymousId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AnonymousSession', AnonymousSessionSchema);

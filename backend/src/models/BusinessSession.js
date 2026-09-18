const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  identity: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessIdentity', required: true, index: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true, select: false },
  csrfHash: { type: String, required: true, select: false },
  sessionVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
  lastSeenAt: { type: Date, required: true }
}, { timestamps: true, collection: 'businesssessions' });

module.exports = mongoose.models.BusinessSession || mongoose.model('BusinessSession', schema);

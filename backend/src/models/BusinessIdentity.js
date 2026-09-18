const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  identityId: { type: String, required: true, unique: true, index: true },
  emailHash: { type: String, required: true, unique: true, index: true, select: false },
  emailEncrypted: { type: String, required: true, select: false },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  ownedOrganizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  lastSuccessfulLoginAt: { type: Date, default: null },
  sessionVersion: { type: Number, default: 1 },
  provisionedBy: { type: String, required: true }
}, { timestamps: true, collection: 'businessidentities' });

module.exports = mongoose.models.BusinessIdentity || mongoose.model('BusinessIdentity', schema);

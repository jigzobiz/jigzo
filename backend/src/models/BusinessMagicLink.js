const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  identity: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessIdentity', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date, default: null },
  requestedIpHash: { type: String, default: '' }
}, { timestamps: true, collection: 'businessmagiclinks' });

module.exports = mongoose.models.BusinessMagicLink || mongoose.model('BusinessMagicLink', schema);

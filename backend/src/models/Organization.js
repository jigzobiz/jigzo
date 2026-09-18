const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  organizationId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  ownerIdentity: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessIdentity', required: true, unique: true },
  defaultLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
  timezone: { type: String, required: true, default: 'Asia/Bahrain', maxlength: 80 },
  recipientRetentionDays: { type: Number, min: 1, max: 3650, default: 365 }
}, { timestamps: true, collection: 'organizations' });

module.exports = mongoose.models.Organization || mongoose.model('Organization', schema);

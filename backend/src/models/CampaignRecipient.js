const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  recipientId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  // 'test' recipients back the Studio "Preview as guest" action (see businessInvitations.js
  // POST /:campaignId/preview-recipient) — a real CampaignRecipient so the real /i session/
  // puzzle/RSVP pipeline runs unmodified, but excluded everywhere real recipients are
  // counted, launched to, or aggregated into results (grep `source:{ $ne: 'test' }`).
  source: { type: String, enum: ['manual', 'import', 'test'], required: true },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecipientImport', default: null },
  importRowNumber: { type: Number, default: null },
  externalRef: { type: String, default: null, maxlength: 120 },
  displayName: { type: String, required: true, maxlength: 160 },
  language: { type: String, enum: ['en', 'ar'], required: true },
  deliveryChannel: { type: String, enum: ['email', 'whatsapp'], required: true },
  contactEncrypted: { type: String, required: true, select: false },
  contactHash: { type: String, required: true, select: false },
  maskedContact: { type: String, required: true },
  plusOneOverride: { type: String, enum: ['inherit', 'allowed', 'not_allowed'], default: 'inherit' },
  invitationMessageOverride: { type: String, default: '', maxlength: 3000 },
  state: { type: String, enum: ['ready', 'needs_fixing'], default: 'ready' },
  accessTokenHash: { type: String, default: null, select: false, index: true },
  accessTokenMode: { type: String, enum: ['random', 'derived'], default: 'random', select: false },
  accessIssuedAt: { type: Date, default: null },
  accessRevokedAt: { type: Date, default: null },
  lastAccessAt: { type: Date, default: null },
  firstOpenedAt: { type: Date, default: null },
  firstSolvedAt: { type: Date, default: null },
  completionSeconds: { type: Number, default: null, min: 0 },
  rsvpStatus: { type: String, enum: ['pending', 'going', 'not_going'], default: 'pending' },
  guestCount: { type: Number, enum: [0, 1, 2], default: 0 },
  respondedAt: { type: Date, default: null }
}, { timestamps: true, collection: 'campaignrecipients' });
schema.index({ organizationId: 1, campaignId: 1, contactHash: 1 }, { unique: true });
schema.index({ organizationId: 1, campaignId: 1, externalRef: 1 }, { unique: true, partialFilterExpression: { externalRef: { $type: 'string' } } });
module.exports = mongoose.models.CampaignRecipient || mongoose.model('CampaignRecipient', schema);

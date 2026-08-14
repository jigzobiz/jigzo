const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  eventTitle: { type: String, default: '', maxlength: 180 },
  eventDateTime: { type: Date, default: null },
  timezone: { type: String, default: 'Asia/Bahrain', maxlength: 80 },
  location: { type: String, default: '', maxlength: 300 },
  rsvpDeadline: { type: Date, default: null },
  message: { type: String, default: '', maxlength: 3000 },
  rsvpEnabled: { type: Boolean, default: true },
  allowPlusOneDefault: { type: Boolean, default: false }
}, { _id: false });

const schema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessIdentity', required: true },
  name: { type: String, default: 'Untitled invitation', trim: true, maxlength: 160 },
  experienceType: { type: String, enum: ['invitation'], default: 'invitation', immutable: true },
  status: { type: String, enum: ['draft', 'ready', 'active', 'completed', 'cancelled'], default: 'draft', index: true },
  revision: { type: Number, default: 1, min: 1 },
  puzzle: {
    imageAssetId: { type: String, default: null },
    puzzleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle', default: null },
    difficultyId: { type: String, enum: ['extra_easy', 'easy', 'classic', 'challenging'], default: 'classic' },
    mysteryMode: { type: Boolean, default: false }
  },
  invitation: { type: invitationSchema, default: () => ({}) },
  deliveryDefault: { type: String, enum: ['whatsapp', 'email'], default: 'whatsapp' },
  expiresAt: { type: Date, default: null }
}, { timestamps: true, collection: 'businesscampaigns' });

schema.index({ organizationId: 1, campaignId: 1 }, { unique: true });
module.exports = mongoose.models.Campaign || mongoose.model('Campaign', schema);

const mongoose = require('mongoose');
const stagedSchema = new mongoose.Schema({ rowNumber: Number, displayName: String, language: String, deliveryChannel: String, contactEncrypted: { type: String, select: false }, contactHash: { type: String, select: false }, maskedContact: String, externalRef: String, plusOneOverride: String, invitationMessageOverride: String }, { _id: false });
const summarySchema = new mongoose.Schema({ rowNumber: Number, displayName: String, maskedContact: String, classification: { type: String, enum: ['ready', 'needs_fixing', 'duplicate'] }, validationErrors: [String] }, { _id: false });
const schema = new mongoose.Schema({
  importId: { type: String, required: true, unique: true, index: true }, organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }, campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  originalFilename: { type: String, required: true }, templateVersion: { type: Number, default: 1 }, rowCount: { type: Number, default: 0 }, validCount: { type: Number, default: 0 }, invalidCount: { type: Number, default: 0 }, duplicateCount: { type: Number, default: 0 }, committedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['validated', 'committing', 'completed', 'failed', 'expired'], default: 'validated' }, errorSummary: [summarySchema], stagedRows: { type: [stagedSchema], select: false, default: [] }, commitErrors: [String], expiresAt: { type: Date, required: true, index: { expires: 0 } }, committedAt: { type: Date, default: null }
}, { timestamps: true, collection: 'recipientimports' });
module.exports = mongoose.models.RecipientImport || mongoose.model('RecipientImport', schema);

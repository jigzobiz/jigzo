const mongoose = require('mongoose');

const WaitlistAdminMetaSchema = new mongoose.Schema({
  waitlistMetaId: { type: String, required: true, unique: true, index: true },
  waitlistSourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  contactStatus: { type: String, enum: ['uncontacted', 'contacted', 'converted', 'ignored'], default: 'uncontacted', index: true },
  lastContactedDate: { type: Date },
  linkedCustomerId: { type: String, index: true },
  adminNotes: { type: String, default: '' },
  convertedStatus: { type: Boolean, default: false },
  migrationRunId: { type: String, index: true },
  migrationSource: { type: String },
  migratedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'waitlistadminmeta' });

module.exports = mongoose.model('WaitlistAdminMeta', WaitlistAdminMetaSchema);

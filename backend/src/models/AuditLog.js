const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  action: { type: String, required: true },
  targetModel: { type: String },
  targetId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  beforeValues: { type: mongoose.Schema.Types.Mixed },
  afterValues: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'auditlogs' });

module.exports = mongoose.model('AuditLog', AuditLogSchema);


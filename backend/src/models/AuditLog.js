const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  action: { type: String, required: true },
  targetModel: { type: String },
  targetId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);

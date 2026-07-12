const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'manager', 'analyst'], default: 'analyst' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminUser', AdminUserSchema);

const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  anonymousIds: [{ type: String, index: true }],
  sessionIds: [{ type: String }],
  converted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', CustomerSchema);

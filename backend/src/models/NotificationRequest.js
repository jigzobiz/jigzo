const mongoose = require('mongoose');

const NotificationRequestSchema = new mongoose.Schema({
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  interestType: { type: String, required: true, index: true }, // e.g., jigzo_launch, checkout_available, physical_puzzle
  sourceUrl: { type: String },
  context: { type: mongoose.Schema.Types.Mixed, default: {} },
  notified: { type: Boolean, default: false },
  notifiedAt: { type: Date },
  converted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationRequest', NotificationRequestSchema);

const mongoose = require('mongoose');

const NotificationRequestSchema = new mongoose.Schema({
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  country: { type: String, trim: true },
  interestType: { type: String, required: true, index: true },
  sourceUrl: { type: String },
  context: { type: mongoose.Schema.Types.Mixed, default: {} },

  notified: { type: Boolean, default: false },
  notifiedAt: { type: Date },

  sendStatus: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed', 'review_required'],
    default: 'pending',
    index: true
  },
  sendAttemptedAt: { type: Date },
  sentAt: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  sentByUsername: { type: String, trim: true },
  providerMessageId: { type: String, trim: true },
  emailSubject: { type: String, trim: true },
  emailBody: { type: String },
  lastSendError: { type: String },

  converted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationRequest', NotificationRequestSchema);

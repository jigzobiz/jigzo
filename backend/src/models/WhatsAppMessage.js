const mongoose = require('mongoose');

const WhatsAppMessageSchema = new mongoose.Schema({
  recipientPhone: { type: String, required: true },
  messageType: { type: String, enum: ['puzzle_delivery', 'reveal_notification', 'test'], default: 'puzzle_delivery' },
  status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed'], default: 'queued' },
  errorText: { type: String },
  rawResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WhatsAppMessage', WhatsAppMessageSchema);

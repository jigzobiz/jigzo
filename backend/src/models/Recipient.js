const mongoose = require('mongoose');

const RecipientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  dial: { type: String, required: true },
  countryCode: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  puzzleId: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'delivered', 'opened', 'completed'], default: 'pending' },
  revealDurationSeconds: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Recipient', RecipientSchema);

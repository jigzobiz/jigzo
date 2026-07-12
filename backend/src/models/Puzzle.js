const mongoose = require('mongoose');

const RecipientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  countryCode: { type: String, required: true },
  phone: { type: String, required: true },
  deliveryStatus: { type: String, default: 'pending' },
  openedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completionSeconds: { type: Number, default: null }
});

const PuzzleSchema = new mongoose.Schema({
  publicId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_payment',
      'paid',
      'preparing',
      'ready',
      'partially_delivered',
      'delivered',
      'failed',
      'expired'
    ],
    default: 'draft'
  },
  cropImageUrl: { type: String, required: true },
  message: { type: String, default: '' },
  senderName: { type: String, default: '' },
  senderPhone: { type: String, default: '' },
  revealIdentity: { type: Boolean, default: true },
  occasion: { type: String, default: '' },
  tone: { type: String, default: '' },
  pieceCount: { type: Number, default: 12 },
  recipients: [RecipientSchema],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }
});

module.exports = mongoose.model('Puzzle', PuzzleSchema);

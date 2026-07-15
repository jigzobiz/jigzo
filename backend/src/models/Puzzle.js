const mongoose = require('mongoose');

const RecipientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Legacy WhatsApp fields. No longer required at the schema level so that
  // Email recipients (which have no phone) remain valid, while old records
  // that only carry countryCode/phone continue to load unchanged.
  countryCode: { type: String, default: '' },
  phone: { type: String, default: '' },

  // Delivery channel. Absent on legacy records -> treated as 'whatsapp'.
  deliveryMethod: { type: String, enum: ['whatsapp', 'email'], default: 'whatsapp' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phoneE164: { type: String, default: '' },

  deliveryStatus: { type: String, default: 'pending' },
  sentAt: { type: Date, default: null },
  providerMessageId: { type: String, default: '' },
  lastError: { type: String, default: '' },

  openedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completionSeconds: { type: Number, default: null },

  manualLinkProvidedAt: { type: Date, default: null },
  manualLinkProvidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  manualLinkProvidedByUsername: { type: String, default: '' }
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

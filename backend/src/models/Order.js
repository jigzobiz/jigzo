const mongoose = require('mongoose');

const PaymentAttemptSchema = new mongoose.Schema({
  providerChargeId: { type: String },
  providerStatus: { type: String },
  transactionReference: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  safeFailureCode: { type: String },
  safeFailureMessage: { type: String }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  puzzleId: { type: String, required: true, ref: 'Puzzle' }, // References Puzzle's publicId
  packageId: { type: String, required: true },
  recipientCount: { type: Number, required: true },
  basePrice: { type: Number, required: true },
  addOns: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentReference: { type: String, default: '' },
  paymentProvider: { type: String, default: 'tap' },
  providerChargeId: { type: String, index: true },
  providerStatus: { type: String },
  providerTransactionReference: { type: String },
  paidAt: { type: Date },
  failedAt: { type: Date },
  lastPaymentError: { type: String },
  paymentAttempts: [PaymentAttemptSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);

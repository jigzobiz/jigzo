const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  puzzleId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: ['initiated', 'succeeded', 'failed'], default: 'initiated' },
  gatewayReference: { type: String },
  rawResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);

const mongoose = require('mongoose');

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
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);

const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  saleReference: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String },
  customerPhone: { type: String },
  date: { type: Date, required: true },
  
  originalAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
  originalCurrency: { type: String, required: true },
  fxRateToBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  calculatedAmountBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  tapReference: { type: String, unique: true, sparse: true, index: true },
  paymentStatus: { type: String, enum: ['captured', 'refunded', 'failed'], required: true },
  refundAmount: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0.000000') },
  netCalculatedBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  reconciliationStatus: {
    type: String,
    enum: ['Awaiting Statement', 'Reconciled', 'Difference Found', 'Excluded', 'Refunded'],
    default: 'Awaiting Statement',
    index: true
  },
  confirmedSettlementBHD: { type: mongoose.Schema.Types.Decimal128 },
  settlementPeriod: { type: String },
  settlementReference: { type: String },
  reconciledAt: { type: Date },
  reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  notes: { type: String, default: '' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'sales' });

module.exports = mongoose.model('Sale', SaleSchema);


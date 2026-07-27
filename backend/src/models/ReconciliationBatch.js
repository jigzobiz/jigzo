const mongoose = require('mongoose');

const ReconciliationBatchSchema = new mongoose.Schema({
  reconciliationId: { type: String, required: true, unique: true, index: true },
  settlementPeriod: { type: String, required: true },
  settlementReference: { type: String, required: true },
  originalCurrency: { type: String, default: 'BHD' },
  
  totalCalculatedBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  totalSettledBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  differenceBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  
  status: { type: String, enum: ['draft', 'matched', 'mismatch', 'closed'], default: 'draft' },
  notes: { type: String, default: '' },
  salesLinked: [{ type: String }], // Array of Sale references/IDs
  
  reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  reconciledAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'reconciliationbatches' });

module.exports = mongoose.model('ReconciliationBatch', ReconciliationBatchSchema);


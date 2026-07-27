const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  expenseId: { type: String, required: true, unique: true, index: true },
  date: { type: Date, required: true },
  category: { type: String, required: true },
  vendor: { type: String, required: true },
  description: { type: String, required: true },
  
  originalAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
  currency: { type: String, required: true },
  
  fxRateToBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  fxRateDate: { type: Date },
  fxRateSource: { type: String, default: 'manual' },
  fxRateLockedAt: { type: Date, default: Date.now },
  fxRateWasOverridden: { type: Boolean, default: false },
  
  amountBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  paymentMethod: { type: String, default: '' },
  paidBy: { type: String, default: 'JIGZO' },
  status: { type: String, enum: ['Paid', 'Pending', 'Refunded', 'Partially Refunded', 'Cancelled'], default: 'Paid' },
  comments: { type: String, default: '' },
  receiptAttachments: [{ type: String }],
  
  refundAmount: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0.000000') },
  refundDate: { type: Date },
  
  relatedOrderId: { type: String },
  relatedPaymentReference: { type: String },
  
  isRecurring: { type: Boolean, default: false },
  recurrenceFrequency: { type: String, enum: ['monthly', 'quarterly', 'semi-annual', 'annual', 'custom'] },
  recurrenceCustomInterval: { type: String },
  lastRenewalDate: { type: Date },
  nextRenewalDate: { type: Date },
  renewalHistory: [{
    renewalDate: { type: Date },
    amountBHD: { type: mongoose.Schema.Types.Decimal128 }
  }],
  
  reimbursementAmount: { type: mongoose.Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0.000000') },
  reimbursementStatus: { type: String, enum: ['Not Required', 'Due', 'Reimbursed'], default: 'Not Required' },
  reimbursementNotes: { type: String, default: '' },
  reimbursedDate: { type: Date },
  
  createdBy: { type: String },
  updatedBy: { type: String },
  isArchived: { type: Boolean, default: false },
  migrationSource: { type: String },
  importBatchId: { type: String },
  migrationKey: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'expenses' });

module.exports = mongoose.model('Expense', ExpenseSchema);


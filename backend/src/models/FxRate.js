const mongoose = require('mongoose');

const FxRateSchema = new mongoose.Schema({
  currency: { type: String, required: true, unique: true },
  rateToBHD: { type: mongoose.Schema.Types.Decimal128, required: true },
  effectiveDate: { type: Date, default: Date.now },
  source: { type: String, default: 'manual' },
  isPegged: { type: Boolean, default: false },
  manualOverrideStatus: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
}, { collection: 'fxrates' });

module.exports = mongoose.model('FxRate', FxRateSchema);


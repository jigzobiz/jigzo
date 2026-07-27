const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  isArchived: { type: Boolean, default: false }
}, { collection: 'vendors' });

module.exports = mongoose.model('Vendor', VendorSchema);


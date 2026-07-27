const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true, index: true },
  primaryPhone: { type: String, required: true },
  normalizedPhone: { type: String, required: true, unique: true, index: true },
  name: { type: String, trim: true },
  aliases: [{
    name: { type: String },
    date: { type: Date, default: Date.now }
  }],
  countryCode: { type: String, default: '' },
  countryName: { type: String, default: 'Unknown' },
  email: { type: String, trim: true, lowercase: true },
  emailVerifiedAt: { type: Date },
  loyaltyOptInAt: { type: Date },
  marketingConsentAt: { type: Date },
  accountStatus: { type: String, enum: ['none', 'pending', 'active', 'suspended'], default: 'none' },
  adminNotes: { type: String, default: '' },
  
  // Future account profile fields
  passwordHash: { type: String },
  lastLoginAt: { type: Date },
  passwordChangedAt: { type: Date },
  profileCreatedAt: { type: Date },
  
  // Merge and archive details
  mergeHistory: [{
    fromPhone: { type: String },
    mergedAt: { type: Date, default: Date.now },
    reason: { type: String }
  }],
  firstOrderAt: { type: Date },
  latestOrderAt: { type: Date },
  isArchived: { type: Boolean, default: false },
  // Admin-only suppression for deleted test customers: keeps operational
  // records intact while excluding the customer from all admin lists/metrics.
  adminSuppressed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'customers' });

module.exports = mongoose.model('Customer', CustomerSchema);


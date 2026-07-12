const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  finding: { type: String, required: true },
  evidence: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  action: { type: String, required: true },
  status: { type: String, enum: ['pending', 'implemented', 'dismissed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Recommendation', RecommendationSchema);

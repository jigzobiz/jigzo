const mongoose = require('mongoose');

const WorkItemSchema = new mongoose.Schema({
  area: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  owner: { type: String, required: true },
  targetDate: { type: Date },
  status: { type: String, enum: ['todo', 'in-progress', 'done', 'blocked'], default: 'todo' },
  blockers: { type: String, default: '' },
  percentageComplete: { type: Number, min: 0, max: 100, default: 0 },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkItem', WorkItemSchema);

const mongoose = require('mongoose');

const DraftPuzzleSchema = new mongoose.Schema({
  anonymousId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true },
  stepsCompleted: { type: Number, default: 0 },
  currentStepData: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DraftPuzzle', DraftPuzzleSchema);

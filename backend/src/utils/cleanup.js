const Puzzle = require('../models/Puzzle');
const { deleteImage } = require('../services/storageService');

/**
 * Sweeps the database for expired puzzles, deletes their associated GridFS images,
 * and clears the storage pointers to save database space.
 *
 * NOTE: This script is prepared for scheduling (e.g., Vercel Crons) but is NOT active yet.
 *
 * @returns {Promise<void>}
 */
async function runCleanup() {
  console.log('[Cleanup] Starting purge of expired test reveals...');
  
  const now = new Date();
  // Find all puzzles that have passed their expiration date and still point to GridFS images
  const expiredPuzzles = await Puzzle.find({
    expiresAt: { $lt: now },
    imageStorageId: { $ne: null }
  });
  
  console.log(`[Cleanup] Found ${expiredPuzzles.length} expired puzzles with stored images.`);
  
  for (const puzzle of expiredPuzzles) {
    try {
      console.log(`[Cleanup] Deleting GridFS image for puzzle: ${puzzle.publicId} (Storage ID: ${puzzle.imageStorageId})`);
      await deleteImage(puzzle.imageStorageId);
      
      // Nullify storage reference and transition status
      puzzle.imageStorageId = null;
      puzzle.status = 'expired';
      await puzzle.save();
      
      console.log(`[Cleanup] Successfully purged assets for puzzle: ${puzzle.publicId}`);
    } catch (err) {
      console.error(`[Cleanup] Failed to purge assets for puzzle ${puzzle.publicId}:`, err.message);
    }
  }
  
  console.log('[Cleanup] Expired test reveals purge completed.');
}

module.exports = { runCleanup };

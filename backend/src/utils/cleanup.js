const Puzzle = require('../models/Puzzle');
const storageService = require('../services/storageService');
const { logRef } = require('./puzzleRef');

/**
 * Physical image cleanup: permanently deletes GridFS binaries whose
 * imageDeletionDueAt has passed. Invoked hourly by Vercel Cron via
 * GET /api/internal/images/cleanup (see routes/internal/imageCleanup.js).
 *
 * Properties:
 *  - Idempotent: file-first deletion; a missing GridFS file counts as done.
 *  - Batch loop bounded by a conservative time budget, so a large backlog
 *    is drained across runs without risking function timeouts.
 *  - One failing record never stops the batch; failures are marked and
 *    automatically retried on later runs (they still match the selector).
 *  - Touches ONLY puzzle image fields. Orders, payments, invoices and the
 *    puzzle's commercial/payment status are never modified.
 *  - Logs use one-way puzzleRef hashes and GridFS ObjectIds only — never
 *    raw publicIds, URLs, tokens or customer data.
 */

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_TIME_BUDGET_MS = 8000;

function isFileNotFoundError(err) {
  return !!err && /file not found|filenotfound/i.test(String(err.message || err.name || ''));
}

async function runImageCleanup(options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const timeBudgetMs = options.timeBudgetMs || DEFAULT_TIME_BUDGET_MS;
  const deps = {
    findDueBatch: options.findDueBatch || (async (now, limit) =>
      Puzzle.find({
        imageDeletionDueAt: { $lte: now },
        imageStorageId: { $ne: null }
      }).limit(limit)),
    countRemaining: options.countRemaining || (async (now) =>
      Puzzle.countDocuments({
        imageDeletionDueAt: { $lte: now },
        imageStorageId: { $ne: null }
      })),
    deleteImage: options.deleteImage || storageService.deleteImage,
    markDeleted: options.markDeleted || (async (puzzle, deletedAt) =>
      Puzzle.updateOne(
        { _id: puzzle._id },
        {
          $set: {
            imageStorageId: null,
            imageMimeType: '',
            imageDeletedAt: deletedAt,
            imageDeletionStatus: 'deleted',
            imageDeletionFailureReason: ''
          }
        }
      )),
    markFailed: options.markFailed || (async (puzzle, reason) =>
      Puzzle.updateOne(
        { _id: puzzle._id },
        {
          $set: {
            imageDeletionStatus: 'failed',
            imageDeletionFailureReason: reason
          }
        }
      ))
  };

  const startedAt = Date.now();
  const summary = { scanned: 0, deleted: 0, alreadyMissing: 0, failed: 0, remaining: 0 };
  console.log('[ImageCleanup] Run started.');

  while (Date.now() - startedAt < timeBudgetMs) {
    const now = new Date();
    const batch = await deps.findDueBatch(now, batchSize);
    if (!batch.length) break;

    for (const puzzle of batch) {
      if (Date.now() - startedAt >= timeBudgetMs) break;
      summary.scanned += 1;

      try {
        let fileWasMissing = false;
        try {
          await deps.deleteImage(puzzle.imageStorageId);
        } catch (err) {
          if (isFileNotFoundError(err)) {
            // Desired end state already reached — treat as success.
            fileWasMissing = true;
          } else {
            throw err;
          }
        }

        await deps.markDeleted(puzzle, new Date());

        if (fileWasMissing) {
          summary.alreadyMissing += 1;
        } else {
          summary.deleted += 1;
        }
        console.log(`[ImageCleanup] Purged image (ref=${logRef(puzzle.publicId)}, storageId=${puzzle.imageStorageId}).`);
      } catch (err) {
        summary.failed += 1;
        const reason = (err && (err.name || err.code)) ? String(err.name || err.code).slice(0, 100) : 'UnknownError';
        console.error(`[ImageCleanup] Deletion failed (ref=${logRef(puzzle.publicId)}, reason=${reason}).`);
        try {
          await deps.markFailed(puzzle, reason);
        } catch (markErr) {
          console.error(`[ImageCleanup] Could not record failure state (ref=${logRef(puzzle.publicId)}).`);
        }
        // Continue with the rest of the batch; this record is retried on
        // the next run because imageStorageId is still set.
      }
    }

    if (batch.length < batchSize) break;
  }

  try {
    summary.remaining = await deps.countRemaining(new Date());
  } catch (e) {
    summary.remaining = -1;
  }

  console.log(`[ImageCleanup] Run finished. scanned=${summary.scanned} deleted=${summary.deleted} alreadyMissing=${summary.alreadyMissing} failed=${summary.failed} remaining=${summary.remaining}`);
  return summary;
}

module.exports = { runImageCleanup, isFileNotFoundError };

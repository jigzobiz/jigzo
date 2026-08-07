const Puzzle = require('../models/Puzzle');
const Order = require('../models/Order');
const { logRef } = require('./puzzleRef');
const {
  addDays,
  earlierDate,
  computeInitialDueAt,
  computePostCompletionDueAt,
  DAY_MS
} = require('./imageRetention');

const BUFFER_DAYS = 3; // 72-hour block-then-purge review buffer for overdue images

/**
 * Core image-retention backfill logic, extracted so it can be invoked
 * identically from the CLI script (backend/scripts/backfill-image-retention.js)
 * and from the temporary authenticated internal apply endpoint — same
 * behavior, same safeguards, no duplicated logic.
 *
 * Does NOT connect/disconnect Mongoose and does NOT delete anything: it
 * only ever backfills imageStoredAt / allRecipientsCompletedAt /
 * imageDeletionDueAt / imageDeletionStatus on Puzzle documents (and, for
 * legacy no-binary records, marks them already-deleted since the file no
 * longer exists). Order documents are read-only (manual-review check).
 *
 * Manual-review records are deliberately left untouched — no deadline is
 * stamped for them — pending separate human disposition.
 */
async function runBackfillImageRetention({ apply = false, now = new Date() } = {}) {
  const counts = {
    totalWithBinary: 0,
    alreadyStamped: 0,
    manualReview: 0,
    wouldScheduleFuture: 0,
    wouldBlockOverdue: 0,
    legacyNoBinary: 0,
    applied: 0
  };
  const manualReviewRefs = [];

  // --- Legacy records: pointer but no GridFS binary ---
  const legacyQuery = {
    imageStorageId: null,
    imageDeletedAt: null,
    cropImageUrl: { $regex: '^/uploads/' }
  };
  counts.legacyNoBinary = await Puzzle.countDocuments(legacyQuery);
  if (apply && counts.legacyNoBinary > 0) {
    await Puzzle.updateMany(legacyQuery, {
      $set: {
        imageDeletedAt: now,
        imageDeletionStatus: 'deleted',
        imageDeletionFailureReason: ''
      }
    });
  }

  // --- Records still holding a GridFS binary ---
  const cursor = Puzzle.find({ imageStorageId: { $ne: null } }).cursor();

  for (let puzzle = await cursor.next(); puzzle != null; puzzle = await cursor.next()) {
    counts.totalWithBinary += 1;

    // Idempotent / restart-safe: already-stamped records are skipped.
    if (puzzle.imageDeletionDueAt) {
      counts.alreadyStamped += 1;
      continue;
    }

    // Manual-review set: active or recently-paid commerce states.
    let needsReview = ['pending_payment', 'paid', 'preparing'].includes(puzzle.status);
    if (!needsReview) {
      const order = await Order.findOne({ puzzleId: puzzle.publicId }).sort({ createdAt: -1 });
      if (order) {
        if (order.paymentStatus === 'refunded') needsReview = true;
        if (order.paymentStatus === 'paid' && order.paidAt &&
            now.getTime() - order.paidAt.getTime() < 7 * DAY_MS) {
          needsReview = true;
        }
      }
    }
    if (needsReview) {
      counts.manualReview += 1;
      manualReviewRefs.push(`${logRef(puzzle.publicId)} (status=${puzzle.status})`);
      continue;
    }

    const imageStoredAt = puzzle.imageStoredAt || puzzle.createdAt;
    let allCompletedAt = null;
    if (puzzle.recipients.length > 0 && puzzle.recipients.every(r => r.completedAt)) {
      allCompletedAt = puzzle.recipients.reduce(
        (latest, r) => (r.completedAt > latest ? r.completedAt : latest),
        puzzle.recipients[0].completedAt
      );
    }

    let dueAt = computeInitialDueAt(imageStoredAt);
    if (allCompletedAt) {
      dueAt = earlierDate(dueAt, computePostCompletionDueAt(allCompletedAt));
    }

    const overdue = dueAt.getTime() <= now.getTime();
    if (overdue) {
      counts.wouldBlockOverdue += 1;
    } else {
      counts.wouldScheduleFuture += 1;
    }

    if (apply) {
      await Puzzle.updateOne(
        { _id: puzzle._id, imageDeletionDueAt: null },
        {
          $set: {
            imageStoredAt,
            allRecipientsCompletedAt: allCompletedAt,
            // Overdue: block access NOW (API gate honors 'blocked'), but give
            // physical deletion a review buffer before the cron purges.
            imageDeletionDueAt: overdue ? addDays(now, BUFFER_DAYS) : dueAt,
            imageDeletionStatus: overdue ? 'blocked' : 'scheduled'
          }
        }
      );
      counts.applied += 1;
    }
  }

  return { counts, manualReviewRefs };
}

module.exports = { runBackfillImageRetention, BUFFER_DAYS };

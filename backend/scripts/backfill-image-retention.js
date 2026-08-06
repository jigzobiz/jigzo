/**
 * Backfill image-retention fields for existing puzzles.
 *
 * DRY-RUN BY DEFAULT — prints counts only and writes nothing.
 *
 * Usage:
 *   node scripts/backfill-image-retention.js                 # dry-run (read-only)
 *   node scripts/backfill-image-retention.js --apply         # writes (local DB only)
 *
 * Applying against a NON-LOCAL database additionally requires the
 * environment variable JIGZO_PRODUCTION_APPLY=I_UNDERSTAND to be set —
 * a deliberate, separate confirmation step.
 *
 * What apply mode does (NEVER deletes anything):
 *  - imageStoredAt        := createdAt (exact substitute: historically both
 *                            were written in the same request).
 *  - allRecipientsCompletedAt := max(recipients.completedAt) but only when
 *                            every intended recipient has completed.
 *  - imageDeletionDueAt   := min(imageStoredAt + 30d, allRecipientsCompletedAt + 7d)
 *  - Records already past their computed deadline are set to
 *    imageDeletionStatus='blocked' (access stops immediately via the API
 *    gate) with imageDeletionDueAt := now + BUFFER_DAYS, deferring physical
 *    deletion by the cron until the review buffer has elapsed.
 *  - Puzzles in pending_payment/paid/preparing status, or with an order paid
 *    within the last 7 days or refunded, are SKIPPED for manual review.
 *  - Legacy records with no GridFS binary (old /uploads pointers) are marked
 *    deleted — the ephemeral files no longer exist.
 *
 * Output contains counts and one-way hashed references only: no customer
 * data, no complete publicIds, no image URLs.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Puzzle = require('../src/models/Puzzle');
const Order = require('../src/models/Order');
const { logRef } = require('../src/utils/puzzleRef');
const {
  addDays,
  earlierDate,
  computeInitialDueAt,
  computePostCompletionDueAt,
  DAY_MS
} = require('../src/utils/imageRetention');

const APPLY = process.argv.includes('--apply');
const BUFFER_DAYS = 3; // 72-hour block-then-purge review buffer for overdue images

function isLocalUri(uri) {
  return /localhost|127\.0\.0\.1/.test(String(uri || ''));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not configured.');
    process.exit(1);
  }

  if (APPLY && !isLocalUri(uri) && process.env.JIGZO_PRODUCTION_APPLY !== 'I_UNDERSTAND') {
    console.error('REFUSING apply mode against a non-local database.');
    console.error('Set JIGZO_PRODUCTION_APPLY=I_UNDERSTAND to confirm deliberately.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[Backfill] Connected. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}`);

  const now = new Date();
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
  if (APPLY && counts.legacyNoBinary > 0) {
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

    if (APPLY) {
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

  console.log('[Backfill] Summary (counts only):');
  console.log(JSON.stringify(counts, null, 2));
  if (manualReviewRefs.length) {
    console.log('[Backfill] Manual-review records (hashed refs only):');
    for (const ref of manualReviewRefs) console.log(`  - ${ref}`);
  }
  if (!APPLY) {
    console.log('[Backfill] DRY-RUN complete. No documents were modified.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Backfill] Fatal:', err.name || 'Error');
  process.exit(1);
});

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
 *
 * The core logic lives in ../src/utils/migrationBackfill.js, shared with
 * the temporary authenticated internal apply endpoint — this file is a
 * thin CLI wrapper (env loading, argv parsing, Mongoose connect/disconnect)
 * around that single, tested implementation.
 */

const { runBackfillImageRetention } = require('../src/utils/migrationBackfill');

function isLocalUri(uri) {
  return /localhost|127\.0\.0\.1/.test(String(uri || ''));
}

async function main() {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');

  const APPLY = process.argv.includes('--apply');
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

  const { counts, manualReviewRefs } = await runBackfillImageRetention({ apply: APPLY, now: new Date() });

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

if (require.main === module) {
  main().catch((err) => {
    console.error('[Backfill] Fatal:', err.name || 'Error');
    process.exit(1);
  });
}

module.exports = { isLocalUri };

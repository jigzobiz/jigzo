/**
 * Sanitize historical JourneyEvent records.
 *
 * DRY-RUN BY DEFAULT — prints counts only and writes nothing.
 *
 * Usage:
 *   node scripts/sanitize-journeyevents.js            # dry-run (read-only)
 *   node scripts/sanitize-journeyevents.js --apply    # writes (local DB only)
 *
 * Applying against a NON-LOCAL database additionally requires
 * JIGZO_PRODUCTION_APPLY=I_UNDERSTAND — a deliberate, separate confirmation.
 *
 * Apply mode rewrites, per event:
 *  - pageUrl  -> sanitized route template (no query, no hash, no capability
 *                segment; e.g. "/p/:puzzleId").
 *  - metadata -> scrubbed copy (no puzzleId/publicId, tokens, signatures,
 *                URLs, phone numbers, emails, names or messages).
 *  - puzzleRef stamped (one-way keyed hash) where derivable, so funnel
 *                correlation survives sanitization.
 *
 * Idempotent: sanitizing already-sanitized records is a no-op. Restart-safe:
 * documents are updated one at a time via a cursor.
 *
 * Output contains counts only — never stored URLs, publicIds or metadata.
 *
 * The core logic lives in ../src/utils/migrationSanitizeJourney.js, shared
 * with the temporary authenticated internal apply endpoint — this file is a
 * thin CLI wrapper (env loading, argv parsing, Mongoose connect/disconnect)
 * around that single, tested implementation.
 */

const { runSanitizeJourneyEvents } = require('../src/utils/migrationSanitizeJourney');

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
  console.log(`[SanitizeJourney] Connected. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}`);

  const { counts } = await runSanitizeJourneyEvents({ apply: APPLY });

  console.log('[SanitizeJourney] Summary (counts only):');
  console.log(JSON.stringify(counts, null, 2));
  if (!APPLY) {
    console.log('[SanitizeJourney] DRY-RUN complete. No documents were modified.');
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[SanitizeJourney] Fatal:', err.name || 'Error');
    process.exit(1);
  });
}

module.exports = { isLocalUri };

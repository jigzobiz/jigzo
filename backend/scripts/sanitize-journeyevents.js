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
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const JourneyEvent = require('../src/models/JourneyEvent');
const { sanitizePageUrl, derivePuzzleRef, scrubMetadata } = require('../src/utils/analyticsSanitize');

const APPLY = process.argv.includes('--apply');

function isLocalUri(uri) {
  return /localhost|127\.0\.0\.1/.test(String(uri || ''));
}

const CAPABILITY_URL_RE = /\/p\/(?!:puzzleId)[^/?#]+/;

function metadataNeedsScrub(metadata, scrubbed) {
  return JSON.stringify(metadata || {}) !== JSON.stringify(scrubbed || {});
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
  console.log(`[SanitizeJourney] Connected. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}`);

  const counts = {
    totalEvents: 0,
    pageUrlWithCapability: 0,
    pageUrlWithQueryOrHash: 0,
    metadataWithPuzzleId: 0,
    metadataWithOtherSensitive: 0,
    updated: 0
  };

  const cursor = JourneyEvent.find({}).cursor();

  for (let event = await cursor.next(); event != null; event = await cursor.next()) {
    counts.totalEvents += 1;

    const rawUrl = event.pageUrl || '';
    const rawMetadata = (event.metadata && typeof event.metadata === 'object') ? event.metadata : {};

    const hasCapabilityUrl = CAPABILITY_URL_RE.test(rawUrl);
    const hasQueryOrHash = /[?#]/.test(rawUrl) || /^https?:\/\//i.test(rawUrl);
    const hasPuzzleId = 'puzzleId' in rawMetadata || 'publicId' in rawMetadata;

    if (hasCapabilityUrl) counts.pageUrlWithCapability += 1;
    if (hasQueryOrHash) counts.pageUrlWithQueryOrHash += 1;
    if (hasPuzzleId) counts.metadataWithPuzzleId += 1;

    const safeUrl = sanitizePageUrl(rawUrl);
    const safeMetadata = scrubMetadata(rawMetadata);
    const metadataChanged = metadataNeedsScrub(rawMetadata, safeMetadata);
    if (metadataChanged && !hasPuzzleId) counts.metadataWithOtherSensitive += 1;

    const urlChanged = safeUrl !== rawUrl;
    if (!urlChanged && !metadataChanged) continue;

    if (APPLY) {
      const update = {
        $set: {
          pageUrl: safeUrl,
          metadata: safeMetadata
        }
      };
      if (!event.puzzleRef) {
        const ref = derivePuzzleRef(rawMetadata, rawUrl);
        if (ref) update.$set.puzzleRef = ref;
      }
      await JourneyEvent.updateOne({ _id: event._id }, update);
      counts.updated += 1;
    } else {
      counts.updated += 1; // would-update count in dry-run
    }
  }

  console.log('[SanitizeJourney] Summary (counts only):');
  console.log(JSON.stringify(counts, null, 2));
  if (!APPLY) {
    console.log('[SanitizeJourney] DRY-RUN complete. No documents were modified.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[SanitizeJourney] Fatal:', err.name || 'Error');
  process.exit(1);
});

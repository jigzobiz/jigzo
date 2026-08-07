const JourneyEvent = require('../models/JourneyEvent');
const { sanitizePageUrl, derivePuzzleRef, scrubMetadata } = require('./analyticsSanitize');

const CAPABILITY_URL_RE = /\/p\/(?!:puzzleId)[^/?#]+/;

function metadataNeedsScrub(metadata, scrubbed) {
  return JSON.stringify(metadata || {}) !== JSON.stringify(scrubbed || {});
}

/**
 * Core JourneyEvent sanitization logic, extracted so it can be invoked
 * identically from the CLI script (backend/scripts/sanitize-journeyevents.js)
 * and from the temporary authenticated internal apply endpoint.
 *
 * Does NOT connect/disconnect Mongoose and never deletes a document: it
 * only rewrites pageUrl -> route template, metadata -> scrubbed copy, and
 * stamps puzzleRef (one-way keyed hash) where derivable and not already
 * set. Already-sanitized records are left untouched (idempotent).
 */
async function runSanitizeJourneyEvents({ apply = false } = {}) {
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

    if (apply) {
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

  return { counts };
}

module.exports = { runSanitizeJourneyEvents };

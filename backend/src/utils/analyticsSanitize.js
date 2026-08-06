const { puzzleRef } = require('./puzzleRef');

/**
 * Server-side analytics sanitization. The backend never trusts the frontend:
 * everything persisted to JourneyEvent / DraftPuzzle passes through here.
 *
 * Rules:
 *  - Never store a full page URL: only a route template (no query, no hash,
 *    no origin), with the puzzle capability segment replaced.
 *  - Never store raw publicId / puzzleId, tokens, signatures or cookies.
 *  - Never store telephone numbers, emails, names or customer messages in
 *    the event log (Customer mapping consumes them upstream before this).
 *  - Correlation, where needed, uses the one-way keyed puzzleRef only.
 */

// Matches the puzzle capability path segment (32-hex publicId today; any
// segment is templated defensively).
const PUZZLE_PATH_RE = /\/p\/[^/?#]+/g;

// Metadata keys that must never be persisted in analytics records.
const FORBIDDEN_KEYS = [
  'puzzleid', 'publicid', 'token', 'sig', 'signature', 'cookie',
  'phone', 'email', 'name', 'message', 'senderphone', 'recipientphone'
];

// String values that look like capabilities/secrets: long hex runs, URLs,
// or the image cookie name.
const SUSPICIOUS_VALUE_RE = /([a-f0-9]{24,}|https?:\/\/|jigzo_img)/i;

/**
 * Reduces any incoming pageUrl to a safe same-site route template.
 * "https://example/p/abc123?r=0#x" -> "/p/:puzzleId"
 */
function sanitizePageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let pathname = rawUrl;

  try {
    // Tolerate absolute URLs, protocol-relative and bare paths.
    const parsed = new URL(rawUrl, 'https://jigzo.invalid');
    pathname = parsed.pathname || '/';
  } catch (e) {
    pathname = String(rawUrl).split(/[?#]/)[0];
  }

  pathname = pathname.replace(PUZZLE_PATH_RE, '/p/:puzzleId');
  if (pathname.startsWith('/receive.html')) pathname = '/receive.html';

  // Hard cap and final safety net: no query, hash, or capability leftovers.
  pathname = pathname.split(/[?#]/)[0].slice(0, 200);
  if (SUSPICIOUS_VALUE_RE.test(pathname)) return '/p/:puzzleId';
  return pathname;
}

/**
 * Extracts a puzzleRef (or null) from incoming metadata/pageUrl BEFORE
 * scrubbing, so correlation survives sanitization.
 */
function derivePuzzleRef(metadata, rawPageUrl) {
  const md = metadata || {};
  const candidate = md.puzzleId || md.publicId || null;
  if (candidate && typeof candidate === 'string') {
    return puzzleRef(candidate);
  }
  if (rawPageUrl && typeof rawPageUrl === 'string') {
    const match = rawPageUrl.match(/\/p\/([^/?#]+)/);
    if (match) return puzzleRef(match[1]);
  }
  return null;
}

/**
 * Returns a scrubbed shallow copy of metadata safe for persistence.
 * Removes forbidden keys and any value that looks like a capability,
 * secret or URL. Non-string primitives pass through.
 */
function scrubMetadata(metadata) {
  const out = {};
  if (!metadata || typeof metadata !== 'object') return out;

  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) continue;
    if (typeof value === 'string') {
      if (SUSPICIOUS_VALUE_RE.test(value)) continue;
      out[key] = value.slice(0, 200);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    }
    // Nested objects/arrays are dropped: nothing in the current event
    // catalogue requires them and they are the easiest leak vector.
  }
  return out;
}

module.exports = {
  sanitizePageUrl,
  derivePuzzleRef,
  scrubMetadata
};

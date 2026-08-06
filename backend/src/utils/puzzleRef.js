const crypto = require('crypto');

/**
 * One-way keyed reference for a puzzle, safe for analytics and logs.
 *
 * The raw publicId is a capability (anyone holding it can open the puzzle),
 * so it must never be stored in analytics or written to logs. puzzleRef is a
 * truncated keyed HMAC: it allows correlation but cannot be reversed or used
 * to reconstruct the puzzle URL.
 *
 * Uses ANALYTICS_HASH_SECRET — deliberately independent from
 * IMAGE_TOKEN_SECRET so the two can be rotated separately.
 */

function getSecret() {
  const secret = process.env.ANALYTICS_HASH_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

/**
 * Returns a 12-hex-char reference, or null when the secret is unset
 * (callers then store/log nothing rather than falling back to the raw id).
 */
function puzzleRef(publicId) {
  const secret = getSecret();
  if (!secret || !publicId) return null;
  return crypto
    .createHmac('sha256', secret)
    .update(`ref|${publicId}`)
    .digest('hex')
    .slice(0, 12);
}

/** Log-safe label for a puzzle; never exposes the raw publicId. */
function logRef(publicId) {
  return puzzleRef(publicId) || '[ref-unavailable]';
}

module.exports = { puzzleRef, logRef };

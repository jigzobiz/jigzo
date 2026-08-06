const crypto = require('crypto');

/**
 * Anti-hotlinking image-access cookie.
 *
 * The puzzle link (publicId) remains the access capability by design; this
 * cookie only prevents permanent direct-image hotlinking. It is never placed
 * in URLs, query strings, JSON responses or logs.
 *
 * Fails CLOSED: when IMAGE_TOKEN_SECRET is not configured, no cookie can be
 * issued and verification always fails, so images are never silently public.
 */

const COOKIE_NAME = 'jigzo_img';
const COOKIE_TTL_SECONDS = 1800; // 30 minutes

function getSecret() {
  const secret = process.env.IMAGE_TOKEN_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

function isConfigured() {
  return getSecret() !== null;
}

function sign(publicId, recipientIndex, expEpochSeconds) {
  const secret = getSecret();
  if (!secret) return null;
  return crypto
    .createHmac('sha256', secret)
    .update(`img|${publicId}|${recipientIndex}|${expEpochSeconds}`)
    .digest('hex');
}

/**
 * Builds the Set-Cookie header value for a puzzle's image route.
 * Returns null when the secret is missing (fail closed — no cookie issued).
 */
function buildImageCookie(publicId, recipientIndex, { secure }) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const sig = sign(publicId, recipientIndex, exp);
  if (!sig) return null;

  const attributes = [
    `${COOKIE_NAME}=${recipientIndex}.${exp}.${sig}`,
    `Max-Age=${COOKIE_TTL_SECONDS}`,
    `Path=/api/puzzles/${publicId}/image`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key && !(key in out)) out[key] = value;
  }
  return out;
}

/**
 * Verifies the image cookie for a request. Timing-safe. Fails closed when
 * the secret is missing or anything about the cookie is malformed/expired.
 */
function verifyImageCookieHeader(cookieHeader, publicId, recipientIndex, nowEpochSeconds) {
  if (!isConfigured()) return false;

  const cookies = parseCookieHeader(cookieHeader);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;

  const segments = raw.split('.');
  if (segments.length !== 3) return false;

  const [cookieR, expRaw, providedSig] = segments;
  if (String(recipientIndex) !== cookieR) return false;

  const exp = parseInt(expRaw, 10);
  if (!Number.isFinite(exp)) return false;

  const now = nowEpochSeconds !== undefined ? nowEpochSeconds : Math.floor(Date.now() / 1000);
  if (now > exp) return false;

  const expectedSig = sign(publicId, cookieR, exp);
  if (!expectedSig) return false;

  const providedBuf = Buffer.from(String(providedSig), 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

module.exports = {
  COOKIE_NAME,
  COOKIE_TTL_SECONDS,
  isConfigured,
  buildImageCookie,
  verifyImageCookieHeader
};

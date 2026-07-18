/**
 * Central runtime configuration helpers.
 *
 * These resolve environment-dependent values (frontend origin, deploy stage,
 * JWT secret) in ONE place so Production, Vercel Preview and local development
 * cannot drift apart. No secret values are ever logged from here.
 */

/** Remove any trailing slashes so we never build `origin//p/...`. */
function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}

/** Prefix https:// only when the value has no protocol already. */
function ensureProtocol(value) {
  const trimmed = String(value).trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Resolve the public frontend origin for building reveal links and the CORS
 * allow-list. Priority:
 *   1. FRONTEND_URL (explicit, may already include a protocol)
 *   2. https://VERCEL_BRANCH_URL (stable per-branch Preview alias)
 *   3. https://VERCEL_URL (per-deployment Preview URL)
 *   4. http://localhost:5173 (local development)
 *
 * @returns {string} origin with no trailing slash
 */
function getFrontendOrigin() {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'staging') {
    return 'https://staging.jigzo.biz';
  }

  const explicit = process.env.FRONTEND_URL;
  if (explicit && explicit.trim()) {
    return stripTrailingSlash(ensureProtocol(explicit));
  }

  const branchUrl = process.env.VERCEL_BRANCH_URL;
  if (branchUrl && branchUrl.trim()) {
    return stripTrailingSlash(ensureProtocol(branchUrl));
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.trim()) {
    return stripTrailingSlash(ensureProtocol(vercelUrl));
  }

  return 'http://localhost:5173';
}

/**
 * True when the runtime is NOT the production environment. Vercel sets
 * NODE_ENV='production' even for Preview builds, so VERCEL_ENV is the reliable
 * discriminator for Preview.
 *
 * @returns {boolean}
 */
function isNonProduction() {
  if (process.env.VERCEL_ENV === 'preview') return true;
  return process.env.NODE_ENV !== 'production';
}

/**
 * True when running on a Vercel deployment (Preview or Production) rather than a
 * developer's machine. Vercel injects VERCEL and VERCEL_ENV automatically.
 *
 * @returns {boolean}
 */
function isDeployed() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

// Clearly-named, obviously-insecure fallback used ONLY for local development so
// a fresh clone runs without setup. It must never be reachable when deployed.
const LOCAL_DEV_JWT_FALLBACK = 'jigzo_local_dev_only_insecure_secret';

/**
 * Resolve the JWT signing secret.
 *   - If JWT_SECRET is configured, use it (all environments).
 *   - On a Vercel deployment with no JWT_SECRET, throw so the misconfiguration
 *     is loud instead of silently using a public key.
 *   - On local development only, fall back to a clearly-named dev secret.
 *
 * @returns {string}
 */
function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.trim()) {
    return configured;
  }

  if (isDeployed()) {
    throw new Error(
      'JWT_SECRET must be configured in deployed environments (Vercel Preview/Production).'
    );
  }

  return LOCAL_DEV_JWT_FALLBACK;
}

module.exports = {
  getFrontendOrigin,
  isNonProduction,
  isDeployed,
  resolveJwtSecret,
  LOCAL_DEV_JWT_FALLBACK
};

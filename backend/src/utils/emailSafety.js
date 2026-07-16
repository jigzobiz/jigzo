/**
 * Non-production email guard.
 *
 * Both outgoing email paths (recipient reveal in emailService, admin waitlist in
 * routes/admin) call resolveEmailDelivery so their behavior can never diverge:
 *   - Production: deliver to the originally requested recipient, unchanged.
 *   - Preview/local: require STAGING_EMAIL_REDIRECT; redirect EVERY email to that
 *     inbox, prefix the subject, and never contact the original recipient. When
 *     the redirect is absent or invalid, block the send with a clear error.
 *
 * No secret values are read or logged here.
 */
const { isNonProduction } = require('./runtimeConfig');

const STAGING_SUBJECT_PREFIX = '[JIGZO STAGING] ';

// Deliberately simple, dependency-free email shape check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @returns {boolean} whether value looks like a single email address. */
function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

/**
 * Decide the real destination and subject for an outgoing email.
 *
 * @param {object} params
 * @param {string} params.to      Originally requested recipient.
 * @param {string} params.subject Original subject line.
 * @returns {{ ok: true, to: string, subject: string, redirected: boolean }
 *          | { ok: false, error: string }}
 */
function resolveEmailDelivery({ to, subject } = {}) {
  const originalSubject = String(subject || '');

  if (!isNonProduction()) {
    return { ok: true, to, subject: originalSubject, redirected: false };
  }

  const redirect = String(process.env.STAGING_EMAIL_REDIRECT || '').trim();
  if (!isValidEmail(redirect)) {
    return {
      ok: false,
      error:
        'Staging email is blocked: set STAGING_EMAIL_REDIRECT to a valid email address to send from a non-production environment.'
    };
  }

  const stagingSubject = originalSubject.startsWith(STAGING_SUBJECT_PREFIX)
    ? originalSubject
    : STAGING_SUBJECT_PREFIX + originalSubject;

  return { ok: true, to: redirect, subject: stagingSubject, redirected: true };
}

module.exports = { resolveEmailDelivery, isValidEmail, STAGING_SUBJECT_PREFIX };

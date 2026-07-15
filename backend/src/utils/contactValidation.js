/**
 * Shared contact validation helpers for recipient/sender delivery.
 *
 * Phone validation uses libphonenumber-js structural validity (isValid()),
 * NOT number type. A structurally valid number is accepted even when its type
 * cannot be conclusively classified as mobile. We never claim a number is
 * "WhatsApp verified" — only that its format is valid.
 */
const { parsePhoneNumberFromString } = require('libphonenumber-js');

/**
 * Validate a phone number and normalize it to E.164.
 * @param {string} phone   Local or full phone string (may already include '+').
 * @param {string} dial    Optional dial/country code (e.g. "+973") used when
 *                          the phone value does not already start with '+'.
 * @returns {{ valid: boolean, e164: string|null }}
 */
function validatePhone(phone, dial = '') {
  let input = String(phone == null ? '' : phone).trim();
  if (!input) return { valid: false, e164: null };

  if (!input.startsWith('+')) {
    const rawDial = String(dial == null ? '' : dial).trim();
    const dialDigits = rawDial.replace(/[^\d]/g, '');
    if (dialDigits) {
      input = '+' + dialDigits + input.replace(/[^\d]/g, '');
    }
  }

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(input);
  } catch (err) {
    return { valid: false, e164: null };
  }

  if (!parsed || !parsed.isValid()) {
    return { valid: false, e164: null };
  }

  return { valid: true, e164: parsed.number };
}

// Pragmatic single-@ email shape check (no external dependency).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and normalize (trim + lowercase) an email address.
 * @param {string} email
 * @returns {{ valid: boolean, email: string|null }}
 */
function validateEmail(email) {
  const normalized = String(email == null ? '' : email).trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !EMAIL_RE.test(normalized)) {
    return { valid: false, email: null };
  }
  return { valid: true, email: normalized };
}

module.exports = { validatePhone, validateEmail };

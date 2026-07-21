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
 * Shared phone-input normalizer (keep in sync with frontend src/utils/phone.js).
 *
 * Produces the same value regardless of the page language by:
 *   1. Converting Arabic-Indic (U+0660–U+0669) and Extended/Persian
 *      (U+06F0–U+06F9) digits to ASCII 0-9.
 *   2. Stripping invisible bidi / zero-width control characters (RLM, LRM,
 *      embeddings, isolates, ALM, BOM) that RTL keyboards and copy/paste inject.
 *   3. Removing spaces, brackets, dots and every hyphen/dash variant.
 *   4. Preserving a single leading '+' (the country code sign) and dropping any
 *      other '+' — so the country code + subscriber-digit order is kept intact.
 *
 * It intentionally does NOT drop letters or other stray characters; downstream
 * libphonenumber parsing rejects anything that is not a real number.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizePhoneInput(value) {
  if (value == null) return '';
  let s = String(value);
  // Arabic-Indic digits (U+0660–U+0669) -> ASCII
  s = s.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48));
  // Extended Arabic-Indic (Persian/Urdu) digits (U+06F0–U+06F9) -> ASCII
  s = s.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48));
  // Invisible bidi / zero-width / directional control characters
  s = s.replace(/[​-‏‪-‮⁦-⁩؜﻿]/g, '');
  // Spaces, brackets, dots and hyphen/dash variants (incl. U+2010–U+2015, minus)
  s = s.replace(/[\s()[\].‐-―−-]/g, '');
  // Preserve one leading '+', drop any others
  const hasLeadingPlus = s.startsWith('+');
  s = s.replace(/\+/g, '');
  return hasLeadingPlus ? '+' + s : s;
}

/**
 * Validate a phone number and normalize it to E.164.
 * @param {string} phone   Local or full phone string (may already include '+').
 * @param {string} dial    Optional dial/country code (e.g. "+973") used when
 *                          the phone value does not already start with '+'.
 * @returns {{ valid: boolean, e164: string|null }}
 */
function validatePhone(phone, dial = '') {
  // Normalize FIRST so Arabic-Indic/Persian digits survive; the old code stripped
  // them here with an ASCII-only /[^\d]/ and produced an empty subscriber number.
  let input = normalizePhoneInput(phone);
  if (!input) return { valid: false, e164: null };

  if (!input.startsWith('+')) {
    const dialDigits = normalizePhoneInput(dial).replace(/[^\d]/g, '');
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

module.exports = { normalizePhoneInput, validatePhone, validateEmail };

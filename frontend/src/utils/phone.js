// Shared phone-input normalizer (keep in sync with backend
// src/utils/contactValidation.js `normalizePhoneInput`).
//
// Produces the same value regardless of the page language by:
//   1. Converting Arabic-Indic (U+0660–U+0669) and Extended/Persian
//      (U+06F0–U+06F9) digits to ASCII 0-9.
//   2. Stripping invisible bidi / zero-width control characters (RLM, LRM,
//      embeddings, isolates, ALM, BOM) that RTL keyboards and copy/paste inject.
//   3. Removing spaces, brackets, dots and every hyphen/dash variant.
//   4. Preserving a single leading '+' (the country code sign) and dropping any
//      other '+' — so the country code + subscriber-digit order is kept intact.
//
// Used before client-side validation AND before building the API payload, for
// both recipient and sender numbers, on both the test-reveal and normal paid
// creation paths.
export function normalizePhoneInput(value) {
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

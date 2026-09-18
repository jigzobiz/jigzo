import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { normalizePhoneInput } from './phone.js';

export function pickerAvailable(navigatorObject = globalThis.navigator, windowObject = globalThis.window) {
  try {
    return Boolean(windowObject?.isSecureContext && windowObject.top === windowObject.self &&
      navigatorObject?.contacts && typeof navigatorObject.contacts.select === 'function' &&
      typeof navigatorObject.contacts.getProperties === 'function');
  } catch {
    return false;
  }
}

export function internationalPhone(value) {
  const normalized = normalizePhoneInput(value);
  if (!normalized.startsWith('+')) return { valid: false, raw: normalized, e164: null, dial: '', national: normalized };
  try {
    const parsed = parsePhoneNumberFromString(normalized);
    if (parsed?.isValid()) {
      return { valid: true, raw: normalized, e164: parsed.number,
        dial: `+${parsed.countryCallingCode}`, national: parsed.nationalNumber };
    }
  } catch { /* Retain the selected value for manual correction. */ }
  return { valid: false, raw: normalized, e164: null, dial: '', national: normalized };
}

export function recipientPhoneIdentity(dial, phone) {
  const value = normalizePhoneInput(`${dial || ''}${phone || ''}`);
  const parsed = internationalPhone(value);
  return parsed.e164 || value;
}

export function selectedContactRows(contacts) {
  return (Array.isArray(contacts) ? contacts : []).map(contact => ({
    name: String(Array.isArray(contact.name) ? contact.name[0] || '' : contact.name || '').trim(),
    numbers: (Array.isArray(contact.tel) ? contact.tel : []).map(value => String(value || '').trim()).filter(Boolean)
  }));
}

export function startPickerSelection(setPending) {
  setPending([]);
}

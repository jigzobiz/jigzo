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

let selectionBatchSequence = 0;
export function nextContactSelectionBatchId() {
  return ++selectionBatchSequence;
}

export function partitionContactSelection(contacts, batchId) {
  const immediate = [];
  const pending = [];
  selectedContactRows(contacts).forEach((row, selectionOrder) => {
    const entry = { name: row.name, batchId, selectionOrder };
    if (row.numbers.length <= 1) immediate.push({ ...entry, phone: row.numbers[0] || '' });
    else pending.push({ ...entry, numbers: row.numbers, choice: '' });
  });
  return { immediate, pending };
}

export function mergeContactRecipients(recipients, selected) {
  const next = [...recipients];
  const useEmptyFirst = next.length === 1 && !next[0].name.trim() && !next[0].phone.trim();
  const existing = new Set(next.filter((_, i) => !(useEmptyFirst && i === 0))
    .filter(row => row.deliveryMethod !== 'email' && (row.phone || row.dial))
    .map(row => recipientPhoneIdentity(row.dial, row.phone)));
  let added = 0;
  let duplicates = 0;
  let overLimit = 0;
  for (const contact of selected) {
    const parsed = internationalPhone(contact.phone);
    const identity = parsed.e164 || parsed.raw;
    if (identity && existing.has(identity)) { duplicates++; continue; }
    if (next.length >= 50 && !(useEmptyFirst && added === 0)) { overLimit++; continue; }
    const row = { name: contact.name || '', phone: parsed.national, dial: parsed.dial,
      dialEdited: true, deliveryMethod: 'whatsapp', email: '', fromContact: true,
      contactBatchId: contact.batchId, contactSelectionOrder: contact.selectionOrder };
    if (useEmptyFirst && added === 0) next[0] = row;
    else {
      const later = next.findIndex(item => item.contactBatchId === contact.batchId &&
        item.contactSelectionOrder > contact.selectionOrder);
      if (later < 0) next.push(row);
      else next.splice(later, 0, row);
    }
    if (identity) existing.add(identity);
    added++;
  }
  return { recipients: next, added, duplicates, overLimit };
}

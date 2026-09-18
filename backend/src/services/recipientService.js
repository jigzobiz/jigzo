const { v4: uuidv4 } = require('uuid');
const { validateEmail, validatePhone } = require('../utils/contactValidation');
const { encryptText, decryptText, keyedHash } = require('../utils/businessSecurity');
const CampaignRecipient = require('../models/CampaignRecipient');

const MAX_RECIPIENTS = 2000; const MAX_CELL = 3000;
const stripUnsafe = value => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\u061c\ufeff]/g, '').trim();
const safeExternalRef = value => { const clean = stripUnsafe(value); return clean || null; };
function maskContact(channel, value) { if (channel === 'email') { const [name, domain] = value.split('@'); return `${name.slice(0, 2)}***@${domain}`; } return `${value.slice(0, 4)} •••• ${value.slice(-3)}`; }
function normalizeRecipient(input, defaultLanguage = 'en') {
  const displayName = stripUnsafe(input.name ?? input.displayName); const deliveryChannel = stripUnsafe(input.contact_method ?? input.delivery_channel ?? input.contactMethod ?? input.deliveryChannel).toLowerCase();
  const language = (stripUnsafe(input.language) || defaultLanguage).toLowerCase(); const externalRef = safeExternalRef(input.recipient_ref ?? input.externalRef);
  const errors = []; if (!displayName || displayName.length > 160) errors.push('invalid_name'); if (!['email', 'whatsapp'].includes(deliveryChannel)) errors.push('invalid_delivery_channel'); if (!['en', 'ar'].includes(language)) errors.push('invalid_language'); if (externalRef?.length > 120) errors.push('invalid_recipient_ref');
  let normalizedContact = null;
  if (deliveryChannel === 'email') { const result = validateEmail(input.contact ?? input.email); if (!result.valid) errors.push('invalid_email'); else normalizedContact = result.email; }
  if (deliveryChannel === 'whatsapp') { const result = validatePhone(input.contact ?? input.phone, input.contact == null ? input.country_code ?? input.countryCode : undefined); if (!result.valid) errors.push('invalid_phone'); else normalizedContact = result.e164; }
  const rawPlusOne = stripUnsafe(input.plus_one_override ?? input.allow_plus_one ?? input.plusOneOverride).toLowerCase(); let plusOneOverride = 'inherit';
  if (['on', 'true', 'yes', '1', 'allowed', 'allow'].includes(rawPlusOne)) plusOneOverride = 'allowed'; else if (['off', 'false', 'no', '0', 'not_allowed', 'disallow'].includes(rawPlusOne)) plusOneOverride = 'not_allowed'; else if (rawPlusOne && rawPlusOne !== 'inherit') errors.push('invalid_plus_one');
  const invitationMessageOverride = '';
  if (Object.values(input).some(value => String(value ?? '').length > MAX_CELL)) errors.push('cell_too_long');
  const contactHash = normalizedContact ? keyedHash(`recipient:${deliveryChannel}:${normalizedContact}`) : null;
  return { displayName, deliveryChannel, language, externalRef, plusOneOverride, invitationMessageOverride, normalizedContact, contactHash, maskedContact: normalizedContact ? maskContact(deliveryChannel, normalizedContact) : '', errors: [...new Set(errors)] };
}
function persistedRecipient(normalized, context) { return { recipientId: uuidv4(), organizationId: context.organizationId, campaignId: context.campaignId, source: context.source, importId: context.importId || null, importRowNumber: context.rowNumber || null, externalRef: normalized.externalRef, displayName: normalized.displayName, language: normalized.language, deliveryChannel: normalized.deliveryChannel, contactEncrypted: encryptText(normalized.normalizedContact), contactHash: normalized.contactHash, maskedContact: normalized.maskedContact, plusOneOverride: normalized.plusOneOverride, invitationMessageOverride: normalized.invitationMessageOverride, state: 'ready' }; }
function serializeRecipient(value, includeContact = false) { const row = value.toObject ? value.toObject() : value; const result = { recipientId: row.recipientId, source: row.source, importRowNumber: row.importRowNumber, externalRef: row.externalRef, displayName: row.displayName, language: row.language, deliveryChannel: row.deliveryChannel, maskedContact: row.maskedContact, plusOneOverride: row.plusOneOverride, invitationMessageOverride: row.invitationMessageOverride, state: row.state, createdAt: row.createdAt, updatedAt: row.updatedAt }; if (includeContact && row.contactEncrypted) result.contact = decryptText(row.contactEncrypted); return result; }
async function assertNoDuplicate({ Model = CampaignRecipient, organizationId, campaignId, contactHash, externalRef, excludeRecipientId }) { const base = { organizationId, campaignId, ...(excludeRecipientId ? { recipientId: { $ne: excludeRecipientId } } : {}) }; if (await Model.exists({ ...base, contactHash })) throw Object.assign(new Error('A recipient with this contact already exists.'), { statusCode: 409, code: 'DUPLICATE_CONTACT' }); if (externalRef && await Model.exists({ ...base, externalRef })) throw Object.assign(new Error('A recipient with this reference already exists.'), { statusCode: 409, code: 'DUPLICATE_EXTERNAL_REF' }); }
module.exports = { MAX_RECIPIENTS, MAX_CELL, stripUnsafe, maskContact, normalizeRecipient, persistedRecipient, serializeRecipient, assertNoDuplicate };

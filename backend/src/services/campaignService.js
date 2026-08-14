const { v4: uuidv4 } = require('uuid');
const Campaign = require('../models/Campaign');

const DIFFICULTIES = new Set(['extra_easy', 'easy', 'classic', 'challenging']);
const editablePaths = new Set(['name', 'puzzle.imageAssetId', 'puzzle.difficultyId', 'puzzle.mysteryMode', 'invitation.eventTitle', 'invitation.eventDateTime', 'invitation.timezone', 'invitation.location', 'invitation.rsvpDeadline', 'invitation.message', 'invitation.rsvpEnabled', 'invitation.allowPlusOneDefault', 'deliveryDefault', 'expiresAt']);

function flattenPatch(input, prefix = '', output = {}) {
  for (const [key, value] of Object.entries(input || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) flattenPatch(value, path, output); else output[path] = value;
  }
  return output;
}
function sanitizePatch(input) {
  const flat = flattenPatch(input); const rejected = Object.keys(flat).filter(path => !editablePaths.has(path));
  if (rejected.length) { const error = new Error('Campaign patch contains unsupported fields.'); error.statusCode = 400; error.code = 'CAMPAIGN_PATCH_NOT_ALLOWED'; throw error; }
  if (flat['puzzle.difficultyId'] && !DIFFICULTIES.has(flat['puzzle.difficultyId'])) throw Object.assign(new Error('Unsupported puzzle difficulty.'), { statusCode: 400 });
  if (flat.deliveryDefault && !['whatsapp', 'email'].includes(flat.deliveryDefault)) throw Object.assign(new Error('Unsupported delivery choice.'), { statusCode: 400 });
  return flat;
}
function validateCampaign(campaign) {
  const errors = [];
  if (!String(campaign.name || '').trim()) errors.push({ field: 'name', code: 'required' });
  const invitation = campaign.invitation || {};
  for (const field of ['eventTitle', 'eventDateTime', 'timezone', 'location', 'rsvpDeadline', 'message']) if (!invitation[field]) errors.push({ field: `invitation.${field}`, code: 'required' });
  if (invitation.eventDateTime && invitation.rsvpDeadline && new Date(invitation.rsvpDeadline) > new Date(invitation.eventDateTime)) errors.push({ field: 'invitation.rsvpDeadline', code: 'must_precede_event' });
  if (campaign.expiresAt && invitation.rsvpDeadline && new Date(campaign.expiresAt) < new Date(invitation.rsvpDeadline)) errors.push({ field: 'expiresAt', code: 'must_follow_rsvp_deadline' });
  return { valid: errors.length === 0, errors };
}
function serializeCampaign(c) {
  const value = c.toObject ? c.toObject() : c;
  return { campaignId: value.campaignId, name: value.name, experienceType: value.experienceType, status: value.status, revision: value.revision, puzzle: value.puzzle, invitation: value.invitation, deliveryDefault: value.deliveryDefault, expiresAt: value.expiresAt, createdAt: value.createdAt, updatedAt: value.updatedAt };
}
const tenantCampaignFilter = (organizationId, campaignId, revision) => ({ campaignId, organizationId, ...(revision === undefined ? {} : { revision }) });
const classifyCampaignMiss = existsInTenant => existsInTenant ? { status: 409, code: 'CAMPAIGN_REVISION_CONFLICT' } : { status: 404, code: 'CAMPAIGN_NOT_FOUND' };
async function createDraft({ organizationId, identityId, body = {}, Model = Campaign }) {
  const patch = sanitizePatch(body); const campaign = await Model.create({ campaignId: uuidv4(), organizationId, createdBy: identityId, ...Object.fromEntries(Object.entries(patch).filter(([key]) => !key.includes('.'))) });
  if (Object.keys(patch).some(key => key.includes('.'))) { for (const [path, value] of Object.entries(patch)) if (path.includes('.')) campaign.set(path, value); await campaign.save(); }
  return campaign;
}
module.exports = { editablePaths, flattenPatch, sanitizePatch, validateCampaign, serializeCampaign, createDraft, tenantCampaignFilter, classifyCampaignMiss };

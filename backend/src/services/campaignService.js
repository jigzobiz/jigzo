const { v4: uuidv4 } = require('uuid');
const Campaign = require('../models/Campaign');
const CampaignRecipient = require('../models/CampaignRecipient');
const CampaignDelivery = require('../models/CampaignDelivery');

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
  return { campaignId: value.campaignId, name: value.name, experienceType: value.experienceType, status: value.status, revision: value.revision, puzzle: value.puzzle, invitation: value.invitation, deliveryDefault: value.deliveryDefault, expiresAt: value.expiresAt, scheduledSendAt: value.scheduledSendAt || null, createdAt: value.createdAt, updatedAt: value.updatedAt };
}
const tenantCampaignFilter = (organizationId, campaignId, revision) => ({ campaignId, organizationId, ...(revision === undefined ? {} : { revision }) });
const classifyCampaignMiss = existsInTenant => existsInTenant ? { status: 409, code: 'CAMPAIGN_REVISION_CONFLICT' } : { status: 404, code: 'CAMPAIGN_NOT_FOUND' };
async function createDraft({ organizationId, identityId, body = {}, Model = Campaign }) {
  const patch = sanitizePatch(body); const campaign = await Model.create({ campaignId: uuidv4(), organizationId, createdBy: identityId, ...Object.fromEntries(Object.entries(patch).filter(([key]) => !key.includes('.'))) });
  if (Object.keys(patch).some(key => key.includes('.'))) { for (const [path, value] of Object.entries(patch)) if (path.includes('.')) campaign.set(path, value); await campaign.save(); }
  return campaign;
}
const ZERO_RECIPIENT_STATS = { total: 0, opened: 0, solved: 0, going: 0, notGoing: 0, rsvpPending: 0 };
const ZERO_DELIVERY_STATS = { total: 0, sent: 0, failed: 0 };
const SENT_STATUSES = ['accepted', 'sent', 'delivered', 'opened', 'read'];
const FAILED_STATUSES = ['failed', 'bounced', 'complained'];

function mergeCampaignSummaries(campaigns, recipientStats, deliveryStats) {
  const recipientById = Object.fromEntries((recipientStats || []).map(row => [String(row._id), row]));
  const deliveryById = Object.fromEntries((deliveryStats || []).map(row => [String(row._id), row]));
  return campaigns.map(c => {
    const recipients = recipientById[String(c._id)] || ZERO_RECIPIENT_STATS;
    const delivery = deliveryById[String(c._id)] || ZERO_DELIVERY_STATS;
    return {
      campaignId: c.campaignId, name: c.name, status: c.status, revision: c.revision, scheduledSendAt: c.scheduledSendAt || null,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
      invitation: { eventTitle: c.invitation?.eventTitle || '', eventDateTime: c.invitation?.eventDateTime || null, location: c.invitation?.location || '', timezone: c.invitation?.timezone || '' },
      puzzle: { difficultyId: c.puzzle?.difficultyId || 'classic', hasImage: Boolean(c.puzzle?.puzzleId) },
      recipients: { total: recipients.total, opened: recipients.opened, solved: recipients.solved, going: recipients.going, notGoing: recipients.notGoing, rsvpPending: recipients.rsvpPending },
      delivery: { total: delivery.total, sent: delivery.sent, failed: delivery.failed }
    };
  });
}

async function listCampaigns({ organizationId, CampaignModel = Campaign, RecipientModel = CampaignRecipient, DeliveryModel = CampaignDelivery }) {
  const campaigns = await CampaignModel.find({ organizationId }).sort({ updatedAt: -1 }).lean();
  if (!campaigns.length) return [];
  const campaignObjectIds = campaigns.map(c => c._id);
  const [recipientStats, deliveryStats] = await Promise.all([
    RecipientModel.aggregate([
      { $match: { organizationId, campaignId: { $in: campaignObjectIds } } },
      { $group: { _id: '$campaignId', total: { $sum: 1 }, opened: { $sum: { $cond: [{ $ne: ['$firstOpenedAt', null] }, 1, 0] } }, solved: { $sum: { $cond: [{ $ne: ['$firstSolvedAt', null] }, 1, 0] } }, going: { $sum: { $cond: [{ $eq: ['$rsvpStatus', 'going'] }, 1, 0] } }, notGoing: { $sum: { $cond: [{ $eq: ['$rsvpStatus', 'not_going'] }, 1, 0] } }, rsvpPending: { $sum: { $cond: [{ $eq: ['$rsvpStatus', 'pending'] }, 1, 0] } } } }
    ]),
    DeliveryModel.aggregate([
      { $match: { organizationId, campaignId: { $in: campaignObjectIds }, purpose: 'launch' } },
      { $group: { _id: '$campaignId', total: { $sum: 1 }, sent: { $sum: { $cond: [{ $in: ['$status', SENT_STATUSES] }, 1, 0] } }, failed: { $sum: { $cond: [{ $in: ['$status', FAILED_STATUSES] }, 1, 0] } } } }
    ])
  ]);
  return mergeCampaignSummaries(campaigns, recipientStats, deliveryStats);
}

module.exports = { editablePaths, flattenPatch, sanitizePatch, validateCampaign, serializeCampaign, createDraft, tenantCampaignFilter, classifyCampaignMiss, listCampaigns, mergeCampaignSummaries };

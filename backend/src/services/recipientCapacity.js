const Campaign = require('../models/Campaign');
const CampaignRecipient = require('../models/CampaignRecipient');
const { MAX_RECIPIENTS } = require('./recipientService');

function recipientLimitError() {
  return Object.assign(new Error('Campaign recipient limit reached.'), { statusCode: 409, code: 'RECIPIENT_LIMIT' });
}

async function reserveRecipientCapacity({ campaignId, organizationId, amount, Models = {} }) {
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_RECIPIENTS) throw recipientLimitError();
  if (!amount) return;
  const CampaignModel = Models.Campaign || Campaign;
  const RecipientModel = Models.CampaignRecipient || CampaignRecipient;
  // The compare-and-set initializes historical campaigns once. Every recipient
  // writer must pass through this reservation before inserting real recipients.
  const existing = await RecipientModel.countDocuments({ organizationId, campaignId, source: { $ne: 'test' } });
  await CampaignModel.findOneAndUpdate(
    { _id: campaignId, organizationId, recipientSlotsUsed: { $exists: false } },
    { $set: { recipientSlotsUsed: existing } }
  );
  const reserved = await CampaignModel.findOneAndUpdate(
    { _id: campaignId, organizationId, recipientSlotsUsed: { $lte: MAX_RECIPIENTS - amount } },
    { $inc: { recipientSlotsUsed: amount } }
  );
  if (!reserved) throw recipientLimitError();
}

async function releaseRecipientCapacity({ campaignId, organizationId, amount, Models = {} }) {
  if (!amount) return;
  const CampaignModel = Models.Campaign || Campaign;
  await CampaignModel.updateOne(
    { _id: campaignId, organizationId, recipientSlotsUsed: { $gte: amount } },
    { $inc: { recipientSlotsUsed: -amount } }
  );
}

module.exports = { reserveRecipientCapacity, releaseRecipientCapacity, recipientLimitError };

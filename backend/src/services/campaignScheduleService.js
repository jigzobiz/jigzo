const Campaign = require('../models/Campaign');
const { createLaunchWork } = require('./campaignLaunchService');

async function promoteDueCampaigns({ now = new Date(), CampaignModel = Campaign, createLaunchWorkFn = createLaunchWork } = {}) {
  const due = await CampaignModel.find({ status: 'scheduled', scheduledSendAt: { $lte: now } }).select('campaignId organizationId').lean();
  let promoted = 0;
  for (const c of due) {
    try { await createLaunchWorkFn({ organizationId: c.organizationId, campaignId: c.campaignId }); promoted++; }
    catch (e) { if (e.code !== 11000) throw e; }
  }
  return { promoted, due: due.length };
}

module.exports = { promoteDueCampaigns };

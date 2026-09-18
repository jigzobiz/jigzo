const express = require('express');
const Campaign = require('../models/Campaign');
const { requireBusinessAuth, requireBusinessCsrf } = require('../middleware/businessAuth');
const { sanitizePatch, validateCampaign, serializeCampaign, createDraft, tenantCampaignFilter, classifyCampaignMiss, listCampaigns } = require('../services/campaignService');

const router = express.Router();
router.use(requireBusinessAuth);

router.get('/', async (req, res, next) => {
  try { const campaigns = await listCampaigns({ organizationId: req.business.organizationId }); return res.json({ success: true, campaigns }); } catch (error) { return next(error); }
});
router.post('/', requireBusinessCsrf, async (req, res, next) => {
  try { const campaign = await createDraft({ organizationId: req.business.organizationId, identityId: req.business.identity._id, body: req.body }); return res.status(201).json({ success: true, campaign: serializeCampaign(campaign) }); } catch (error) { return next(error); }
});
router.get('/:campaignId', async (req, res, next) => {
  try { const campaign = await Campaign.findOne(tenantCampaignFilter(req.business.organizationId, req.params.campaignId)); if (!campaign) return res.status(404).json({ error: 'Campaign not found.' }); return res.json({ success: true, campaign: serializeCampaign(campaign) }); } catch (error) { return next(error); }
});
router.patch('/:campaignId', requireBusinessCsrf, async (req, res, next) => {
  try {
    const revision = Number(req.body?.revision); if (!Number.isInteger(revision) || revision < 1) return res.status(400).json({ error: 'A valid campaign revision is required.' });
    const { revision: ignored, ...candidate } = req.body || {}; const set = sanitizePatch(candidate);
    const tenantFilter = tenantCampaignFilter(req.business.organizationId, req.params.campaignId);
    const campaign = await Campaign.findOneAndUpdate({ ...tenantFilter, revision }, { $set: set, $inc: { revision: 1 } }, { new: true, runValidators: true });
    if (!campaign) { const miss = classifyCampaignMiss(await Campaign.exists(tenantFilter)); if (miss.status === 409) return res.status(409).json({ error: 'Campaign changed in another session.', code: miss.code }); return res.status(404).json({ error: 'Campaign not found.' }); }
    return res.json({ success: true, campaign: serializeCampaign(campaign) });
  } catch (error) { return next(error); }
});
router.post('/:campaignId/validate', requireBusinessCsrf, async (req, res, next) => {
  try { const campaign = await Campaign.findOne(tenantCampaignFilter(req.business.organizationId, req.params.campaignId)); if (!campaign) return res.status(404).json({ error: 'Campaign not found.' }); return res.json({ success: true, ...validateCampaign(campaign) }); } catch (error) { return next(error); }
});
router.delete('/:campaignId', requireBusinessCsrf, async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne(tenantCampaignFilter(req.business.organizationId, req.params.campaignId));
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status !== 'draft') return res.status(409).json({ error: 'Only draft campaigns can be deleted.', code: 'CAMPAIGN_NOT_DRAFT' });
    await Campaign.deleteOne({ _id: campaign._id });
    return res.json({ success: true });
  } catch (error) { return next(error); }
});
module.exports = router;

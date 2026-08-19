const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '../', file), 'utf8');

const { mergeCampaignSummaries, listCampaigns } = require('../src/services/campaignService');

test('campaign summaries merge recipient and delivery stats by ObjectId, not the public campaignId', () => {
  const campaigns = [
    { _id: 'oid-1', campaignId: 'public-uuid-1', name: 'A', status: 'draft', revision: 1, invitation: { eventTitle: 'Launch' }, puzzle: { difficultyId: 'classic', puzzleId: 'p1' } },
    { _id: 'oid-2', campaignId: 'public-uuid-2', name: 'B', status: 'active', revision: 3, invitation: {}, puzzle: {} }
  ];
  const recipientStats = [{ _id: 'oid-1', total: 10, opened: 8, solved: 6, going: 5, notGoing: 1, rsvpPending: 4 }];
  const deliveryStats = [{ _id: 'oid-1', total: 10, sent: 9, failed: 1 }];
  const rows = mergeCampaignSummaries(campaigns, recipientStats, deliveryStats);
  assert.equal(rows[0].campaignId, 'public-uuid-1');
  assert.equal(rows[0].recipients.total, 10);
  assert.equal(rows[0].delivery.sent, 9);
  assert.equal(rows[0].puzzle.hasImage, true);
  // A campaign with no matching stat rows (e.g. never had recipients) must not throw and must report zeros, not undefined.
  assert.deepEqual(rows[1].recipients, { total: 0, opened: 0, solved: 0, going: 0, notGoing: 0, rsvpPending: 0 });
  assert.deepEqual(rows[1].delivery, { total: 0, sent: 0, failed: 0 });
  assert.equal(rows[1].puzzle.hasImage, false);
});

test('campaign list is tenant scoped end to end with no full-recipient-document fetch', async () => {
  let recipientMatch; let deliveryMatch; let campaignFilter;
  const CampaignModel = { find: filter => { campaignFilter = filter; return { sort: () => ({ lean: async () => [{ _id: 'oid-1', campaignId: 'uuid-1', name: 'A', status: 'draft', revision: 1, invitation: {}, puzzle: {} }] }) }; } };
  const RecipientModel = { aggregate: async pipeline => { recipientMatch = pipeline[0].$match; return []; } };
  const DeliveryModel = { aggregate: async pipeline => { deliveryMatch = pipeline[0].$match; return []; } };
  const rows = await listCampaigns({ organizationId: 'org-a', CampaignModel, RecipientModel, DeliveryModel });
  assert.deepEqual(campaignFilter, { organizationId: 'org-a' });
  assert.equal(recipientMatch.organizationId, 'org-a');
  assert.equal(deliveryMatch.organizationId, 'org-a');
  assert.equal(deliveryMatch.purpose, 'launch');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].campaignId, 'uuid-1');
});

test('campaign list skips aggregation entirely when the tenant has no campaigns', async () => {
  let recipientCalled = false;
  const CampaignModel = { find: () => ({ sort: () => ({ lean: async () => [] }) }) };
  const RecipientModel = { aggregate: async () => { recipientCalled = true; return []; } };
  const DeliveryModel = { aggregate: async () => [] };
  const rows = await listCampaigns({ organizationId: 'org-a', CampaignModel, RecipientModel, DeliveryModel });
  assert.deepEqual(rows, []);
  assert.equal(recipientCalled, false);
});

test('list and draft-delete routes are tenant scoped and delete is restricted to draft status', () => {
  const s = read('src/routes/businessCampaigns.js');
  assert.match(s, /router\.get\('\/', async \(req, res, next\) => \{/);
  assert.match(s, /router\.use\(requireBusinessAuth\)/);
  assert.match(s, /router\.delete\('\/:campaignId', requireBusinessCsrf/);
  assert.match(s, /campaign\.status !== 'draft'/);
  assert.match(s, /tenantCampaignFilter\(req\.business\.organizationId, req\.params\.campaignId\)/);
});

test('list aggregation groups by the ObjectId campaignId ref, not the public campaignId string', () => {
  const s = read('src/services/campaignService.js');
  assert.match(s, /\$group: \{ _id: '\$campaignId'/);
  assert.match(s, /purpose: 'launch'/);
});

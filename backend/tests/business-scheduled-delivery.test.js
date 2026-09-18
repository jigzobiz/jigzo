const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const read = file => fs.readFileSync(path.resolve(__dirname, '../', file), 'utf8');

const Campaign = require('../src/models/Campaign');
const { promoteDueCampaigns } = require('../src/services/campaignScheduleService');
const { serializeCampaign, mergeCampaignSummaries } = require('../src/services/campaignService');

function baseCampaignDoc(overrides = {}) {
  return new Campaign({
    campaignId: 'uuid-1',
    organizationId: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides
  });
}

test('Campaign status enum properly declares scheduled and sending (no validateOn-updateOne quirk needed)', () => {
  assert.equal(baseCampaignDoc({ status: 'scheduled' }).validateSync(), undefined);
  assert.equal(baseCampaignDoc({ status: 'sending' }).validateSync(), undefined);
  const invalid = baseCampaignDoc({ status: 'not-a-real-status' }).validateSync();
  assert.ok(invalid, 'an unknown status must still fail validation');
});

test('scheduledSendAt is a real schema field, defaulting to null', () => {
  const doc = baseCampaignDoc();
  assert.equal(doc.scheduledSendAt, null);
  assert.match(read('src/models/Campaign.js'), /scheduledSendAt: \{ type: Date, default: null, index: true \}/);
});

test('serializeCampaign and mergeCampaignSummaries expose scheduledSendAt', () => {
  const doc = baseCampaignDoc({ status: 'scheduled', scheduledSendAt: new Date('2026-12-01T10:00:00.000Z') });
  assert.equal(serializeCampaign(doc).scheduledSendAt.toISOString(), '2026-12-01T10:00:00.000Z');
  const rows = mergeCampaignSummaries([{ _id: 'oid-1', campaignId: 'uuid-1', name: 'A', status: 'scheduled', revision: 1, invitation: {}, puzzle: {}, scheduledSendAt: new Date('2026-12-01T10:00:00.000Z') }], [], []);
  assert.equal(rows[0].scheduledSendAt.toISOString(), '2026-12-01T10:00:00.000Z');
});

test('schedule route validates readiness, future time, expiry and RSVP ordering, and is tenant scoped + CSRF protected', () => {
  const s = read('src/routes/businessDeliveries.js');
  assert.match(s, /router\.post\('\/:campaignId\/schedule',requireBusinessCsrf/);
  assert.match(s, /validateLaunch\(\{organizationId:req\.business\.organizationId,campaignId:req\.params\.campaignId\}\)/);
  assert.match(s, /SCHEDULE_IN_PAST/);
  assert.match(s, /SCHEDULE_AFTER_EXPIRY/);
  assert.match(s, /SCHEDULE_AFTER_RSVP/);
  assert.match(s, /status:\{\$in:\['draft','ready','scheduled'\]\}/);
});

test('launch route accepts a previously scheduled campaign and clears its schedule on immediate send', () => {
  const s = read('src/routes/businessDeliveries.js');
  assert.match(s, /status:\{\$in:\['draft','scheduled'\]\}\},\{\$set:\{status:'ready',scheduledSendAt:null\}\}/);
});

test('createLaunchWork promotes a scheduled campaign into sending, not just draft/ready', () => {
  assert.match(read('src/services/campaignLaunchService.js'), /status:\{\$in:\['draft','ready','scheduled','sending'\]\}/);
});

test('promoteDueCampaigns only promotes campaigns whose scheduledSendAt is due, and tolerates a duplicate-key race like the manual launch route already does', async () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const due = [{ campaignId: 'due-1', organizationId: 'org-a' }];
  const CampaignModel = { find: filter => { assert.deepEqual(filter, { status: 'scheduled', scheduledSendAt: { $lte: now } }); return { select: () => ({ lean: async () => due }) }; } };
  const calls = [];
  const createLaunchWorkFn = async ({ organizationId, campaignId }) => { calls.push({ organizationId, campaignId }); return { queued: 1 }; };
  const result = await promoteDueCampaigns({ now, CampaignModel, createLaunchWorkFn });
  assert.equal(result.promoted, 1);
  assert.deepEqual(calls, [{ organizationId: 'org-a', campaignId: 'due-1' }]);
});

test('promoteDueCampaigns does not throw and does not double-count when createLaunchWork hits a duplicate key (overlapping cron ticks)', async () => {
  const due = [{ campaignId: 'due-1', organizationId: 'org-a' }];
  const CampaignModel = { find: () => ({ select: () => ({ lean: async () => due }) }) };
  const createLaunchWorkFn = async () => { const e = new Error('dup'); e.code = 11000; throw e; };
  const result = await promoteDueCampaigns({ CampaignModel, createLaunchWorkFn });
  assert.equal(result.promoted, 0);
  assert.equal(result.due, 1);
});

test('promoteDueCampaigns re-throws non-duplicate-key errors instead of silently swallowing them', async () => {
  const due = [{ campaignId: 'due-1', organizationId: 'org-a' }];
  const CampaignModel = { find: () => ({ select: () => ({ lean: async () => due }) }) };
  const createLaunchWorkFn = async () => { throw new Error('boom'); };
  await assert.rejects(() => promoteDueCampaigns({ CampaignModel, createLaunchWorkFn }), /boom/);
});

test('internal cron route promotes due scheduled campaigns before running the delivery batch, still guarded by CRON_SECRET', () => {
  const s = read('src/routes/internal/businessDelivery.js');
  assert.match(s, /promoteDueCampaigns/);
  assert.match(s, /CRON_SECRET/);
  const promoteIndex = s.indexOf('promoteDueCampaigns()');
  const batchIndex = s.indexOf('runDeliveryBatch()');
  assert.ok(promoteIndex > -1 && batchIndex > -1 && promoteIndex < batchIndex, 'campaigns must be promoted before the same tick claims delivery work');
});

test('scheduledSendAt is not part of the generic autosave PATCH allowlist (scheduling has its own validated route)', () => {
  const s = read('src/services/campaignService.js');
  assert.doesNotMatch(s, /'scheduledSendAt'/);
});

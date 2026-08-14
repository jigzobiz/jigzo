const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.BUSINESS_IDENTITY_HASH_SECRET = 'test-business-hash-secret-000000000000';
process.env.BUSINESS_DATA_ENCRYPTION_SECRET = 'test-business-encryption-secret-000000';

const { issueMagicLink, consumeMagicLink, revokeSession } = require('../src/services/businessAuthService');
const { sanitizePatch, tenantCampaignFilter, classifyCampaignMiss } = require('../src/services/campaignService');
const { requireBusinessAuth } = require('../src/middleware/businessAuth');

test('unauthenticated Business campaign access is rejected before database access', async () => {
  let status; let body; const req = { headers: {} }; const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  await requireBusinessAuth(req, res, () => assert.fail('must not continue'));
  assert.equal(status, 401); assert.equal(body.error, 'Authentication required.');
});

test('Organization A cannot read Organization B campaign', () => {
  assert.deepEqual(tenantCampaignFilter('org-a', 'campaign-1'), { campaignId: 'campaign-1', organizationId: 'org-a' });
  assert.notDeepEqual(tenantCampaignFilter('org-a', 'campaign-1'), tenantCampaignFilter('org-b', 'campaign-1'));
});

test('Organization A cannot patch Organization B campaign', () => {
  assert.deepEqual(tenantCampaignFilter('org-b', 'campaign-1', 4), { campaignId: 'campaign-1', organizationId: 'org-b', revision: 4 });
  assert.notDeepEqual(tenantCampaignFilter('org-a', 'campaign-1', 4), tenantCampaignFilter('org-b', 'campaign-1', 4));
});

test('cross-tenant read and patch misses are indistinguishable from absent campaigns', () => {
  assert.deepEqual(classifyCampaignMiss(false), { status: 404, code: 'CAMPAIGN_NOT_FOUND' });
  assert.deepEqual(classifyCampaignMiss(false), classifyCampaignMiss(false));
});

test('campaign patch allowlist rejects ownership, status, recipients and scheduling', () => {
  for (const patch of [{ organizationId: 'org-b' }, { status: 'active' }, { recipients: [] }, { scheduledAt: new Date() }]) assert.throws(() => sanitizePatch(patch), /unsupported fields/);
  assert.deepEqual(sanitizePatch({ name: 'Invite', puzzle: { mysteryMode: true }, deliveryDefault: 'email' }), { name: 'Invite', 'puzzle.mysteryMode': true, deliveryDefault: 'email' });
});

test('stale campaign revision is a clear conflict only after tenant-scoped existence', () => {
  assert.deepEqual(classifyCampaignMiss(true), { status: 409, code: 'CAMPAIGN_REVISION_CONFLICT' });
});

test('magic link stores only a hash and cannot be replayed', async () => {
  let persisted; let delivered; let consumed = false;
  const identity = { _id: 'identity-a', ownedOrganizationId: 'org-a', sessionVersion: 1 };
  const models = {
    BusinessIdentity: { findOne: () => ({ select: async () => identity }), updateOne: async () => ({}) },
    BusinessMagicLink: { create: async value => { persisted = value; }, findOneAndUpdate: async query => { if (consumed) return null; consumed = true; return { identity: identity._id, tokenHash: query.tokenHash }; } },
    Organization: { findOne: async () => ({ _id: 'org-a', organizationId: 'public-org', ownerIdentity: identity._id, status: 'active' }) },
    BusinessSession: { create: async value => ({ _id: 'session-a', ...value }) }
  };
  await issueMagicLink('Owner@Example.com', { models, send: async value => { delivered = value; } });
  assert.ok(delivered.token); assert.notEqual(persisted.tokenHash, delivered.token); assert.equal(JSON.stringify(persisted).includes(delivered.token), false);
  assert.ok(await consumeMagicLink(delivered.token, { models }));
  assert.equal(await consumeMagicLink(delivered.token, { models }), null);
});

test('expired magic links are rejected atomically', async () => {
  const models = { BusinessMagicLink: { findOneAndUpdate: async query => { assert.ok(query.expiresAt.$gt instanceof Date); return null; } } };
  assert.equal(await consumeMagicLink('expired-token-value-that-is-long-enough', { models }), null);
});

test('logout revokes the server session and is retry safe', async () => {
  let filter; let update; const Model = { updateOne: async (f, u) => { filter = f; update = u; return { modifiedCount: 1 }; } };
  await revokeSession('session-a', { Model, now: new Date('2026-01-01T00:00:00Z') });
  assert.deepEqual(filter, { _id: 'session-a', revokedAt: null }); assert.ok(update.$set.revokedAt instanceof Date);
});

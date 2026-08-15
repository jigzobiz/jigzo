const test = require('node:test');
const assert = require('node:assert/strict');
process.env.BUSINESS_IDENTITY_HASH_SECRET = 'test-business-hash-secret-000000000000';
process.env.BUSINESS_DATA_ENCRYPTION_SECRET = 'test-business-encryption-secret-000000';
const {
  OWNER_EMAIL,
  ORGANIZATION_NAME,
  LANGUAGE,
  TIMEZONE,
  bootstrapStagingBusiness
} = require('../src/services/stagingBusinessBootstrap');
const { REQUIRED_SECRETS } = require('../src/utils/stagingSafety');
const { keyedHash } = require('../src/utils/businessSecurity');

function safeStagingEnv() {
  const env = {
    VERCEL_TARGET_ENV: 'staging',
    MONGODB_URI: 'mongodb+srv://user:password@jigzo-staging.example.mongodb.net/jigzo_staging',
    CHECKOUT_ENABLED: 'false',
    WHATSAPP_ENABLED: 'false',
    FRONTEND_URL: 'https://staging.jigzo.biz'
  };
  for (const name of REQUIRED_SECRETS) env[name] = `test-${name}`;
  return env;
}

function models(initial = {}) {
  const identities = [...(initial.identities || [])];
  const organizations = [...(initial.organizations || [])];
  const Identity = {
    countDocuments: async () => identities.length,
    findOne: query => {
      const result = identities.find(item => item.emailHash === query.emailHash) || null;
      return { select: async () => result, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
    },
    create: async value => { const row = { _id: `identity-${identities.length + 1}`, ...value }; identities.push(row); return row; },
    updateOne: async (query, update) => { Object.assign(identities.find(item => item._id === query._id), update.$set); },
    deleteOne: async query => { const index = identities.findIndex(item => item._id === query._id); if (index >= 0) identities.splice(index, 1); }
  };
  const Org = {
    countDocuments: async () => organizations.length,
    findOne: async query => organizations.find(item => item.ownerIdentity === query.ownerIdentity && item.name === query.name && item.defaultLanguage === query.defaultLanguage && item.timezone === query.timezone) || null,
    create: async value => { const row = { _id: `organization-${organizations.length + 1}`, ...value }; organizations.push(row); return row; }
  };
  return { BusinessIdentity: Identity, Organization: Org, identities, organizations };
}

test('bootstrap is unavailable outside staging', async () => {
  await assert.rejects(() => bootstrapStagingBusiness({ env: { VERCEL_TARGET_ENV: 'production' }, models: models() }), error => error.statusCode === 404);
  await assert.rejects(() => bootstrapStagingBusiness({ env: { VERCEL_TARGET_ENV: 'preview' }, models: models() }), error => error.statusCode === 404);
  await assert.rejects(() => bootstrapStagingBusiness({ env: {}, models: models() }), error => error.statusCode === 404);
});

test('bootstrap provisions only the fixed owner and organization and is idempotent', async () => {
  const state = models();
  const first = await bootstrapStagingBusiness({ env: safeStagingEnv(), models: state });
  const second = await bootstrapStagingBusiness({ env: safeStagingEnv(), models: state });
  assert.deepEqual(first, { success: true, created: true, owner: true, organization: true });
  assert.deepEqual(second, { success: true, created: false, owner: true, organization: true });
  assert.equal(state.identities.length, 1);
  assert.equal(state.identities[0].emailHash, keyedHash(OWNER_EMAIL));
  assert.equal(state.organizations.length, 1);
  assert.equal(state.organizations[0].name, ORGANIZATION_NAME);
  assert.equal(state.organizations[0].defaultLanguage, LANGUAGE);
  assert.equal(state.organizations[0].timezone, TIMEZONE);
});

test('bootstrap fails closed on unexpected Business data', async () => {
  const state = models({ identities: [{ _id: 'unexpected', emailHash: 'unexpected' }] });
  await assert.rejects(() => bootstrapStagingBusiness({ env: safeStagingEnv(), models: state }), error => error.code === 'UNEXPECTED_STAGING_BUSINESS_STATE');
});

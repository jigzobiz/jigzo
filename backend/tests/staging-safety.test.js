const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REQUIRED_SECRETS, assertStagingSafety } = require('../src/utils/stagingSafety');
const root = path.resolve(__dirname, '../..');

function stagingEnv(overrides = {}) {
  const env = {
    VERCEL_TARGET_ENV: 'staging',
    MONGODB_URI: 'mongodb+srv://user:password@jigzo-staging.example.mongodb.net/jigzo_staging?retryWrites=true',
    CHECKOUT_ENABLED: 'false',
    WHATSAPP_ENABLED: 'false',
    FRONTEND_URL: 'https://staging.jigzo.biz'
  };
  for (const name of REQUIRED_SECRETS) env[name] = `test-${name}`;
  return { ...env, ...overrides };
}

function quietLogger() {
  return { log() {}, error() {} };
}

test('correct staging configuration passes', () => {
  assert.deepEqual(assertStagingSafety(stagingEnv(), quietLogger()), { executed: true, passed: true });
});

test('wrong staging database fails closed', () => {
  assert.throws(
    () => assertStagingSafety(stagingEnv({ MONGODB_URI: 'mongodb+srv://user:password@jigzo-staging.example.mongodb.net/jigzo_prod' }), quietLogger()),
    error => error.code === 'STAGING_SAFETY_CHECK_FAILED' && error.failedAssertions.includes('MONGO_DATABASE')
  );
});

test('wrong Mongo host fails closed', () => {
  assert.throws(
    () => assertStagingSafety(stagingEnv({ MONGODB_URI: 'mongodb+srv://user:password@production.example.mongodb.net/jigzo_staging' }), quietLogger()),
    error => error.code === 'STAGING_SAFETY_CHECK_FAILED' && error.failedAssertions.includes('MONGO_HOST')
  );
});

test('checkout true fails closed', () => {
  assert.throws(
    () => assertStagingSafety(stagingEnv({ CHECKOUT_ENABLED: 'true' }), quietLogger()),
    error => error.code === 'STAGING_SAFETY_CHECK_FAILED' && error.failedAssertions.includes('CHECKOUT_DISABLED')
  );
});

test('WhatsApp true fails closed', () => {
  assert.throws(
    () => assertStagingSafety(stagingEnv({ WHATSAPP_ENABLED: 'true' }), quietLogger()),
    error => error.code === 'STAGING_SAFETY_CHECK_FAILED' && error.failedAssertions.includes('WHATSAPP_DISABLED')
  );
});

test('Production does not execute the staging guard', () => {
  let logged = false;
  const result = assertStagingSafety({ VERCEL_TARGET_ENV: 'production' }, { log() { logged = true; }, error() { logged = true; } });
  assert.deepEqual(result, { executed: false });
  assert.equal(logged, false);
});

test('database cache reuses only a connected Mongoose connection', () => {
  const source = fs.readFileSync(path.join(root, 'backend/src/config/database.js'), 'utf8');
  assert.match(source, /cached\.connection && mongoose\.connection\.readyState === 1/);
  assert.match(source, /cached\.connection = null;[\s\S]*cached\.promise = null;/);
});

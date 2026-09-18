const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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

function previewEnv(overrides = {}) {
  return {
    VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
    MONGODB_URI: 'mongodb+srv://preview:synthetic@jigzo-staging.example.mongodb.net/jigzo_staging',
    PREVIEW_MONGODB_HOST: 'jigzo-staging.example.mongodb.net',
    CHECKOUT_ENABLED: 'false', WHATSAPP_ENABLED: 'false', TAP_MODE: 'test',
    ...overrides
  };
}

function previewFailure(overrides, assertion) {
  assert.throws(() => assertStagingSafety(previewEnv(overrides), quietLogger()),
    error => error.code === 'PREVIEW_SAFETY_CHECK_FAILED' && error.failedAssertions.includes(assertion));
}

test('safe isolated normal Preview passes without custom staging target', () => {
  assert.deepEqual(assertStagingSafety(previewEnv(), quietLogger()), { executed: true, passed: true });
});

test('Preview rejects production Mongo host, database, and unapproved host before startup', () => {
  previewFailure({ MONGODB_URI: 'mongodb+srv://user:pass@jigzo-production.example.mongodb.net/jigzo', PREVIEW_MONGODB_HOST: 'jigzo-production.example.mongodb.net' }, 'MONGO_HOST');
  previewFailure({ MONGODB_URI: 'mongodb+srv://user:pass@jigzo-staging.example.mongodb.net/jigzo' }, 'MONGO_DATABASE');
  previewFailure({ MONGODB_URI: 'mongodb+srv://user:pass@jigzo-staging.example.mongodb.net/jigzo_staging?dbName=jigzo_prod' }, 'MONGO_DATABASE');
  previewFailure({ PREVIEW_MONGODB_HOST: undefined }, 'MONGO_HOST');
  previewFailure({ PREVIEW_MONGODB_HOST: 'jigzo-staging.other.mongodb.net' }, 'MONGO_HOST');
  const started = spawnSync(process.execPath, ['-e', "require('./src/server')"], {
    cwd: path.join(root, 'backend'), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, ...previewEnv({ MONGODB_URI: 'mongodb+srv://user:pass@jigzo-production.example.mongodb.net/jigzo' }) }
  });
  assert.notEqual(started.status, 0);
  assert.match(started.stderr, /PREVIEW_SAFETY_CHECK FAIL: MONGO_HOST,MONGO_DATABASE/);
});

test('Preview rejects enabled checkout, WhatsApp, and live/provider credentials', () => {
  previewFailure({ CHECKOUT_ENABLED: 'true' }, 'CHECKOUT_DISABLED');
  previewFailure({ WHATSAPP_ENABLED: 'true' }, 'WHATSAPP_DISABLED');
  previewFailure({ TAP_MODE: 'live' }, 'TAP_CREDENTIALS_ABSENT');
  previewFailure({ TAP_SECRET_KEY: 'sk_live_example' }, 'TAP_CREDENTIALS_ABSENT');
  previewFailure({ TAP_MERCHANT_ID: 'production-merchant' }, 'TAP_CREDENTIALS_ABSENT');
  previewFailure({ KAPSO_API_KEY: 'production-key' }, 'KAPSO_CREDENTIALS_ABSENT');
  previewFailure({ KAPSO_PHONE_NUMBER_ID: 'production-number' }, 'KAPSO_CREDENTIALS_ABSENT');
  previewFailure({ KAPSO_WEBHOOK_SECRET: 'production-webhook' }, 'KAPSO_CREDENTIALS_ABSENT');
  previewFailure({ CRON_SECRET: 'production-cron' }, 'CRON_SECRET_ABSENT');
});

test('Preview rejects production frontend/API origins and unsafe email configuration', () => {
  previewFailure({ FRONTEND_URL: 'https://jigzo.biz' }, 'FRONTEND_ORIGIN_LOCAL');
  previewFailure({ VITE_API_URL: 'https://jigzo.biz' }, 'API_ORIGIN_LOCAL');
  previewFailure({ RESEND_API_KEY: 'production-key' }, 'EMAIL_REDIRECT_SAFE');
  assert.deepEqual(assertStagingSafety(previewEnv({ RESEND_API_KEY: 'test-key', STAGING_EMAIL_REDIRECT: 'qa@example.test' }), quietLogger()), { executed: true, passed: true });
});

test('Preview Business delivery endpoint refuses execution even with the correct cron secret', async () => {
  const router = require('../src/routes/internal/businessDelivery');
  const handle = router.stack.find(layer => layer.route?.path === '/')?.route.stack[0].handle;
  const oldEnv = process.env.VERCEL_ENV; const oldSecret = process.env.CRON_SECRET;
  process.env.VERCEL_ENV = 'preview'; process.env.CRON_SECRET = 'production-cron';
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await handle({ get: () => 'Bearer production-cron' }, res, error => { throw error; });
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /disabled in Preview/);
  } finally {
    if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
    if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret;
  }
});

test('Production and dedicated custom staging retain their existing guard behavior', () => {
  assert.deepEqual(assertStagingSafety({ VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production', CHECKOUT_ENABLED: 'true', WHATSAPP_ENABLED: 'true' }, quietLogger()), { executed: false });
  assert.deepEqual(assertStagingSafety(stagingEnv({ VERCEL_ENV: 'preview' }), quietLogger()), { executed: true, passed: true });
});

test('database cache reuses only a connected Mongoose connection', () => {
  const source = fs.readFileSync(path.join(root, 'backend/src/config/database.js'), 'utf8');
  assert.match(source, /cached\.connection && mongoose\.connection\.readyState === 1/);
  assert.match(source, /cached\.connection = null;[\s\S]*cached\.promise = null;/);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { isTestModeAllowed } = require('../src/utils/testModeGuard');
const { businessCookiePath } = require('../src/utils/businessSecurity');

function syntheticMongoUri({ database = 'jigzo_staging', validHost = true } = {}) {
  const host = validHost
    ? ['jigzo-staging.unit-test.', 'mongodb.net'].join('')
    : 'unit-test-host.invalid';
  const uri = new URL(`mongodb+srv://${host}/${database}`);
  uri.username = 'synthetic-test-user';
  uri.password = 'not-a-secret';
  return uri.toString();
}

const validStaging = (overrides = {}) => ({
  VERCEL_TARGET_ENV: 'staging',
  MONGODB_URI: syntheticMongoUri(),
  CHECKOUT_ENABLED: 'false',
  WHATSAPP_ENABLED: 'false',
  FRONTEND_URL: 'https://staging.jigzo.biz',
  JWT_SECRET: 'present',
  IMAGE_TOKEN_SECRET: 'present',
  ANALYTICS_HASH_SECRET: 'present',
  CRON_SECRET: 'present',
  BUSINESS_DATA_ENCRYPTION_SECRET: 'present',
  BUSINESS_IDENTITY_HASH_SECRET: 'present',
  BUSINESS_PROVISIONING_SECRET: 'present',
  BUSINESS_INVITATION_ACCESS_SECRET: 'present',
  ...overrides
});

const request = (host = 'staging.jigzo.biz') => ({ headers: { host } });

test('consumer test creation is available only on the safe custom staging target', () => {
  assert.equal(isTestModeAllowed(request(), validStaging()), true);
  assert.equal(businessCookiePath({ VERCEL_TARGET_ENV: 'staging' }), '/api');
});

test('consumer test creation fails closed outside staging', () => {
  for (const target of ['production', 'preview', 'development', undefined]) {
    assert.equal(isTestModeAllowed(request(), validStaging({ VERCEL_TARGET_ENV: target })), false);
    assert.equal(businessCookiePath({ VERCEL_TARGET_ENV: target }), '/api/business');
  }
});

test('consumer test creation fails when payment or WhatsApp is enabled', () => {
  assert.equal(isTestModeAllowed(request(), validStaging({ CHECKOUT_ENABLED: 'true' })), false);
  assert.equal(isTestModeAllowed(request(), validStaging({ WHATSAPP_ENABLED: 'true' })), false);
});

test('consumer test creation rejects non-staging hosts and databases', () => {
  assert.equal(isTestModeAllowed(request('jigzo.biz'), validStaging()), false);
  assert.equal(isTestModeAllowed(request(), validStaging({ MONGODB_URI: syntheticMongoUri({ database: 'production', validHost: false }) })), false);
});

test('staging route requires Business owner authentication and CSRF without payment or delivery', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/test.js'), 'utf8');
  assert.match(source, /router\.get\('\/status',\s*requireBusinessAuth/);
  assert.match(source, /router\.post\('\/reveals',\s*requireBusinessAuth,\s*requireBusinessCsrf/);
  assert.match(source, /testMode:\s*true/);
  assert.doesNotMatch(source, /Order|createCheckout|markOrderAndPuzzlePaid|whatsappService/);
});

test('staging session refresh upgrades the cookie scope without changing Production', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/businessAuth.js'), 'utf8');
  assert.match(source, /VERCEL_TARGET_ENV === 'staging'/);
  assert.match(source, /Set-Cookie/);
  assert.match(source, /cookieHeader\(rawSession, remainingSeconds\)/);
  assert.match(source, /clearCookieAtPath\('\/api\/business'\)/);
});

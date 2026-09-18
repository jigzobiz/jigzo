const REQUIRED_SECRETS = [
  'JWT_SECRET',
  'IMAGE_TOKEN_SECRET',
  'ANALYTICS_HASH_SECRET',
  'CRON_SECRET',
  'BUSINESS_DATA_ENCRYPTION_SECRET',
  'BUSINESS_IDENTITY_HASH_SECRET',
  'BUSINESS_PROVISIONING_SECRET',
  'BUSINESS_INVITATION_ACCESS_SECRET'
];

function inspectMongoUri(value) {
  try {
    const parsed = new URL(String(value || ''));
    const hostname = parsed.hostname.toLowerCase();
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return {
      hostMatches: hostname.startsWith('jigzo-staging.') && hostname.endsWith('.mongodb.net'),
      databaseMatches: database === 'jigzo_staging'
    };
  } catch {
    return { hostMatches: false, databaseMatches: false };
  }
}

function assertStagingSafety(env = process.env, logger = console) {
  if (env.VERCEL_TARGET_ENV !== 'staging') return { executed: false };

  const mongo = inspectMongoUri(env.MONGODB_URI);
  const assertions = {
    MONGO_HOST: mongo.hostMatches,
    MONGO_DATABASE: mongo.databaseMatches,
    CHECKOUT_DISABLED: env.CHECKOUT_ENABLED === 'false',
    WHATSAPP_DISABLED: env.WHATSAPP_ENABLED === 'false',
    FRONTEND_URL: env.FRONTEND_URL === 'https://staging.jigzo.biz',
    REQUIRED_SECRETS: REQUIRED_SECRETS.every(name => typeof env[name] === 'string' && env[name].length > 0)
  };
  const failed = Object.entries(assertions).filter(([, passed]) => !passed).map(([name]) => name);

  if (failed.length) {
    logger.error(`STAGING_SAFETY_CHECK FAIL: ${failed.join(',')}`);
    const error = new Error('Staging safety verification failed.');
    error.code = 'STAGING_SAFETY_CHECK_FAILED';
    error.failedAssertions = failed;
    throw error;
  }

  logger.log('STAGING_SAFETY_CHECK PASS');
  return { executed: true, passed: true };
}

module.exports = { REQUIRED_SECRETS, inspectMongoUri, assertStagingSafety };

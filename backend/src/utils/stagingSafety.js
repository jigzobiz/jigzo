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
const { isValidEmail } = require('./emailSafety');

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

function assertPreviewSafety(env = process.env, logger = console) {
  if (env.VERCEL_ENV !== 'preview') return { executed: false };

  const mongo = inspectMongoUri(env.MONGODB_URI);
  let protocolMatches = false;
  let exactHostMatches = false;
  let databaseOverrideAbsent = false;
  try {
    const uri = new URL(String(env.MONGODB_URI || ''));
    protocolMatches = uri.protocol === 'mongodb+srv:';
    exactHostMatches = Boolean(env.PREVIEW_MONGODB_HOST) && uri.hostname.toLowerCase() === String(env.PREVIEW_MONGODB_HOST).toLowerCase();
    databaseOverrideAbsent = ![...uri.searchParams.keys()].some(key => key.toLowerCase() === 'dbname');
  } catch { /* Fail closed. */ }
  const assertions = {
    MONGO_HOST: mongo.hostMatches && protocolMatches && exactHostMatches,
    MONGO_DATABASE: mongo.databaseMatches && databaseOverrideAbsent,
    CHECKOUT_DISABLED: env.CHECKOUT_ENABLED !== 'true',
    WHATSAPP_DISABLED: env.WHATSAPP_ENABLED !== 'true',
    TAP_CREDENTIALS_ABSENT: !env.TAP_SECRET_KEY && !env.TAP_MERCHANT_ID && env.TAP_MODE !== 'live',
    KAPSO_CREDENTIALS_ABSENT: !env.KAPSO_API_KEY && !env.KAPSO_PHONE_NUMBER_ID && !env.KAPSO_WEBHOOK_SECRET,
    CRON_SECRET_ABSENT: !env.CRON_SECRET,
    FRONTEND_ORIGIN_LOCAL: !env.FRONTEND_URL,
    API_ORIGIN_LOCAL: !env.VITE_API_URL,
    EMAIL_REDIRECT_SAFE: !env.RESEND_API_KEY || isValidEmail(env.STAGING_EMAIL_REDIRECT)
  };
  const failed = Object.entries(assertions).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) {
    logger.error(`PREVIEW_SAFETY_CHECK FAIL: ${failed.join(',')}`);
    const error = new Error('Preview safety verification failed.');
    error.code = 'PREVIEW_SAFETY_CHECK_FAILED';
    error.failedAssertions = failed;
    throw error;
  }
  logger.log('PREVIEW_SAFETY_CHECK PASS');
  return { executed: true, passed: true };
}

function assertStagingSafety(env = process.env, logger = console) {
  // Keep the dedicated custom staging target's established contract intact.
  // Every ordinary Vercel branch Preview must pass the separate strict guard.
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_TARGET_ENV !== 'staging') {
    return assertPreviewSafety(env, logger);
  }
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

module.exports = { REQUIRED_SECRETS, inspectMongoUri, assertPreviewSafety, assertStagingSafety };

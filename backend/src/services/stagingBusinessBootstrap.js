const BusinessIdentity = require('../models/BusinessIdentity');
const Organization = require('../models/Organization');
const { provisionOwner } = require('./businessAuthService');
const { keyedHash } = require('../utils/businessSecurity');
const { assertStagingSafety } = require('../utils/stagingSafety');

const OWNER_EMAIL = 'zahra.dhaif@hotmail.com';
const ORGANIZATION_NAME = 'JIGZO STAGING TEST';
const LANGUAGE = 'en';
const TIMEZONE = 'Asia/Bahrain';

async function inspectExactState({ Identity, Org }) {
  const [identityCount, organizationCount, identity] = await Promise.all([
    Identity.countDocuments({}),
    Org.countDocuments({}),
    Identity.findOne({ emailHash: keyedHash(OWNER_EMAIL) }).select('+emailHash')
  ]);
  const organization = identity && await Org.findOne({
    ownerIdentity: identity._id,
    name: ORGANIZATION_NAME,
    defaultLanguage: LANGUAGE,
    timezone: TIMEZONE
  });
  return {
    empty: identityCount === 0 && organizationCount === 0,
    exact: identityCount === 1 && organizationCount === 1 && Boolean(identity && organization),
    identity,
    organization
  };
}

async function bootstrapStagingBusiness({ env = process.env, models = {} } = {}) {
  if (env.VERCEL_TARGET_ENV !== 'staging') {
    const error = new Error('Not found.');
    error.code = 'STAGING_BOOTSTRAP_UNAVAILABLE';
    error.statusCode = 404;
    throw error;
  }
  assertStagingSafety(env);

  const Identity = models.BusinessIdentity || BusinessIdentity;
  const Org = models.Organization || Organization;
  const before = await inspectExactState({ Identity, Org });
  if (before.exact) return { success: true, created: false, owner: true, organization: true };
  if (!before.empty) {
    const error = new Error('Unexpected staging Business state.');
    error.code = 'UNEXPECTED_STAGING_BUSINESS_STATE';
    error.statusCode = 409;
    throw error;
  }

  await provisionOwner({
    email: OWNER_EMAIL,
    organizationName: ORGANIZATION_NAME,
    defaultLanguage: LANGUAGE,
    timezone: TIMEZONE,
    provisionedBy: 'staging-bootstrap'
  }, { models: { BusinessIdentity: Identity, Organization: Org } });

  const after = await inspectExactState({ Identity, Org });
  if (!after.exact) throw new Error('Staging Business bootstrap verification failed.');
  return { success: true, created: true, owner: true, organization: true };
}

module.exports = {
  OWNER_EMAIL,
  ORGANIZATION_NAME,
  LANGUAGE,
  TIMEZONE,
  bootstrapStagingBusiness
};

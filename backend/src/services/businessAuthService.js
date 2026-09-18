const { v4: uuidv4 } = require('uuid');
const BusinessIdentity = require('../models/BusinessIdentity');
const Organization = require('../models/Organization');
const BusinessMagicLink = require('../models/BusinessMagicLink');
const BusinessSession = require('../models/BusinessSession');
const { normalizeEmail, randomToken, sha256, keyedHash, encryptText } = require('../utils/businessSecurity');

const MAGIC_LINK_SECONDS = 15 * 60;
const SESSION_SECONDS = 12 * 60 * 60;

async function issueMagicLink(email, { now = new Date(), ip = '', models = {}, send } = {}) {
  const Identity = models.BusinessIdentity || BusinessIdentity; const Link = models.BusinessMagicLink || BusinessMagicLink;
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { issued: false };
  const identity = await Identity.findOne({ emailHash: keyedHash(normalized), status: 'active' }).select('+emailEncrypted');
  if (!identity) return { issued: false };
  const rawToken = randomToken(); const expiresAt = new Date(now.getTime() + MAGIC_LINK_SECONDS * 1000);
  await Link.create({ identity: identity._id, tokenHash: sha256(rawToken), expiresAt, requestedIpHash: ip ? keyedHash(ip) : '' });
  if (send) await send({ email: normalized, token: rawToken, expiresAt });
  return { issued: true };
}

async function consumeMagicLink(rawToken, { now = new Date(), models = {} } = {}) {
  const Link = models.BusinessMagicLink || BusinessMagicLink; const Identity = models.BusinessIdentity || BusinessIdentity;
  const Session = models.BusinessSession || BusinessSession; const Org = models.Organization || Organization;
  const link = await Link.findOneAndUpdate({ tokenHash: sha256(rawToken), consumedAt: null, expiresAt: { $gt: now } }, { $set: { consumedAt: now } }, { new: true });
  if (!link) return null;
  const identity = await Identity.findOne({ _id: link.identity, status: 'active' });
  if (!identity) return null;
  const organization = await Org.findOne({ _id: identity.ownedOrganizationId, ownerIdentity: identity._id, status: 'active' });
  if (!organization) return null;
  const sessionToken = randomToken(); const csrfToken = randomToken();
  const session = await Session.create({ identity: identity._id, organization: organization._id, tokenHash: sha256(sessionToken), csrfHash: sha256(csrfToken), sessionVersion: identity.sessionVersion, expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000), lastSeenAt: now });
  await Identity.updateOne({ _id: identity._id }, { $set: { lastSuccessfulLoginAt: now } });
  return { sessionToken, csrfToken, session, identity, organization, maxAgeSeconds: SESSION_SECONDS };
}

async function provisionOwner({ email, organizationName, defaultLanguage = 'en', timezone = 'Asia/Bahrain', retentionDays = 365, provisionedBy = 'cli' }, { models = {} } = {}) {
  const Identity = models.BusinessIdentity || BusinessIdentity; const Org = models.Organization || Organization;
  const normalized = normalizeEmail(email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Valid owner email required.');
  if (!organizationName || String(organizationName).trim().length > 160) throw new Error('Valid organization name required.');
  const emailHash = keyedHash(normalized); if (await Identity.findOne({ emailHash })) throw new Error('Business owner already provisioned.');
  const identity = await Identity.create({ identityId: uuidv4(), emailHash, emailEncrypted: encryptText(normalized), status: 'active', provisionedBy });
  try {
    const organization = await Org.create({ organizationId: uuidv4(), name: String(organizationName).trim(), ownerIdentity: identity._id, defaultLanguage, timezone, recipientRetentionDays: retentionDays });
    await Identity.updateOne({ _id: identity._id }, { $set: { ownedOrganizationId: organization._id } });
    return { identityId: identity.identityId, organizationId: organization.organizationId };
  } catch (error) { await Identity.deleteOne({ _id: identity._id }); throw error; }
}
async function revokeSession(sessionId, { Model = BusinessSession, now = new Date() } = {}) { return Model.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: now } }); }
module.exports = { MAGIC_LINK_SECONDS, SESSION_SECONDS, issueMagicLink, consumeMagicLink, provisionOwner, revokeSession };

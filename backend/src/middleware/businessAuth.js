const BusinessSession = require('../models/BusinessSession');
const BusinessIdentity = require('../models/BusinessIdentity');
const Organization = require('../models/Organization');
const { readCookie, sha256, timingSafeEqualText } = require('../utils/businessSecurity');
const { getFrontendOrigin } = require('../utils/runtimeConfig');

async function requireBusinessAuth(req, res, next) {
  try {
    const raw = readCookie(req.headers.cookie); if (!raw) return res.status(401).json({ error: 'Authentication required.' });
    const now = new Date();
    const session = await BusinessSession.findOne({ tokenHash: sha256(raw), revokedAt: null, expiresAt: { $gt: now } }).select('+csrfHash');
    if (!session) return res.status(401).json({ error: 'Authentication required.' });
    const [identity, organization] = await Promise.all([
      BusinessIdentity.findOne({ _id: session.identity, status: 'active', sessionVersion: session.sessionVersion }),
      Organization.findOne({ _id: session.organization, ownerIdentity: session.identity, status: 'active' })
    ]);
    if (!identity || !organization) return res.status(401).json({ error: 'Authentication required.' });
    req.business = { session, identity, organization, organizationId: organization._id };
    if (req.path !== '/session') BusinessSession.updateOne({ _id: session._id }, { $set: { lastSeenAt: now } }).catch(() => {});
    return next();
  } catch (error) { return next(error); }
}

function requireBusinessCsrf(req, res, next) {
  const origin = req.get('origin');
  if (origin && origin !== getFrontendOrigin()) return res.status(403).json({ error: 'Invalid request origin.' });
  const token = req.get('x-jigzo-csrf') || '';
  if (!req.business?.session?.csrfHash || !timingSafeEqualText(sha256(token), req.business.session.csrfHash)) return res.status(403).json({ error: 'Invalid CSRF token.' });
  return next();
}
module.exports = { requireBusinessAuth, requireBusinessCsrf };

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const BusinessSession = require('../models/BusinessSession');
const { issueMagicLink, consumeMagicLink } = require('../services/businessAuthService');
const { revokeSession } = require('../services/businessAuthService');
const { sendBusinessMagicLinkEmail } = require('../services/emailService');
const { cookieHeader, clearCookieHeader, sha256, randomToken } = require('../utils/businessSecurity');
const { getFrontendOrigin } = require('../utils/runtimeConfig');
const { requireBusinessAuth, requireBusinessCsrf } = require('../middleware/businessAuth');

const router = express.Router();
const generic = { success: true, message: 'If this email is authorized, a sign-in link will arrive shortly.' };
const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: generic });

router.post('/request-link', requestLimiter, async (req, res, next) => {
  try {
    await issueMagicLink(req.body?.email, { ip: req.ip, send: async ({ email, token }) => {
      const magicLink = `${getFrontendOrigin()}/business/auth/verify#token=${encodeURIComponent(token)}`;
      await sendBusinessMagicLinkEmail({ to: email, magicLink, idempotencyKey: `business-magic-${sha256(token)}` });
    } });
    return res.json(generic);
  } catch (error) { return next(error); }
});

router.post('/verify', async (req, res, next) => {
  try {
    const token = String(req.body?.token || ''); if (token.length < 32 || token.length > 200) return res.status(401).json({ error: 'Invalid or expired sign-in link.' });
    const result = await consumeMagicLink(token); if (!result) return res.status(401).json({ error: 'Invalid or expired sign-in link.' });
    res.setHeader('Set-Cookie', cookieHeader(result.sessionToken, result.maxAgeSeconds));
    return res.json({ success: true, csrfToken: result.csrfToken, organization: { organizationId: result.organization.organizationId, name: result.organization.name, defaultLanguage: result.organization.defaultLanguage, timezone: result.organization.timezone } });
  } catch (error) { return next(error); }
});

router.get('/session', requireBusinessAuth, async (req, res, next) => {
  try { const csrfToken = randomToken(); await BusinessSession.updateOne({ _id: req.business.session._id, revokedAt: null }, { $set: { csrfHash: sha256(csrfToken) } }); return res.json({ success: true, csrfToken, organization: { organizationId: req.business.organization.organizationId, name: req.business.organization.name, defaultLanguage: req.business.organization.defaultLanguage, timezone: req.business.organization.timezone } }); } catch (error) { return next(error); }
});
router.post('/logout', requireBusinessAuth, requireBusinessCsrf, async (req, res, next) => {
  try { await revokeSession(req.business.session._id); res.setHeader('Set-Cookie', clearCookieHeader()); return res.json({ success: true }); } catch (error) { return next(error); }
});

module.exports = router;

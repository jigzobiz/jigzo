const mongoose = require('mongoose');
const { assertStagingSafety } = require('./stagingSafety');

/**
 * Parses and returns a clean, port-stripped hostname from the Request object.
 * Returns null if the header is missing, malformed, or invalid.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getCleanHost(req) {
  const hostHeader = req.headers.host;
  if (!hostHeader || typeof hostHeader !== 'string') {
    return null;
  }
  const clean = hostHeader.trim().toLowerCase();
  
  let host = clean;
  if (clean.includes(']')) {
    const bracketEnd = clean.indexOf(']');
    host = clean.substring(0, bracketEnd + 1);
  } else {
    const colonIdx = clean.lastIndexOf(':');
    if (colonIdx !== -1) {
      host = clean.substring(0, colonIdx);
    }
  }

  // Ensure no spaces or invalid characters are present in the final domain/IP format
  if (!host || /[^a-z0-9\.\-\[\]\:]/.test(host)) {
    return null;
  }
  return host;
}

/**
 * Authoritative guard to check if Stage 1 Staging-only test reveal mode is allowed.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */


function isTestModeAllowed(req, env = process.env) {
  // This bypass exists only for the isolated Vercel custom staging target.
  if (env.VERCEL_TARGET_ENV !== 'staging') {
    return false;
  }

  // Reuse the authoritative staging guard. It validates the URI/database,
  // disabled payment/delivery flags, origin, and required isolated secrets.
  try {
    assertStagingSafety(env, { log() {}, error() {} });
  } catch {
    return false;
  }

  // Once connected, independently verify the actual selected database.
  if (mongoose.connection && mongoose.connection.readyState !== 0 && mongoose.connection.name !== 'jigzo_staging') {
    return false;
  }

  // 2. Retrieve clean, normalized host
  const host = getCleanHost(req);
  if (!host) {
    return false;
  }

  // Only the stable custom staging hostname can invoke the creation endpoint.
  return host === 'staging.jigzo.biz';
}

module.exports = { 
  isTestModeAllowed,
  getCleanHost
};

const mongoose = require('mongoose');
const { isNonProduction } = require('./runtimeConfig');

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


function isTestModeAllowed(req) {
  // 1. Authoritative Database check: if connected, must be connected to 'jigzo_test'
  if (mongoose.connection && mongoose.connection.readyState !== 0 && mongoose.connection.name !== 'jigzo_test') {
    return false;
  }

  // 2. Retrieve clean, normalized host
  const host = getCleanHost(req);
  if (!host) {
    return false;
  }

  // 3. Absolute blocklist check (production hosts & runtime configurations)
  if (host === 'jigzo.biz' || host === 'www.jigzo.biz') {
    return false;
  }
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_GIT_COMMIT_REF === 'master') {
    return false;
  }

  // 4. Deployed Vercel environments: Preview targets on 'staging' branch only
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'staging') {
      return false;
    }
    
    const vercelUrl = process.env.VERCEL_URL ? process.env.VERCEL_URL.toLowerCase().trim() : '';
    const branchUrl = process.env.VERCEL_BRANCH_URL ? process.env.VERCEL_BRANCH_URL.toLowerCase().trim() : '';
    
    return (
      host === 'staging.jigzo.biz' ||
      host === vercelUrl ||
      host === branchUrl
    );
  }

  // 5. Local development: explicitly non-production on local interfaces
  if (isNonProduction()) {
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]'
    );
  }

  return false;
}

module.exports = { 
  isTestModeAllowed,
  getCleanHost
};

const crypto = require('crypto');

const SHA256_HEX_LENGTH = 64;

function getHeader(req, name) {
  if (req && typeof req.get === 'function') {
    return req.get(name) || '';
  }
  const key = String(name).toLowerCase();
  const headers = (req && req.headers) || {};
  if (headers[key]) return headers[key];
  const matchedKey = Object.keys(headers).find((headerName) => headerName.toLowerCase() === key);
  return matchedKey ? headers[matchedKey] : '';
}

function getRawBody(req) {
  if (Buffer.isBuffer(req && req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req && req.body)) return req.body;
  return null;
}

function normalizeProvidedSignature(value) {
  const trimmed = String(value || '').trim();
  return trimmed.toLowerCase().startsWith('sha256=')
    ? trimmed.slice(7)
    : trimmed;
}

function safeDiagnosticHeader(value) {
  return String(value || '').replace(/[\r\n]/g, '').slice(0, 120);
}

function verifyKapsoWebhookSignature(req, secret) {
  const providedHeader = getHeader(req, 'X-Webhook-Signature');
  const rawBody = getRawBody(req);
  const providedSignature = normalizeProvidedSignature(providedHeader);
  const diagnostics = {
    signatureHeaderPresent: providedHeader ? 'yes' : 'no',
    payloadVersion: safeDiagnosticHeader(getHeader(req, 'X-Webhook-Payload-Version')),
    webhookEvent: safeDiagnosticHeader(getHeader(req, 'X-Webhook-Event')),
    rawBodyAvailable: rawBody ? 'yes' : 'no',
    rawBodyByteLength: rawBody ? rawBody.length : 0,
    expectedSignatureLength: SHA256_HEX_LENGTH,
    providedSignatureLength: providedSignature.length,
    reason: ''
  };

  if (!providedHeader) {
    diagnostics.reason = 'missing_signature';
    return { valid: false, diagnostics, rawBody };
  }
  if (!rawBody) {
    diagnostics.reason = 'missing_raw_body';
    return { valid: false, diagnostics, rawBody };
  }
  if (!secret) {
    diagnostics.reason = 'missing_secret';
    return { valid: false, diagnostics, rawBody };
  }
  if (!/^[a-fA-F0-9]{64}$/.test(providedSignature)) {
    diagnostics.reason = 'invalid_signature_format';
    return { valid: false, diagnostics, rawBody };
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    diagnostics.reason = 'mismatch';
    return { valid: false, diagnostics, rawBody };
  }

  diagnostics.reason = 'verified';
  return { valid: true, diagnostics, rawBody };
}

module.exports = {
  SHA256_HEX_LENGTH,
  getHeader,
  getRawBody,
  normalizeProvidedSignature,
  verifyKapsoWebhookSignature
};

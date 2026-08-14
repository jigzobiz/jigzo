const crypto = require('crypto');

const SESSION_COOKIE = 'jigzo_business_session';
const normalizeEmail = value => String(value || '').trim().normalize('NFKC').toLowerCase();
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const keyedHash = value => {
  const secret = String(process.env.BUSINESS_IDENTITY_HASH_SECRET || '');
  if (secret.length < 32) throw new Error('BUSINESS_IDENTITY_HASH_SECRET must be at least 32 characters.');
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
};
const timingSafeEqualText = (a, b) => {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const encryptionKey = () => {
  const secret = String(process.env.BUSINESS_DATA_ENCRYPTION_SECRET || '');
  if (secret.length < 32) throw new Error('BUSINESS_DATA_ENCRYPTION_SECRET must be at least 32 characters.');
  return crypto.createHash('sha256').update(secret).digest();
};
function encryptText(value) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
}
function decryptText(value) {
  const [iv, tag, ciphertext] = String(value || '').split('.').map(part => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !ciphertext) throw new Error('Invalid encrypted value.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
function cookieHeader(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return `${SESSION_COOKIE}=${token}; Path=/api/business; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}
function clearCookieHeader() { return `${SESSION_COOKIE}=; Path=/api/business; HttpOnly; SameSite=Strict; Max-Age=0`; }
function readCookie(header, name = SESSION_COOKIE) {
  for (const part of String(header || '').split(';')) {
    const [key, ...rest] = part.trim().split('='); if (key === name) return rest.join('=');
  }
  return '';
}
module.exports = { SESSION_COOKIE, normalizeEmail, randomToken, sha256, keyedHash, timingSafeEqualText, encryptText, decryptText, cookieHeader, clearCookieHeader, readCookie };

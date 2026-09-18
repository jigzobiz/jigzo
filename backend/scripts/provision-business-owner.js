/**
 * Invite-only Business beta provisioning. Requires trusted shell access plus
 * BUSINESS_PROVISIONING_SECRET and --confirm-provision. It intentionally has
 * no HTTP equivalent. Example:
 * npm run business:provision -- --confirm-provision --email owner@example.com --organization "Example Co"
 */
require('dotenv').config();
const crypto = require('crypto');
const connectDB = require('../src/config/database');
const { provisionOwner } = require('../src/services/businessAuthService');

function arg(name) { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : ''; }
async function main() {
  if (!process.argv.includes('--confirm-provision')) throw new Error('Explicit --confirm-provision is required.');
  const secret = String(process.env.BUSINESS_PROVISIONING_SECRET || '');
  if (secret.length < 32) throw new Error('BUSINESS_PROVISIONING_SECRET must be configured for trusted operators.');
  const operatorDigest = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12);
  await connectDB();
  const result = await provisionOwner({ email: arg('email'), organizationName: arg('organization'), defaultLanguage: arg('language') || 'en', timezone: arg('timezone') || 'Asia/Bahrain', provisionedBy: `cli:${operatorDigest}` });
  console.log(`Provisioned Business owner ${result.identityId} for organization ${result.organizationId}.`);
  process.exit(0);
}
main().catch(error => { console.error(`Provisioning failed: ${error.message}`); process.exit(1); });

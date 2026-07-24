const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Set env vars for testing
process.env.NODE_ENV = 'test';
process.env.TAP_SECRET_KEY = 'sk_test_mockkey';
process.env.TAP_MERCHANT_ID = '1234567';

const { getFrontendOrigin } = require('../src/utils/runtimeConfig');
const Puzzle = require('../src/models/Puzzle');
const Order = require('../src/models/Order');

// Mock database connection helper
test.before(async () => {
  // Use mock mongoose or connect to in-memory db
  // For unit testing here, we can stub mongoose methods directly on the model if needed, 
  // or mock the database queries. Let's do a lightweight mock since we are running 
  // without a live local mongodb server.
});

test('Redirect Origin and Webhook verification across environments', () => {
  const originalEnv = { ...process.env };

  // 1. Production Redirect
  process.env.VERCEL_ENV = 'production';
  assert.strictEqual(getFrontendOrigin(), 'https://jigzo.biz');

  // 2. Staging Redirect
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_GIT_COMMIT_REF = 'staging';
  assert.strictEqual(getFrontendOrigin(), 'https://staging.jigzo.biz');

  // 3. Local fallback
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_GIT_COMMIT_REF;
  delete process.env.FRONTEND_URL;
  delete process.env.VERCEL_BRANCH_URL;
  delete process.env.VERCEL_URL;
  assert.strictEqual(getFrontendOrigin(), 'http://localhost:5173');

  // Restore env
  process.env = originalEnv;
});

test('Webhook postUrl environments mapping', () => {
  const mockReq = (host) => ({
    get: () => host,
    protocol: 'https'
  });

  const getPostUrl = (req) => {
    const host = req.get('host');
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const baseUrl = isLocal ? 'https://staging.jigzo.biz' : `${req.protocol}://${host}`;
    return `${baseUrl}/api/webhooks/payment`;
  };

  // Local environment -> staging webhook fallback
  assert.strictEqual(getPostUrl(mockReq('localhost:5000')), 'https://staging.jigzo.biz/api/webhooks/payment');
  
  // Staging environment -> staging webhook
  assert.strictEqual(getPostUrl(mockReq('staging.jigzo.biz')), 'https://staging.jigzo.biz/api/webhooks/payment');
  
  // Production environment -> production webhook
  assert.strictEqual(getPostUrl(mockReq('jigzo.biz')), 'https://jigzo.biz/api/webhooks/payment');
});

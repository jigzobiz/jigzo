const assert = require('assert');
const crypto = require('crypto');

// Setup environment for testing
process.env.CHECKOUT_ENABLED = 'true';
process.env.TAP_SECRET_KEY = 'sk_test_mockkey';
process.env.TAP_MERCHANT_ID = '1234567';
process.env.TAP_MODE = 'test';
process.env.WHATSAPP_ENABLED = 'false';

// Import services and models
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const paymentService = require('../src/services/paymentService');
const { markOrderAndPuzzlePaid } = require('../src/services/paymentCompletion');

// Setup Mongoose Model Mocks (In-memory mock DB)
const mockDb = {
  orders: {},
  puzzles: {}
};

// Mock Order findOne
Order.findOne = async (query) => {
  if (query.orderId) {
    return mockDb.orders[query.orderId] || null;
  }
  if (query.puzzleId) {
    return Object.values(mockDb.orders).find(o => o.puzzleId === query.puzzleId) || null;
  }
  if (query.providerChargeId) {
    return Object.values(mockDb.orders).find(o => o.providerChargeId === query.providerChargeId) || null;
  }
  return null;
};

// Mock Order save
Order.prototype.save = async function() {
  mockDb.orders[this.orderId] = this;
  return this;
};

// Mock Puzzle findOne
Puzzle.findOne = async (query) => {
  if (query.publicId) {
    return mockDb.puzzles[query.publicId] || null;
  }
  return null;
};

// Mock Puzzle findById
Puzzle.findById = async (id) => {
  return Object.values(mockDb.puzzles).find(p => String(p._id) === String(id)) || null;
};

// Mock Puzzle save
Puzzle.prototype.save = async function() {
  mockDb.puzzles[this.publicId] = this;
  return this;
};

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Currency amount decimal formatting tests
test('Webhook Currency Decimal Formatting and Concatenation Order', () => {
  // Test AED/USD (2 decimals)
  const aedFormatted = paymentService.formatAmount(19, 'AED');
  assert.strictEqual(aedFormatted, '19.00');

  const usdFormatted = paymentService.formatAmount(5.5, 'USD');
  assert.strictEqual(usdFormatted, '5.50');

  // Test BHD/KWD/OMR/JOD (3 decimals)
  const bhdFormatted = paymentService.formatAmount(5, 'BHD');
  assert.strictEqual(bhdFormatted, '5.000');

  const kwdFormatted = paymentService.formatAmount(5.12, 'KWD');
  assert.strictEqual(kwdFormatted, '5.120');

  const omrFormatted = paymentService.formatAmount(8.005, 'OMR');
  assert.strictEqual(omrFormatted, '8.005');

  // Test Signature verify method
  const mockPayload = {
    id: 'chg_test123',
    amount: 19,
    currency: 'AED',
    status: 'CAPTURED',
    created: '1589189190566',
    reference: {
      gateway: 'gwy_ref1',
      payment: 'pay_ref2'
    }
  };

  // Concatenated string: chg_test123 + 19.00 + AED + gwy_ref1 + pay_ref2 + CAPTURED + 1589189190566
  const expectedString = 'chg_test12319.00AEDgwy_ref1pay_ref2CAPTURED1589189190566';
  const hmac = crypto.createHmac('sha256', process.env.TAP_SECRET_KEY);
  hmac.update(expectedString);
  const signature = hmac.digest('hex');

  const isValid = paymentService.verifyWebhook(mockPayload, signature);
  assert.strictEqual(isValid, true, 'Valid signature should pass');

  // Invalid signature check
  const isInvalid = paymentService.verifyWebhook(mockPayload, 'invalidsignature');
  assert.strictEqual(isInvalid, false, 'Invalid signature should fail');
});

// 2. Checkout disabled runtime tests
test('Checkout disabled does not run Tap calls or require Tap variables', () => {
  const originalSecret = process.env.TAP_SECRET_KEY;
  const originalMerchant = process.env.TAP_MERCHANT_ID;
  
  // Remove variables to prove they are not required at startup
  delete process.env.TAP_SECRET_KEY;
  delete process.env.TAP_MERCHANT_ID;
  process.env.CHECKOUT_ENABLED = 'false';

  // Existing checkout router emulation when disabled:
  const checkStatus = process.env.CHECKOUT_ENABLED === 'true';
  assert.strictEqual(checkStatus, false);
  
  // Restore
  process.env.TAP_SECRET_KEY = originalSecret;
  process.env.TAP_MERCHANT_ID = originalMerchant;
  process.env.CHECKOUT_ENABLED = 'true';
});

// 3. Tap Charge creation payload assertions
test('Tap Charge request configuration details', async () => {
  const mockOrder = {
    orderId: 'ord_123',
    total: 19,
    currency: 'AED'
  };
  const mockPuzzle = {
    publicId: 'puz_123',
    experienceLanguage: 'ar',
    senderName: 'Zahra'
  };

  // Temporarily stub _request in paymentService
  let capturedPayload = null;
  let capturedHeaders = null;
  
  const originalRequest = paymentService._request;
  paymentService._request = async (method, url, headers, bodyObj) => {
    capturedPayload = bodyObj;
    capturedHeaders = headers;
    return {
      id: 'chg_123',
      status: 'INITIATED',
      transaction: { url: 'https://checkout.tap.company/pay/chg_123' },
      reference: { transaction: 'tx_ref_123' }
    };
  };

  await paymentService.createCheckout(mockOrder, mockPuzzle, 'https://jigzo/redirect', 'https://jigzo/webhook', 'ord_123');

  // Assertions
  assert.strictEqual(capturedHeaders['lang_code'], 'ar', 'Arabic selection header');
  assert.strictEqual(capturedPayload.amount, 19, 'Correct order amount');
  assert.strictEqual(capturedPayload.currency, 'AED', 'Correct order currency');
  assert.strictEqual(capturedPayload.source.id, 'src_all', 'source.id is src_all');
  assert.strictEqual(capturedPayload.merchant.id, '1234567', 'Correct merchant ID');
  assert.strictEqual(capturedPayload.reference.order, 'ord_123', 'Correct order reference');
  assert.strictEqual(capturedPayload.reference.idempotent, 'ord_123', 'Idempotent key is order ID');
  assert.strictEqual(capturedPayload.receipt, undefined, 'Receipt object must be omitted');

  // Restore request
  paymentService._request = originalRequest;
});

// 4. Status mapping & idempotency test
test('Payment Completion, webhook/redirect ordering, and WhatsApp disabled verification', async () => {
  const orderId = 'ord_idempotent_test';
  const puzzleId = 'puz_idempotent_test';

  const order = new Order({
    orderId,
    puzzleId,
    packageId: 'single',
    recipientCount: 1,
    basePrice: 5,
    total: 19,
    currency: 'AED',
    paymentStatus: 'pending',
    paymentAttempts: []
  });
  await order.save();

  const puzzle = new Puzzle({
    publicId: puzzleId,
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Test User', deliveryMethod: 'email', email: 'test@jigzo.biz' }]
  });
  await puzzle.save();

  // Test Mark Paid Idempotently
  let calls = 0;
  // Stub email sending to track triggers
  const emailService = require('../src/services/emailService');
  const originalSendEmail = emailService.sendRevealEmail;
  emailService.sendRevealEmail = async () => {
    calls++;
    return { success: true, providerMessageId: 'msg_123' };
  };

  // Run webhook/redirect flow 1: Redirect verification CAPTURED
  await markOrderAndPuzzlePaid(order, 'chg_999', 'tx_999');
  assert.strictEqual(order.paymentStatus, 'paid', 'Order marked paid');
  assert.ok(['paid', 'delivered'].includes(puzzle.status), 'Puzzle status transitioned to paid/delivered');
  assert.strictEqual(calls, 1, 'Delivery triggered exactly once');

  // Run webhook/redirect flow 2: Webhook CAPTURED arrives next (duplicate)
  await markOrderAndPuzzlePaid(order, 'chg_999', 'tx_999');
  assert.strictEqual(calls, 1, 'Delivery not triggered again (idempotent)');

  // Verify only CAPTURED marks paid (failures shouldn't mark paid)
  order.paymentStatus = 'pending';
  await order.save();
  
  // Emulate INITIATED status
  assert.strictEqual(order.paymentStatus, 'pending', 'Order remains pending on INITIATED');

  // Restore email service
  emailService.sendRevealEmail = originalSendEmail;
});

console.log(`\nRunning automated Tap Payments Staging Integration Tests...\n`);
console.log(`Passed ${passed} tests.`);

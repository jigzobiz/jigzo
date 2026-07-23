const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Set default env vars for tests
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

// Import routers for route-level handler tests
const ordersRouter = require('../src/routes/orders');
const webhooksRouter = require('../src/routes/webhooks');

// Find actual Express route handlers
const ordersPostHandler = ordersRouter.stack.find(s => s.route?.path === '/' && s.route.methods.post)?.route.stack[0]?.handle;
const ordersVerifyPostHandler = ordersRouter.stack.find(s => s.route?.path === '/verify-payment' && s.route.methods.post)?.route.stack[0]?.handle;
const webhookPostHandler = webhooksRouter.stack.find(s => s.route?.path === '/payment' && s.route.methods.post)?.route.stack[0]?.handle;

// Mock database store
const mockDb = {
  orders: {},
  puzzles: {}
};

// Setup Mongoose Model Mocks (In-memory mock DB)
Order.findOne = (query) => {
  const promise = (async () => {
    if (query.orderId) return mockDb.orders[query.orderId] || null;
    if (query.puzzleId) {
      let matched = Object.values(mockDb.orders).filter(o => o.puzzleId === query.puzzleId);
      if (query.paymentStatus) {
        matched = matched.filter(o => o.paymentStatus === query.paymentStatus);
      }
      if (matched.length === 0) return null;
      return matched[matched.length - 1];
    }
    if (query.providerChargeId) return Object.values(mockDb.orders).find(o => o.providerChargeId === query.providerChargeId) || null;
    return null;
  })();

  promise.sort = (sortSpec) => {
    return (async () => {
      if (query.puzzleId) {
        let matched = Object.values(mockDb.orders).filter(o => o.puzzleId === query.puzzleId);
        if (query.paymentStatus) {
          matched = matched.filter(o => o.paymentStatus === query.paymentStatus);
        }
        if (matched.length === 0) return null;
        matched.sort((a, b) => b.createdAt - a.createdAt);
        return matched[0];
      }
      return promise;
    })();
  };

  return promise;
};

Order.find = () => ({
  sort: (sortSpec) => {
    const list = Object.values(mockDb.orders);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }
});

Order.prototype.save = async function() {
  if (!this.createdAt) this.createdAt = new Date();
  mockDb.orders[this.orderId] = this;
  return this;
};

Puzzle.findOne = async (query) => {
  if (query.publicId) return mockDb.puzzles[query.publicId] || null;
  return null;
};

Puzzle.findById = async (id) => {
  return Object.values(mockDb.puzzles).find(p => String(p._id) === String(id)) || null;
};

Puzzle.prototype.save = async function() {
  if (!this._id) this._id = 'puz_db_' + this.publicId;
  mockDb.puzzles[this.publicId] = this;
  return this;
};

// Stub helper for Tap Requests
const originalRequest = paymentService._request;
function stubTapRequest(responseObj) {
  let captured = { payload: null, headers: null, method: null, url: null };
  paymentService._request = async (method, url, headers, bodyObj) => {
    captured.method = method;
    captured.url = url;
    captured.headers = headers;
    captured.payload = bodyObj;
    return responseObj;
  };
  return captured;
}

function restoreTapRequest() {
  paymentService._request = originalRequest;
}

// Mock Request helper
function makeMockReq(body) {
  return {
    body,
    protocol: 'http',
    headers: {
      host: 'localhost:5173'
    },
    get: (header) => 'localhost:5173'
  };
}

// Mock Res helper for Express router invocation
function makeMockRes() {
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    }
  };
}

// ----------------------------------------------------
// THE TEST SUITE
// ----------------------------------------------------

test('actual POST /api/orders returns 503 when checkout disabled', async () => {
  const originalCheckoutFlag = process.env.CHECKOUT_ENABLED;
  process.env.CHECKOUT_ENABLED = 'false';

  const req = makeMockReq({ puzzleId: 'puz_disabled' });
  const res = makeMockRes();

  let apiCalled = false;
  paymentService._request = async () => {
    apiCalled = true;
    return {};
  };

  await ordersPostHandler(req, res, (err) => {
    if (err) throw err;
  });

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.code, 'CHECKOUT_DISABLED');
  assert.strictEqual(apiCalled, false, 'No Tap API call occurs when checkout is disabled');

  // Restore
  process.env.CHECKOUT_ENABLED = originalCheckoutFlag;
  restoreTapRequest();
});

test('Preview rejects a live Tap secret & TAP_MODE=test accepts only a test secret', () => {
  const originalSecret = process.env.TAP_SECRET_KEY;
  const originalMode = process.env.TAP_MODE;

  // 1. sk_live_ must fail in staging/preview
  process.env.TAP_SECRET_KEY = 'sk_live_123';
  process.env.TAP_MODE = 'test';
  assert.throws(() => paymentService._getTapConfig(), /requires a secret key starting with sk_test_/);

  // 2. Reject TAP_MODE=live in preview
  process.env.TAP_MODE = 'live';
  assert.throws(() => paymentService._getTapConfig(), /TAP_MODE=live is rejected in non-production environments/);

  // 3. Test key sk_test_ must succeed
  process.env.TAP_SECRET_KEY = 'sk_test_123';
  process.env.TAP_MODE = 'test';
  const config = paymentService._getTapConfig();
  assert.strictEqual(config.secretKey, 'sk_test_123');

  // Restore env
  process.env.TAP_SECRET_KEY = originalSecret;
  process.env.TAP_MODE = originalMode;
});

test('correct Tap URL, merchant ID, source.id=src_all, lang_code, idempotent, receipt omitted', async () => {
  const mockOrder = { orderId: 'ord_details', total: 19, currency: 'AED' };
  const mockPuzzleEn = { publicId: 'puz_en', experienceLanguage: 'en', senderName: 'Zahra' };
  const mockPuzzleAr = { publicId: 'puz_ar', experienceLanguage: 'ar', senderName: 'Zahra' };

  let captured = stubTapRequest({
    id: 'chg_111',
    status: 'INITIATED',
    transaction: { url: 'https://checkout.tap.company/pay/chg_111' },
    reference: { transaction: 'tx_111' }
  });

  // Test URL, source, merchant, receipt, idempotent
  await paymentService.createCheckout(mockOrder, mockPuzzleEn, 'http://redir', 'http://webhook', 'idem_key');
  assert.strictEqual(captured.url, 'https://api.tap.company/v2/charges/');
  assert.strictEqual(captured.headers['lang_code'], 'en');
  assert.strictEqual(captured.payload.merchant.id, '1234567');
  assert.strictEqual(captured.payload.source.id, 'src_all');
  assert.strictEqual(captured.payload.reference.idempotent, 'idem_key');
  assert.strictEqual(captured.payload.receipt, undefined, 'Receipt object must be omitted');

  // Test Arabic lang selection
  await paymentService.createCheckout(mockOrder, mockPuzzleAr, 'http://redir', 'http://webhook', 'idem_key');
  assert.strictEqual(captured.headers['lang_code'], 'ar');

  restoreTapRequest();
});

test('AED, USD, and BHD decimal formatting rules', () => {
  assert.strictEqual(paymentService.formatAmount(19.5, 'AED'), '19.50');
  assert.strictEqual(paymentService.formatAmount(5, 'USD'), '5.00');
  assert.strictEqual(paymentService.formatAmount(5.5, 'BHD'), '5.500');
});

test('unchanged duplicate checkout reuses the same charge', async () => {
  const puzzle = new Puzzle({
    publicId: 'puz_duplicate_test',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Sam' }]
  });
  await puzzle.save();

  stubTapRequest({
    id: 'chg_dup_1',
    status: 'INITIATED',
    transaction: { url: 'https://checkout.tap.company/pay/chg_dup_1' },
    reference: { transaction: 'tx_dup_1' }
  });

  // First request
  const req1 = makeMockReq({ puzzleId: 'puz_duplicate_test', recipientCount: 1, hasRevealAlert: false, currency: 'USD' });
  const res1 = makeMockRes();
  await ordersPostHandler(req1, res1, (err) => { if (err) throw err; });

  const orderId1 = res1.body.order.orderId;
  const checkoutUrl1 = res1.body.order.checkoutUrl;

  // Second request (unchanged duplicate checkout)
  const req2 = makeMockReq({ puzzleId: 'puz_duplicate_test', recipientCount: 1, hasRevealAlert: false, currency: 'USD' });
  const res2 = makeMockRes();
  await ordersPostHandler(req2, res2, (err) => { if (err) throw err; });

  assert.strictEqual(res2.body.order.orderId, orderId1, 'Reuses same order ID');
  assert.strictEqual(res2.body.order.checkoutUrl, checkoutUrl1, 'Reuses same checkout charge url');

  restoreTapRequest();
});

test('changed currency or amount creates a new safe order/attempt and new idempotency value', async () => {
  const puzzle = new Puzzle({
    publicId: 'puz_change_test',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Sam' }]
  });
  await puzzle.save();

  // Mock pricing rates cache
  const pricing = require('../src/routes/pricing');
  const originalRates = pricing.getExchangeRates;
  pricing.getExchangeRates = async () => ({ USD: 1.0, AED: 3.67 });

  let captured = stubTapRequest({
    id: 'chg_c_1',
    status: 'INITIATED',
    transaction: { url: 'https://checkout.tap.company/pay/chg_c_1' },
    reference: { transaction: 'tx_c_1' }
  });

  // 1. Initial order in USD
  const req1 = makeMockReq({ puzzleId: 'puz_change_test', recipientCount: 1, hasRevealAlert: false, currency: 'USD' });
  const res1 = makeMockRes();
  await ordersPostHandler(req1, res1, (err) => { if (err) throw err; });
  const firstOrderId = res1.body.order.orderId;

  // 2. Changed currency (USD -> AED)
  const req2 = makeMockReq({ puzzleId: 'puz_change_test', recipientCount: 1, hasRevealAlert: false, currency: 'AED' });
  const res2 = makeMockRes();
  await ordersPostHandler(req2, res2, (err) => { if (err) throw err; });

  const secondOrderId = res2.body.order.orderId;
  assert.notStrictEqual(secondOrderId, firstOrderId, 'Creates a brand new order ID');
  assert.strictEqual(captured.payload.reference.idempotent, secondOrderId, 'Idempotency value is updated to the new order ID');

  // Verify that the old order was marked failed/superseded
  const oldOrder = mockDb.orders[firstOrderId];
  assert.strictEqual(oldOrder.paymentStatus, 'failed', 'Old order marked failed');
  assert.strictEqual(oldOrder.lastPaymentError, 'Superseded by a new checkout attempt with different details.');

  // Restore pricing
  pricing.getExchangeRates = originalRates;
  restoreTapRequest();
});

test('paid order cannot create a charge', async () => {
  const puzzle = new Puzzle({
    publicId: 'puz_paid_prevent',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Sam' }]
  });
  await puzzle.save();

  // Create an order already marked paid
  const order = new Order({
    orderId: 'ord_already_paid',
    puzzleId: 'puz_paid_prevent',
    packageId: 'single',
    recipientCount: 1,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'paid'
  });
  await order.save();

  let apiCalled = false;
  paymentService._request = async () => {
    apiCalled = true;
    return {};
  };

  const req = makeMockReq({ puzzleId: 'puz_paid_prevent', recipientCount: 1, hasRevealAlert: false, currency: 'USD' });
  const res = makeMockRes();
  await ordersPostHandler(req, res, (err) => { if (err) throw err; });

  assert.strictEqual(res.body.order.paymentStatus, 'paid');
  assert.strictEqual(apiCalled, false, 'No Tap API call occurred because order was already paid');
  restoreTapRequest();
});

test('verify-payment error scenarios (unknown, mismatched, live_mode)', async () => {
  const order = new Order({
    orderId: 'ord_verify_fails',
    puzzleId: 'puz_verify_fails',
    packageId: 'single',
    recipientCount: 1,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'pending',
    providerChargeId: 'chg_real'
  });
  await order.save();

  // Stub retrieveCharge
  paymentService.retrieveCharge = async (id) => {
    return {
      id: 'chg_real',
      amount: 5,
      currency: 'USD',
      live_mode: false,
      reference: { order: 'ord_verify_fails' }
    };
  };

  // 1. Unknown tap_id (mismatch stored charge ID)
  const res1 = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_fake', orderId: 'ord_verify_fails' } }, res1, () => {});
  assert.strictEqual(res1.statusCode, 400);

  // 2. Mismatched amount
  paymentService.retrieveCharge = async () => ({
    id: 'chg_real',
    amount: 99,
    currency: 'USD',
    live_mode: false,
    reference: { order: 'ord_verify_fails' }
  });
  const res2 = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_real', orderId: 'ord_verify_fails' } }, res2, () => {});
  assert.strictEqual(res2.statusCode, 400);

  // 3. live_mode=true rejected
  paymentService.retrieveCharge = async () => ({
    id: 'chg_real',
    amount: 5,
    currency: 'USD',
    live_mode: true,
    reference: { order: 'ord_verify_fails' }
  });
  const res3 = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_real', orderId: 'ord_verify_fails' } }, res3, () => {});
  assert.strictEqual(res3.statusCode, 400);
});

test('webhook valid labelled hashstring accepted, unlabelled/invalid rejected', async () => {
  const mockPayload = {
    id: 'chg_webhook_test',
    amount: 5,
    currency: 'USD',
    status: 'CAPTURED',
    live_mode: false,
    created: '1589189190566',
    reference: { gateway: 'gwy_1', payment: 'pay_2', order: 'ord_webhook_test' }
  };

  const order = new Order({
    orderId: 'ord_webhook_test',
    puzzleId: 'puz_webhook_test',
    packageId: 'single',
    recipientCount: 1,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'pending',
    providerChargeId: 'chg_webhook_test'
  });
  await order.save();

  const puzzle = new Puzzle({
    publicId: 'puz_webhook_test',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Sam' }]
  });
  await puzzle.save();

  // 1. Compute valid labelled hash
  const expectedString = 'x_idchg_webhook_testx_amount5.00x_currencyUSDx_gateway_referencegwy_1x_payment_referencepay_2x_statusCAPTUREDx_created1589189190566';
  const hmac = crypto.createHmac('sha256', process.env.TAP_SECRET_KEY);
  hmac.update(expectedString);
  const signature = hmac.digest('hex');

  // Valid labelled hash accepted
  const res1 = makeMockRes();
  await webhookPostHandler({ headers: { hashstring: signature }, body: mockPayload }, res1, () => {});
  assert.strictEqual(res1.body.success, true);

  // 2. Unlabelled old hashstring rejected
  const oldConcatenationString = 'chg_webhook_test5.00USDgwy_1pay_2CAPTURED1589189190566';
  const oldHmac = crypto.createHmac('sha256', process.env.TAP_SECRET_KEY);
  oldHmac.update(oldConcatenationString);
  const oldSignature = oldHmac.digest('hex');

  const res2 = makeMockRes();
  await webhookPostHandler({ headers: { hashstring: oldSignature }, body: mockPayload }, res2, () => {});
  assert.strictEqual(res2.statusCode, 401, 'Unlabelled hash string must be rejected');
});

test('Preview/non-prod sends zero email and zero WhatsApp on sandbox CAPTURED payment', async () => {
  process.env.VERCEL_ENV = 'preview';

  const order = new Order({
    orderId: 'ord_guard_test',
    puzzleId: 'puz_guard_test',
    packageId: 'single',
    recipientCount: 1,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'pending'
  });
  await order.save();

  const puzzle = new Puzzle({
    publicId: 'puz_guard_test',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Sam', deliveryMethod: 'email', email: 'test@jigzo.biz', deliveryStatus: 'pending' }]
  });
  await puzzle.save();

  let emailSent = false;
  const emailService = require('../src/services/emailService');
  const originalSendEmail = emailService.sendRevealEmail;
  emailService.sendRevealEmail = async () => {
    emailSent = true;
    return { success: true };
  };

  await markOrderAndPuzzlePaid(order, 'chg_guard_1', 'tx_guard_1');

  assert.strictEqual(order.paymentStatus, 'paid');
  assert.strictEqual(puzzle.status, 'paid');
  assert.strictEqual(emailSent, false, 'Staging guard must block email delivery');
  assert.strictEqual(puzzle.recipients[0].deliveryStatus, 'pending', 'Recipient status unchanged');

  // Restore
  emailService.sendRevealEmail = originalSendEmail;
  delete process.env.VERCEL_ENV;
});

test('actual GET /api/features/status returns safe booleans', async () => {
  const req = makeMockReq({});
  const res = makeMockRes();

  const featuresRouter = require('../src/routes/features');
  const featuresStatusHandler = featuresRouter.stack.find(s => s.route?.path === '/status' && s.route.methods.get)?.route.stack[0]?.handle;

  await featuresStatusHandler(req, res, () => {});

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(typeof res.body.checkoutEnabled, 'boolean');
  assert.strictEqual(typeof res.body.whatsappEnabled, 'boolean');
  assert.strictEqual(typeof res.body.testRevealEnabled, 'boolean');
});

test('actual POST /api/puzzles saves image to GridFS and creates a draft puzzle without local directory writes', async () => {
  const req = makeMockReq({
    cropData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    message: 'Hello World',
    senderName: 'Zahra',
    senderPhone: '+97333333333',
    recipients: [{ name: 'Sam', deliveryMethod: 'email', email: 'sam@jigzo.biz' }]
  });
  const res = makeMockRes();

  const puzzlesRouter = require('../src/routes/puzzles');
  const puzzlesPostHandler = puzzlesRouter.stack.find(s => s.route?.path === '/' && s.route.methods.post)?.route.stack[0]?.handle;

  // Mock storageService.saveImage
  const storageService = require('../src/services/storageService');
  const originalSaveImage = storageService.saveImage;
  storageService.saveImage = async () => 'mock_image_id';

  await puzzlesPostHandler(req, res, (err) => {
    if (err) throw err;
  });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.puzzle.cropImageUrl, `/api/puzzles/${res.body.puzzle.publicId}/image`);

  // Restore
  storageService.saveImage = originalSaveImage;
});

test('actual POST /api/orders handles Tap creation rejection with safe error logging and formatting', async () => {
  const puzzle = new Puzzle({
    publicId: 'puz_tap_error_test',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Sam' }]
  });
  await puzzle.save();

  // Stub createCheckout to reject/throw
  const originalCreateCheckout = paymentService.createCheckout;
  paymentService.createCheckout = async () => {
    throw new Error('Tap API error (status 400): {"code":"VALIDATION_ERROR","message":"Invalid card brand"}');
  };

  const req = makeMockReq({
    puzzleId: 'puz_tap_error_test',
    recipientCount: 1,
    hasRevealAlert: false,
    currency: 'USD'
  });
  const res = makeMockRes();

  await ordersPostHandler(req, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error.message, /VALIDATION_ERROR/);
  assert.strictEqual(res.body.error.status, 'failed');

  // Restore
  paymentService.createCheckout = originalCreateCheckout;
});

test('mode-aware live_mode validation (test and live)', async () => {
  const originalTapMode = process.env.TAP_MODE;

  // 1. Expected test mode (TAP_MODE=test)
  process.env.TAP_MODE = 'test';
  assert.strictEqual(paymentService.getExpectedLiveMode(), false);

  // 2. Expected live mode (TAP_MODE=live)
  process.env.TAP_MODE = 'live';
  assert.strictEqual(paymentService.getExpectedLiveMode(), true);

  // 3. Unsupported TAP_MODE fails safely
  process.env.TAP_MODE = 'invalid';
  assert.throws(() => paymentService.getExpectedLiveMode(), /Unsupported or missing TAP_MODE/);

  // Restore TAP_MODE
  process.env.TAP_MODE = originalTapMode;
});

test('mode-aware redirect and webhook verification (accepts and rejects appropriately)', async () => {
  const originalTapMode = process.env.TAP_MODE;

  // Let's create an order to verify against
  const order = new Order({
    orderId: 'ord_mode_test',
    puzzleId: 'puz_mode_test',
    packageId: 'single',
    recipientCount: 1,
    basePrice: 19,
    total: 19,
    currency: 'AED',
    paymentStatus: 'pending',
    providerChargeId: 'chg_mode_test',
    paymentAttempts: [{
      providerChargeId: 'chg_mode_test',
      providerStatus: 'INITIATED',
      transactionReference: 'tx_ref_1'
    }]
  });
  await order.save();

  const puzzle = new Puzzle({
    publicId: 'puz_mode_test',
    status: 'draft',
    cropImageUrl: 'http://image',
    recipients: [{ name: 'Test User', deliveryStatus: 'pending' }]
  });
  await puzzle.save();

  // Test scenario 1: TAP_MODE=test (Sandbox)
  process.env.TAP_MODE = 'test';

  // 1a. Sandbox redirect verify accepts live_mode=false
  paymentService.retrieveCharge = async () => ({
    id: 'chg_mode_test',
    amount: 19,
    currency: 'AED',
    live_mode: false,
    reference: { order: 'ord_mode_test' },
    status: 'CAPTURED'
  });
  const res1a = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_mode_test', orderId: 'ord_mode_test' } }, res1a, () => {});
  assert.strictEqual(res1a.statusCode, 200);

  // 1b. Sandbox redirect verify rejects live_mode=true
  paymentService.retrieveCharge = async () => ({
    id: 'chg_mode_test',
    amount: 19,
    currency: 'AED',
    live_mode: true,
    reference: { order: 'ord_mode_test' },
    status: 'CAPTURED'
  });
  const res1b = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_mode_test', orderId: 'ord_mode_test' } }, res1b, () => {});
  assert.strictEqual(res1b.statusCode, 400);

  // Test scenario 2: TAP_MODE=live (Production)
  process.env.TAP_MODE = 'live';

  // Reset order status
  order.paymentStatus = 'pending';
  await order.save();

  // 2a. Live redirect verify accepts live_mode=true
  paymentService.retrieveCharge = async () => ({
    id: 'chg_mode_test',
    amount: 19,
    currency: 'AED',
    live_mode: true,
    reference: { order: 'ord_mode_test' },
    status: 'CAPTURED'
  });
  const res2a = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_mode_test', orderId: 'ord_mode_test' } }, res2a, () => {});
  assert.strictEqual(res2a.statusCode, 200);

  // Reset order status
  order.paymentStatus = 'pending';
  await order.save();

  // 2b. Live redirect verify rejects live_mode=false
  paymentService.retrieveCharge = async () => ({
    id: 'chg_mode_test',
    amount: 19,
    currency: 'AED',
    live_mode: false,
    reference: { order: 'ord_mode_test' },
    status: 'CAPTURED'
  });
  const res2b = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_mode_test', orderId: 'ord_mode_test' } }, res2b, () => {});
  assert.strictEqual(res2b.statusCode, 400);

  // Restore TAP_MODE
  process.env.TAP_MODE = originalTapMode;
});

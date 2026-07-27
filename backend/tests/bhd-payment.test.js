const test = require('node:test');
const assert = require('node:assert');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const { calculateDisplayTotal, convertToBhdFils, createQuote, verifyQuote } = require('../src/utils/checkoutQuote');
const ordersRouter = require('../src/routes/orders');
const webhooksRouter = require('../src/routes/webhooks');
const paymentService = require('../src/services/paymentService');

const ordersPostHandler = ordersRouter.stack.find(s => s.route?.path === '/' && s.route.methods.post)?.route.stack[0]?.handle;
const ordersVerifyPostHandler = ordersRouter.stack.find(s => s.route?.path === '/verify-payment' && s.route.methods.post)?.route.stack[0]?.handle;
const webhookPostHandler = webhooksRouter.stack.find(s => s.route?.path === '/payment' && s.route.methods.post)?.route.stack[0]?.handle;

// Setup mock DB store
const mockDb = {
  orders: {},
  puzzles: {}
};

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

Order.prototype.save = async function() {
  if (!this.createdAt) this.createdAt = new Date();
  mockDb.orders[this.orderId] = this;
  return this;
};

Puzzle.findOne = async (query) => {
  if (query.publicId) return mockDb.puzzles[query.publicId] || null;
  return null;
};

Puzzle.prototype.save = async function() {
  mockDb.puzzles[this.publicId] = this;
  return this;
};

test('BHD Checkout Snapshot and Conversion Accuracy', async (t) => {
  process.env.CHECKOUT_ENABLED = 'true';
  process.env.TAP_MODE = 'test';
  process.env.TAP_SECRET_KEY = 'sk_test_mockkey';
  process.env.TAP_MERCHANT_ID = '1234567';
  const rates = {
    AED: 3.67,
    BHD: 0.376,
    USD: 1.0
  };

  // 1. AED total converts correctly into a three-decimal BHD amount using the required formula
  // AED 35 -> BHD raw = 35 * (0.376 / 3.67) = 3.5858... -> Math.round(3.5858... * 1000) = 3586 fils -> 3.586 BHD
  const fils = convertToBhdFils(35, 'AED', rates);
  assert.strictEqual(fils, 3586);
  assert.strictEqual((fils / 1000).toFixed(3), '3.586');

  // 2. BHD-selected checkout is not converted twice
  const bhdFils = convertToBhdFils(3.596, 'BHD', rates);
  assert.strictEqual(bhdFils, 3596);
  assert.strictEqual((bhdFils / 1000).toFixed(3), '3.596');

  // 3. Expired or modified quote tokens are rejected before Tap opens
  const invalidQuote = {
    selectedCurrency: 'AED',
    selectedTotal: 35,
    packageId: 'single',
    hasRevealAlert: true,
    finalBhdFils: 3586,
    timestamp: Date.now(),
    expiry: Date.now() - 1000, // Expired
    token: 'some-fake-signature'
  };

  const verification = verifyQuote(invalidQuote);
  assert.strictEqual(verification.valid, false);

  // 4. Recipient count / package / Reveal Alert mismatch is rejected
  const puzzle = new Puzzle({
    publicId: 'puz_test_bhd',
    recipients: [
      { name: 'Alice', phone: '12345678', dial: '973', deliveryMethod: 'whatsapp' }
    ],
    status: 'draft'
  });
  await puzzle.save();

  // Create a valid quote for single package without Reveal Alert
  const validQuote = createQuote('single', false, 'AED', rates);
  
  // Helper to build mock requests
  const mockReq = (body) => ({
    body,
    protocol: 'http',
    headers: { host: 'localhost:5173' },
    get: (name) => 'localhost:5173'
  });

  const mockRes = () => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    return res;
  };

  // Try to create order with mismatched quote (e.g. hasRevealAlert = true)
  const req = mockReq({
    puzzleId: 'puz_test_bhd',
    recipientCount: 1,
    hasRevealAlert: true, // Mismatch: quote was for false
    currency: 'AED',
    quote: validQuote
  });
  const res = mockRes();

  await ordersPostHandler(req, res, (err) => { if (err) console.error("NEXT ERR:", err); });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.code, 'QUOTE_INVALID');

  // 5. Clicks/retries reuse the same order and same finalBhdFils
  // Create a successful order first
  const reqSuccess = mockReq({
    puzzleId: 'puz_test_bhd',
    recipientCount: 1,
    hasRevealAlert: false,
    currency: 'AED',
    quote: validQuote
  });
  
  // Mock Tap checkout creation in paymentService
  const originalCreateCheckout = paymentService.createCheckout;
  let tapPayloadAmount = null;
  let tapPayloadCurrency = null;
  paymentService.createCheckout = async (order, puzzle, redirectUrl, postUrl, stableKey) => {
    tapPayloadAmount = Number((order.finalBhdFils / 1000).toFixed(3));
    tapPayloadCurrency = 'BHD';
    return {
      id: 'ch_mock_test_123',
      transaction: { url: 'http://tap-mock-checkout/ch_mock_test_123' },
      reference: { transaction: 'tx_ref_123' },
      status: 'INITIATED'
    };
  };

  const resSuccess = mockRes();

  process.env.CHECKOUT_ENABLED = 'true';
  await ordersPostHandler(reqSuccess, resSuccess, (err) => { if (err) console.error("NEXT ERR:", err); });
  assert.strictEqual(resSuccess.statusCode, 201);
  const orderCreated = resSuccess.body.order;
  assert.strictEqual(orderCreated.finalBhdFils, validQuote.finalBhdFils);
  assert.strictEqual(tapPayloadAmount, 1.947); // USD 5.0 * 3.67 = 19 AED -> 19 * (0.376 / 3.67) = 1.947 BHD
  assert.strictEqual(tapPayloadCurrency, 'BHD');

  // Verify second click returns same checkout URL and doesn't re-create or recalculate
  const resRetry = mockRes();
  await ordersPostHandler(reqSuccess, resRetry, (err) => { if (err) console.error("NEXT ERR:", err); });
  assert.strictEqual(resRetry.statusCode, 200);
  assert.strictEqual(resRetry.body.order.finalBhdFils, orderCreated.finalBhdFils);
  assert.strictEqual(resRetry.body.order.checkoutUrl, orderCreated.checkoutUrl);

  // 6. Tap verification compares integer fils
  // Mock retrieval of charge
  const originalRetrieveCharge = paymentService.retrieveCharge;
  paymentService.retrieveCharge = async (tapId) => {
    return {
      amount: 1.947,
      currency: 'BHD',
      live_mode: false,
      reference: { order: orderCreated.orderId, transaction: 'tx_ref_123' },
      status: 'CAPTURED'
    };
  };

  const reqVerify = {
    body: {
      tap_id: 'ch_mock_test_123',
      orderId: orderCreated.orderId
    }
  };
  const resVerify = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  await ordersVerifyPostHandler(reqVerify, resVerify, () => {});
  assert.strictEqual(resVerify.body.success, true);
  assert.strictEqual(resVerify.body.paymentStatus, 'paid');

  // 7. Old orders fallback checks correctly
  const oldOrder = new Order({
    orderId: 'ord_old_123',
    puzzleId: 'puz_test_bhd',
    packageId: 'single',
    recipientCount: 1,
    basePrice: 5,
    total: 19,
    currency: 'AED',
    paymentStatus: 'pending',
    providerChargeId: 'ch_mock_test_old'
  });
  await oldOrder.save();

  paymentService.retrieveCharge = async (tapId) => {
    return {
      amount: 19.00,
      currency: 'AED', // Matches old order AED currency and total 19
      live_mode: false,
      reference: { order: 'ord_old_123', transaction: 'tx_ref_old' },
      status: 'CAPTURED'
    };
  };

  const reqVerifyOld = mockReq({
    tap_id: 'ch_mock_test_old',
    orderId: 'ord_old_123'
  });
  const resVerifyOld = mockRes();

  await ordersVerifyPostHandler(reqVerifyOld, resVerifyOld, (err) => { if (err) console.error("NEXT ERR:", err); });
  assert.strictEqual(resVerifyOld.body.success, true);
  assert.strictEqual(resVerifyOld.body.paymentStatus, 'paid');

  // Restore stubs
  paymentService.createCheckout = originalCreateCheckout;
  paymentService.retrieveCharge = originalRetrieveCharge;
});

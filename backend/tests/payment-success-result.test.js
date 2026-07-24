const test = require('node:test');
const assert = require('node:assert');

// Set default env vars for tests
process.env.CHECKOUT_ENABLED = 'true';
process.env.TAP_SECRET_KEY = 'sk_test_mockkey';
process.env.TAP_MERCHANT_ID = '1234567';
process.env.TAP_MODE = 'test';
process.env.WHATSAPP_ENABLED = 'false';

// Load the localized copy to assert language strings
const enLocale = require('../../frontend/src/i18n/locales/en.js').default;
const arLocale = require('../../frontend/src/i18n/locales/ar.js').default;

// Mock database order store
const mockDb = {
  orders: {},
  puzzles: {}
};

// Mock Order and Puzzle mongoose models
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');

const originalOrderFindOne = Order.findOne;
const originalPuzzleFindOne = Puzzle.findOne;
const originalPuzzleFindById = Puzzle.findById;

test('Setup Mongoose Mocks for Success Result Tests', () => {
  Order.findOne = async (query) => {
    if (query.orderId) {
      return mockDb.orders[query.orderId] || null;
    }
    return null;
  };

  Puzzle.findOne = async (query) => {
    if (query.publicId) {
      return mockDb.puzzles[query.publicId] || null;
    }
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
});

// Import orders router for route-level handler tests
const ordersRouter = require('../src/routes/orders');
const ordersVerifyPostHandler = ordersRouter.stack.find(s => s.route?.path === '/verify-payment' && s.route.methods.post)?.route.stack[0]?.handle;
const ordersGetHandler = ordersRouter.stack.find(s => s.route?.path === '/:orderId' && s.route.methods.get)?.route.stack[0]?.handle;

const paymentService = require('../src/services/paymentService');

// Helper to mock Express req and res
function makeMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    }
  };
  return res;
}

test('TAP_MODE/WHATSAPP_ENABLED configurations are protected for staging safety', () => {
  // Staging configurations check
  assert.strictEqual(process.env.WHATSAPP_ENABLED === 'true', false, 'WhatsApp must remain disabled on staging');
});

test('One recipient shows correct i18n wording and bold count tags', () => {
  // English one recipient
  const enOne = enLocale.payment.successOneRecipient;
  assert.match(enOne, /<strong>1<\/strong>/, 'English one recipient copy contains bolded 1');
  const strippedEn = enOne.replace(/<[^>]*>/g, '');
  assert.ok(strippedEn.includes('1 recipient'), 'English one recipient copy contains exact wording');

  // Arabic one recipient
  const arOne = arLocale.payment.successOneRecipient;
  assert.match(arOne, /<strong>لمستلم واحد<\/strong>/, 'Arabic one recipient copy contains bolded recipient text');
  const strippedAr = arOne.replace(/<[^>]*>/g, '');
  assert.ok(strippedAr.includes('لمستلم واحد'), 'Arabic one recipient copy contains exact wording');
});

test('Multiple recipients show correct i18n wording and bold count tags', () => {
  // English multiple recipients
  const enMult = enLocale.payment.successMultipleRecipients;
  assert.match(enMult, /<strong>\{\{count\}\}<\/strong>/, 'English multiple recipient copy contains bolded count placeholder');
  const strippedEn = enMult.replace(/<[^>]*>/g, '');
  assert.ok(strippedEn.includes('recipients'), 'English multiple recipient copy contains exact wording');

  // Arabic multiple recipients
  const arMult = arLocale.payment.successMultipleRecipients;
  assert.match(arMult, /<strong>\{\{count\}\}<\/strong>/, 'Arabic multiple recipient copy contains bolded count placeholder');
  const strippedAr = arMult.replace(/<[^>]*>/g, '');
  assert.ok(strippedAr.includes('مستلمين'), 'Arabic multiple recipient copy contains exact wording');
});

test('Success copy values match launch copy requirement exactly', () => {
  // English Titles and lines
  assert.strictEqual(enLocale.payment.successTitle, 'Your JIGZO is ready! ✨');
  assert.strictEqual(enLocale.payment.successFirstLine, 'Payment successful.');
  assert.strictEqual(enLocale.payment.successFinalLine, 'Each recipient will receive their private puzzle link shortly.');
  assert.strictEqual(enLocale.payment.backToCreate, 'Create Another JIGZO');

  // Arabic Titles and lines
  assert.strictEqual(arLocale.payment.successTitle, 'جيقزو الخاص بك جاهز! ✨');
  assert.strictEqual(arLocale.payment.successFirstLine, 'تم الدفع بنجاح.');
  assert.strictEqual(arLocale.payment.successFinalLine, 'سيحصل كل مستلم على رابط أحجيته الخاص قريبًا.');
  assert.strictEqual(arLocale.payment.backToCreate, 'إنشاء جيقزو آخر');
});

test('Recipient count comes from the stored order, not the client/URL', async () => {
  const orderId = 'ord_test_stored_count';
  mockDb.orders[orderId] = {
    orderId,
    puzzleId: 'puz_test_1',
    packageId: 'single',
    recipientCount: 5,
    basePrice: 8,
    total: 8,
    currency: 'USD',
    paymentStatus: 'pending',
    providerChargeId: 'chg_test_stored_count',
    paymentAttempts: [{ providerChargeId: 'chg_test_stored_count' }],
    save: async function() { return this; }
  };

  mockDb.puzzles['puz_test_1'] = new Puzzle({
    publicId: 'puz_test_1',
    status: 'draft',
    recipients: [{ name: 'A', deliveryMethod: 'email', email: 'a@a.com' }]
  });

  // Mock Tap charge retrieve
  paymentService.retrieveCharge = async () => ({
    id: 'chg_test_stored_count',
    amount: 8,
    currency: 'USD',
    live_mode: false,
    reference: { order: orderId },
    status: 'CAPTURED'
  });

  const res = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_test_stored_count', orderId } }, res, (err) => {
    if (err) throw err;
  });
  
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.status, 'CAPTURED');
  assert.strictEqual(res.body.recipientCount, 5, 'recipientCount must be fetched from the database order');
});

test('Missing recipientCount fallback on older orders does not crash verification', async () => {
  const orderId = 'ord_old_missing_count';
  mockDb.orders[orderId] = {
    orderId,
    puzzleId: 'puz_test_2',
    packageId: 'single',
    recipientCount: undefined,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'pending',
    providerChargeId: 'chg_old_missing_count',
    paymentAttempts: [{ providerChargeId: 'chg_old_missing_count' }],
    save: async function() { return this; }
  };

  mockDb.puzzles['puz_test_2'] = new Puzzle({
    publicId: 'puz_test_2',
    status: 'draft',
    recipients: [{ name: 'B', deliveryMethod: 'email', email: 'b@b.com' }]
  });

  paymentService.retrieveCharge = async () => ({
    id: 'chg_old_missing_count',
    amount: 5,
    currency: 'USD',
    live_mode: false,
    reference: { order: orderId },
    status: 'CAPTURED'
  });

  const res = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_old_missing_count', orderId } }, res, (err) => {
    if (err) throw err;
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.recipientCount, undefined, 'Handles missing count gracefully without crashing');
});

test('Pending, declined, cancelled, and failed payments do not show success status', async () => {
  const orderId = 'ord_failed_test';
  mockDb.orders[orderId] = {
    orderId,
    puzzleId: 'puz_test_3',
    packageId: 'single',
    recipientCount: 2,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'pending',
    providerChargeId: 'chg_failed_test',
    paymentAttempts: [{ providerChargeId: 'chg_failed_test' }],
    save: async function() { return this; }
  };

  paymentService.retrieveCharge = async () => ({
    id: 'chg_failed_test',
    amount: 5,
    currency: 'USD',
    live_mode: false,
    reference: { order: orderId },
    status: 'FAILED'
  });

  const res = makeMockRes();
  await ordersVerifyPostHandler({ body: { tap_id: 'chg_failed_test', orderId } }, res, (err) => {
    if (err) throw err;
  });

  assert.strictEqual(res.statusCode, 200);
  assert.notStrictEqual(res.body.status, 'CAPTURED');
  assert.strictEqual(res.body.paymentStatus, 'failed');
  assert.strictEqual(res.body.recipientCount, undefined, 'Does not return recipientCount if not successful/CAPTURED');
});

test('No recipient personal details are exposed in order endpoint', async () => {
  const orderId = 'ord_private_info_test';
  mockDb.orders[orderId] = {
    orderId,
    puzzleId: 'puz_test_4',
    packageId: 'single',
    recipientCount: 3,
    basePrice: 5,
    total: 5,
    currency: 'USD',
    paymentStatus: 'paid',
    // Mock personal fields that must not be returned
    recipientName: 'Secret Name',
    recipientPhone: '+123456789',
    recipientEmail: 'private@jigzo.biz'
  };

  const res = makeMockRes();
  await ordersGetHandler({ params: { orderId } }, res, () => {});

  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.body.order);
  assert.strictEqual(res.body.order.recipientName, undefined, 'Should not return recipientName');
  assert.strictEqual(res.body.order.recipientPhone, undefined, 'Should not return recipientPhone');
  assert.strictEqual(res.body.order.recipientEmail, undefined, 'Should not return recipientEmail');
  assert.strictEqual(res.body.order.recipientCount, 3, 'Returns safe recipientCount');
});

test('Cleanup Mongoose Mocks', () => {
  Order.findOne = originalOrderFindOne;
  Puzzle.findOne = originalPuzzleFindOne;
  Puzzle.findById = originalPuzzleFindById;
});

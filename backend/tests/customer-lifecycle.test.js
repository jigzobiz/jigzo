const test = require('node:test');
const assert = require('node:assert');

const Customer = require('../src/models/Customer');
const Counter = require('../src/models/Counter');
const L = require('../src/utils/adminBusinessLogic');
const { canonicalizeCustomerPhone } = require('../src/utils/contactValidation');
const customerService = require('../src/services/customerService');

test('equivalent Bahrain international formats share one E.164 identity', () => {
  const expected = canonicalizeCustomerPhone('+97333333333');
  assert.ok(expected);
  assert.strictEqual(canonicalizeCustomerPhone('97333333333'), expected);
  assert.strictEqual(canonicalizeCustomerPhone('0097333333333'), expected);
});

function installCustomerMocks() {
  const rows = new Map();
  let seq = 0;
  Customer.findOne = async (query) => {
    const variants = query.$or?.flatMap((clause) => clause.normalizedPhone?.$in || clause.primaryPhone?.$in || []) || [];
    return [...rows.values()].find((row) => variants.includes(row.normalizedPhone) || variants.includes(row.primaryPhone)) || null;
  };
  Customer.findOneAndUpdate = async ({ _id }, update) => {
    const row = [...rows.values()].find((candidate) => candidate._id === _id);
    if (!row) return null;
    if (update.$min?.firstOrderAt && (!row.firstOrderAt || update.$min.firstOrderAt < row.firstOrderAt)) row.firstOrderAt = update.$min.firstOrderAt;
    if (update.$max?.latestOrderAt && (!row.latestOrderAt || update.$max.latestOrderAt > row.latestOrderAt)) row.latestOrderAt = update.$max.latestOrderAt;
    row.updatedAt = update.$set.updatedAt;
    return row;
  };
  Customer.create = async (data) => {
    await new Promise((resolve) => setImmediate(resolve));
    if (rows.has(data.normalizedPhone)) {
      const error = new Error('duplicate');
      error.code = 11000;
      throw error;
    }
    const row = { ...data, _id: `customer-${data.customerId}`, isArchived: false, adminSuppressed: false };
    rows.set(data.normalizedPhone, row);
    return row;
  };
  Counter.findOneAndUpdate = async () => ({ seq: ++seq });
  return rows;
}

test('first paid purchase creates one Customer and repeat purchase updates its dates', async () => {
  const rows = installCustomerMocks();
  const puzzle = { senderPhone: '+97333333333', senderName: 'Purchaser' };
  const first = { createdAt: new Date('2026-08-01T10:00:00Z'), paidAt: new Date('2026-08-01T10:05:00Z') };
  const repeat = { createdAt: new Date('2026-08-03T10:00:00Z'), paidAt: new Date('2026-08-03T10:05:00Z') };
  const created = await customerService.upsertCustomerFromPuzzleOrder({ puzzle, order: first });
  const updated = await customerService.upsertCustomerFromPuzzleOrder({ puzzle: { ...puzzle, senderPhone: '0097333333333' }, order: repeat });
  assert.strictEqual(rows.size, 1);
  assert.strictEqual(updated.customerId, created.customerId);
  assert.deepStrictEqual(updated.firstOrderAt, first.createdAt);
  assert.deepStrictEqual(updated.latestOrderAt, repeat.paidAt);
});

test('concurrent webhook and redirect upserts cannot create duplicate Customers', async () => {
  const rows = installCustomerMocks();
  const puzzle = { senderPhone: '+97333333333', senderName: 'Purchaser' };
  const order = { createdAt: new Date('2026-08-01T10:00:00Z'), paidAt: new Date('2026-08-01T10:05:00Z') };
  const results = await Promise.all([
    customerService.upsertCustomerFromPuzzleOrder({ puzzle, order }),
    customerService.upsertCustomerFromPuzzleOrder({ puzzle: { ...puzzle, senderPhone: '97333333333' }, order })
  ]);
  assert.strictEqual(rows.size, 1);
  assert.strictEqual(results[0].customerId, results[1].customerId);
});

test('existing archived Customer stays archived', async () => {
  const rows = installCustomerMocks();
  rows.set('+97333333333', {
    _id: 'archived-customer', customerId: 'JZ-CUS-00001', normalizedPhone: '+97333333333',
    primaryPhone: '+97333333333', isArchived: true, adminSuppressed: true,
    firstOrderAt: new Date('2026-07-01T00:00:00Z'), latestOrderAt: new Date('2026-07-01T00:00:00Z')
  });
  const result = await customerService.upsertCustomerFromPuzzleOrder({
    puzzle: { senderPhone: '97333333333' },
    order: { createdAt: new Date('2026-08-01T00:00:00Z'), paidAt: new Date('2026-08-01T00:05:00Z') }
  });
  assert.strictEqual(result.isArchived, true);
  assert.strictEqual(result.adminSuppressed, true);
});

test('legacy 973 normalized format is reused instead of creating a duplicate', async () => {
  const rows = installCustomerMocks();
  rows.set('97333333333', {
    _id: 'legacy-customer', customerId: 'JZ-CUS-00002', normalizedPhone: '97333333333',
    primaryPhone: '97333333333', isArchived: false,
    firstOrderAt: new Date('2026-07-01T00:00:00Z'), latestOrderAt: new Date('2026-07-01T00:00:00Z')
  });
  const result = await customerService.upsertCustomerFromPuzzleOrder({
    puzzle: { senderPhone: '+97333333333' },
    order: { createdAt: new Date('2026-08-01T00:00:00Z') }
  });
  assert.strictEqual(rows.size, 1);
  assert.strictEqual(result.customerId, 'JZ-CUS-00002');
});

test('pending and failed orders remain abandoned/non-paying until captured', () => {
  assert.strictEqual(L.isCompletedPaidOrder({ paymentStatus: 'pending' }), false);
  assert.strictEqual(L.isCompletedPaidOrder({ paymentStatus: 'failed' }), false);
  assert.strictEqual(L.isAbandonedCheckout({ paymentStatus: 'pending' }), true);
  assert.strictEqual(L.isAbandonedCheckout({ paymentStatus: 'failed' }), true);
  assert.strictEqual(L.isCompletedPaidOrder({ paymentStatus: 'paid' }), true);
});

test('verified payment completion invokes authoritative Customer synchronization', async () => {
  const Puzzle = require('../src/models/Puzzle');
  const { markOrderAndPuzzlePaid } = require('../src/services/paymentCompletion');
  const originalFindOne = Puzzle.findOne;
  const originalSync = customerService.upsertCustomerFromPuzzleOrder;
  const originalVercelEnv = process.env.VERCEL_ENV;
  let syncCalls = 0;
  const puzzle = {
    publicId: 'safe-puzzle-fixture', status: 'pending_payment', senderPhone: '+97333333333',
    recipients: [], imageDeletionDueAt: new Date('2099-01-01T00:00:00Z'),
    save: async function save() { return this; }
  };
  const order = {
    puzzleId: puzzle.publicId, paymentStatus: 'pending', createdAt: new Date('2026-08-01T00:00:00Z'),
    save: async function save() { return this; }
  };
  Puzzle.findOne = async () => puzzle;
  customerService.upsertCustomerFromPuzzleOrder = async ({ puzzle: syncedPuzzle, order: syncedOrder }) => {
    syncCalls += 1;
    assert.strictEqual(syncedPuzzle, puzzle);
    assert.strictEqual(syncedOrder, order);
  };
  process.env.VERCEL_ENV = 'preview';
  try {
    await markOrderAndPuzzlePaid(order, 'safe-charge-fixture', 'safe-transaction-fixture');
    assert.strictEqual(order.paymentStatus, 'paid');
    assert.strictEqual(syncCalls, 1);
  } finally {
    Puzzle.findOne = originalFindOne;
    customerService.upsertCustomerFromPuzzleOrder = originalSync;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  }
});

test('analytics accepts personal-looking metadata without creating an authoritative Customer', async () => {
  const AnonymousSession = require('../src/models/AnonymousSession');
  const JourneyEvent = require('../src/models/JourneyEvent');
  const analyticsRouter = require('../src/routes/analytics');
  const handler = analyticsRouter.stack.find((layer) => layer.route?.path === '/events')?.route.stack[0].handle;
  let customerTouched = false;
  Customer.findOne = async () => { customerTouched = true; throw new Error('Customer must not be queried'); };
  Customer.create = async () => { customerTouched = true; throw new Error('Customer must not be created'); };
  AnonymousSession.findOne = async () => null;
  AnonymousSession.prototype.save = async function save() { return this; };
  JourneyEvent.prototype.save = async function save() { return this; };
  const req = {
    body: { anonymousId: 'anon-safe', sessionId: 'session-safe', eventType: 'checkout_started', pageUrl: '/create', metadata: { phone: '+97333333333', email: 'person@example.test' } },
    headers: {}, ip: ''
  };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res, (error) => { if (error) throw error; });
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(customerTouched, false);
});

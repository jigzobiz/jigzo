const test = require('node:test');
const assert = require('node:assert');

const { buildPlan, customerCanonicalIdentity } = require('../src/services/customerHistoricalReconciliation');

const d = (day, minute = 0) => new Date(`2026-08-${String(day).padStart(2, '0')}T10:${String(minute).padStart(2, '0')}:00Z`);

test('paid and abandoned history for one canonical phone creates one paying Customer', () => {
  const puzzles = [{ publicId: 'p1', senderPhone: '+97333333333' }, { publicId: 'p2', senderPhone: '0097333333333' }];
  const orders = [
    { puzzleId: 'p1', paymentStatus: 'failed', createdAt: d(1), failedAt: d(1, 5) },
    { puzzleId: 'p2', paymentStatus: 'paid', createdAt: d(2), paidAt: d(2, 5) }
  ];
  const plan = buildPlan({ orders, puzzles, customers: [] });
  assert.strictEqual(plan.creates.length, 1);
  assert.strictEqual(plan.counts.customersToCreateFromPaidOrders, 1);
  assert.strictEqual(plan.counts.customersToCreateFromAbandonedCheckouts, 0);
  assert.deepStrictEqual(plan.creates[0].firstOrderAt, d(1));
  assert.deepStrictEqual(plan.creates[0].latestOrderAt, d(2, 5));
});

test('existing archived Customer receives only a material lifecycle plan and is not reactivated', () => {
  const customer = {
    _id: 'c1', normalizedPhone: '97333333333', primaryPhone: '0097333333333',
    firstOrderAt: d(2), latestOrderAt: d(2), isArchived: true, adminSuppressed: true
  };
  const plan = buildPlan({
    customers: [customer],
    puzzles: [{ publicId: 'p1', senderPhone: '+97333333333' }],
    orders: [{ puzzleId: 'p1', paymentStatus: 'paid', createdAt: d(1), paidAt: d(3) }]
  });
  assert.strictEqual(plan.creates.length, 0);
  assert.strictEqual(plan.updates.length, 1);
  assert.strictEqual(plan.updates[0].customer.isArchived, true);
  assert.strictEqual(plan.updates[0].customer.adminSuppressed, true);
});

test('already reconciled history produces zero creates and zero material updates', () => {
  const customer = {
    _id: 'c1', normalizedPhone: '+97333333333', primaryPhone: '+97333333333',
    firstOrderAt: d(1), latestOrderAt: d(1, 5)
  };
  const plan = buildPlan({
    customers: [customer],
    puzzles: [{ publicId: 'p1', senderPhone: '0097333333333' }],
    orders: [{ puzzleId: 'p1', paymentStatus: 'paid', createdAt: d(1), paidAt: d(1, 5) }]
  });
  assert.strictEqual(plan.creates.length, 0);
  assert.strictEqual(plan.updates.length, 0);
});

test('duplicates, unmatchable paid records, and conflicting Customer phones are blocking signals', () => {
  const customers = [
    { _id: 'c1', normalizedPhone: '+97333333333', primaryPhone: '+97333333333' },
    { _id: 'c2', normalizedPhone: '97333333333', primaryPhone: '0097333333333' },
    { _id: 'c3', normalizedPhone: '+97334444444', primaryPhone: '+97335555555' }
  ];
  const plan = buildPlan({
    customers,
    puzzles: [],
    orders: [{ puzzleId: 'missing', paymentStatus: 'paid', createdAt: d(1), paidAt: d(1, 5) }]
  });
  assert.strictEqual(plan.counts.duplicateNormalizedCustomers, 1);
  assert.strictEqual(plan.counts.unmatchableRecords, 1);
  assert.strictEqual(plan.counts.unmatchablePaidRecords, 1);
  assert.strictEqual(plan.counts.ambiguousPhoneMatches, 1);
  assert.strictEqual(customerCanonicalIdentity(customers[2]).ambiguous, true);
});

test('waitlist or puzzle data without a genuine Order is ignored', () => {
  const plan = buildPlan({
    customers: [], orders: [],
    puzzles: [{ publicId: 'waitlist-like', senderPhone: '+97333333333' }]
  });
  assert.strictEqual(plan.creates.length, 0);
  assert.strictEqual(plan.counts.customersToCreateFromPaidOrders, 0);
  assert.strictEqual(plan.counts.customersToCreateFromAbandonedCheckouts, 0);
});

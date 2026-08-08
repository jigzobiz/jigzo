const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Customer = require('../src/models/Customer');
const Counter = require('../src/models/Counter');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const Sale = require('../src/models/Sale');
const JourneyEvent = require('../src/models/JourneyEvent');
const AnonymousSession = require('../src/models/AnonymousSession');
const customerService = require('../src/services/customerService');
const deletionService = require('../src/services/customerDeletionService');

const query = (value) => ({ session() { return this; }, lean: async () => value });
const phone = '+97333333333';

test('normalized variants resolve to one deletion identity', () => {
  assert.strictEqual(deletionService.canonicalCustomerPhone({ normalizedPhone: phone }).phone, phone);
  assert.strictEqual(deletionService.canonicalCustomerPhone({ normalizedPhone: '97333333333' }).phone, phone);
  assert.strictEqual(deletionService.canonicalCustomerPhone({ normalizedPhone: '0097333333333' }).phone, phone);
});

test('paid Order, Sale, and CAPTURED transaction independently block deletion', () => {
  const customer = { customerId: 'JZ-CUS-00001', normalizedPhone: phone, primaryPhone: phone };
  const puzzles = [{ publicId: 'p1', status: 'pending_payment' }];
  const base = { customer, puzzles, orders: [{ _id: 'o1', orderId: 'order-1', puzzleId: 'p1', paymentStatus: 'failed' }], paymentTransactions: [], sales: [] };
  assert.strictEqual(deletionService.assessFinancialHistory({ ...base, orders: [{ ...base.orders[0], paymentStatus: 'paid' }] }).blocked, true);
  assert.strictEqual(deletionService.assessFinancialHistory({ ...base, orders: [{ ...base.orders[0], paymentStatus: 'refunded' }] }).blocked, true);
  assert.strictEqual(deletionService.assessFinancialHistory({ ...base, sales: [{ orderId: 'order-1' }] }).blocked, true);
  assert.strictEqual(deletionService.assessFinancialHistory({ ...base, paymentTransactions: [{ orderId: 'o1', puzzleId: 'p1', status: 'initiated', rawResponse: { status: 'CAPTURED' } }] }).blocked, true);
});

test('zero-paid test Customer is deleted after only its unpaid identity is severed; repeat is safe', async () => {
  const originals = {
    startSession: mongoose.startSession, customerFindOne: Customer.findOne, customerFind: Customer.find,
    customerDeleteOne: Customer.deleteOne, puzzleFind: Puzzle.find, puzzleUpdateMany: Puzzle.updateMany,
    orderFind: Order.find, transactionFind: PaymentTransaction.find, saleFind: Sale.find,
    journeyUpdateMany: JourneyEvent.updateMany, sessionUpdateMany: AnonymousSession.updateMany
  };
  const customer = { _id: 'c1', customerId: 'JZ-CUS-00001', normalizedPhone: phone, primaryPhone: phone };
  const other = { _id: 'c2', customerId: 'JZ-CUS-00002', normalizedPhone: '+97334444444', primaryPhone: '+97334444444' };
  let deleted = false;
  let redaction;
  const refs = [];
  mongoose.startSession = async () => ({ withTransaction: async (work) => work(), endSession: async () => {} });
  Customer.findOne = () => query(deleted ? null : customer);
  Customer.find = () => query(deleted ? [other] : [customer, other]);
  Puzzle.find = () => query([
    { _id: 'p1-mongo', publicId: 'p1', senderPhone: '0097333333333', status: 'pending_payment' },
    { _id: 'p2-mongo', publicId: 'p2', senderPhone: other.primaryPhone, status: 'pending_payment' }
  ]);
  Order.find = () => query([{ _id: 'o1', orderId: 'order-1', puzzleId: 'p1', paymentStatus: 'failed' }]);
  PaymentTransaction.find = () => query([]);
  Sale.find = () => query([]);
  Puzzle.updateMany = async (filter, update) => { redaction = { filter, update }; return { modifiedCount: 1 }; };
  JourneyEvent.updateMany = async (filter) => { refs.push(filter); return { modifiedCount: 1 }; };
  AnonymousSession.updateMany = async (filter) => { refs.push(filter); return { modifiedCount: 1 }; };
  Customer.deleteOne = async (filter) => { assert.strictEqual(filter._id, 'c1'); deleted = true; return { deletedCount: 1 }; };
  try {
    const first = await deletionService.deleteCustomerSafely(customer.customerId);
    assert.deepStrictEqual(first, { success: true, alreadyDeleted: false, redactedPuzzles: 1 });
    assert.deepStrictEqual(redaction.filter._id.$in, ['p1-mongo']);
    assert.strictEqual(redaction.update.$set.senderPhone, '');
    assert.strictEqual(redaction.update.$set.senderName, '');
    assert.strictEqual(redaction.update.$set.customerIdentityRedacted, true);
    assert.deepStrictEqual(refs, [{ customerId: 'c1' }, { customerId: 'c1' }]);
    const second = await deletionService.deleteCustomerSafely(customer.customerId);
    assert.deepStrictEqual(second, { success: true, alreadyDeleted: true, redactedPuzzles: 0 });
  } finally {
    mongoose.startSession = originals.startSession; Customer.findOne = originals.customerFindOne; Customer.find = originals.customerFind;
    Customer.deleteOne = originals.customerDeleteOne; Puzzle.find = originals.puzzleFind; Puzzle.updateMany = originals.puzzleUpdateMany;
    Order.find = originals.orderFind; PaymentTransaction.find = originals.transactionFind; Sale.find = originals.saleFind;
    JourneyEvent.updateMany = originals.journeyUpdateMany; AnonymousSession.updateMany = originals.sessionUpdateMany;
  }
});

test('deleted test history cannot reattach and a future purchase creates a fresh Customer', async () => {
  const oldFindOne = Customer.findOne;
  const oldCreate = Customer.create;
  const oldCounter = Counter.findOneAndUpdate;
  const oldFindOneAndUpdate = Customer.findOneAndUpdate;
  let created;
  Customer.findOne = async () => null;
  Customer.create = async (data) => { created = { ...data, _id: 'fresh-customer' }; return created; };
  Counter.findOneAndUpdate = async () => ({ seq: 99 });
  Customer.findOneAndUpdate = async () => null;
  try {
    const oldResult = await customerService.upsertCustomerFromPuzzleOrder({
      puzzle: { senderPhone: phone, customerIdentityRedacted: true },
      order: { createdAt: new Date('2026-08-01T00:00:00Z'), paymentStatus: 'failed' }
    });
    assert.strictEqual(oldResult, null);
    const fresh = await customerService.upsertCustomerFromPuzzleOrder({
      puzzle: { senderPhone: '97333333333', senderName: 'Fresh purchaser' },
      order: { createdAt: new Date('2026-08-02T00:00:00Z'), paidAt: new Date('2026-08-02T00:01:00Z'), paymentStatus: 'paid' }
    });
    assert.strictEqual(fresh.customerId, 'JZ-CUS-00099');
    assert.strictEqual(fresh.normalizedPhone, phone);
    assert.strictEqual(created.firstOrderAt.toISOString(), '2026-08-02T00:00:00.000Z');
  } finally {
    Customer.findOne = oldFindOne; Customer.create = oldCreate;
    Counter.findOneAndUpdate = oldCounter; Customer.findOneAndUpdate = oldFindOneAndUpdate;
  }
});

test('DELETE Customer endpoint rejects unauthenticated requests', async () => {
  const router = require('../src/routes/adminRebuild');
  const layer = router.stack.find((item) => item.route?.path === '/customers/:customerId' && item.route.methods.delete);
  assert.ok(layer);
  const auth = layer.route.stack[0].handle;
  const req = { headers: {} };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await auth(req, res, () => assert.fail('Unauthenticated request reached delete handler'));
  assert.strictEqual(res.statusCode, 401);
});

const test = require('node:test');
const assert = require('node:assert');

const auditService = require('../src/services/customerReconciliationAudit');
const historicalService = require('../src/services/customerHistoricalReconciliation');
const expectedCounts = {
  successfulPaidOrders: 3,
  saleRecords: 3,
  customerRecords: 2,
  uniqueNormalizedPaidPhones: 3,
  missingPaidCustomers: 1,
  stalePaidPuzzleTotals: 0,
  staleTotalSpendTotals: 0,
  staleLatestActivity: 0,
  staleCompletedTotals: 0,
  staleAbandonedTotals: 0,
  duplicateNormalizedCustomers: 0,
  unmatchablePaidOrders: 0,
  genuineAbandonedCheckoutPhonesMissingFromCustomer: 1
};
auditService.runCustomerReconciliationAudit = async () => expectedCounts;
const dryRunCounts = {
  customersToCreateFromPaidOrders: 1,
  customersToCreateFromAbandonedCheckouts: 2,
  existingCustomersToUpdate: 1,
  duplicateNormalizedCustomers: 0,
  unmatchableRecords: 0,
  unmatchablePaidRecords: 0,
  ambiguousPhoneMatches: 0
};
historicalService.dryRunCustomerReconciliation = async () => dryRunCounts;
historicalService.applyCustomerReconciliation = async () => ({ created: 3, updated: 1, ...dryRunCounts });
delete require.cache[require.resolve('../src/routes/internal/customerReconciliation')];
const router = require('../src/routes/internal/customerReconciliation');
const handler = router.stack.find((layer) => layer.route?.path === '/')?.route.stack[0].handle;
const dryRunHandler = router.stack.find((layer) => layer.route?.path === '/dry-run')?.route.stack[0].handle;
const applyHandler = router.stack.find((layer) => layer.route?.path === '/apply')?.route.stack[0].handle;

function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('temporary reconciliation endpoint is production-only and authenticated', async () => {
  const oldEnv = process.env.VERCEL_ENV;
  const oldSecret = process.env.CUSTOMER_RECONCILIATION_SECRET;
  try {
    process.env.VERCEL_ENV = 'preview';
    process.env.CUSTOMER_RECONCILIATION_SECRET = 'test-secret';
    const previewRes = response();
    await handler({ headers: { authorization: 'Bearer test-secret' } }, previewRes, (e) => { if (e) throw e; });
    assert.strictEqual(previewRes.statusCode, 404);

    process.env.VERCEL_ENV = 'production';
    const unauthorizedRes = response();
    await handler({ headers: { authorization: 'Bearer wrong' } }, unauthorizedRes, (e) => { if (e) throw e; });
    assert.strictEqual(unauthorizedRes.statusCode, 401);

    const authorizedRes = response();
    await handler({ headers: { authorization: 'Bearer test-secret' } }, authorizedRes, (e) => { if (e) throw e; });
    assert.deepStrictEqual(authorizedRes.body, expectedCounts);
    assert.match(authorizedRes.headers['Cache-Control'], /no-store/);
    assert.deepStrictEqual(Object.keys(authorizedRes.body).sort(), Object.keys(expectedCounts).sort());
  } finally {
    if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
    if (oldSecret === undefined) delete process.env.CUSTOMER_RECONCILIATION_SECRET; else process.env.CUSTOMER_RECONCILIATION_SECRET = oldSecret;
  }
});

test('temporary apply requires explicit confirmation and returns counts only', async () => {
  const oldEnv = process.env.VERCEL_ENV;
  const oldSecret = process.env.CUSTOMER_RECONCILIATION_SECRET;
  try {
    process.env.VERCEL_ENV = 'production';
    process.env.CUSTOMER_RECONCILIATION_SECRET = 'test-secret';
    const req = { headers: { authorization: 'Bearer test-secret' }, body: {} };
    const missingConfirmation = response();
    await applyHandler(req, missingConfirmation, (e) => { if (e) throw e; });
    assert.strictEqual(missingConfirmation.statusCode, 400);

    const dryRunRes = response();
    await dryRunHandler({ headers: req.headers }, dryRunRes, (e) => { if (e) throw e; });
    assert.deepStrictEqual(dryRunRes.body, dryRunCounts);

    const applied = response();
    await applyHandler({ ...req, body: { confirm: true } }, applied, (e) => { if (e) throw e; });
    assert.deepStrictEqual(applied.body, { created: 3, updated: 1, ...dryRunCounts });
    assert.strictEqual(Object.values(applied.body).every(Number.isInteger), true);
  } finally {
    if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv;
    if (oldSecret === undefined) delete process.env.CUSTOMER_RECONCILIATION_SECRET; else process.env.CUSTOMER_RECONCILIATION_SECRET = oldSecret;
  }
});

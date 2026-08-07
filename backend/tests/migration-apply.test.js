const test = require('node:test');
const assert = require('node:assert');

// Test-only mock secrets (never real values).
process.env.NODE_ENV = 'test';
process.env.CRON_SECRET = 'test_cron_secret_for_migration_apply';
process.env.ANALYTICS_HASH_SECRET = 'test_analytics_hash_secret_for_apply';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * DAY_MS);
const daysFromNow = (n) => new Date(now.getTime() + n * DAY_MS);

function stubModule(relPath, exportsObj) {
  const resolved = require.resolve(relPath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

// --- Puzzle write tracking: captures exactly what would be written, so we
// can assert field-level correctness, never a deleteOne/deleteMany call. ---
const puzzleWrites = [];
const puzzleDeletes = [];
const puzzles = [
  // 1. Manual review (status paid) -> must NOT be written by apply.
  {
    _id: 'pid-1',
    publicId: 'a'.repeat(32),
    status: 'paid',
    imageStorageId: 'sid-1',
    imageStoredAt: null,
    createdAt: daysAgo(2),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: null }]
  },
  // 2. Eligible, not overdue -> scheduled, future dueAt.
  {
    _id: 'pid-2',
    publicId: 'b'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-2',
    imageStoredAt: null,
    createdAt: daysAgo(5),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: null }]
  },
  // 3. Eligible, all recipients completed 8-9 days ago -> the 7-day-post-
  // completion deadline has ALREADY passed (8 days > 7) -> overdue/blocked,
  // exercising that code path deliberately (the real production dry-run
  // showed 0 such records, but the endpoint must still handle one safely).
  {
    _id: 'pid-3',
    publicId: 'c'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-3',
    imageStoredAt: null,
    createdAt: daysAgo(10),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: daysAgo(9) }, { completedAt: daysAgo(8) }]
  },
  // 4. Already stamped (post-deploy live puzzle) -> must be skipped entirely.
  {
    _id: 'pid-4',
    publicId: 'd'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-4',
    imageStoredAt: daysAgo(1),
    createdAt: daysAgo(1),
    imageDeletionDueAt: daysFromNow(29),
    recipients: [{ completedAt: null }]
  }
];

stubModule('../src/models/Puzzle', {
  countDocuments: async () => 0, // no legacy /uploads records in this fixture
  updateMany: async () => { throw new Error('unexpected updateMany (no legacy records expected)'); },
  find: () => ({
    cursor: () => {
      let i = 0;
      return { next: async () => (i < puzzles.length ? puzzles[i++] : null) };
    }
  }),
  updateOne: async (filter, update) => {
    puzzleWrites.push({ filter, update });
    return { acknowledged: true };
  },
  deleteOne: async (...args) => { puzzleDeletes.push(args); throw new Error('unexpected Puzzle.deleteOne'); },
  deleteMany: async (...args) => { puzzleDeletes.push(args); throw new Error('unexpected Puzzle.deleteMany'); }
});

stubModule('../src/models/Order', {
  findOne: () => ({ sort: async () => null }), // no orders -> no additional manual-review triggers
  updateOne: async () => { throw new Error('unexpected Order write — orders must never be modified'); },
  updateMany: async () => { throw new Error('unexpected Order write — orders must never be modified'); },
  deleteOne: async () => { throw new Error('unexpected Order write — orders must never be modified'); }
});

// --- JourneyEvent fixtures ---
const journeyWrites = [];
const journeyDeletes = [];
const events = [
  { _id: 'e1', pageUrl: `/p/${'x'.repeat(32)}?r=0`, metadata: { puzzleId: 'x'.repeat(32) }, puzzleRef: null },
  { _id: 'e2', pageUrl: '/p/:puzzleId', metadata: {}, puzzleRef: null }, // already sanitized -> no write
  { _id: 'e3', pageUrl: '/', metadata: { phone: '+97300000000' }, puzzleRef: null }
];

stubModule('../src/models/JourneyEvent', {
  find: () => ({
    cursor: () => {
      let i = 0;
      return { next: async () => (i < events.length ? events[i++] : null) };
    }
  }),
  updateOne: async (filter, update) => {
    journeyWrites.push({ filter, update });
    return { acknowledged: true };
  },
  updateMany: async () => { throw new Error('unexpected JourneyEvent.updateMany'); },
  deleteOne: async (...args) => { journeyDeletes.push(args); throw new Error('unexpected JourneyEvent.deleteOne'); },
  deleteMany: async (...args) => { journeyDeletes.push(args); throw new Error('unexpected JourneyEvent.deleteMany'); }
});

// Required AFTER stubs are seeded — these (and their deep dependencies) do
// their own top-level require('../models/...') which must resolve to fakes.
const applyRouter = require('../src/routes/internal/migrationApply');

function getHandler(router, method, routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method]
  );
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; }
  };
}

const handler = getHandler(applyRouter, 'post', '/');

function invoke(headers, body) {
  return new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers, body }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });
}

test('unauthorized request returns 401 before any database work, and never writes', async () => {
  const before = puzzleWrites.length + journeyWrites.length;
  const res = await invoke({}, { confirm: 'I_UNDERSTAND', target: 'imageRetention' });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(puzzleWrites.length + journeyWrites.length, before);
});

test('authorized but missing confirm returns 400 and never writes', async () => {
  const before = puzzleWrites.length + journeyWrites.length;
  const res = await invoke(
    { authorization: `Bearer ${process.env.CRON_SECRET}` },
    { target: 'imageRetention' }
  );
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(puzzleWrites.length + journeyWrites.length, before);
});

test('authorized + confirm but invalid target returns 400 and never writes', async () => {
  const before = puzzleWrites.length + journeyWrites.length;
  const res = await invoke(
    { authorization: `Bearer ${process.env.CRON_SECRET}` },
    { confirm: 'I_UNDERSTAND', target: 'somethingElse' }
  );
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(puzzleWrites.length + journeyWrites.length, before);
});

test('authorized + confirm alone (no target) still requires target and never writes', async () => {
  const before = puzzleWrites.length + journeyWrites.length;
  const res = await invoke(
    { authorization: `Bearer ${process.env.CRON_SECRET}` },
    { confirm: 'I_UNDERSTAND' }
  );
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(puzzleWrites.length + journeyWrites.length, before);
});

test('imageRetention apply: writes exactly the eligible records, skips manual-review and already-stamped, never touches Order, never deletes', async () => {
  const res = await invoke(
    { authorization: `Bearer ${process.env.CRON_SECRET}` },
    { confirm: 'I_UNDERSTAND', target: 'imageRetention' }
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.target, 'imageRetention');
  assert.deepStrictEqual(res.body.counts, {
    totalWithBinary: 4,
    alreadyStamped: 1,      // puzzle 4
    manualReview: 1,        // puzzle 1
    wouldScheduleFuture: 1, // puzzle 2
    wouldBlockOverdue: 1,   // puzzle 3 (7-day-post-completion deadline already passed)
    legacyNoBinary: 0,
    applied: 2              // puzzles 2, 3 both written (different resulting status)
  });

  // Exactly two Puzzle.updateOne calls, for puzzles 2 and 3 only.
  assert.strictEqual(puzzleWrites.length, 2);
  const writeIds = puzzleWrites.map((w) => w.filter._id).sort();
  assert.deepStrictEqual(writeIds, ['pid-2', 'pid-3']);

  const write2 = puzzleWrites.find((w) => w.filter._id === 'pid-2').update.$set;
  assert.deepStrictEqual(write2.imageStoredAt, puzzles[1].createdAt); // imageStoredAt was null -> falls back to createdAt
  assert.strictEqual(write2.allRecipientsCompletedAt, null);
  assert.strictEqual(write2.imageDeletionStatus, 'scheduled');
  assert.ok(write2.imageDeletionDueAt.getTime() > now.getTime()); // still in the future

  const write3 = puzzleWrites.find((w) => w.filter._id === 'pid-3').update.$set;
  assert.deepStrictEqual(write3.allRecipientsCompletedAt, daysAgo(8)); // latest of the two completions
  // Overdue: blocked immediately (access already stops via the isImageExpired
  // gate), but physical deletion gets a 3-day review buffer, NEVER an
  // already-past date — this is what "no image becomes immediately
  // inaccessible... unless the expectation is false" is guarding against.
  assert.strictEqual(write3.imageDeletionStatus, 'blocked');
  const expectedBuffer = daysFromNow(3).getTime();
  assert.ok(Math.abs(write3.imageDeletionDueAt.getTime() - expectedBuffer) < 5000, 'buffer date is ~3 days from now');

  // Manual-review (puzzle 1) and already-stamped (puzzle 4) got NO write.
  assert.ok(!puzzleWrites.some((w) => w.filter._id === 'pid-1'));
  assert.ok(!puzzleWrites.some((w) => w.filter._id === 'pid-4'));

  // Never deletes a Puzzle document.
  assert.strictEqual(puzzleDeletes.length, 0);

  // Response contains counts only — no publicIds, no image URLs.
  const bodyText = JSON.stringify(res.body);
  for (const p of puzzles) assert.ok(!bodyText.includes(p.publicId));
});

test('analytics apply: sanitizes only records that need it, stamps puzzleRef, never deletes', async () => {
  const res = await invoke(
    { authorization: `Bearer ${process.env.CRON_SECRET}` },
    { confirm: 'I_UNDERSTAND', target: 'analytics' }
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.target, 'analytics');
  assert.deepStrictEqual(res.body.counts, {
    totalEvents: 3,
    pageUrlWithCapability: 1,
    pageUrlWithQueryOrHash: 1,
    metadataWithPuzzleId: 1,
    metadataWithOtherSensitive: 1,
    updated: 2 // e1 (url+metadata) and e3 (metadata) needed rewriting; e2 already clean
  });

  assert.strictEqual(journeyWrites.length, 2);
  const write1 = journeyWrites.find((w) => w.filter._id === 'e1').update.$set;
  assert.strictEqual(write1.pageUrl, '/p/:puzzleId');
  assert.deepStrictEqual(write1.metadata, {});
  assert.match(write1.puzzleRef, /^[0-9a-f]{12}$/);

  const write3 = journeyWrites.find((w) => w.filter._id === 'e3').update.$set;
  assert.strictEqual(write3.pageUrl, '/');
  assert.deepStrictEqual(write3.metadata, {});

  // The already-sanitized event (e2) was never written.
  assert.ok(!journeyWrites.some((w) => w.filter._id === 'e2'));

  // Never deletes a JourneyEvent document.
  assert.strictEqual(journeyDeletes.length, 0);

  const bodyText = JSON.stringify(res.body);
  assert.ok(!bodyText.includes('x'.repeat(32)));
  assert.ok(!bodyText.includes('+97300000000'));
});

test('CRON_SECRET and MIGRATION_DRYRUN_SECRET are never present in the response body', async () => {
  const res = await invoke(
    { authorization: `Bearer ${process.env.CRON_SECRET}` },
    { confirm: 'I_UNDERSTAND', target: 'imageRetention' }
  );
  const bodyText = JSON.stringify(res.body);
  assert.ok(!bodyText.includes(process.env.CRON_SECRET));
});

test('module source contains no document-deletion calls (defense in depth)', () => {
  const fs = require('fs');
  const path = require('path');
  for (const relPath of [
    ['..', 'src', 'routes', 'internal', 'migrationApply.js'],
    ['..', 'src', 'utils', 'migrationBackfill.js'],
    ['..', 'src', 'utils', 'migrationSanitizeJourney.js']
  ]) {
    const src = fs.readFileSync(path.join(__dirname, ...relPath), 'utf8');
    for (const forbidden of ['deleteOne(', 'deleteMany(', 'findOneAndDelete(', 'Order.updateOne', 'Order.updateMany']) {
      assert.ok(!src.includes(forbidden), `${relPath.join('/')} must not contain ${forbidden}`);
    }
  }
});

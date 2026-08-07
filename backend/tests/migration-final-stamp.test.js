const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.CRON_SECRET = 'test_cron_secret_for_final_stamp';
process.env.ANALYTICS_HASH_SECRET = 'test_analytics_hash_secret_for_final_stamp';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * DAY_MS);
const daysFromNow = (n) => new Date(now.getTime() + n * DAY_MS);

function stubModule(relPath, exportsObj) {
  const resolved = require.resolve(relPath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

const puzzleWrites = [];
let puzzles; // reassigned per test via resetPuzzles()

function resetPuzzles(list) {
  puzzles = list;
  puzzleWrites.length = 0;
}

stubModule('../src/models/Puzzle', {
  countDocuments: async () => 0,
  updateMany: async () => { throw new Error('unexpected Puzzle.updateMany'); },
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
  deleteOne: async () => { throw new Error('unexpected Puzzle.deleteOne'); },
  deleteMany: async () => { throw new Error('unexpected Puzzle.deleteMany'); }
});

// finalRetentionStamp never touches Order or JourneyEvent, but the apply
// router requires all three migration utils at load time — stub them to
// throw if ever actually called, proving they're untouched.
stubModule('../src/models/Order', {
  findOne: () => { throw new Error('unexpected Order read/write — finalRetentionStamp must not touch Order'); },
  updateOne: async () => { throw new Error('unexpected Order write'); }
});
stubModule('../src/models/JourneyEvent', {
  find: () => { throw new Error('unexpected JourneyEvent access'); },
  updateOne: async () => { throw new Error('unexpected JourneyEvent write'); }
});

const applyRouter = require('../src/routes/internal/migrationApply');
const { runFinalRetentionStamp } = require('../src/utils/migrationFinalStamp');

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

function invokeApply(body) {
  return new Promise((resolve, reject) => {
    const r = mockRes();
    handler(
      { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, body },
      { ...r, json(o) { this.body = o; resolve(this); return this; } },
      reject
    );
  });
}

test('stamps a previously-manual-review record (status=paid) that the standard backfill would have skipped', async () => {
  resetPuzzles([
    {
      _id: 'pid-1',
      publicId: 'a'.repeat(32),
      status: 'paid', // would be manual-review under runBackfillImageRetention
      imageStorageId: 'sid-1',
      imageStoredAt: null,
      createdAt: daysAgo(3),
      imageDeletionDueAt: null,
      recipients: [{ completedAt: null }]
    }
  ]);

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.counts.totalStoredImages, 1);
  assert.strictEqual(res.body.counts.missingEither, 1);
  assert.strictEqual(res.body.counts.wouldStamp, 1);
  assert.strictEqual(res.body.counts.wouldBeOverdue, 0);
  assert.strictEqual(res.body.counts.applied, 1);

  assert.strictEqual(puzzleWrites.length, 1);
  const write = puzzleWrites[0].update.$set;
  assert.deepStrictEqual(write.imageStoredAt, daysAgo(3)); // fell back to createdAt
  assert.strictEqual(write.allRecipientsCompletedAt, null);
  assert.strictEqual(write.imageDeletionStatus, 'scheduled');
  assert.ok(write.imageDeletionDueAt.getTime() > now.getTime());
});

test('all-or-nothing: one overdue-eligible record blocks writes for ALL records in the same call', async () => {
  resetPuzzles([
    {
      // Safe record that WOULD be stamped if evaluated alone.
      _id: 'pid-safe',
      publicId: 'b'.repeat(32),
      status: 'delivered',
      imageStorageId: 'sid-safe',
      imageStoredAt: daysAgo(1),
      createdAt: daysAgo(1),
      imageDeletionDueAt: null,
      recipients: [{ completedAt: null }]
    },
    {
      // All recipients completed 9 days ago -> 7-day-post-completion
      // deadline already passed -> triggers the stop.
      _id: 'pid-overdue',
      publicId: 'c'.repeat(32),
      status: 'delivered',
      imageStorageId: 'sid-overdue',
      imageStoredAt: daysAgo(20),
      createdAt: daysAgo(20),
      imageDeletionDueAt: null,
      recipients: [{ completedAt: daysAgo(9) }]
    }
  ]);

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp' });

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.stopped, true);
  assert.strictEqual(res.body.applied, false);
  assert.strictEqual(res.body.counts.wouldBeOverdue, 1);
  assert.strictEqual(res.body.counts.wouldStamp, 1); // the safe one was identified...

  // ...but NOTHING was written, not even the safe record.
  assert.strictEqual(puzzleWrites.length, 0);
});

test('a record that already has imageDeletionDueAt is never touched (never extended)', async () => {
  const existingDueAt = daysFromNow(15);
  resetPuzzles([
    {
      _id: 'pid-already',
      publicId: 'd'.repeat(32),
      status: 'paid',
      imageStorageId: 'sid-already',
      imageStoredAt: daysAgo(15),
      createdAt: daysAgo(15),
      imageDeletionDueAt: existingDueAt,
      recipients: [{ completedAt: null }]
    }
  ]);

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counts.totalStoredImages, 1);
  assert.strictEqual(res.body.counts.withImageStoredAt, 1);
  assert.strictEqual(res.body.counts.withImageDeletionDueAt, 1);
  assert.strictEqual(res.body.counts.missingEither, 0);
  assert.strictEqual(res.body.counts.applied, 0);
  assert.strictEqual(puzzleWrites.length, 0); // completely untouched
});

test('dry-run mode (apply:false) never writes, regardless of outcome', async () => {
  resetPuzzles([
    {
      _id: 'pid-x',
      publicId: 'e'.repeat(32),
      status: 'paid',
      imageStorageId: 'sid-x',
      imageStoredAt: null,
      createdAt: daysAgo(2),
      imageDeletionDueAt: null,
      recipients: []
    }
  ]);

  const result = await runFinalRetentionStamp({ apply: false, now });
  assert.strictEqual(result.counts.wouldStamp, 1);
  assert.strictEqual(result.counts.applied, 0);
  assert.strictEqual(puzzleWrites.length, 0);
});

test('unauthorized and missing-confirm paths reject finalRetentionStamp too, with zero writes', async () => {
  resetPuzzles([
    {
      _id: 'pid-y',
      publicId: 'f'.repeat(32),
      status: 'paid',
      imageStorageId: 'sid-y',
      imageStoredAt: null,
      createdAt: daysAgo(1),
      imageDeletionDueAt: null,
      recipients: []
    }
  ]);

  const noAuth = await new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers: {}, body: { confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp' } },
      { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });
  assert.strictEqual(noAuth.statusCode, 401);

  const noConfirm = await invokeApply({ target: 'finalRetentionStamp' });
  assert.strictEqual(noConfirm.statusCode, 400);

  assert.strictEqual(puzzleWrites.length, 0);
});

test('response never contains a raw publicId or the CRON_SECRET value', async () => {
  resetPuzzles([
    {
      _id: 'pid-z',
      publicId: 'g'.repeat(32),
      status: 'paid',
      imageStorageId: 'sid-z',
      imageStoredAt: null,
      createdAt: daysAgo(1),
      imageDeletionDueAt: null,
      recipients: []
    }
  ]);
  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp' });
  const bodyText = JSON.stringify(res.body);
  assert.ok(!bodyText.includes('g'.repeat(32)));
  assert.ok(!bodyText.includes(process.env.CRON_SECRET));
});

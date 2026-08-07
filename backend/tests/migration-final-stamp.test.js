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

function resetPuzzles(list, orders = null) {
  puzzles = list;
  puzzleWrites.length = 0;
  ordersByPuzzleId = orders;
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

// finalRetentionStamp never WRITES Order, but in skipOverdue mode it DOES
// read Order (read-only) to build the non-identifying overdue detail
// summary. ordersByPuzzleId is configured per-test; default throws so any
// test not expecting an Order read fails loudly if one occurs.
let ordersByPuzzleId = null;
stubModule('../src/models/Order', {
  findOne: (query) => ({
    sort: async () => {
      if (ordersByPuzzleId === null) {
        throw new Error('unexpected Order read — this test does not expect one');
      }
      return ordersByPuzzleId[query.puzzleId] || null;
    }
  }),
  updateOne: async () => { throw new Error('unexpected Order write — finalRetentionStamp must never write Order'); },
  updateMany: async () => { throw new Error('unexpected Order write — finalRetentionStamp must never write Order'); }
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

// --- skipOverdue mode: stamp the safe subset, leave overdue records untouched ---

test('skipOverdue: stamps the safe record, leaves the overdue record completely untouched, reports non-identifying detail', async () => {
  resetPuzzles(
    [
      {
        _id: 'pid-safe',
        publicId: 'h'.repeat(32),
        status: 'delivered',
        imageStorageId: 'sid-safe',
        imageStoredAt: daysAgo(1),
        createdAt: daysAgo(1),
        imageDeletionDueAt: null,
        recipients: [{ completedAt: null }]
      },
      {
        // All recipients completed 9 days ago -> 7-day deadline already
        // passed by 2 days. Paid 3 days ago (recently), not refunded,
        // status still 'delivered' (delivery succeeded).
        _id: 'pid-overdue',
        publicId: 'i'.repeat(32),
        status: 'delivered',
        imageStorageId: 'sid-overdue',
        imageStoredAt: daysAgo(20),
        createdAt: daysAgo(20),
        imageDeletionDueAt: null,
        recipients: [{ completedAt: daysAgo(9) }]
      }
    ],
    {
      ['i'.repeat(32)]: { paymentStatus: 'paid', paidAt: daysAgo(3), lastPaymentError: '' }
    }
  );

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'skipOverdue' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.mode, 'skipOverdue');
  assert.strictEqual(res.body.counts.wouldStamp, 1);
  assert.strictEqual(res.body.counts.wouldBeOverdue, 1);
  assert.strictEqual(res.body.counts.applied, 1); // only the safe one

  // Only the safe record was written.
  assert.strictEqual(puzzleWrites.length, 1);
  assert.strictEqual(puzzleWrites[0].filter._id, 'pid-safe');

  // Non-identifying detail for the overdue record.
  assert.strictEqual(res.body.overdueDetails.length, 1);
  const detail = res.body.overdueDetails[0];
  assert.strictEqual(detail.puzzleStatus, 'delivered');
  assert.strictEqual(detail.deliveredSuccessfully, true);
  assert.strictEqual(detail.allRecipientsCompleted, true);
  assert.strictEqual(detail.paymentExists, true);
  assert.strictEqual(detail.paidWithinLast7Days, true);
  assert.strictEqual(detail.refunded, false);
  assert.strictEqual(detail.hasManualResolutionMarker, false);
  assert.ok(detail.deadlineOverdueDays > 0);
  assert.strictEqual(typeof detail.imageAgeDays, 'number');
  assert.strictEqual(typeof detail.daysSinceAllRecipientsCompleted, 'number');

  // No identifying fields anywhere in the detail or the response.
  const bodyText = JSON.stringify(res.body);
  assert.ok(!bodyText.includes('h'.repeat(32)));
  assert.ok(!bodyText.includes('i'.repeat(32)));
  assert.ok(!('publicId' in detail));
});

test('skipOverdue detects refunded and manual-resolution-marker orders correctly', async () => {
  resetPuzzles(
    [
      {
        _id: 'pid-refunded',
        publicId: 'j'.repeat(32),
        status: 'delivered',
        imageStorageId: 'sid-refunded',
        imageStoredAt: daysAgo(25),
        createdAt: daysAgo(25),
        imageDeletionDueAt: null,
        recipients: [{ completedAt: daysAgo(15) }]
      },
      {
        _id: 'pid-manual',
        publicId: 'k'.repeat(32),
        status: 'paid',
        imageStorageId: 'sid-manual',
        imageStoredAt: daysAgo(40),
        createdAt: daysAgo(40),
        imageDeletionDueAt: null,
        recipients: []
      }
    ],
    {
      ['j'.repeat(32)]: { paymentStatus: 'refunded', paidAt: daysAgo(20), lastPaymentError: '' },
      ['k'.repeat(32)]: { paymentStatus: 'paid', paidAt: daysAgo(35), lastPaymentError: 'PAID_AFTER_IMAGE_RETENTION_DEADLINE_MANUAL_RESOLUTION_REQUIRED' }
    }
  );

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'skipOverdue' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counts.wouldBeOverdue, 2);
  assert.strictEqual(res.body.counts.applied, 0); // neither is safe
  assert.strictEqual(puzzleWrites.length, 0);

  assert.strictEqual(res.body.overdueDetails.length, 2);
  const refundedDetail = res.body.overdueDetails.find((d) => d.refunded === true);
  assert.ok(refundedDetail);
  assert.strictEqual(refundedDetail.paymentExists, true);

  const manualDetail = res.body.overdueDetails.find((d) => d.hasManualResolutionMarker === true);
  assert.ok(manualDetail);
  assert.strictEqual(manualDetail.paymentExists, true);
  assert.strictEqual(manualDetail.refunded, false);

  // Most-overdue-first ordering (pid-manual is 40 days old with a 30-day
  // cap deadline vs pid-refunded's 7-day-post-completion deadline).
  assert.ok(res.body.overdueDetails[0].deadlineOverdueDays >= res.body.overdueDetails[1].deadlineOverdueDays);
});

test('skipOverdue with dryRun:true previews without writing anything', async () => {
  resetPuzzles(
    [
      {
        _id: 'pid-safe2',
        publicId: 'l'.repeat(32),
        status: 'delivered',
        imageStorageId: 'sid-safe2',
        imageStoredAt: daysAgo(1),
        createdAt: daysAgo(1),
        imageDeletionDueAt: null,
        recipients: []
      },
      {
        _id: 'pid-overdue2',
        publicId: 'm'.repeat(32),
        status: 'delivered',
        imageStorageId: 'sid-overdue2',
        imageStoredAt: daysAgo(20),
        createdAt: daysAgo(20),
        imageDeletionDueAt: null,
        recipients: [{ completedAt: daysAgo(10) }]
      }
    ],
    { ['m'.repeat(32)]: null }
  );

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'skipOverdue', dryRun: true });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.applied, false);
  assert.strictEqual(res.body.counts.wouldStamp, 1);
  assert.strictEqual(res.body.counts.wouldBeOverdue, 1);
  assert.strictEqual(res.body.overdueDetails.length, 1);
  assert.strictEqual(res.body.overdueDetails[0].paymentExists, false);

  // Nothing written despite mode:skipOverdue identifying a safe record.
  assert.strictEqual(puzzleWrites.length, 0);
});

// --- grandfather mode: approved one-time exception for legacy records ---

test('grandfather: stamps min(now+7d, imageStoredAt+30d), sets ONLY the 3 named fields, never touches Order', async () => {
  resetPuzzles([
    {
      // Legacy-A-like: ~14 days old -> imageStoredAt+30d is ~16 days out,
      // so now+7d (the earlier one) should win.
      _id: 'pid-legacy-a',
      publicId: 'n'.repeat(32),
      status: 'paid',
      imageStorageId: 'sid-legacy-a',
      imageStoredAt: null,
      createdAt: daysAgo(14),
      imageDeletionDueAt: null,
      recipients: [{ completedAt: daysAgo(13) }]
    }
  ]);

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'grandfather' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.mode, 'grandfather');
  assert.strictEqual(res.body.counts.wouldStamp, 1);
  assert.strictEqual(res.body.counts.wouldBeOverdue, 0);
  assert.strictEqual(res.body.counts.applied, 1);

  assert.strictEqual(puzzleWrites.length, 1);
  const { filter, update } = puzzleWrites[0];
  assert.strictEqual(filter._id, 'pid-legacy-a');
  assert.strictEqual(filter.imageDeletionDueAt, null); // write guard: never touch an existing deadline

  const set = update.$set;
  assert.deepStrictEqual(Object.keys(set).sort(), ['imageDeletionDueAt', 'imageDeletionStatus', 'imageStoredAt'].sort());
  assert.deepStrictEqual(set.imageStoredAt, daysAgo(14)); // fell back to createdAt
  assert.strictEqual(set.imageDeletionStatus, 'scheduled');

  const expected7d = daysFromNow(7).getTime();
  assert.ok(Math.abs(set.imageDeletionDueAt.getTime() - expected7d) < 5000, 'due date is ~7 days from now (the earlier bound)');
  assert.ok(set.imageDeletionDueAt.getTime() > now.getTime());
});

test('grandfather: a record already 25 days old gets capped by the 30-day bound, not now+7d', async () => {
  resetPuzzles([
    {
      // 25 days old -> imageStoredAt+30d is only 5 days out, EARLIER than now+7d.
      _id: 'pid-legacy-old',
      publicId: 'o'.repeat(32),
      status: 'delivered',
      imageStorageId: 'sid-legacy-old',
      imageStoredAt: null,
      createdAt: daysAgo(25),
      imageDeletionDueAt: null,
      recipients: []
    }
  ]);

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'grandfather' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counts.applied, 1);
  const set = puzzleWrites[0].update.$set;
  const expected5d = daysFromNow(5).getTime();
  assert.ok(Math.abs(set.imageDeletionDueAt.getTime() - expected5d) < 5000, 'due date is ~5 days from now (the 30-day-from-storage bound, which is earlier than now+7d here)');
});

test('grandfather never touches a record that already has a deadline', async () => {
  const existingDueAt = daysFromNow(20);
  resetPuzzles([
    {
      _id: 'pid-already-2',
      publicId: 'p'.repeat(32),
      status: 'delivered',
      imageStorageId: 'sid-already-2',
      imageStoredAt: daysAgo(5),
      createdAt: daysAgo(5),
      imageDeletionDueAt: existingDueAt,
      recipients: []
    }
  ]);

  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'grandfather' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counts.applied, 0);
  assert.strictEqual(puzzleWrites.length, 0);
});

test('grandfather never calls Order (payment/puzzle/recipient/WhatsApp data untouched)', async () => {
  resetPuzzles([
    {
      _id: 'pid-legacy-b',
      publicId: 'q'.repeat(32),
      status: 'paid',
      imageStorageId: 'sid-legacy-b',
      imageStoredAt: null,
      createdAt: daysAgo(8),
      imageDeletionDueAt: null,
      recipients: [{ completedAt: daysAgo(8) }]
    }
  ]);
  // ordersByPuzzleId stays null (default) -> Order.findOne would throw if called.
  const res = await invokeApply({ confirm: 'I_UNDERSTAND', target: 'finalRetentionStamp', mode: 'grandfather' });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.counts.applied, 1);
});

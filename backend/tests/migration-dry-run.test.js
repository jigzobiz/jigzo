const test = require('node:test');
const assert = require('node:assert');

// Test-only mock secret (never a real value).
process.env.NODE_ENV = 'test';
process.env.CRON_SECRET = 'test_cron_secret_for_migration_dryrun';

const DAY_MS = 24 * 60 * 60 * 1000;
// Anchored to the REAL current time: the route computes its own `new
// Date()` at request time, so fixtures must be built off the same clock
// (not a hardcoded date) or boundary-crossing records could misclassify
// depending on how much real time has passed since this file was written.
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * DAY_MS);

function stubModule(relPath, exportsObj) {
  const resolved = require.resolve(relPath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

// --- Write-attempt tracker: every mutating method throws AND records the
// attempt, so any accidental write anywhere in the endpoint is impossible
// to miss — either the test explicitly sees writeAttempts grow, or the
// request itself fails loudly.
const writeAttempts = [];
function trackWrite(name) {
  return (...args) => {
    writeAttempts.push({ name, args });
    throw new Error(`Unexpected WRITE call: ${name}`);
  };
}

// --- Fixture puzzles, covering every bucket ---
const puzzles = [
  // 1. Old, incomplete, well past 30-day deadline -> deadlineAlreadyPassed, olderThan30Days, incompleteRecipients
  {
    publicId: 'a'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-1',
    imageStoredAt: daysAgo(45),
    createdAt: daysAgo(45),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: null }]
  },
  // 2. Fresh, incomplete, well within retention -> stillWithinRetention, incompleteRecipients
  {
    publicId: 'b'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-2',
    imageStoredAt: daysAgo(2),
    createdAt: daysAgo(2),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: null }]
  },
  // 3. All recipients completed long ago -> allRecipientsCompleted, deadlineAlreadyPassed (7d rule), NOT olderThan30Days
  {
    publicId: 'c'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-3',
    imageStoredAt: daysAgo(10),
    createdAt: daysAgo(10),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: daysAgo(9) }, { completedAt: daysAgo(8) }]
  },
  // 4. Already-stamped by live creation-time code (post-deploy puzzle) -> uses imageDeletionDueAt directly, stillWithinRetention
  {
    publicId: 'd'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-4',
    imageStoredAt: daysAgo(1),
    createdAt: daysAgo(1),
    imageDeletionDueAt: new Date(now.getTime() + 29 * DAY_MS),
    recipients: [{ completedAt: null }]
  },
  // 5. Manual review: currently paid, recently -> manualReview, excluded from deadline buckets
  {
    publicId: 'e'.repeat(32),
    status: 'paid',
    imageStorageId: 'sid-5',
    imageStoredAt: daysAgo(3),
    createdAt: daysAgo(3),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: null }]
  },
  // 6. Malformed record: reading a field throws mid-classification ->
  // caught by the per-record try/catch, counted as unclassified, and never
  // crashes the rest of the report (proves the endpoint is resilient to
  // corrupt/unexpected data rather than failing the whole request).
  {
    publicId: 'f'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-6',
    createdAt: daysAgo(5),
    get imageStoredAt() { throw new Error('boom'); },
    imageDeletionDueAt: null,
    recipients: []
  },
  // 7. Manual review via REFUNDED order only (status 'draft' is not in the
  // auto-trigger list) -> exercises the refundedOrder breakdown dimension
  // and shows a non-"active" payment status can still force manual review.
  {
    publicId: 'g'.repeat(32),
    status: 'draft',
    imageStorageId: 'sid-7',
    imageStoredAt: daysAgo(4),
    createdAt: daysAgo(4),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: null }]
  },
  // 8. Manual review via RECENTLY-PAID order only (status 'delivered' is
  // not in the auto-trigger list, but the order paid 2 days ago) -> proves
  // byPuzzleStatus.delivered and recentlyPaidOrder can overlap on one
  // record, and exercises allRecipientsCompleted within the review set.
  {
    publicId: 'h'.repeat(32),
    status: 'delivered',
    imageStorageId: 'sid-8',
    imageStoredAt: daysAgo(6),
    createdAt: daysAgo(6),
    imageDeletionDueAt: null,
    recipients: [{ completedAt: daysAgo(5) }]
  },
  // 9. Manual review via puzzle.status alone ('preparing'); order is paid
  // but OLD (10 days ago) -> proves activePaidOrder (payment currently
  // paid) is a distinct signal from recentlyPaidOrder (paid <7 days ago).
  {
    publicId: 'i'.repeat(32),
    status: 'preparing',
    imageStorageId: 'sid-9',
    imageStoredAt: daysAgo(1),
    createdAt: daysAgo(1),
    imageDeletionDueAt: null,
    recipients: []
  }
];

stubModule('../src/models/Puzzle', {
  countDocuments: trackReadOnlyCountDocuments,
  find: (query) => ({
    cursor: () => {
      const matching = puzzles.filter((p) => p.imageStorageId != null);
      let i = 0;
      return { next: async () => (i < matching.length ? matching[i++] : null) };
    }
  }),
  updateOne: trackWrite('Puzzle.updateOne'),
  updateMany: trackWrite('Puzzle.updateMany'),
  findOneAndUpdate: trackWrite('Puzzle.findOneAndUpdate'),
  deleteOne: trackWrite('Puzzle.deleteOne'),
  deleteMany: trackWrite('Puzzle.deleteMany')
});

function trackReadOnlyCountDocuments(query) {
  // Legacy-uploads count: read-only, always returns a fixed known value.
  return Promise.resolve(2);
}

const ORDERS_BY_PUZZLE_ID = {
  ['e'.repeat(32)]: { paymentStatus: 'paid', paidAt: daysAgo(1) },       // recently paid
  ['g'.repeat(32)]: { paymentStatus: 'refunded' },                       // refunded
  ['h'.repeat(32)]: { paymentStatus: 'paid', paidAt: daysAgo(2) },       // recently paid
  ['i'.repeat(32)]: { paymentStatus: 'paid', paidAt: daysAgo(10) }       // paid, but NOT recent
};

stubModule('../src/models/Order', {
  findOne: (query) => ({
    sort: async () => ORDERS_BY_PUZZLE_ID[query.puzzleId] || null
  }),
  updateOne: trackWrite('Order.updateOne'),
  updateMany: trackWrite('Order.updateMany'),
  deleteOne: trackWrite('Order.deleteOne')
});

// --- Fixture JourneyEvents ---
const events = [
  { pageUrl: `/p/${'a'.repeat(32)}?r=0`, metadata: {} }, // capability URL + query string
  { pageUrl: '/p/:puzzleId', metadata: {} }, // already sanitized -> none of the flags
  { pageUrl: '/create', metadata: { puzzleId: 'x'.repeat(32) } }, // rawPublicIds
  { pageUrl: '/', metadata: { phone: '+97300000000' } }, // sensitiveMetadata
  { pageUrl: '/', metadata: { occasion: 'birthday' } }, // clean, no flags
  { get pageUrl() { throw new Error('boom'); }, metadata: {} } // forces unclassified via try/catch
];

stubModule('../src/models/JourneyEvent', {
  find: () => ({
    cursor: () => {
      let i = 0;
      return { next: async () => (i < events.length ? events[i++] : null) };
    }
  }),
  updateOne: trackWrite('JourneyEvent.updateOne'),
  updateMany: trackWrite('JourneyEvent.updateMany'),
  deleteOne: trackWrite('JourneyEvent.deleteOne'),
  deleteMany: trackWrite('JourneyEvent.deleteMany')
});

const dryRunRouter = require('../src/routes/internal/migrationDryRun');

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

const handler = getHandler(dryRunRouter, 'get', '/');

test('unauthorized request returns 401 before any database read, and never writes', async () => {
  const before = writeAttempts.length;
  const res = await new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers: {} }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(writeAttempts.length, before, 'no write attempted on unauthorized request');
});

test('wrong secret returns 401 and never writes', async () => {
  const before = writeAttempts.length;
  const res = await new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers: { authorization: 'Bearer not-the-secret' } }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(writeAttempts.length, before);
});

test('MIGRATION_DRYRUN_SECRET, when unset, grants no access on its own', async () => {
  delete process.env.MIGRATION_DRYRUN_SECRET;
  const res = await new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers: { authorization: 'Bearer whatever-someone-guesses' } }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });
  assert.strictEqual(res.statusCode, 401);
});

test('the alternate MIGRATION_DRYRUN_SECRET, when configured, also authorizes (CRON_SECRET is Sensitive/unretrievable)', async () => {
  process.env.MIGRATION_DRYRUN_SECRET = 'test_alt_secret_never_a_real_value';
  try {
    const res = await new Promise((resolve, reject) => {
      const r = mockRes();
      handler({ headers: { authorization: `Bearer ${process.env.MIGRATION_DRYRUN_SECRET}` } }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
    });
    assert.strictEqual(res.statusCode, 200); // res.status() was never called -> default 200 path (json() called directly)
    assert.strictEqual(res.body.success, true);

    const wrong = await new Promise((resolve, reject) => {
      const r = mockRes();
      handler({ headers: { authorization: 'Bearer definitely-wrong' } }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
    });
    assert.strictEqual(wrong.statusCode, 401);
  } finally {
    delete process.env.MIGRATION_DRYRUN_SECRET;
  }
});

test('authorized dry-run performs zero writes and returns exact counts for both reports', async () => {
  const before = writeAttempts.length;
  const res = await new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });

  assert.strictEqual(writeAttempts.length, before, 'the full dry-run performed zero write calls');
  assert.strictEqual(res.body.success, true);

  assert.deepStrictEqual(res.body.imageRetention, {
    totalStoredImages: 9,       // sid-1..sid-9
    olderThan30Days: 1,         // only puzzle 1 (45 days old)
    deadlineAlreadyPassed: 2,   // puzzle 1 (30d cap passed) + puzzle 3 (7d-after-completion passed)
    stillWithinRetention: 2,    // puzzle 2 (fresh) + puzzle 4 (already-stamped, future)
    allRecipientsCompleted: 2,  // puzzle 3 + puzzle 8
    incompleteRecipients: 6,    // puzzles 1, 2, 4, 5, 7, 9 (classified before the manual-review branch)
    manualReview: 4,            // puzzles 5, 7, 8, 9 (excluded from the deadline buckets above)
    legacyUploads: 2,           // from the stubbed countDocuments
    unclassified: 1,            // puzzle 6 (throws while reading imageStoredAt)
    manualReviewBreakdown: {
      byPuzzleStatus: {
        draft: 1,               // puzzle 7 (refunded-only trigger)
        pending_payment: 0,
        paid: 1,                // puzzle 5
        preparing: 1,           // puzzle 9
        ready: 0,
        partially_delivered: 0,
        delivered: 1,           // puzzle 8 (recently-paid-only trigger)
        failed: 0,
        expired: 0,
        other: 0
      },
      refundedOrder: 1,         // puzzle 7
      recentlyPaidOrder: 2,     // puzzles 5, 8 (NOT puzzle 9 — paid 10 days ago)
      activePaidOrder: 3,       // puzzles 5, 8, 9 (paid & not refunded); puzzle 7 excluded (refunded)
      allRecipientsCompleted: 1,   // puzzle 8, WITHIN the manual-review set
      incompleteRecipients: 3,    // puzzles 5, 7, 9, WITHIN the manual-review set
      ageDaysOldest: 6,           // puzzle 8
      ageDaysYoungest: 1          // puzzle 9
    },
    retentionFieldCompleteness: {
      // Read-only preview of the (separate, temporary) final-stamp pass —
      // apply is always false here, so this can never write anything.
      totalStoredImages: 9,
      withImageStoredAt: 8,       // all but puzzle 6 (throws on access)
      withImageDeletionDueAt: 1,  // puzzle 4 only (already stamped)
      missingEither: 7,           // puzzles 1,2,3,5,7,8,9 (missing the due date)
      wouldStamp: 5,              // puzzles 2,5,7,8,9
      wouldBeOverdue: 2,          // puzzles 1,3 (their computed deadline already passed)
      unclassified: 1,            // puzzle 6
      applied: 0                  // dry-run: never applies
    }
  });

  assert.deepStrictEqual(res.body.analytics, {
    totalInspected: 6,
    realPuzzleUrls: 1,          // event 1 only (event 2 is already the template, not a real id)
    rawPublicIds: 1,            // event 3
    queryStringsOrTokens: 1,    // event 1 (?r=0)
    sensitiveMetadata: 1,       // event 4 (phone)
    unclassified: 1             // event 6 (throws while reading pageUrl)
  });

  // Report contract: no customer data, no full publicIds, no image URLs —
  // only the two count objects and a success flag.
  assert.deepStrictEqual(Object.keys(res.body).sort(), ['analytics', 'imageRetention', 'success'].sort());
  const bodyText = JSON.stringify(res.body);
  for (const p of puzzles) assert.ok(!bodyText.includes(p.publicId), 'no raw publicId in response');
  assert.ok(!bodyText.includes('+973'));
});

test('module source contains no Mongoose write-operation calls (defense in depth)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'internal', 'migrationDryRun.js'), 'utf8');
  for (const forbidden of ['updateOne(', 'updateMany(', 'deleteOne(', 'deleteMany(', 'findOneAndUpdate(', 'findOneAndDelete(', '.save(', 'insertMany(']) {
    assert.ok(!src.includes(forbidden), `route source must not call ${forbidden}`);
  }
});

test('CRON_SECRET is never present in the response body', async () => {
  const res = await new Promise((resolve, reject) => {
    const r = mockRes();
    handler({ headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, { ...r, json(o) { this.body = o; resolve(this); return this; } }, reject);
  });
  assert.ok(!JSON.stringify(res.body).includes(process.env.CRON_SECRET));
});

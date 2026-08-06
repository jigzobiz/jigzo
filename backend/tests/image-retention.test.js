const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Test-only mock secrets (never real values).
process.env.NODE_ENV = 'test';
process.env.IMAGE_TOKEN_SECRET = 'test_image_token_secret_0123456789abcdef';
process.env.ANALYTICS_HASH_SECRET = 'test_analytics_hash_secret_fedcba9876543210';
process.env.CRON_SECRET = 'test_cron_secret_for_unit_tests_only';

const {
  DAY_MS,
  CHECKOUT_MIN_RUNWAY_MS,
  addDays,
  earlierDate,
  computeInitialDueAt,
  computePostCompletionDueAt,
  hasCheckoutRunway,
  isImageExpired,
  buildRecipientCompletionUpdate,
  buildAllRecipientsCompleteUpdate
} = require('../src/utils/imageRetention');
const imageToken = require('../src/utils/imageToken');
const { runImageCleanup } = require('../src/utils/cleanup');

const DAY0 = new Date('2026-01-01T00:00:00.000Z');
const day = (n) => new Date(DAY0.getTime() + n * DAY_MS);

// ---------------------------------------------------------------------------
// Minimal simulation of the MongoDB single-document update semantics this
// feature relies on ($set with a null-guard filter, $min on dates, $not/
// $elemMatch). Lets us prove the atomicity INVARIANTS of the exact filters
// and updates the route sends, without a live database.
// ---------------------------------------------------------------------------
function matches(doc, filter, ctx = {}) {
  for (const [key, cond] of Object.entries(filter)) {
    if (key === 'recipients' && cond && cond.$not && cond.$not.$elemMatch) {
      const sub = cond.$not.$elemMatch;
      const anyMatch = doc.recipients.some((r) =>
        Object.entries(sub).every(([f, v]) => (v === null ? r[f] == null : r[f] === v))
      );
      if (anyMatch) return false;
      continue;
    }
    if (key === 'recipients' && cond && cond.$elemMatch) {
      // $elemMatch resolves to ONE concrete element ("$" positional target).
      const sub = cond.$elemMatch;
      const idx = doc.recipients.findIndex((r) =>
        Object.entries(sub).every(([f, v]) => (v === null ? r[f] == null : String(r[f]) === String(v)))
      );
      if (idx === -1) return false;
      ctx.elemIndex = idx;
      continue;
    }
    const value = key.split('.').reduce((o, part) => (o == null ? o : o[part]), doc);
    if (cond === null) {
      if (value != null) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

function applyUpdate(doc, { filter, update }) {
  const ctx = {};
  if (!matches(doc, filter, ctx)) return false;
  for (const [p, v] of Object.entries(update.$set || {})) {
    const parts = p.replace('.$.', `.${ctx.elemIndex}.`).split('.');
    let target = doc;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = v;
  }
  for (const [p, v] of Object.entries(update.$min || {})) {
    const current = doc[p];
    if (current == null || v.getTime() < current.getTime()) doc[p] = v;
  }
  return true;
}

function makePuzzle(recipientCount, opts = {}) {
  return {
    publicId: 'f'.repeat(32),
    status: opts.status || 'delivered',
    imageStoredAt: DAY0,
    imageDeletionDueAt: computeInitialDueAt(DAY0),
    allRecipientsCompletedAt: null,
    imageDeletedAt: null,
    imageDeletionStatus: 'scheduled',
    createdAt: DAY0,
    recipients: Array.from({ length: recipientCount }, (_, i) => ({
      _id: `rid-${i}`,
      name: `R${i}`,
      completedAt: null,
      completionSeconds: null
    })),
    ...opts
  };
}

function complete(doc, index, when) {
  const s1 = buildRecipientCompletionUpdate(doc.publicId, doc.recipients[index]._id, when, 30);
  const recorded = applyUpdate(doc, s1);
  if (recorded) {
    const s2 = buildAllRecipientsCompleteUpdate(doc.publicId, when);
    applyUpdate(doc, s2);
  }
  return recorded;
}

// --- Retention rule -------------------------------------------------------

test('imageStoredAt drives the 30-day cap (day 0 -> due day 30)', () => {
  assert.deepStrictEqual(computeInitialDueAt(DAY0), day(30));
});

test('single recipient completing on day 2 -> deletion due day 9', () => {
  const p = makePuzzle(1);
  complete(p, 0, day(2));
  assert.deepStrictEqual(p.allRecipientsCompletedAt, day(2));
  assert.deepStrictEqual(p.imageDeletionDueAt, day(9));
});

test('three recipients on days 2/5/8 -> deletion due day 15', () => {
  const p = makePuzzle(3);
  complete(p, 0, day(2));
  assert.strictEqual(p.allRecipientsCompletedAt, null);
  complete(p, 1, day(5));
  assert.strictEqual(p.allRecipientsCompletedAt, null);
  complete(p, 2, day(8));
  assert.deepStrictEqual(p.allRecipientsCompletedAt, day(8));
  assert.deepStrictEqual(p.imageDeletionDueAt, day(15));
});

test('one incomplete recipient leaves the deadline at day 30', () => {
  const p = makePuzzle(3);
  complete(p, 0, day(2));
  complete(p, 1, day(5));
  assert.strictEqual(p.allRecipientsCompletedAt, null);
  assert.deepStrictEqual(p.imageDeletionDueAt, day(30));
});

test('completion on day 27 does not extend beyond day 30 ($min)', () => {
  const p = makePuzzle(1);
  complete(p, 0, day(27));
  assert.deepStrictEqual(p.allRecipientsCompletedAt, day(27));
  assert.deepStrictEqual(p.imageDeletionDueAt, day(30)); // not day 34
});

test('repeated completion is a no-op: neither completedAt nor deadline changes', () => {
  const p = makePuzzle(1);
  assert.strictEqual(complete(p, 0, day(2)), true);
  assert.strictEqual(complete(p, 0, day(20)), false);
  assert.deepStrictEqual(p.recipients[0].completedAt, day(2));
  assert.deepStrictEqual(p.imageDeletionDueAt, day(9));
});

test('concurrent last-recipient completion produces exactly one allRecipientsCompletedAt', () => {
  const p = makePuzzle(2);
  // Interleave the two requests' atomic steps the worst way possible:
  const s1a = buildRecipientCompletionUpdate(p.publicId, p.recipients[0]._id, day(3), 10);
  const s1b = buildRecipientCompletionUpdate(p.publicId, p.recipients[1]._id, day(3), 12);
  assert.strictEqual(applyUpdate(p, s1a), true);
  assert.strictEqual(applyUpdate(p, s1b), true);
  const s2a = buildAllRecipientsCompleteUpdate(p.publicId, day(3));
  const s2b = buildAllRecipientsCompleteUpdate(p.publicId, new Date(day(3).getTime() + 5));
  const won = [applyUpdate(p, s2a), applyUpdate(p, s2b)].filter(Boolean);
  assert.strictEqual(won.length, 1); // the null-guard admits exactly one winner
  assert.deepStrictEqual(p.allRecipientsCompletedAt, day(3));
  assert.deepStrictEqual(p.imageDeletionDueAt, day(10));
});

test('a stuck paid / partially_delivered puzzle is still expired at day 30', () => {
  for (const status of ['paid', 'partially_delivered', 'preparing']) {
    const p = makePuzzle(2, { status });
    assert.strictEqual(isImageExpired(p, day(29)), false);
    assert.strictEqual(isImageExpired(p, new Date(day(30).getTime() + 1)), true);
  }
});

test('nothing in the checkout path can extend the deadline (read-only gate)', () => {
  const p = makePuzzle(1);
  const before = p.imageDeletionDueAt.getTime();
  hasCheckoutRunway(p, day(29));
  assert.strictEqual(p.imageDeletionDueAt.getTime(), before);
});

// --- Checkout runway gate ---------------------------------------------------

test('checkout runway constant is exactly 7 days and 35 minutes', () => {
  assert.strictEqual(CHECKOUT_MIN_RUNWAY_MS, 7 * DAY_MS + 35 * 60 * 1000);
});

test('checkout rejected when remaining retention is clearly below the boundary', () => {
  const p = makePuzzle(1);
  assert.strictEqual(hasCheckoutRunway(p, day(23)), false); // 7d left < 7d35m
  assert.strictEqual(hasCheckoutRunway(p, day(24)), false);
  assert.strictEqual(hasCheckoutRunway(p, day(29)), false);
});

test('checkout boundary: allowed at exactly 7d35m remaining, rejected 1ms past it', () => {
  const p = makePuzzle(1);
  // The instant at which remaining retention equals exactly 7d + 35min.
  const boundary = new Date(day(30).getTime() - CHECKOUT_MIN_RUNWAY_MS);
  assert.strictEqual(hasCheckoutRunway(p, new Date(boundary.getTime() - 1)), true);  // just above
  assert.strictEqual(hasCheckoutRunway(p, boundary), true);                          // exactly at
  assert.strictEqual(hasCheckoutRunway(p, new Date(boundary.getTime() + 1)), false); // just below
  assert.strictEqual(hasCheckoutRunway(p, day(1)), true);
});

test('runway falls back to createdAt for legacy records without imageStoredAt', () => {
  const p = makePuzzle(1);
  p.imageStoredAt = null;
  const boundary = new Date(day(30).getTime() - CHECKOUT_MIN_RUNWAY_MS);
  assert.strictEqual(hasCheckoutRunway(p, boundary), true);
  assert.strictEqual(hasCheckoutRunway(p, new Date(boundary.getTime() + 1)), false);
});

// --- Expiry gate -------------------------------------------------------------

test('isImageExpired honors due date, imageDeletedAt and blocked/deleted status', () => {
  const base = makePuzzle(1);
  assert.strictEqual(isImageExpired(base, day(1)), false);
  assert.strictEqual(isImageExpired({ ...base, imageDeletedAt: day(1) }, day(1)), true);
  assert.strictEqual(isImageExpired({ ...base, imageDeletionStatus: 'blocked' }, day(1)), true);
  assert.strictEqual(isImageExpired({ ...base, imageDeletionStatus: 'deleted' }, day(1)), true);
  assert.strictEqual(isImageExpired(base, new Date(day(30).getTime() + 1)), true);
});

// --- Image-access cookie ------------------------------------------------------

test('cookie fails closed when IMAGE_TOKEN_SECRET is missing', () => {
  const saved = process.env.IMAGE_TOKEN_SECRET;
  delete process.env.IMAGE_TOKEN_SECRET;
  try {
    assert.strictEqual(imageToken.buildImageCookie('a'.repeat(32), 0, { secure: true }), null);
    assert.strictEqual(imageToken.verifyImageCookieHeader('jigzo_img=0.99999999999.deadbeef', 'a'.repeat(32), 0), false);
  } finally {
    process.env.IMAGE_TOKEN_SECRET = saved;
  }
});

test('cookie attributes: HttpOnly, SameSite=Lax, path-scoped, Max-Age 1800, Secure toggles', () => {
  const publicId = 'b'.repeat(32);
  const secureCookie = imageToken.buildImageCookie(publicId, 2, { secure: true });
  assert.ok(secureCookie.includes('HttpOnly'));
  assert.ok(secureCookie.includes('SameSite=Lax'));
  assert.ok(secureCookie.includes(`Path=/api/puzzles/${publicId}/image`));
  assert.ok(secureCookie.includes('Max-Age=1800'));
  assert.ok(secureCookie.includes('Secure'));
  const insecureCookie = imageToken.buildImageCookie(publicId, 2, { secure: false });
  assert.ok(!insecureCookie.includes('Secure'));
});

test('cookie verification: valid passes; absent, tampered, wrong-recipient and expired fail', () => {
  const publicId = 'c'.repeat(32);
  const header = imageToken.buildImageCookie(publicId, 0, { secure: false });
  const cookieValue = header.split(';')[0]; // "jigzo_img=r.exp.sig"

  assert.strictEqual(imageToken.verifyImageCookieHeader(cookieValue, publicId, 0), true);
  assert.strictEqual(imageToken.verifyImageCookieHeader(undefined, publicId, 0), false);
  assert.strictEqual(imageToken.verifyImageCookieHeader(cookieValue, publicId, 1), false);
  assert.strictEqual(imageToken.verifyImageCookieHeader(cookieValue.slice(0, -2) + 'aa', publicId, 0), false);
  const farFuture = Math.floor(Date.now() / 1000) + 100000;
  assert.strictEqual(imageToken.verifyImageCookieHeader(cookieValue, publicId, 0, farFuture), false); // expired
});

// --- Route-level tests (stubbed models; each test file runs in its own process)

function stubModule(relPath, exportsObj) {
  const resolved = require.resolve(relPath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

const dbState = { puzzle: null, updates: [] };
stubModule('../src/models/Puzzle', {
  findOne: async () => dbState.puzzle,
  findOneAndUpdate: async (filter, update) => {
    if (!dbState.puzzle) return null;
    const ok = applyUpdate(dbState.puzzle, { filter, update });
    dbState.updates.push({ filter, update });
    return ok ? dbState.puzzle : null;
  }
});
stubModule('../src/models/Order', { findOne: async () => null });
const deliveryCalls = { whatsapp: 0, email: 0 };
stubModule('../src/services/whatsappService', {
  claimAndSendPuzzleDelivery: async () => { deliveryCalls.whatsapp += 1; return {}; },
  sendRevealAlert: async () => ({})
});
stubModule('../src/services/emailService', {
  sendRevealEmail: async () => { deliveryCalls.email += 1; return { success: true }; }
});
// Force the production delivery path so the late-payment guard (not the
// staging QA block) is what withholds delivery in the test below.
stubModule('../src/utils/runtimeConfig', {
  isNonProduction: () => false,
  getFrontendOrigin: () => 'https://test.example'
});
const streamCalls = [];
stubModule('../src/services/storageService', {
  saveImage: async () => 'stub-id',
  deleteImage: async () => {},
  getImageStream: (id) => ({
    on() { return this; },
    pipe(res) { streamCalls.push(id); res.streamed = true; }
  })
});

// Required AFTER the stubs above are seeded into require.cache: this module
// (and puzzlesRouter below) do their own top-level require('../models/...')
// etc., so they must resolve to the fakes, not the real Mongoose models.
const puzzlesRouter = require('../src/routes/puzzles');
const { markOrderAndPuzzlePaid, MANUAL_RESOLUTION_IMAGE_EXPIRED } = require('../src/services/paymentCompletion');

function getHandler(router, method, routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method]
  );
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    redirect(u) { this.redirected = u; }
  };
}

function routePuzzle(overrides = {}) {
  const p = makePuzzle(1, { status: 'delivered' });
  // Route fixtures must be ACTIVE relative to the real clock the handlers use.
  p.imageStoredAt = new Date();
  p.imageDeletionDueAt = new Date(Date.now() + 10 * DAY_MS);
  p.cropImageUrl = `/api/puzzles/${p.publicId}/image`;
  p.imageStorageId = 'stub-storage-id';
  p.imageMimeType = 'image/jpeg';
  p.senderName = 'Sender';
  p.senderPhone = '+97300000000';
  p.message = 'secret message body';
  p.revealIdentity = true;
  p.pieceCount = 12;
  p.experienceLanguage = 'en';
  p.expiresAt = null;
  p.testMode = false;
  p.recipients[0] = {
    ...p.recipients[0],
    phone: '39999999',
    phoneE164: '+97339999999',
    email: 'recipient@example.invalid',
    openedAt: null
  };
  return Object.assign(p, overrides);
}

const EXPECTED_NO_STORE = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0'
};

test('metadata route: no-store headers, cookie issued, data minimization', async () => {
  dbState.puzzle = routePuzzle();
  const handler = getHandler(puzzlesRouter, 'get', '/:publicId');
  const res = mockRes();
  await handler({ params: { publicId: dbState.puzzle.publicId }, query: { r: '0' }, headers: {}, secure: true }, res, (e) => { throw e; });

  for (const [k, v] of Object.entries(EXPECTED_NO_STORE)) {
    assert.strictEqual(res.headers[k], v, `header ${k}`);
  }
  assert.ok(res.headers['Set-Cookie'].includes('jigzo_img='));
  assert.ok(res.headers['Set-Cookie'].includes('HttpOnly'));

  const bodyText = JSON.stringify(res.body);
  // Cookie/token material never appears in JSON or the image URL.
  const sig = res.headers['Set-Cookie'].split(';')[0].split('.').pop();
  assert.ok(!bodyText.includes(sig));
  assert.ok(res.body.puzzle.cropImageUrl.endsWith('/image?r=0'));
  assert.strictEqual(res.body.puzzle.imageExpired, false);
  // Data minimization: no phones, emails, message, internal ids, payment data.
  assert.ok(!bodyText.includes('+973'));
  assert.ok(!bodyText.includes('recipient@example.invalid'));
  assert.ok(!bodyText.includes('secret message body'));
  assert.ok(!bodyText.includes('stub-storage-id'));
  assert.ok(!bodyText.includes('_id'));
  assert.deepStrictEqual(
    Object.keys(res.body.puzzle).sort(),
    ['cropImageUrl', 'experienceLanguage', 'imageExpired', 'pieceCount', 'publicId', 'recipient', 'recipients', 'revealIdentity', 'senderName'].sort()
  );
});

test('metadata route after expiry: imageExpired true, no cropImageUrl, no cookie', async () => {
  dbState.puzzle = routePuzzle({ imageDeletionDueAt: new Date(Date.now() - 1000) });
  const handler = getHandler(puzzlesRouter, 'get', '/:publicId');
  const res = mockRes();
  await handler({ params: { publicId: dbState.puzzle.publicId }, query: { r: '0' }, headers: {}, secure: true }, res, (e) => { throw e; });
  assert.strictEqual(res.body.puzzle.imageExpired, true);
  assert.ok(!('cropImageUrl' in res.body.puzzle));
  assert.strictEqual(res.headers['Set-Cookie'], undefined);
});

test('image route: expired image returns 410 IMAGE_EXPIRED regardless of a valid cookie', async () => {
  dbState.puzzle = routePuzzle({ imageDeletionDueAt: new Date(Date.now() - 1000) });
  const cookie = imageToken.buildImageCookie(dbState.puzzle.publicId, 0, { secure: false }).split(';')[0];
  const handler = getHandler(puzzlesRouter, 'get', '/:publicId/image');
  const res = mockRes();
  await handler({ params: { publicId: dbState.puzzle.publicId }, query: { r: '0' }, headers: { cookie }, secure: true }, res, (e) => { throw e; });
  assert.strictEqual(res.statusCode, 410);
  assert.deepStrictEqual(res.body, { error: { code: 'IMAGE_EXPIRED' } });
});

test('image route: blocked status returns 410 even before physical deletion', async () => {
  dbState.puzzle = routePuzzle({ imageDeletionStatus: 'blocked' });
  const handler = getHandler(puzzlesRouter, 'get', '/:publicId/image');
  const res = mockRes();
  await handler({ params: { publicId: dbState.puzzle.publicId }, query: { r: '0' }, headers: {}, secure: true }, res, (e) => { throw e; });
  assert.strictEqual(res.statusCode, 410);
  assert.deepStrictEqual(res.body, { error: { code: 'IMAGE_EXPIRED' } });
});

test('image route: absent or invalid cookie returns 403 IMAGE_TOKEN_INVALID', async () => {
  dbState.puzzle = routePuzzle();
  const handler = getHandler(puzzlesRouter, 'get', '/:publicId/image');

  for (const cookie of [undefined, 'jigzo_img=0.123.deadbeef']) {
    const res = mockRes();
    await handler({ params: { publicId: dbState.puzzle.publicId }, query: { r: '0' }, headers: { cookie }, secure: true }, res, (e) => { throw e; });
    assert.strictEqual(res.statusCode, 403);
    assert.deepStrictEqual(res.body, { error: { code: 'IMAGE_TOKEN_INVALID' } });
  }
});

test('image route: valid cookie streams the image with no-store headers and no immutable caching', async () => {
  dbState.puzzle = routePuzzle();
  const cookie = imageToken.buildImageCookie(dbState.puzzle.publicId, 0, { secure: false }).split(';')[0];
  const handler = getHandler(puzzlesRouter, 'get', '/:publicId/image');
  const res = mockRes();
  await handler({ params: { publicId: dbState.puzzle.publicId }, query: { r: '0' }, headers: { cookie }, secure: true }, res, (e) => { throw e; });

  assert.strictEqual(res.streamed, true);
  assert.strictEqual(res.headers['Content-Type'], 'image/jpeg');
  for (const [k, v] of Object.entries(EXPECTED_NO_STORE)) {
    assert.strictEqual(res.headers[k], v, `header ${k}`);
  }
  assert.strictEqual(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(res.headers['Cross-Origin-Resource-Policy'], 'same-origin');
  assert.ok(!JSON.stringify(res.headers).includes('immutable'));
  assert.ok(!JSON.stringify(res.headers).includes('max-age=31536000'));
});

// --- Cron route ---------------------------------------------------------------

test('cleanup cron: unauthorized 401 before DB work; authorized returns safe counts only', async () => {
  stubModule('../src/utils/cleanup', {
    runImageCleanup: async () => ({ scanned: 3, deleted: 2, alreadyMissing: 1, failed: 0, remaining: 0 })
  });
  delete require.cache[require.resolve('../src/routes/internal/imageCleanup')];
  const cronRouter = require('../src/routes/internal/imageCleanup');
  const handler = getHandler(cronRouter, 'get', '/');

  const bad = mockRes();
  await handler({ headers: { authorization: 'Bearer wrong-secret' } }, bad, (e) => { throw e; });
  assert.strictEqual(bad.statusCode, 401);

  const none = mockRes();
  await handler({ headers: {} }, none, (e) => { throw e; });
  assert.strictEqual(none.statusCode, 401);

  const good = mockRes();
  await handler({ headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, good, (e) => { throw e; });
  assert.strictEqual(good.statusCode, 200);
  assert.deepStrictEqual(Object.keys(good.body).sort(),
    ['alreadyMissing', 'deleted', 'failed', 'remaining', 'scanned', 'success'].sort());
});

// --- Cleanup job (injected dependencies) ---------------------------------------

function fakeCleanupWorld(records) {
  const world = {
    records: records.map((r) => ({ ...r })),
    deleted: [],
    markedDeleted: [],
    markedFailed: [],
    orderWrites: 0
  };
  world.deps = {
    findDueBatch: async () => world.records.filter((r) => r.imageStorageId && !r.done),
    countRemaining: async () => world.records.filter((r) => r.imageStorageId && !r.done).length,
    deleteImage: async (id) => {
      if (id === 'missing-id') { throw new Error('File not found for id missing-id'); }
      if (id === 'poison-id') { throw new Error('boom'); }
      world.deleted.push(id);
    },
    markDeleted: async (puzzle) => {
      const rec = world.records.find((r) => r._id === puzzle._id);
      rec.imageStorageId = null;
      rec.done = true;
      world.markedDeleted.push(puzzle._id);
    },
    markFailed: async (puzzle, reason) => {
      const rec = world.records.find((r) => r._id === puzzle._id);
      rec.done = true; // keep the unit test loop finite; real query re-selects
      world.markedFailed.push({ id: puzzle._id, reason });
    }
  };
  return world;
}

test('cleanup deletes binaries, tolerates missing files, continues past failures, never touches orders', async () => {
  const world = fakeCleanupWorld([
    { _id: 1, publicId: 'a'.repeat(32), imageStorageId: 'sid-1' },
    { _id: 2, publicId: 'b'.repeat(32), imageStorageId: 'missing-id' },
    { _id: 3, publicId: 'd'.repeat(32), imageStorageId: 'poison-id' },
    { _id: 4, publicId: 'e'.repeat(32), imageStorageId: 'sid-4' }
  ]);

  const summary = await runImageCleanup({ ...world.deps, timeBudgetMs: 5000, batchSize: 10 });

  assert.strictEqual(summary.scanned, 4);
  assert.strictEqual(summary.deleted, 2);
  assert.strictEqual(summary.alreadyMissing, 1);
  assert.strictEqual(summary.failed, 1);
  assert.deepStrictEqual(world.deleted, ['sid-1', 'sid-4']);
  assert.deepStrictEqual(world.markedDeleted, [1, 2, 4]);
  assert.strictEqual(world.markedFailed.length, 1);
  assert.strictEqual(world.orderWrites, 0);
});

test('cleanup is idempotent: a second run finds nothing to do', async () => {
  const world = fakeCleanupWorld([
    { _id: 1, publicId: 'a'.repeat(32), imageStorageId: 'sid-1' }
  ]);
  await runImageCleanup({ ...world.deps, timeBudgetMs: 5000 });
  const second = await runImageCleanup({ ...world.deps, timeBudgetMs: 5000 });
  assert.strictEqual(second.scanned, 0);
  assert.strictEqual(second.deleted, 0);
  assert.strictEqual(world.deleted.length, 1);
});

test('cleanup logs never contain full publicIds, cookies, phone numbers or secrets', async () => {
  const captured = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => captured.push(a.join(' '));
  console.error = (...a) => captured.push(a.join(' '));
  try {
    const world = fakeCleanupWorld([
      { _id: 1, publicId: 'a1b2c3d4'.repeat(4), imageStorageId: 'sid-1' },
      { _id: 2, publicId: '9f8e7d6c'.repeat(4), imageStorageId: 'poison-id' }
    ]);
    await runImageCleanup({ ...world.deps, timeBudgetMs: 5000 });
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  const text = captured.join('\n');
  assert.ok(!text.includes('a1b2c3d4'.repeat(4)));
  assert.ok(!text.includes('9f8e7d6c'.repeat(4)));
  assert.ok(!text.includes('jigzo_img'));
  assert.ok(!text.includes(process.env.IMAGE_TOKEN_SECRET));
  assert.ok(!text.includes(process.env.ANALYTICS_HASH_SECRET));
  assert.ok(!/\+\d{8,}/.test(text));
});

// --- Defensive late-payment handling ------------------------------------------

test('a verified CAPTURED payment arriving after the retention deadline withholds delivery', async () => {
  const puzzle = makePuzzle(2, { status: 'paid' });
  // Past its deletion deadline: isImageExpired(puzzle, now) === true.
  puzzle.imageDeletionDueAt = new Date(Date.now() - 60 * 1000);
  puzzle.senderPhone = '+97300000000';
  puzzle.recipients = puzzle.recipients.map((r) => ({ ...r, deliveryMethod: 'whatsapp', deliveryStatus: 'pending' }));
  puzzle.save = async () => puzzle;
  dbState.puzzle = puzzle;

  const order = {
    orderId: 'ord_late_payment_test',
    puzzleId: puzzle.publicId,
    paymentStatus: 'pending',
    addOns: 0,
    lastPaymentError: '',
    save: async function () { return this; }
  };

  const before = { whatsapp: deliveryCalls.whatsapp, email: deliveryCalls.email };
  const result = await markOrderAndPuzzlePaid(order, 'chg_late_test', 'tx_late_test');

  // Payment itself is still recorded as captured/paid...
  assert.strictEqual(result.paymentStatus, 'paid');
  // ...but delivery must NOT have fired, and the puzzle must NOT be marked delivered.
  assert.strictEqual(deliveryCalls.whatsapp, before.whatsapp);
  assert.strictEqual(deliveryCalls.email, before.email);
  assert.notStrictEqual(puzzle.status, 'delivered');
  assert.notStrictEqual(puzzle.status, 'partially_delivered');
  // A sanitized internal marker records the case for manual resolution —
  // no automatic refund, since no tested refund mechanism exists.
  assert.strictEqual(order.lastPaymentError, MANUAL_RESOLUTION_IMAGE_EXPIRED);
});

test('late-payment log never contains the full publicId, phone number or Tap payload', async () => {
  const puzzle = makePuzzle(1, { status: 'paid' });
  puzzle.imageDeletionDueAt = new Date(Date.now() - 1000);
  puzzle.senderPhone = '+97355512345';
  puzzle.save = async () => puzzle;
  dbState.puzzle = puzzle;

  const order = {
    orderId: 'ord_late_payment_log_test',
    puzzleId: puzzle.publicId,
    paymentStatus: 'pending',
    lastPaymentError: '',
    save: async function () { return this; }
  };

  const captured = [];
  const origErr = console.error;
  console.error = (...a) => captured.push(a.join(' '));
  try {
    await markOrderAndPuzzlePaid(order, 'chg_secret_charge_id', 'tx_secret_ref');
  } finally {
    console.error = origErr;
  }

  const text = captured.join('\n');
  assert.ok(!text.includes(puzzle.publicId));
  assert.ok(!text.includes(puzzle.senderPhone));
  assert.ok(!text.includes('chg_secret_charge_id'));
  assert.ok(!text.includes('tx_secret_ref'));
});

// --- vercel.json configuration ---------------------------------------------------

test('vercel.json: hourly cleanup cron at minute 15 (Pro plan)', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  assert.deepStrictEqual(config.crons, [
    { path: '/api/internal/images/cleanup', schedule: '15 * * * *' }
  ]);
});

test('vercel.json: /p/* gets no-referrer + noindex + no-store; landing pages do not', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  const pRoute = config.routes.find((r) => r.src === '/p/(.*)');
  assert.ok(pRoute, 'recipient route present');
  assert.strictEqual(pRoute.headers['Referrer-Policy'], 'no-referrer');
  assert.strictEqual(pRoute.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.strictEqual(pRoute.headers['Cache-Control'], 'no-store');
  // No other route (and nothing global) applies noindex — SEO stays intact.
  for (const route of config.routes) {
    if (route === pRoute) continue;
    assert.ok(!route.headers || !route.headers['X-Robots-Tag'], `unexpected X-Robots-Tag on ${route.src}`);
  }
});

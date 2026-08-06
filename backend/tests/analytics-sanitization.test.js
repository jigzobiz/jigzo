const test = require('node:test');
const assert = require('node:assert');

// Test-only mock secrets (never real values).
process.env.NODE_ENV = 'test';
process.env.IMAGE_TOKEN_SECRET = 'test_image_token_secret_0123456789abcdef';
process.env.ANALYTICS_HASH_SECRET = 'test_analytics_hash_secret_fedcba9876543210';

const { sanitizePageUrl, derivePuzzleRef, scrubMetadata } = require('../src/utils/analyticsSanitize');
const { puzzleRef } = require('../src/utils/puzzleRef');
const imageToken = require('../src/utils/imageToken');

const SAMPLE_ID = 'ab12cd34ef56ab12cd34ef56ab12cd34';

test('full puzzle URLs are reduced to a route template', () => {
  assert.strictEqual(
    sanitizePageUrl(`https://jigzo.biz/p/${SAMPLE_ID}?r=0#stage`),
    '/p/:puzzleId'
  );
  assert.strictEqual(sanitizePageUrl(`/p/${SAMPLE_ID}`), '/p/:puzzleId');
  assert.strictEqual(sanitizePageUrl(`/p/${SAMPLE_ID}?r=2`), '/p/:puzzleId');
});

test('query strings and fragments are always removed', () => {
  assert.strictEqual(sanitizePageUrl('/create?step=3#top'), '/create');
  assert.strictEqual(sanitizePageUrl('https://jigzo.biz/?utm_source=x'), '/');
});

test('non-capability routes pass through untouched', () => {
  assert.strictEqual(sanitizePageUrl('https://jigzo.biz/'), '/');
  assert.strictEqual(sanitizePageUrl('/create'), '/create');
  assert.strictEqual(sanitizePageUrl('/payment/result'), '/payment/result');
  assert.strictEqual(sanitizePageUrl(''), '');
});

test('sanitized output never contains a raw publicId', () => {
  for (const raw of [
    `https://jigzo.biz/p/${SAMPLE_ID}?r=1`,
    `/p/${SAMPLE_ID}/anything`,
    `/receive.html?id=${SAMPLE_ID}`
  ]) {
    assert.ok(!sanitizePageUrl(raw).includes(SAMPLE_ID), raw);
  }
});

test('metadata scrub removes capability ids, tokens, contact details and messages', () => {
  const scrubbed = scrubMetadata({
    puzzleId: SAMPLE_ID,
    publicId: SAMPLE_ID,
    token: 'tok', sig: 'sig', signature: 'sig2', cookie: 'jigzo_img=1.2.3',
    phone: '+97339999999', email: 'someone@example.invalid', name: 'Someone',
    message: 'private customer message',
    occasion: 'birthday',
    recipientIndex: 2,
    durationSeconds: 41,
    isLocalTest: false
  });
  assert.deepStrictEqual(scrubbed, {
    occasion: 'birthday',
    recipientIndex: 2,
    durationSeconds: 41,
    isLocalTest: false
  });
});

test('metadata scrub drops URL-shaped, hex-capability and cookie-shaped values under any key', () => {
  const scrubbed = scrubMetadata({
    context: `https://jigzo.biz/p/${SAMPLE_ID}`,
    somethingElse: SAMPLE_ID,
    note: 'jigzo_img=0.1.2',
    keep: 'plain value'
  });
  assert.deepStrictEqual(scrubbed, { keep: 'plain value' });
});

test('puzzleRef is derivable from metadata or pageUrl, one-way, and 12 hex chars', () => {
  const fromMetadata = derivePuzzleRef({ puzzleId: SAMPLE_ID }, null);
  const fromUrl = derivePuzzleRef({}, `https://jigzo.biz/p/${SAMPLE_ID}?r=0`);
  assert.match(fromMetadata, /^[0-9a-f]{12}$/);
  assert.strictEqual(fromMetadata, fromUrl);
  assert.strictEqual(fromMetadata, puzzleRef(SAMPLE_ID));
  // Not reversible / not a substring of the capability.
  assert.ok(!SAMPLE_ID.includes(fromMetadata));
});

test('puzzleRef is null (never a raw id) when ANALYTICS_HASH_SECRET is unset', () => {
  const saved = process.env.ANALYTICS_HASH_SECRET;
  delete process.env.ANALYTICS_HASH_SECRET;
  try {
    assert.strictEqual(puzzleRef(SAMPLE_ID), null);
    assert.strictEqual(derivePuzzleRef({ puzzleId: SAMPLE_ID }, null), null);
  } finally {
    process.env.ANALYTICS_HASH_SECRET = saved;
  }
});

test('IMAGE_TOKEN_SECRET and ANALYTICS_HASH_SECRET operate independently', () => {
  const publicId = 'e'.repeat(32);
  const cookieBefore = imageToken.buildImageCookie(publicId, 0, { secure: false });
  const refBefore = puzzleRef(publicId);

  const saved = process.env.ANALYTICS_HASH_SECRET;
  process.env.ANALYTICS_HASH_SECRET = 'rotated_analytics_secret_0000000000000000';
  try {
    // Rotating the analytics secret changes puzzleRef...
    assert.notStrictEqual(puzzleRef(publicId), refBefore);
    // ...but image cookies still verify: image access is unaffected.
    const cookieValue = cookieBefore.split(';')[0];
    assert.strictEqual(imageToken.verifyImageCookieHeader(cookieValue, publicId, 0), true);
  } finally {
    process.env.ANALYTICS_HASH_SECRET = saved;
  }
});

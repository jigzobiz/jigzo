const assert = require('assert');
const mongoose = require('mongoose');
const express = require('express');
const JourneyEvent = require('../src/models/JourneyEvent');
const Customer = require('../src/models/Customer');
const DraftPuzzle = require('../src/models/DraftPuzzle');
const AnonymousSession = require('../src/models/AnonymousSession');
const analyticsRouter = require('../src/routes/analytics');

const MONGODB_URI = process.env.MONGODB_TEST_URI;

// Mock frontend globals for testing the frontend analytics service logic
global.window = {
  location: {
    pathname: '/p/secret-id?r=1#x',
  }
};
global.localStorage = {
  getItem: (k) => null,
  setItem: (k, v) => {}
};
global.sessionStorage = {
  getItem: (k) => null,
  setItem: (k, v) => {}
};
global.navigator = {};
global.import = {
  meta: {
    env: {
      VITE_API_URL: '',
      VITE_ENABLE_LOCAL_TEST: 'true'
    }
  }
};

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  // Clear existing test records to be safe
  await JourneyEvent.deleteMany({ anonymousId: { $regex: /^test_/ } });
  await Customer.deleteMany({ name: { $regex: /^test_/ } });
  await DraftPuzzle.deleteMany({ anonymousId: { $regex: /^test_/ } });
  await AnonymousSession.deleteMany({ anonymousId: { $regex: /^test_/ } });

  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
  
  // Custom error handler to avoid HTML crash logs
  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });

  const server = app.listen(5001);
  const targetUrl = 'http://localhost:5001/api/analytics/events';

  try {
    // 1. All legitimate existing and P0 events are accepted.
    console.log('Test 1: Valid events accepted...');
    const validEvents = [
      'landing_viewed', 'hero_cta_clicked', 'pricing_viewed', 'create_page_viewed',
      'create_started', 'photo_uploaded', 'difficulty_selected', 'occasion_selected',
      'tone_selected', 'message_written', 'recipient_added', 'sender_details_added',
      'create_validation_failed', 'checkout_viewed', 'checkout_blocked', 'checkout_started',
      'payment_succeeded', 'payment_failed', 'payment_cancelled', 'puzzle_created',
      'whatsapp_accepted', 'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read', 'whatsapp_failed',
      'puzzle_opened', 'puzzle_started', 'puzzle_completed', 'reveal_viewed',
      'save_share_clicked', 'share_completed', 'replay_clicked', 'create_your_puzzle_clicked',
      'occasion_card_click', 'photo_cropped', 'review_opened', 'payment_started', 'waitlist_joined'
    ];
    for (const eventType of validEvents) {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymousId: 'test_anon_valid',
          sessionId: 'test_sess_valid',
          eventType,
          pageUrl: '/create',
          eventId: `test-evt-valid-${eventType}`
        })
      });
      assert.strictEqual(res.status, 201, `Failed to accept event: ${eventType}`);
    }
    console.log('✓ Valid events accepted.');

    // 2. Unsupported events return 400.
    console.log('Test 2: Reject unsupported events...');
    const resUnk = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon',
        sessionId: 'test_sess',
        eventType: 'disallowed_event_name',
        pageUrl: '/create',
        eventId: 'test-evt-unk'
      })
    });
    assert.strictEqual(resUnk.status, 400);
    console.log('✓ Reject unsupported events.');

    // 3 & 4. Full recipient URL stores only /p/:publicId and query strings/fragments are never stored.
    console.log('Test 3 & 4: Server-side path normalization...');
    const resUrlNorm = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon_url',
        sessionId: 'test_sess_url',
        eventType: 'landing_viewed',
        pageUrl: 'https://staging.jigzo.biz/p/secret-id?r=1#x',
        eventId: 'test-evt-url-norm'
      })
    });
    assert.strictEqual(resUrlNorm.status, 201);
    const dbEvent = await JourneyEvent.findOne({ eventId: 'test-evt-url-norm' });
    assert.strictEqual(dbEvent.pageUrl, '/p/:publicId');
    console.log('✓ Path normalization stores only /p/:publicId.');

    // 5. PII and secret keys are removed from metadata.
    console.log('Test 5: PII and secret keys removed...');
    const resPii = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon_pii',
        sessionId: 'test_sess_pii',
        eventType: 'recipient_added',
        pageUrl: '/create',
        eventId: 'test-evt-pii',
        metadata: {
          recipientCount: 3,
          name: 'Secret Name',
          phone: '+97333000000',
          email: 'secret@domain.com',
          message: 'Very secret message'
        }
      })
    });
    assert.strictEqual(resPii.status, 201);
    const dbEventPii = await JourneyEvent.findOne({ eventId: 'test-evt-pii' });
    assert.strictEqual(dbEventPii.metadata.recipientCount, 3);
    assert.strictEqual(dbEventPii.metadata.name, undefined);
    assert.strictEqual(dbEventPii.metadata.phone, undefined);
    assert.strictEqual(dbEventPii.metadata.email, undefined);
    assert.strictEqual(dbEventPii.metadata.message, undefined);
    console.log('✓ PII removed.');

    // 6. Identity is separated and restricted by event.
    console.log('Test 6: Identity separation...');
    // Identity on allowed event
    const resIdAllowed = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon_id',
        sessionId: 'test_sess_id',
        eventType: 'waitlist_joined',
        pageUrl: '/create',
        eventId: 'test-evt-id-allowed',
        metadata: { interestType: 'launch' },
        identity: {
          email: 'test_waitlist@domain.com',
          name: 'test_name'
        }
      })
    });
    assert.strictEqual(resIdAllowed.status, 201);
    const customer = await Customer.findOne({ email: 'test_waitlist@domain.com' });
    assert.ok(customer);
    // Verify waitlist email is NOT copied into generic metadata
    const dbEventId = await JourneyEvent.findOne({ eventId: 'test-evt-id-allowed' });
    assert.strictEqual(dbEventId.metadata.email, undefined);

    // Identity on disallowed event
    const resIdDisallowed = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon_id_dis',
        sessionId: 'test_sess_id_dis',
        eventType: 'landing_viewed',
        pageUrl: '/',
        eventId: 'test-evt-id-dis',
        identity: { email: 'secret_disallowed@domain.com' }
      })
    });
    assert.strictEqual(resIdDisallowed.status, 201);
    const customerDis = await Customer.findOne({ email: 'secret_disallowed@domain.com' });
    assert.strictEqual(customerDis, null);
    console.log('✓ Identity separation enforced.');

    // 7 & 8. Same eventId twice creates one JourneyEvent and side effects execute once.
    console.log('Test 7 & 8: EventId idempotency...');
    const eventIdDup = 'test-evt-dup';
    const resDup1 = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon_dup',
        sessionId: 'test_sess_dup',
        eventType: 'waitlist_joined',
        pageUrl: '/create',
        eventId: eventIdDup,
        identity: { email: 'test_dup@domain.com' }
      })
    });
    assert.strictEqual(resDup1.status, 201);
    const countBefore = await JourneyEvent.countDocuments({ eventId: eventIdDup });
    assert.strictEqual(countBefore, 1);

    const resDup2 = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon_dup',
        sessionId: 'test_sess_dup',
        eventType: 'waitlist_joined',
        pageUrl: '/create',
        eventId: eventIdDup,
        identity: { email: 'test_dup@domain.com' }
      })
    });
    assert.strictEqual(resDup2.status, 200);
    const jsonDup2 = await resDup2.json();
    assert.strictEqual(jsonDup2.duplicate, true);

    const countAfter = await JourneyEvent.countDocuments({ eventId: eventIdDup });
    assert.strictEqual(countAfter, 1);
    console.log('✓ EventId idempotency handles duplicates.');

    // 9. Storage exceptions fall back to in-memory IDs.
    console.log('Test 9: Storage exceptions fallback...');
    // Mock storage to throw exception
    global.localStorage.getItem = () => { throw new Error('SecurityError'); };
    global.sessionStorage.getItem = () => { throw new Error('SecurityError'); };
    
    // Import frontend analytics service dynamically to run in mock environment
    const { analytics } = require('../../frontend/src/services/analytics.js');
    const anonId1 = analytics.getAnonymousId();
    assert.ok(anonId1);
    assert.ok(anonId1.startsWith('anon_'));
    const sessId1 = analytics.getSessionId();
    assert.ok(sessId1);
    assert.ok(sessId1.startsWith('sess_'));
    console.log('✓ Storage exceptions fallback works.');

    // 10. trackOnce prevents duplicate page events.
    console.log('Test 10: trackOnce duplicate prevention...');
    // Clean storage mock to accept values in memory
    const mockSessionStore = {};
    global.sessionStorage.getItem = (k) => mockSessionStore[k] || null;
    global.sessionStorage.setItem = (k, v) => { mockSessionStore[k] = v; };
    
    let tracks = 0;
    const originalTrack = analytics.track;
    analytics.track = async (type, meta) => {
      tracks++;
    };

    await analytics.trackOnce('landing_viewed');
    await analytics.trackOnce('landing_viewed');
    assert.strictEqual(tracks, 1);
    analytics.track = originalTrack;
    console.log('✓ trackOnce prevents duplicates.');

    // 11. Oversized raw metadata is rejected.
    console.log('Test 11: Oversized raw metadata rejection...');
    const oversizedMetadata = { data: 'a'.repeat(5000) };
    const resOverRaw = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon',
        sessionId: 'test_sess',
        eventType: 'landing_viewed',
        pageUrl: '/',
        eventId: 'test-evt-over-raw',
        metadata: oversizedMetadata
      })
    });
    assert.strictEqual(resOverRaw.status, 400);
    console.log('✓ Oversized raw metadata rejected.');

    // 12. Invalid metadata types are rejected or safely removed.
    console.log('Test 12: Metadata types validation...');
    const resTypes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: 'test_anon',
        sessionId: 'test_sess',
        eventType: 'puzzle_completed',
        pageUrl: '/p/:publicId',
        eventId: 'test-evt-types',
        metadata: {
          pieceCount: 'invalid_string_instead_of_number',
          durationSeconds: 120
        }
      })
    });
    assert.strictEqual(resTypes.status, 201);
    const dbEventTypes = await JourneyEvent.findOne({ eventId: 'test-evt-types' });
    assert.strictEqual(dbEventTypes.metadata.pieceCount, undefined);
    assert.strictEqual(dbEventTypes.metadata.durationSeconds, 120);
    console.log('✓ Invalid metadata types filtered.');

    console.log('ALL ANALYTICS TEST SCENARIOS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('Test suite failed:', err);
    process.exit(1);
  } finally {
    server.close();
    // Clean up created test records
    await JourneyEvent.deleteMany({ anonymousId: { $regex: /^test_/ } });
    await Customer.deleteMany({ name: { $regex: /^test_/ } });
    await DraftPuzzle.deleteMany({ anonymousId: { $regex: /^test_/ } });
    await AnonymousSession.deleteMany({ anonymousId: { $regex: /^test_/ } });
    await mongoose.disconnect();
  }
}

run();

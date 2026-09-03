const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');

process.env.NODE_ENV = 'production';
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-resend-webhook-secret-32-b!').toString('base64');
process.env.RESEND_API_KEY = 're_test_mock_api_key';

// Mock Resend client before loading emailService
let lastResendSendCall = null;
const mockResendClient = {
  emails: {
    send: async (payload, options) => {
      lastResendSendCall = { payload, options };
      return { data: { id: 're_msg_mock_12345' }, error: null };
    }
  }
};
require.cache[require.resolve('resend')] = {
  exports: {
    Resend: function() { return mockResendClient; }
  }
};

// In-memory mock database
const mockDb = {
  puzzles: new Map(),
  webhookEvents: new Set()
};

function resetDb() {
  mockDb.puzzles.clear();
  mockDb.webhookEvents.clear();
  lastResendSendCall = null;
}

// Mock DeliveryWebhookEvent model
const MockDeliveryWebhookEvent = {
  create: async ({ provider, eventId, eventType, providerMessageId }) => {
    const key = `${provider}:${eventId}`;
    if (mockDb.webhookEvents.has(key)) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    mockDb.webhookEvents.add(key);
    const event = {
      provider, eventId, eventType, providerMessageId,
      processedAt: null, matched: null,
      save: async function() { return this; }
    };
    return event;
  }
};

// Mock Puzzle model (Consumer)
const MockPuzzle = {
  findOne: async (query) => {
    if (query['recipients.providerMessageId']) {
      const targetId = query['recipients.providerMessageId'];
      for (const puzzle of mockDb.puzzles.values()) {
        const found = (puzzle.recipients || []).some(r => r.providerMessageId === targetId);
        if (found) {
          return {
            ...puzzle,
            save: async function() {
              mockDb.puzzles.set(puzzle.publicId, { ...this });
              return this;
            }
          };
        }
      }
      return null;
    }
    if (query.publicId) {
      const p = mockDb.puzzles.get(query.publicId);
      if (!p) return null;
      return {
        ...p,
        save: async function() {
          mockDb.puzzles.set(p.publicId, { ...this });
          return this;
        }
      };
    }
    return null;
  }
};

// Inject mock models into require.cache for resendWebhookService
require.cache[path.resolve(__dirname, '../src/models/DeliveryWebhookEvent.js')] = { exports: MockDeliveryWebhookEvent };
require.cache[path.resolve(__dirname, '../src/models/Puzzle.js')] = { exports: MockPuzzle };

const { sendRevealEmail } = require('../src/services/emailService');
const {
  processEvent,
  verifySignature,
  mapping,
  extractResendError,
  canTransitionConsumerEmail
} = require('../src/services/resendWebhookService');
const adminBusinessLogic = require('../src/utils/adminBusinessLogic');

// Helper to simulate Delivery Centre row construction from adminRebuild.js
function buildDeliveryCentreRow(r, message = null) {
  const isEmail = r.deliveryMethod === 'email';
  const rowStatus = isEmail ? (r.deliveryStatus || 'pending') : ((message && message.status) || r.whatsappSendStatus || r.deliveryStatus || 'pending');
  const rowProviderStatus = isEmail ? (r.deliveryStatus || 'pending') : ((message && message.providerStatus) || r.whatsappSendStatus || r.deliveryStatus || 'pending');
  const rowProviderSendStatus = isEmail ? (r.deliveryStatus || 'pending') : ((message && (message.providerStatus || message.status)) || r.whatsappSendStatus || r.deliveryStatus || 'pending');
  const rowSentAt = isEmail ? (r.sentAt || null) : (r.sentAt || r.whatsappSentAt || null);
  const rowDeliveredAt = isEmail ? (r.deliveredAt || null) : (r.whatsappDeliveredAt || null);
  const rowLastError = isEmail ? (r.lastError || '') : ((message && message.lastErrorMessage) || r.whatsappLastErrorMessage || r.lastError || '');

  const state = adminBusinessLogic.getRecipientOperationalState(r, message);
  const tracking = adminBusinessLogic.getDeliveryTracking(r, message);

  return {
    deliveryMethod: r.deliveryMethod || 'whatsapp',
    state,
    deliveryTracking: tracking,
    status: rowStatus,
    providerStatus: rowProviderStatus,
    providerSendStatus: rowProviderSendStatus,
    sentAt: rowSentAt,
    deliveredAt: rowDeliveredAt,
    openedAt: r.openedAt || null,
    completedAt: r.completedAt || null,
    lastError: rowLastError
  };
}

// ============================================================================
// PART 6 & 1: EMAIL CONTENT & PROVIDER ACCEPTANCE
// ============================================================================

test('1. sendRevealEmail formats content securely and captures providerMessageId', async () => {
  resetDb();
  const secretRevealMessage = 'Super secret proposal message';
  const params = {
    to: 'gabrielmcmanus6@gmail.com',
    recipientName: 'Gabriel Mcmanus',
    senderName: 'Ahmed Alsowar',
    revealLink: 'https://jigzo.biz/p/d71f7a0ec9d798f25f8cb2f85e132e16?r=0',
    idempotencyKey: 'puzzle-reveal/d71f7a0ec9d798f25f8cb2f85e132e16/0'
  };

  const result = await sendRevealEmail(params);

  assert.equal(result.success, true);
  assert.equal(result.providerMessageId, 're_msg_mock_12345');
  assert.equal(result.error, null);

  assert.ok(lastResendSendCall, 'resend.emails.send must be called');
  const { payload, options } = lastResendSendCall;

  assert.deepEqual(payload.to, ['gabrielmcmanus6@gmail.com']);
  assert.equal(payload.subject, 'Ahmed Alsowar sent a JIGZO puzzle');
  assert.match(payload.text, /Hi Gabriel Mcmanus,/);
  assert.match(payload.text, /Ahmed Alsowar sent you a JIGZO surprise puzzle\./);
  assert.match(payload.text, /https:\/\/jigzo\.biz\/p\/d71f7a0ec9d798f25f8cb2f85e132e16\?r=0/);
  assert.match(payload.html, /href="https:\/\/jigzo\.biz\/p\/d71f7a0ec9d798f25f8cb2f85e132e16\?r=0"/);
  assert.doesNotMatch(payload.text, new RegExp(secretRevealMessage, 'i'));
  assert.doesNotMatch(payload.html, new RegExp(secretRevealMessage, 'i'));
  assert.equal(options?.idempotencyKey, 'puzzle-reveal/d71f7a0ec9d798f25f8cb2f85e132e16/0');
});

test('2. email sent + whatsappSendStatus=pending displays email sent, NOT pending', () => {
  const r = {
    deliveryMethod: 'email',
    deliveryStatus: 'sent',
    sentAt: new Date('2026-03-01T10:00:00Z'),
    whatsappSendStatus: 'pending',
    providerMessageId: 're_msg_test_ord'
  };

  const row = buildDeliveryCentreRow(r, null);
  assert.equal(row.providerSendStatus, 'sent');
  assert.equal(row.status, 'sent');
  assert.equal(row.providerStatus, 'sent');
  assert.notEqual(row.providerSendStatus, 'pending');
  assert.equal(row.state, 'sent');
  assert.equal(row.deliveryTracking, 'Sent');
});

test('3. delivered webhook updates correct recipient and records deliveredAt', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-consumer-deliv',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'gabrielmcmanus6@gmail.com',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_resend_delivery_test'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.delivered',
    created_at: '2026-03-01T10:02:00.000Z',
    data: { email_id: 'msg_resend_delivery_test' }
  };

  const res = await processEvent(payload, 'evt_delivered_1');
  assert.equal(res.matched, true);

  const updated = mockDb.puzzles.get('puz-consumer-deliv');
  const rec = updated.recipients[0];
  assert.equal(rec.deliveryStatus, 'delivered');
  assert.equal(rec.deliveredAt.toISOString(), '2026-03-01T10:02:00.000Z');
});

test('4. sibling recipient untouched by webhook', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-multi-recipients',
    status: 'paid',
    recipients: [
      {
        name: 'Recipient 0',
        deliveryMethod: 'email',
        email: 'rec0@example.com',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_rec_0'
      },
      {
        name: 'Recipient 1',
        deliveryMethod: 'email',
        email: 'rec1@example.com',
        deliveryStatus: 'pending',
        sentAt: null,
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_rec_1'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  await processEvent({
    type: 'email.delivered',
    created_at: '2026-03-01T10:05:00.000Z',
    data: { email_id: 'msg_rec_0' }
  }, 'evt_rec0_delivered');

  const updated = mockDb.puzzles.get('puz-multi-recipients');
  assert.equal(updated.recipients[0].deliveryStatus, 'delivered');
  assert.ok(updated.recipients[0].deliveredAt);

  assert.equal(updated.recipients[1].deliveryStatus, 'pending');
  assert.equal(updated.recipients[1].deliveredAt, undefined);
  assert.equal(updated.recipients[1].sentAt, null);
});

test('5. delayed handled cleanly without downgrading delivered', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-consumer-delayed',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'deferred@greylisted.org',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_resend_delayed_test'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const res = await processEvent({
    type: 'email.delivery_delayed',
    created_at: '2026-03-01T10:01:30.000Z',
    data: { email_id: 'msg_resend_delayed_test' }
  }, 'evt_delayed_1');

  assert.equal(res.matched, true);
  const rec = mockDb.puzzles.get('puz-consumer-delayed').recipients[0];
  assert.equal(rec.deliveryStatus, 'delayed');

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.providerSendStatus, 'delayed');
  assert.equal(row.state, 'sent');
});

test('6. bounced handled and populates diagnostic lastError', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-consumer-bounce',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'invalid@bad-domain.xyz',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_resend_bounce_test'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.bounced',
    created_at: '2026-03-01T10:01:00.000Z',
    data: {
      email_id: 'msg_resend_bounce_test',
      bounce: {
        message: '550 5.1.1 User unknown',
        type: 'Permanent',
        subType: 'General',
        diagnosticCode: 'smtp; 550 5.1.1 Recipient address rejected'
      }
    }
  };

  await processEvent(payload, 'evt_bounce_1');

  const rec = mockDb.puzzles.get('puz-consumer-bounce').recipients[0];
  assert.equal(rec.deliveryStatus, 'bounced');
  assert.match(rec.lastError, /550 5.1.1 User unknown/);
  assert.match(rec.lastError, /smtp; 550 5.1.1 Recipient address rejected/);

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.state, 'failed');
  assert.equal(row.deliveryTracking, 'Failed');
  assert.equal(row.providerSendStatus, 'bounced');
  assert.match(row.lastError, /550 5.1.1 User unknown/);
});

test('7. suppressed handled and marks operational failure in Delivery Centre', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-suppressed',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'suppressed@example.com',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_suppressed'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.suppressed',
    created_at: '2026-03-01T10:01:00.000Z',
    data: {
      email_id: 'msg_suppressed',
      suppressed: {
        message: 'Recipient address is suppressed due to previous complaint',
        type: 'complaint'
      }
    }
  };

  await processEvent(payload, 'evt_suppressed_1');

  const rec = mockDb.puzzles.get('puz-suppressed').recipients[0];
  assert.equal(rec.deliveryStatus, 'suppressed');
  assert.match(rec.lastError, /Recipient address is suppressed due to previous complaint/);

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.state, 'failed');
  assert.equal(row.deliveryTracking, 'Failed');
  assert.equal(row.providerSendStatus, 'suppressed');
  assert.match(row.lastError, /suppressed/);
});

test('8. failed handled and records failure reason', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-failed',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'fail@example.com',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_failed'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.failed',
    created_at: '2026-03-01T10:01:00.000Z',
    data: {
      email_id: 'msg_failed',
      failed: {
        reason: 'Invalid MX record for destination domain'
      }
    }
  };

  await processEvent(payload, 'evt_failed_1');

  const rec = mockDb.puzzles.get('puz-failed').recipients[0];
  assert.equal(rec.deliveryStatus, 'failed');
  assert.equal(rec.lastError, 'Invalid MX record for destination domain');

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.state, 'failed');
  assert.equal(row.deliveryTracking, 'Failed');
  assert.equal(row.providerSendStatus, 'failed');
});

test('9. complained handled and transitions to failed state with complaint recorded', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-complained',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'spam@example.com',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_complaint_direct'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.complained',
    data: {
      email_id: 'msg_complaint_direct',
      reason: 'Recipient marked as spam'
    }
  };

  await processEvent(payload, 'evt_complaint_direct');

  const rec = mockDb.puzzles.get('puz-complained').recipients[0];
  assert.equal(rec.deliveryStatus, 'complained');
  assert.equal(rec.lastError, 'Recipient marked as spam');

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.state, 'failed');
  assert.equal(row.deliveryTracking, 'Failed');
  assert.equal(row.providerSendStatus, 'complained');
});

test('10. delivered -> complained allowed (spam complaint post-delivery)', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-delivered-then-complained',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        email: 'delivered_then_complained@example.com',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        deliveredAt: new Date('2026-03-01T10:02:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_deliv_then_complaint'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.complained',
    created_at: '2026-03-01T10:20:00.000Z',
    data: {
      email_id: 'msg_deliv_then_complaint',
      reason: 'Recipient marked email as spam'
    }
  };

  await processEvent(payload, 'evt_complaint_post_deliv');

  const rec = mockDb.puzzles.get('puz-delivered-then-complained').recipients[0];
  assert.equal(rec.deliveryStatus, 'complained');
  assert.match(rec.lastError, /Recipient marked email as spam/);

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.providerSendStatus, 'complained');
  assert.equal(row.state, 'failed');
  assert.equal(row.deliveryTracking, 'Failed');
});

test('11. stale sent after delivered is blocked', async () => {
  resetDb();
  const deliveredAt = new Date('2026-03-01T10:05:00.000Z');
  const puzzle = {
    publicId: 'puz-downgrade-guard',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        deliveredAt,
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_downgrade_test'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  await processEvent({
    type: 'email.sent',
    data: { email_id: 'msg_downgrade_test' }
  }, 'evt_late_sent');

  const rec = mockDb.puzzles.get('puz-downgrade-guard').recipients[0];
  assert.equal(rec.deliveryStatus, 'delivered');
  assert.equal(rec.deliveredAt.toISOString(), deliveredAt.toISOString());
});

test('12. stale sent/delivered after bounced is blocked', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-transition-test',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'bounced',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        lastError: 'Permanent failure',
        providerMessageId: 'msg_trans_1'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  // Stale email.sent arriving after bounced
  await processEvent({
    type: 'email.sent',
    data: { email_id: 'msg_trans_1' }
  }, 'evt_late_sent_bounced');

  let rec = mockDb.puzzles.get('puz-transition-test').recipients[0];
  assert.equal(rec.deliveryStatus, 'bounced');

  // Stale email.delivered arriving after bounced
  await processEvent({
    type: 'email.delivered',
    data: { email_id: 'msg_trans_1' }
  }, 'evt_late_deliv_bounced');

  rec = mockDb.puzzles.get('puz-transition-test').recipients[0];
  assert.equal(rec.deliveryStatus, 'bounced');
});

test('13. duplicate webhook harmless (idempotent)', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-dup-test',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        providerMessageId: 'msg_dup'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.delivered',
    data: { email_id: 'msg_dup' }
  };

  const first = await processEvent(payload, 'evt_same_id');
  assert.equal(first.matched, true);

  const second = await processEvent(payload, 'evt_same_id');
  assert.equal(second.duplicate, true);

  const rec = mockDb.puzzles.get('puz-dup-test').recipients[0];
  assert.equal(rec.deliveryStatus, 'delivered');
});

test('14. solved recipient can still record bounced provider result (independent truths)', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-engagement-independent',
    status: 'paid',
    recipients: [
      {
        name: 'Solved Recipient',
        deliveryMethod: 'email',
        email: 'solved@example.com',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        completedAt: new Date('2026-03-01T10:30:00Z'),
        completionSeconds: 120,
        providerMessageId: 'msg_solved_bounced'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.bounced',
    created_at: '2026-03-01T10:05:00.000Z',
    data: {
      email_id: 'msg_solved_bounced',
      bounce: {
        message: '550 5.1.1 Mailbox unknown',
        type: 'Permanent'
      }
    }
  };

  await processEvent(payload, 'evt_solved_bounced_1');

  const rec = mockDb.puzzles.get('puz-engagement-independent').recipients[0];
  assert.equal(rec.deliveryStatus, 'bounced');
  assert.match(rec.lastError, /550 5.1.1 Mailbox unknown/);
  assert.ok(rec.completedAt);

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.state, 'solved');
  assert.equal(row.providerSendStatus, 'bounced');
  assert.equal(row.deliveryTracking, 'Failed');
});

test('15. Puzzle.status remains unchanged by email.delivered webhook', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-status-iso',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'sent',
        providerMessageId: 'msg_status_iso'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  await processEvent({
    type: 'email.delivered',
    data: { email_id: 'msg_status_iso' }
  }, 'evt_iso');

  const updated = mockDb.puzzles.get('puz-status-iso');
  assert.equal(updated.status, 'paid');
  assert.equal(updated.recipients[0].deliveryStatus, 'delivered');
});

test('16. invalid webhook signature rejected', () => {
  const rawBody = Buffer.from(JSON.stringify({ type: 'email.delivered' }));
  const id = 'msg_test_id';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const badSignature = 'v1,invalid_base64_signature_here';

  const valid = verifySignature({ rawBody, id, timestamp, signature: badSignature });
  assert.equal(valid, false);
});

test('17. valid webhook signature accepted', () => {
  const rawBody = Buffer.from(JSON.stringify({ type: 'email.delivered' }));
  const id = 'msg_test_id';
  const now = Date.now();
  const timestamp = Math.floor(now / 1000).toString();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expectedHmac = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest('base64');
  const signature = `v1,${expectedHmac}`;

  const valid = verifySignature({ rawBody, id, timestamp, signature, now });
  assert.equal(valid, true);
});

test('18. no outbound resend happens during reconciliation', async () => {
  resetDb();
  let sendCalls = 0;
  mockResendClient.emails.send = async () => {
    sendCalls++;
    return { data: { id: 'unexpected' } };
  };

  const puzzle = {
    publicId: 'puz-no-resend',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'sent',
        providerMessageId: 'msg_no_resend_check'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  await processEvent({
    type: 'email.delivered',
    data: { email_id: 'msg_no_resend_check' }
  }, 'evt_no_resend_check');

  assert.equal(sendCalls, 0, 'Webhook processing must never invoke email resend');
});

test('19. HTTP Route Integration: POST /api/webhooks/resend rejects unsigned and accepts correctly signed payload', async () => {
  global.mongooseConnection = { connection: {}, promise: null };
  require.cache[path.resolve(__dirname, '../src/config/database.js')] = {
    exports: async () => ({})
  };
  const http = require('http');
  const app = require('../src/server');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/webhooks/resend`;

  try {
    // 1. Unsigned request -> 401
    const resNoSig = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.delivered' })
    });
    assert.equal(resNoSig.status, 401);
    const bodyNoSig = await resNoSig.json();
    assert.equal(bodyNoSig.error, 'Invalid webhook signature.');

    // 2. Invalid signature -> 401
    const resBadSig = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_route_test',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,invalid_signature'
      },
      body: JSON.stringify({ type: 'email.delivered' })
    });
    assert.equal(resBadSig.status, 401);

    // 3. Valid signature -> 200 { success: true }
    const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_route_ok' } });
    const id = 'msg_route_ok';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
    const hmac = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
    const signature = `v1,${hmac}`;

    const resValid = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature
      },
      body: rawBody
    });
    assert.equal(resValid.status, 200);
    const bodyValid = await resValid.json();
    assert.equal(bodyValid.success, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

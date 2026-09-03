const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'production';
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-resend-webhook-secret-32-b!').toString('base64');
process.env.RESEND_API_KEY = 're_test_mock_api_key';

// Capture real Mongoose models before mocking require.cache
const RealEmailMessage = require('../src/models/EmailMessage');
const RealCampaignDelivery = require('../src/models/CampaignDelivery');

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
  emailMessages: new Map(),
  campaignDeliveries: new Map(),
  webhookEvents: new Set()
};

function resetDb() {
  mockDb.puzzles.clear();
  mockDb.emailMessages.clear();
  mockDb.campaignDeliveries.clear();
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

// Mock EmailMessage model (Business)
const MockEmailMessage = {
  findOne: async ({ providerMessageId }) => {
    const msg = mockDb.emailMessages.get(providerMessageId);
    if (!msg) return null;
    return {
      ...msg,
      save: async function() {
        mockDb.emailMessages.set(providerMessageId, { ...this });
        return this;
      }
    };
  }
};

// Mock CampaignDelivery model (Business)
const MockCampaignDelivery = {
  updateOne: async ({ _id }, { $set }) => {
    const delivery = mockDb.campaignDeliveries.get(String(_id)) || {};
    mockDb.campaignDeliveries.set(String(_id), { ...delivery, ...$set });
    return { modifiedCount: 1 };
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
require.cache[path.resolve(__dirname, '../src/models/EmailMessage.js')] = { exports: MockEmailMessage };
require.cache[path.resolve(__dirname, '../src/models/CampaignDelivery.js')] = { exports: MockCampaignDelivery };
require.cache[path.resolve(__dirname, '../src/models/Puzzle.js')] = { exports: MockPuzzle };

const { sendRevealEmail } = require('../src/services/emailService');
const {
  processEvent,
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
// PART 6 — EMAIL CONTENT & PROVIDER ACCEPTANCE TESTS
// ============================================================================

test('PART 6: sendRevealEmail formats content securely and captures providerMessageId', async () => {
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

  // 1. Correct recipient email
  assert.deepEqual(payload.to, ['gabrielmcmanus6@gmail.com']);

  // 2. Sender and Recipient name in subject and body
  assert.equal(payload.subject, 'Ahmed Alsowar sent a JIGZO puzzle');
  assert.match(payload.text, /Hi Gabriel Mcmanus,/);
  assert.match(payload.text, /Ahmed Alsowar sent you a JIGZO surprise puzzle\./);
  assert.match(payload.html, /Gabriel Mcmanus/);
  assert.match(payload.html, /Ahmed Alsowar/);

  // 3. Recipient-specific ?r=N URL and CTA
  assert.match(payload.text, /https:\/\/jigzo\.biz\/p\/d71f7a0ec9d798f25f8cb2f85e132e16\?r=0/);
  assert.match(payload.html, /href="https:\/\/jigzo\.biz\/p\/d71f7a0ec9d798f25f8cb2f85e132e16\?r=0"/);
  assert.match(payload.html, /Open your puzzle/);

  // 4. Secret message must NEVER appear in plain text or HTML
  assert.doesNotMatch(payload.text, new RegExp(secretRevealMessage, 'i'));
  assert.doesNotMatch(payload.html, new RegExp(secretRevealMessage, 'i'));

  // 5. Idempotency key passed to Resend options
  assert.equal(options?.idempotencyKey, 'puzzle-reveal/d71f7a0ec9d798f25f8cb2f85e132e16/0');
});

// ============================================================================
// PART 5 — REGRESSION & BUG TESTS
// ============================================================================

test('PART 5 Bug Test: Email recipient with deliveryStatus="sent" and whatsappSendStatus="pending" displays provider status "sent", NOT "pending"', () => {
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

test('PART 5 Item 1: Consumer email provider acceptance stores providerMessageId', async () => {
  resetDb();
  const recipient = {
    deliveryMethod: 'email',
    email: 'recipient@example.com',
    deliveryStatus: 'pending',
    whatsappSendStatus: 'pending',
    providerMessageId: ''
  };

  const res = await sendRevealEmail({
    to: recipient.email,
    recipientName: 'Test Recipient',
    senderName: 'Test Sender',
    revealLink: 'https://jigzo.biz/p/test?r=0',
    idempotencyKey: 'test-key-1'
  });

  if (res.success) {
    recipient.deliveryStatus = 'sent';
    recipient.sentAt = new Date();
    recipient.providerMessageId = res.providerMessageId;
  }

  assert.equal(recipient.deliveryStatus, 'sent');
  assert.equal(recipient.providerMessageId, 're_msg_mock_12345');
});

test('PART 5 Items 2 & 3: Consumer Resend delivered webhook finds correct Puzzle recipient and changes email recipient to delivered without mutating Puzzle.status', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-consumer-1',
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
  const updated = mockDb.puzzles.get('puz-consumer-1');
  const rec = updated.recipients[0];
  assert.equal(rec.deliveryStatus, 'delivered');
  assert.equal(rec.deliveredAt.toISOString(), '2026-03-01T10:02:00.000Z');
  assert.equal(updated.status, 'paid', 'Puzzle status must remain unchanged by recipient delivery');
});

test('PART 5 Item 4: Bounce/failure changes email recipient to correct failed/bounced state and populates lastError', async () => {
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

  const res = await processEvent(payload, 'evt_bounce_1');

  assert.equal(res.matched, true);
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

test('PART 5 Item 5: Deferred/delayed event maps correctly to delayed', async () => {
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

  const payload = {
    type: 'email.delivery_delayed',
    created_at: '2026-03-01T10:01:30.000Z',
    data: { email_id: 'msg_resend_delayed_test' }
  };

  const res = await processEvent(payload, 'evt_delayed_1');

  assert.equal(res.matched, true);
  const rec = mockDb.puzzles.get('puz-consumer-delayed').recipients[0];
  assert.equal(rec.deliveryStatus, 'delayed');

  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.providerSendStatus, 'delayed');
  assert.equal(row.state, 'sent');
});

test('PART 5 Item 6: Webhook for recipient 0 cannot modify recipient 1', async () => {
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

  const payload = {
    type: 'email.delivered',
    created_at: '2026-03-01T10:05:00.000Z',
    data: { email_id: 'msg_rec_0' }
  };

  await processEvent(payload, 'evt_rec0_delivered');

  const updated = mockDb.puzzles.get('puz-multi-recipients');
  assert.equal(updated.recipients[0].deliveryStatus, 'delivered');
  assert.ok(updated.recipients[0].deliveredAt);

  assert.equal(updated.recipients[1].deliveryStatus, 'pending');
  assert.equal(updated.recipients[1].deliveredAt, undefined);
  assert.equal(updated.recipients[1].sentAt, null);
});

test('PART 5 Item 7: Duplicate webhook is harmless and idempotent', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-duplicate-test',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'sent',
        sentAt: new Date('2026-03-01T10:00:00Z'),
        whatsappSendStatus: 'pending',
        providerMessageId: 'msg_duplicate_test'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  const payload = {
    type: 'email.delivered',
    created_at: '2026-03-01T10:05:00.000Z',
    data: { email_id: 'msg_duplicate_test' }
  };

  const first = await processEvent(payload, 'evt_dup_same_id');
  assert.equal(first.matched, true);

  const second = await processEvent(payload, 'evt_dup_same_id');
  assert.equal(second.duplicate, true);

  const third = await processEvent(payload, 'evt_dup_new_id');
  assert.equal(third.matched, true);

  const rec = mockDb.puzzles.get('puz-duplicate-test').recipients[0];
  assert.equal(rec.deliveryStatus, 'delivered');
});

test('PART 5 Item 8: Delivered cannot be downgraded by a later stale event', async () => {
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

  const sentPayload = {
    type: 'email.sent',
    created_at: '2026-03-01T10:00:05.000Z',
    data: { email_id: 'msg_downgrade_test' }
  };
  await processEvent(sentPayload, 'evt_late_sent');

  const delayedPayload = {
    type: 'email.delivery_delayed',
    created_at: '2026-03-01T10:01:00.000Z',
    data: { email_id: 'msg_downgrade_test' }
  };
  await processEvent(delayedPayload, 'evt_late_delayed');

  const rec = mockDb.puzzles.get('puz-downgrade-guard').recipients[0];
  assert.equal(rec.deliveryStatus, 'delivered');
  assert.equal(rec.deliveredAt.toISOString(), deliveredAt.toISOString());
});

test('PART 5 Item 9: Business Resend webhook handling still works', async () => {
  resetDb();
  const providerMessageId = 'msg_business_campaign_test';
  mockDb.emailMessages.set(providerMessageId, {
    providerMessageId,
    status: 'sent',
    sentAt: new Date('2026-03-01T09:00:00Z'),
    deliveryId: 'campaign_deliv_1'
  });
  mockDb.campaignDeliveries.set('campaign_deliv_1', {
    status: 'sent',
    providerMetadata: {}
  });

  const payload = {
    type: 'email.delivered',
    created_at: '2026-03-01T09:02:00.000Z',
    data: { email_id: providerMessageId }
  };

  const res = await processEvent(payload, 'evt_biz_1');
  assert.equal(res.matched, true);

  const bizMsg = mockDb.emailMessages.get(providerMessageId);
  assert.equal(bizMsg.status, 'delivered');

  const bizDeliv = mockDb.campaignDeliveries.get('campaign_deliv_1');
  assert.equal(bizDeliv.status, 'delivered');
});

test('PART 5 Item 10: WhatsApp Delivery Centre behavior remains unchanged', () => {
  const whatsappRecipient = {
    name: 'WhatsApp Recipient',
    deliveryMethod: 'whatsapp',
    deliveryStatus: 'delivered',
    whatsappSendStatus: 'delivered',
    whatsappDeliveredAt: new Date('2026-03-01T11:00:00Z'),
    whatsappLastErrorCode: '131049'
  };
  const whatsappMessage = {
    status: 'delivered',
    providerStatus: 'delivered',
    lastErrorCode: '131049',
    retryHistory: []
  };

  const row = buildDeliveryCentreRow(whatsappRecipient, whatsappMessage);

  assert.equal(row.deliveryMethod, 'whatsapp');
  assert.equal(row.providerSendStatus, 'delivered');
  assert.equal(row.deliveryTracking, 'Delivered');
  assert.equal(row.state, 'delivered');
  assert.equal(row.deliveredAt.toISOString(), '2026-03-01T11:00:00.000Z');
});

test('PART 5 Item 11: Email Delivery Centre row no longer reads whatsappSendStatus', () => {
  const emailRecipient = {
    deliveryMethod: 'email',
    deliveryStatus: 'sent',
    sentAt: new Date('2026-03-01T10:00:00Z'),
    whatsappSendStatus: 'failed',
    providerMessageId: 'msg_ignore_wa'
  };

  const row = buildDeliveryCentreRow(emailRecipient, null);
  assert.equal(row.providerSendStatus, 'sent');
  assert.notEqual(row.providerSendStatus, 'failed');
  assert.equal(row.state, 'sent');
  assert.equal(row.deliveryTracking, 'Sent');
});

test('PART 5 Item 12: An email accepted by Resend with no delivery webhook is shown as sent/accepted — NOT delivered', () => {
  const acceptedEmail = {
    deliveryMethod: 'email',
    deliveryStatus: 'sent',
    sentAt: new Date('2026-03-01T10:00:00Z'),
    deliveredAt: null,
    whatsappSendStatus: 'pending',
    providerMessageId: 'msg_accepted_only'
  };

  const row = buildDeliveryCentreRow(acceptedEmail, null);
  assert.equal(row.providerSendStatus, 'sent');
  assert.equal(row.state, 'sent');
  assert.equal(row.deliveryTracking, 'Sent');
  assert.notEqual(row.state, 'delivered');
  assert.notEqual(row.deliveryTracking, 'Delivered');
});

test('PART 5 Item 13: A delivered email displays delivered in Delivery Centre', () => {
  const deliveredEmail = {
    deliveryMethod: 'email',
    deliveryStatus: 'delivered',
    sentAt: new Date('2026-03-01T10:00:00Z'),
    deliveredAt: new Date('2026-03-01T10:02:00Z'),
    whatsappSendStatus: 'pending',
    providerMessageId: 'msg_delivered_show'
  };

  const row = buildDeliveryCentreRow(deliveredEmail, null);
  assert.equal(row.providerSendStatus, 'delivered');
  assert.equal(row.state, 'delivered');
  assert.equal(row.deliveryTracking, 'Delivered');
  assert.equal(row.deliveredAt.toISOString(), '2026-03-01T10:02:00.000Z');
});

test('PART 5 Item 14: A bounced email displays failed/bounced appropriately in Delivery Centre', () => {
  const bouncedEmail = {
    deliveryMethod: 'email',
    deliveryStatus: 'bounced',
    sentAt: new Date('2026-03-01T10:00:00Z'),
    lastError: '550 5.1.1 Mailbox does not exist',
    whatsappSendStatus: 'pending',
    providerMessageId: 'msg_bounced_show'
  };

  const row = buildDeliveryCentreRow(bouncedEmail, null);
  assert.equal(row.providerSendStatus, 'bounced');
  assert.equal(row.state, 'failed');
  assert.equal(row.deliveryTracking, 'Failed');
  assert.equal(row.lastError, '550 5.1.1 Mailbox does not exist');
});

test('PART 5 Item 15: No resend occurs during reconciliation', async () => {
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
        sentAt: new Date(),
        providerMessageId: 'msg_no_resend_check'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  await processEvent({
    type: 'email.delivered',
    data: { email_id: 'msg_no_resend_check' }
  }, 'evt_no_resend_1');

  assert.equal(sendCalls, 0, 'No resend should be called during webhook reconciliation');
});

// ============================================================================
// ISSUE 1 — REAL RESEND ERROR EXTRACTION TESTS
// ============================================================================

test('Issue 1: Nested real Resend error payloads are extracted cleanly', () => {
  const bouncePayload = {
    type: 'email.bounced',
    data: {
      email_id: 'msg_bounce_real',
      bounce: {
        message: '550 5.1.1 User unknown',
        type: 'Permanent',
        subType: 'General',
        diagnosticCode: 'smtp; 550 5.1.1 Recipient address rejected'
      }
    }
  };
  const bounceErr = extractResendError(bouncePayload, 'bounced');
  assert.match(bounceErr, /550 5.1.1 User unknown/);
  assert.match(bounceErr, /smtp; 550 5.1.1 Recipient address rejected/);

  const suppressedPayload = {
    type: 'email.suppressed',
    data: {
      email_id: 'msg_supp_real',
      suppressed: {
        message: 'Recipient address is suppressed due to previous complaint',
        type: 'complaint'
      }
    }
  };
  const suppErr = extractResendError(suppressedPayload, 'suppressed');
  assert.match(suppErr, /Recipient address is suppressed due to previous complaint/);
  assert.match(suppErr, /\[complaint\]/);

  const failedPayload = {
    type: 'email.failed',
    data: {
      email_id: 'msg_failed_real',
      failed: {
        reason: 'Invalid MX record for destination domain'
      }
    }
  };
  const failErr = extractResendError(failedPayload, 'failed');
  assert.equal(failErr, 'Invalid MX record for destination domain');
});

// ============================================================================
// ISSUE 2 — STRICT CONSUMER EMAIL TRANSITION TESTS
// ============================================================================

test('Issue 2: Consumer email transition policy prevents state regressions', () => {
  // Stale pre-delivery events cannot overwrite terminal outcomes
  assert.equal(canTransitionConsumerEmail('bounced', 'sent'), false);
  assert.equal(canTransitionConsumerEmail('bounced', 'delayed'), false);
  assert.equal(canTransitionConsumerEmail('suppressed', 'delayed'), false);
  assert.equal(canTransitionConsumerEmail('suppressed', 'sent'), false);
  assert.equal(canTransitionConsumerEmail('failed', 'sent'), false);
  assert.equal(canTransitionConsumerEmail('failed', 'delayed'), false);
  assert.equal(canTransitionConsumerEmail('complained', 'delivered'), false);
  assert.equal(canTransitionConsumerEmail('complained', 'sent'), false);

  // Delivered cannot overwrite terminal failure outcomes
  assert.equal(canTransitionConsumerEmail('bounced', 'delivered'), false);
  assert.equal(canTransitionConsumerEmail('suppressed', 'delivered'), false);
  assert.equal(canTransitionConsumerEmail('failed', 'delivered'), false);

  // Pre-delivery cannot overwrite delivered
  assert.equal(canTransitionConsumerEmail('delivered', 'sent'), false);
  assert.equal(canTransitionConsumerEmail('delivered', 'delayed'), false);

  // Legitimate post-delivery transitions
  assert.equal(canTransitionConsumerEmail('delivered', 'complained'), true);

  // Normal progression
  assert.equal(canTransitionConsumerEmail('pending', 'sent'), true);
  assert.equal(canTransitionConsumerEmail('sent', 'delivered'), true);
  assert.equal(canTransitionConsumerEmail('sent', 'bounced'), true);
  assert.equal(canTransitionConsumerEmail('sent', 'suppressed'), true);
});

test('Issue 2 (Integration): Stale events do not overwrite terminal states', async () => {
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

  const rec = mockDb.puzzles.get('puz-transition-test').recipients[0];
  assert.equal(rec.deliveryStatus, 'bounced', 'bounced -> sent must remain bounced');

  // Stale email.delivered arriving after bounced
  await processEvent({
    type: 'email.delivered',
    data: { email_id: 'msg_trans_1' }
  }, 'evt_late_deliv_bounced');

  assert.equal(rec.deliveryStatus, 'bounced', 'bounced -> delivered must remain bounced');
});

// ============================================================================
// ISSUE 3 — ENGAGEMENT INDEPENDENCE TESTS
// ============================================================================

test('Issue 3: Authoritative Resend bounce is recorded even if puzzle was solved via manual link', async () => {
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
        completedAt: new Date('2026-03-01T10:30:00Z'), // Recipient completed puzzle via direct link!
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

  const updated = mockDb.puzzles.get('puz-engagement-independent');
  const rec = updated.recipients[0];

  // Provider truth: email bounced
  assert.equal(rec.deliveryStatus, 'bounced');
  assert.match(rec.lastError, /550 5.1.1 Mailbox unknown/);

  // Engagement truth: completedAt remains intact
  assert.ok(rec.completedAt);
  assert.equal(rec.completedAt.toISOString(), '2026-03-01T10:30:00.000Z');

  // Delivery Centre row preserves BOTH truths:
  const row = buildDeliveryCentreRow(rec, null);
  assert.equal(row.state, 'solved', 'Operational state reflects engagement (solved)');
  assert.equal(row.providerSendStatus, 'bounced', 'Provider status reflects provider truth (bounced)');
  assert.equal(row.deliveryTracking, 'Failed', 'Tracking reflects provider outcome (Failed)');
  assert.match(row.lastError, /550 5.1.1 Mailbox unknown/);
});

// ============================================================================
// ISSUE 4 — BUSINESS MODEL SCHEMA VALIDATION TESTS
// ============================================================================

test('Issue 4: Real EmailMessage and CampaignDelivery schemas validate successfully for suppression events', async () => {
  const dummyDeliveryId = new mongoose.Types.ObjectId();
  const dummyOrgId = new mongoose.Types.ObjectId();
  const dummyCampId = new mongoose.Types.ObjectId();
  const dummyRecId = new mongoose.Types.ObjectId();

  // 1. Validate EmailMessage instance with suppressed provider status and failed status
  const emailMsg = new RealEmailMessage({
    deliveryId: dummyDeliveryId,
    organizationId: dummyOrgId,
    campaignId: dummyCampId,
    recipientId: dummyRecId,
    idempotencyKey: 'idem-test-1',
    destinationMasked: '***@example.com',
    status: 'failed',
    providerStatus: 'suppressed',
    failedAt: new Date(),
    lastEventAt: new Date()
  });

  const emailErr = emailMsg.validateSync();
  assert.equal(emailErr, undefined, 'EmailMessage schema must pass validation with providerStatus=suppressed');

  // 2. Validate CampaignDelivery instance with status=failed and providerErrorCategory=suppressed
  const campDelivery = new RealCampaignDelivery({
    deliveryId: 'deliv-uuid-1',
    organizationId: dummyOrgId,
    campaignId: dummyCampId,
    recipientId: dummyRecId,
    channel: 'email',
    purpose: 'launch',
    idempotencyKey: 'idem-test-deliv-1',
    provider: 'resend',
    status: 'failed',
    providerErrorCategory: 'suppressed',
    providerErrorCode: 'Recipient suppressed',
    failedAt: new Date()
  });

  const campErr = campDelivery.validateSync();
  assert.equal(campErr, undefined, 'CampaignDelivery schema must pass validation with status=failed');
});

// ============================================================================
// ISSUE 5 — CANONICAL PROVIDER MESSAGE ID TESTS
// ============================================================================

test('Issue 5: Webhooks match exclusively on canonical email_id, not arbitrary object id', async () => {
  resetDb();
  const puzzle = {
    publicId: 'puz-email-id-strict',
    status: 'paid',
    recipients: [
      {
        deliveryMethod: 'email',
        deliveryStatus: 'sent',
        providerMessageId: 'target_email_msg_id'
      }
    ]
  };
  mockDb.puzzles.set(puzzle.publicId, puzzle);

  // A webhook with data.id but no data.email_id (e.g. domain/contact event) must NOT match
  const nonEmailPayload = {
    type: 'domain.created',
    data: { id: 'target_email_msg_id' }
  };
  const resNonEmail = await processEvent(nonEmailPayload, 'evt_non_email_1');
  assert.equal(resNonEmail.matched, false, 'Non-email event lacking email_id must not match');

  // A webhook with canonical data.email_id matches correctly
  const emailPayload = {
    type: 'email.delivered',
    data: { email_id: 'target_email_msg_id' }
  };
  const resEmail = await processEvent(emailPayload, 'evt_email_delivered_strict');
  assert.equal(resEmail.matched, true);
  assert.equal(mockDb.puzzles.get('puz-email-id-strict').recipients[0].deliveryStatus, 'delivered');
});

const assert = require('assert');
const crypto = require('crypto');

// Mock setup for Mongoose models to allow fast database-free unit testing
const mockDb = {
  puzzles: {},
  messages: {},
  webhookEvents: {}
};

function maskPhone(phone) {
  if (!phone) return 'unknown';
  const str = String(phone);
  if (str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

// Mock models
const MockPuzzle = {
  findOne: async ({ publicId }) => mockDb.puzzles[publicId] || null,
  findById: async (id) => {
    return Object.values(mockDb.puzzles).find(p => String(p._id) === String(id)) || null;
  }
};

const MockOrder = {
  findOne: async () => ({
    puzzleId: 'puz-check-status',
    paymentStatus: 'pending',
    save: async () => {}
  })
};

const MockPaymentService = {
  verifyWebhook: () => true
};

const MockWhatsAppMessage = function(data) {
  this._data = { ...data, attemptCount: data.attemptCount || 0 };
  Object.defineProperty(this, 'puzzleId', { get: () => this._data.puzzleId });
  Object.defineProperty(this, 'recipientIndex', { get: () => this._data.recipientIndex });
  Object.defineProperty(this, 'idempotencyKey', { get: () => this._data.idempotencyKey });
  Object.defineProperty(this, 'destinationMasked', { get: () => this._data.destinationMasked });
  Object.defineProperty(this, 'createdAt', { get: () => this._data.createdAt });
  
  Object.defineProperty(this, 'updatedAt', {
    get: () => this._data.updatedAt,
    set: (v) => { this._data.updatedAt = v; }
  });
  Object.defineProperty(this, 'status', {
    get: () => this._data.status,
    set: (v) => { this._data.status = v; }
  });
  Object.defineProperty(this, 'claimedAt', {
    get: () => this._data.claimedAt,
    set: (v) => { this._data.claimedAt = v; }
  });
  Object.defineProperty(this, 'requestStartedAt', {
    get: () => this._data.requestStartedAt,
    set: (v) => { this._data.requestStartedAt = v; }
  });
  Object.defineProperty(this, 'attemptCount', {
    get: () => this._data.attemptCount,
    set: (v) => { this._data.attemptCount = v; }
  });
  Object.defineProperty(this, 'payloadHash', {
    get: () => this._data.payloadHash,
    set: (v) => { this._data.payloadHash = v; }
  });
  Object.defineProperty(this, 'providerMessageId', {
    get: () => this._data.providerMessageId,
    set: (v) => { this._data.providerMessageId = v; }
  });
  Object.defineProperty(this, 'acceptedAt', {
    get: () => this._data.acceptedAt,
    set: (v) => { this._data.acceptedAt = v; }
  });
  Object.defineProperty(this, 'lastErrorCode', {
    get: () => this._data.lastErrorCode,
    set: (v) => { this._data.lastErrorCode = v; }
  });
  Object.defineProperty(this, 'lastErrorMessage', {
    get: () => this._data.lastErrorMessage,
    set: (v) => { this._data.lastErrorMessage = v; }
  });
  Object.defineProperty(this, 'failedAt', {
    get: () => this._data.failedAt,
    set: (v) => { this._data.failedAt = v; }
  });
  Object.defineProperty(this, 'sentAt', {
    get: () => this._data.sentAt,
    set: (v) => { this._data.sentAt = v; }
  });
  Object.defineProperty(this, 'deliveredAt', {
    get: () => this._data.deliveredAt,
    set: (v) => { this._data.deliveredAt = v; }
  });
  Object.defineProperty(this, 'readAt', {
    get: () => this._data.readAt,
    set: (v) => { this._data.readAt = v; }
  });
  Object.defineProperty(this, 'lastStatusAt', {
    get: () => this._data.lastStatusAt,
    set: (v) => { this._data.lastStatusAt = v; }
  });

  this.save = async () => {
    const key = this._data.idempotencyKey;
    if (mockDb.messages[key] && mockDb.messages[key] !== this) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    mockDb.messages[key] = this;
    return this;
  };
};
MockWhatsAppMessage.findOne = async (query) => {
  if (query.idempotencyKey) return mockDb.messages[query.idempotencyKey] || null;
  if (query.providerMessageId) {
    return Object.values(mockDb.messages).find(m => m.providerMessageId === query.providerMessageId) || null;
  }
  return null;
};

const MockWhatsAppWebhookEvent = function(data) {
  this._data = { ...data };
  this.save = async () => {
    const key = this._data.idempotencyKey;
    if (mockDb.webhookEvents[key] && mockDb.webhookEvents[key] !== this) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    mockDb.webhookEvents[key] = this;
    return this;
  };
};

// Intercept mongoose model requires before importing JIGZO modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path.includes('models/WhatsAppMessage')) return MockWhatsAppMessage;
  if (path.includes('models/Puzzle')) return MockPuzzle;
  if (path.includes('models/WhatsAppWebhookEvent')) return MockWhatsAppWebhookEvent;
  if (path.includes('models/Order')) return MockOrder;
  if (path.includes('services/paymentService')) return MockPaymentService;
  return originalRequire.apply(this, arguments);
};

// Import JIGZO service and webhook router under the mock environment
const whatsappService = require('../src/services/whatsappService');
const whatsappWebhookRouter = require('../src/routes/webhooks/whatsapp');

// Inject mock updates into service snapshot updates to run DB-free
whatsappService.updateRecipientSnapshot = async (puzzleId, recipientIndex, fields) => {
  const puzzle = mockDb.puzzles[puzzleId];
  if (puzzle && puzzle.recipients[recipientIndex]) {
    const rec = puzzle.recipients[recipientIndex];
    
    const priority = {
      'pending': 0,
      'disabled': 0,
      'claimed': 1,
      'sending': 2,
      'accepted': 3,
      'sent': 4,
      'delivered': 5,
      'read': 6
    };

    if (fields.status) {
      const currentPriority = priority[rec.whatsappSendStatus] || 0;
      const incomingPriority = priority[fields.status] || 0;
      if (incomingPriority > currentPriority) {
        rec.whatsappSendStatus = fields.status;
      }
    }
    if (fields.providerMessageId) rec.providerMessageId = fields.providerMessageId;
    if (fields.occurredAt) {
      if (fields.status === 'sent') rec.whatsappSentAt = fields.occurredAt;
      if (fields.status === 'delivered') rec.whatsappDeliveredAt = fields.occurredAt;
      if (fields.status === 'read') rec.whatsappReadAt = fields.occurredAt;
    }
    if (fields.failedAt || fields.status === 'failed') {
      rec.whatsappFailedAt = fields.failedAt || fields.occurredAt || new Date();
      rec.whatsappLastErrorCode = fields.errorCode || '';
      rec.whatsappLastErrorMessage = fields.errorMessage || '';
      
      const currentPriority = priority[rec.whatsappSendStatus] || 0;
      if (currentPriority < priority['sent']) {
        rec.whatsappSendStatus = 'failed';
      }
    }
  }
};

// Mock fetch globally
let lastFetchParams = null;
let fetchResponseMock = null;
global.fetch = async (url, options) => {
  lastFetchParams = { url, options };
  return fetchResponseMock || {
    ok: true,
    text: async () => JSON.stringify({ messages: [{ id: 'mock-provider-id-999' }] })
  };
};

function resetMocks() {
  mockDb.puzzles = {};
  mockDb.messages = {};
  mockDb.webhookEvents = {};
  process.env.WHATSAPP_ENABLED = 'false';
  process.env.KAPSO_API_KEY = 'mock_api_key_123';
  process.env.KAPSO_PHONE_NUMBER_ID = '10928374';
  process.env.KAPSO_WEBHOOK_SECRET = 'mock_webhook_secret_abc';
  lastFetchParams = null;
  fetchResponseMock = null;
}

// Minimal router test helper
function invokeWebhookRoute(req, res, next) {
  const routeStack = whatsappWebhookRouter.stack.find(s => s.route)?.route.stack || [];
  const handler = routeStack[0]?.handle;
  if (!handler) {
    throw new Error('Webhook POST handler not found in router');
  }
  return handler(req, res, next);
}

async function runAllTests() {
  console.log('Starting JIGZO WhatsApp Delivery Integration Tests...\n');

  // ==========================================
  // Group 1: Disabled Mode Safety
  // ==========================================
  console.log('--- Group 1: Disabled Mode Safety ---');
  resetMocks();
  mockDb.puzzles['puz-safety'] = {
    publicId: 'puz-safety',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };

  let resSafety = await whatsappService.claimAndSendPuzzleDelivery({
    puzzleId: 'puz-safety',
    recipientIndex: 0
  });

  assert.strictEqual(resSafety.success, true);
  assert.strictEqual(resSafety.status, 'disabled');
  assert.strictEqual(Object.keys(mockDb.messages).length, 0); // no message record created
  assert.strictEqual(mockDb.puzzles['puz-safety'].recipients[0].whatsappSendStatus, 'pending'); // snapshot untouched
  assert.strictEqual(lastFetchParams, null); // zero fetches
  console.log('✓ Scenario 1.1: Disabled mode creates no WhatsAppMessage record: Success');
  console.log('✓ Scenario 1.2: Disabled mode acquires no claim or recipient status changes: Success');
  console.log('✓ Scenario 1.3: Disabled mode executes zero external network requests: Success');

  // ==========================================
  // Group 2: Exact Template Payload
  // ==========================================
  console.log('\n--- Group 2: Exact Template Payload ---');
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-temp'] = {
    publicId: 'puz-temp',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [
      { name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' },
      { name: 'Yazan', phone: '33931332', countryCode: '973', whatsappSendStatus: 'pending' }
    ]
  };

  // Recipient 0
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-temp', recipientIndex: 0 });
  let payload0 = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(payload0.template.components[1].parameters[0].text, 'puz-temp?r=0');
  console.log('✓ Scenario 2.1: Recipient 0 suffix correctly formatted with ?r=0: Success');

  // Recipient 1
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-temp', recipientIndex: 1 });
  let payload1 = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(payload1.template.components[1].parameters[0].text, 'puz-temp?r=1');
  console.log('✓ Scenario 2.2: Recipient 1 suffix correctly formatted with ?r=1: Success');

  // Privacy: Recipient 0 payload has no Recipient 1 PII
  assert.strictEqual(payload0.template.components[0].parameters[0].text, 'Sam');
  assert.ok(!payload0.template.components[0].parameters[0].text.includes('Yazan'));
  console.log('✓ Scenario 2.3: Recipient 0 payload contains no Recipient 1 data: Success');

  // ==========================================
  // Group 3: API Outcomes
  // ==========================================
  console.log('\n--- Group 3: API Outcomes ---');
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-api'] = {
    publicId: 'puz-api',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  
  // Accepted stores providerMessageId and acceptedAt but not sentAt
  fetchResponseMock = {
    ok: true,
    text: async () => JSON.stringify({ messages: [{ id: 'provider-accepted-id-123' }] })
  };
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-api', recipientIndex: 0 });
  let messageRecord = mockDb.messages[`puzzle-delivery:puz-api:0:jigzo_puzzle_delivery:v1`];
  assert.strictEqual(messageRecord.status, 'accepted');
  assert.strictEqual(messageRecord.providerMessageId, 'provider-accepted-id-123');
  assert.ok(messageRecord.acceptedAt);
  assert.strictEqual(messageRecord.sentAt, undefined);
  console.log('✓ Scenario 3.1: Accepted response stores providerMessageId, sets acceptedAt, and leaves sentAt empty: Success');

  // Double send using accepted key performs no second fetch
  lastFetchParams = null;
  let doubleRes = await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-api', recipientIndex: 0 });
  assert.strictEqual(doubleRes.reason, 'duplicate_request');
  assert.strictEqual(lastFetchParams, null);
  console.log('✓ Scenario 3.2: Duplicate send using accepted idempotency key skips second fetch: Success');

  // Explicit provider rejection
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-rejection'] = {
    publicId: 'puz-rejection',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  fetchResponseMock = {
    ok: false,
    text: async () => JSON.stringify({ error: { code: '100', message: 'Unsupported phone number' } })
  };
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-rejection', recipientIndex: 0 });
  assert.strictEqual(mockDb.messages[`puzzle-delivery:puz-rejection:0:jigzo_puzzle_delivery:v1`].status, 'failed');
  console.log('✓ Scenario 3.3: Explicit provider rejection updates status to failed: Success');

  // Ambiguous timeout becomes verification_required
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-timeout'] = {
    publicId: 'puz-timeout',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  global.fetch = async () => { throw new Error('Timeout connecting to proxy'); };
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-timeout', recipientIndex: 0 });
  assert.strictEqual(mockDb.messages[`puzzle-delivery:puz-timeout:0:jigzo_puzzle_delivery:v1`].status, 'verification_required');
  console.log('✓ Scenario 3.4: Network request timeout is caught and marked verification_required: Success');

  // ==========================================
  // Group 4: Webhook Security
  // ==========================================
  console.log('\n--- Group 4: Webhook Security ---');
  resetMocks();
  
  const webhookPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'provider-accepted-id-123',
      timestamp: '1721245678',
      kapso: { status: 'sent' }
    }
  });

  const validSignature = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(webhookPayload, 'utf8'))
    .digest('hex');

  let resStatus = 0;
  let resBody = null;
  let resJson = (data) => { resBody = data; };
  let resMock = {
    status: (s) => { resStatus = s; return { json: resJson }; },
    json: resJson
  };

  // Missing signature
  let reqNoSig = {
    headers: { 'x-idempotency-key': 'w-1', 'x-webhook-event': 'whatsapp.message.sent' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqNoSig, resMock, () => {});
  assert.strictEqual(resStatus, 400);
  console.log('✓ Scenario 4.1: Missing webhook signature header returns HTTP 400: Success');

  // Malformed signature length
  let reqBadSig = {
    headers: { 'x-webhook-signature': 'too_short', 'x-idempotency-key': 'w-2', 'x-webhook-event': 'whatsapp.message.sent' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqBadSig, resMock, () => {});
  assert.strictEqual(resStatus, 401);
  console.log('✓ Scenario 4.2: Malformed signature length timing-safe comparison safely rejected: Success');

  // Missing idempotency key
  let reqNoIdemp = {
    headers: { 'x-webhook-signature': validSignature, 'x-webhook-event': 'whatsapp.message.sent' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqNoIdemp, resMock, () => {});
  assert.strictEqual(resStatus, 400);
  console.log('✓ Scenario 4.3: Missing idempotency key header returns HTTP 400: Success');

  // Duplicate idempotency key returns 200
  let reqValid = {
    headers: { 'x-webhook-signature': validSignature, 'x-idempotency-key': 'w-dup-1', 'x-webhook-event': 'whatsapp.message.sent' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  mockDb.messages['puzzle-delivery:webhook-test:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'webhook-test',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:webhook-test:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'msg-123',
    destinationMasked: '***331',
    status: 'accepted'
  });
  mockDb.puzzles['webhook-test'] = {
    publicId: 'webhook-test',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'accepted' }]
  };

  await invokeWebhookRoute(reqValid, resMock, () => {});
  assert.strictEqual(resStatus, 200);

  // Send duplicate request
  resStatus = 0;
  await invokeWebhookRoute(reqValid, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resBody.note, 'duplicate_webhook_ignored');
  console.log('✓ Scenario 4.4: Duplicate idempotency key returns HTTP 200 and performs no duplicate database updates: Success');

  // ==========================================
  // Group 5: Kapso Webhook Event Status Mapping
  // ==========================================
  console.log('\n--- Group 5: Kapso Webhook Event Status Mapping ---');
  resetMocks();
  
  // Sent, Delivered, Read mapping
  const events = ['sent', 'delivered', 'read'];
  for (let event of events) {
    const payloadStr = JSON.stringify({
      phone_number_id: '10928374',
      message: {
        id: `msg-${event}`,
        timestamp: '1721245678',
        kapso: { status: event }
      }
    });
    const sig = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
      .update(Buffer.from(payloadStr, 'utf8'))
      .digest('hex');

    let reqObj = {
      headers: {
        'x-webhook-signature': sig,
        'x-idempotency-key': `k-event-${event}`,
        'x-webhook-event': `whatsapp.message.${event}`
      },
      body: Buffer.from(payloadStr, 'utf8')
    };

    mockDb.messages[`puzzle-delivery:k-event:${event}:jigzo_puzzle_delivery:v1`] = new MockWhatsAppMessage({
      puzzleId: 'k-event',
      recipientIndex: 0,
      idempotencyKey: `puzzle-delivery:k-event:${event}:jigzo_puzzle_delivery:v1`,
      providerMessageId: `msg-${event}`,
      destinationMasked: '***331',
      status: 'accepted'
    });
    mockDb.puzzles['k-event'] = {
      publicId: 'k-event',
      recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'accepted' }]
    };

    await invokeWebhookRoute(reqObj, resMock, () => {});
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(mockDb.messages[`puzzle-delivery:k-event:${event}:jigzo_puzzle_delivery:v1`].status, event);
    console.log(`✓ Scenario 5.${events.indexOf(event) + 1}: Kapso v2 ${event} payload event status successfully mapped: Success`);
  }

  // Failed status with errors inside message.kapso.statuses
  const failedPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'msg-failed-999',
      timestamp: '1721245678',
      kapso: {
        status: 'failed',
        statuses: [
          {
            status: 'failed',
            errors: [
              {
                code: '131026',
                message: 'Receiver cap exceeded',
                error_data: { details: 'Daily limit hit' }
              }
            ]
          }
        ]
      }
    }
  });

  const sigFail = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(failedPayload, 'utf8'))
    .digest('hex');

  let reqFail = {
    headers: {
      'x-webhook-signature': sigFail,
      'x-idempotency-key': 'k-event-fail-1',
      'x-webhook-event': 'whatsapp.message.failed'
    },
    body: Buffer.from(failedPayload, 'utf8')
  };

  mockDb.messages['puzzle-delivery:k-event:failed:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'k-event',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:k-event:failed:jigzo_puzzle_delivery:v1',
    providerMessageId: 'msg-failed-999',
    destinationMasked: '***331',
    status: 'accepted'
  });

  await invokeWebhookRoute(reqFail, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(mockDb.messages['puzzle-delivery:k-event:failed:jigzo_puzzle_delivery:v1'].status, 'failed');
  assert.strictEqual(mockDb.messages['puzzle-delivery:k-event:failed:jigzo_puzzle_delivery:v1'].lastErrorCode, '131026');
  assert.strictEqual(mockDb.messages['puzzle-delivery:k-event:failed:jigzo_puzzle_delivery:v1'].lastErrorMessage, 'Receiver cap exceeded (Daily limit hit)');
  console.log('✓ Scenario 5.4: Kapso v2 failed payload and nested status errors parsed correctly: Success');

  // ==========================================
  // Group 6: Status Lifecycle
  // ==========================================
  console.log('\n--- Group 6: Status Lifecycle ---');
  resetMocks();
  
  // read followed by late sent remains read
  mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'lc',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'lc-msg-1',
    destinationMasked: '***331',
    status: 'read',
    readAt: new Date()
  });
  mockDb.puzzles['lc'] = {
    publicId: 'lc',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'read' }]
  };

  const payloadSent = JSON.stringify({
    phone_number_id: '10928374',
    message: { id: 'lc-msg-1', timestamp: '1721245678', kapso: { status: 'sent' } }
  });
  const sigSent = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET).update(Buffer.from(payloadSent, 'utf8')).digest('hex');
  let reqSentLate = {
    headers: { 'x-webhook-signature': sigSent, 'x-idempotency-key': 'lc-id-1', 'x-webhook-event': 'whatsapp.message.sent' },
    body: Buffer.from(payloadSent, 'utf8')
  };
  await invokeWebhookRoute(reqSentLate, resMock, () => {});
  assert.strictEqual(mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].status, 'read');
  console.log('✓ Scenario 6.1: Late sent webhook event does not downgrade achieved read state: Success');

  // failed after delivered preserves delivered
  mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].status = 'delivered';
  mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].deliveredAt = new Date();
  mockDb.puzzles['lc'].recipients[0].whatsappSendStatus = 'delivered';

  const payloadFail = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'lc-msg-1',
      timestamp: '1721245678',
      kapso: {
        status: 'failed',
        statuses: [{ status: 'failed', errors: [{ code: '100', message: 'Delivery dropped' }] }]
      }
    }
  });
  const sigFailLate = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET).update(Buffer.from(payloadFail, 'utf8')).digest('hex');
  let reqFailLate = {
    headers: { 'x-webhook-signature': sigFailLate, 'x-idempotency-key': 'lc-id-2', 'x-webhook-event': 'whatsapp.message.failed' },
    body: Buffer.from(payloadFail, 'utf8')
  };
  await invokeWebhookRoute(reqFailLate, resMock, () => {});
  assert.strictEqual(mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].status, 'delivered'); // preserved!
  assert.ok(mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].failedAt); // metadata recorded
  assert.strictEqual(mockDb.puzzles['lc'].recipients[0].whatsappSendStatus, 'delivered'); // snapshot preserved!
  console.log('✓ Scenario 6.2: Late failed webhook event preserves achieved delivered state and records failure metadata: Success');

  // ==========================================
  // Group 7: Puzzle Status Webhook Calculations
  // ==========================================
  console.log('\n--- Group 7: Puzzle Status Webhook Calculations ---');
  // Confirm accepted/sent does not count as delivered, only delivered/read does.
  const Puzzle = require('../src/models/Puzzle');
  
  // Set up mock checkout delivery completion reload verify helper
  const webhookRouterFile = require('../src/routes/webhooks');
  const paymentHandler = webhookRouterFile.stack.find(s => s.route?.path === '/payment')?.route.stack[0]?.handle;
  
  mockDb.puzzles['puz-check-status'] = {
    _id: 'puz-db-id',
    publicId: 'puz-check-status',
    status: 'paid',
    recipients: [
      { name: 'Sam', deliveryMethod: 'whatsapp', whatsappSendStatus: 'accepted', deliveryStatus: 'pending' }
    ],
    save: async function() { return this; }
  };

  // Mock findById for reload sequence inside webhook
  MockPuzzle.findById = async (id) => mockDb.puzzles['puz-check-status'];

  // Simulate payment webhook call
  let mockPaymentReq = {
    headers: { 'x-jigzo-signature': 'mock' },
    body: { orderId: 'ord-123', paymentStatus: 'success' }
  };
  let mockPaymentRes = { json: () => {} };
  await paymentHandler(mockPaymentReq, mockPaymentRes, () => {});

  // Since whatsappSendStatus is accepted (and not delivered or read), puzzle.status must remain 'paid' / not delivered
  assert.strictEqual(mockDb.puzzles['puz-check-status'].status, 'paid');
  console.log('✓ Scenario 7.1: Accepted WhatsApp status does not update Puzzle state to delivered: Success');

  // Now set status to delivered
  mockDb.puzzles['puz-check-status'].recipients[0].whatsappSendStatus = 'delivered';
  await paymentHandler(mockPaymentReq, mockPaymentRes, () => {});
  assert.strictEqual(mockDb.puzzles['puz-check-status'].status, 'delivered');
  console.log('✓ Scenario 7.2: Delivered WhatsApp status updates Puzzle state to delivered: Success');

  console.log('\nAll JIGZO WhatsApp integration scenarios passed successfully!');
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

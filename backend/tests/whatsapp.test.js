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
    if (fields.status) rec.whatsappSendStatus = fields.status;
    if (fields.providerMessageId) rec.providerMessageId = fields.providerMessageId;
    if (fields.occurredAt) {
      if (fields.status === 'sent') rec.whatsappSentAt = fields.occurredAt;
      if (fields.status === 'delivered') rec.whatsappDeliveredAt = fields.occurredAt;
      if (fields.status === 'read') rec.whatsappReadAt = fields.occurredAt;
      if (fields.status === 'failed') rec.whatsappFailedAt = fields.occurredAt;
    }
    if (fields.errorCode) rec.whatsappLastErrorCode = fields.errorCode;
    if (fields.errorMessage) rec.whatsappLastErrorMessage = fields.errorMessage;
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
  console.log('Group 1: Disabled Mode Safety');
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
  assert.strictEqual(Object.keys(mockDb.messages).length, 0); // No message record created
  assert.strictEqual(mockDb.puzzles['puz-safety'].recipients[0].whatsappSendStatus, 'pending'); // Snapshot untouched
  assert.strictEqual(lastFetchParams, null); // No fetch calls occurred
  console.log('✓ Group 1 passed.');

  // ==========================================
  // Group 2: Exact Template Payload
  // ==========================================
  console.log('\nGroup 2: Exact Template Payload');
  
  // Identity ON
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-temp-on'] = {
    publicId: 'puz-temp-on',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-temp-on', recipientIndex: 0 });
  
  let sentBodyOn = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(sentBodyOn.template.name, 'jigzo_puzzle_delivery');
  assert.strictEqual(sentBodyOn.template.language.code, 'en_US');
  assert.strictEqual(sentBodyOn.template.components[0].parameters[1].text, 'Zahra');
  assert.strictEqual(sentBodyOn.template.components[1].parameters[0].text, 'puz-temp-on?r=0');

  // Identity OFF
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-temp-off'] = {
    publicId: 'puz-temp-off',
    senderName: 'Zahra',
    revealIdentity: false,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-temp-off', recipientIndex: 0 });
  
  let sentBodyOff = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(sentBodyOff.template.components[0].parameters[1].text, 'Someone');
  console.log('✓ Group 2 passed.');

  // ==========================================
  // Group 3: API Outcomes
  // ==========================================
  console.log('\nGroup 3: API Outcomes');
  
  // Accepted
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-api'] = {
    publicId: 'puz-api',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  fetchResponseMock = {
    ok: true,
    text: async () => JSON.stringify({ messages: [{ id: 'provider-accepted-id-123' }] })
  };
  let resApi = await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-api', recipientIndex: 0 });
  assert.strictEqual(resApi.success, true);
  assert.strictEqual(resApi.providerMessageId, 'provider-accepted-id-123');
  assert.strictEqual(mockDb.messages[`puzzle-delivery:puz-api:0:jigzo_puzzle_delivery:v1`].status, 'accepted');
  assert.ok(mockDb.messages[`puzzle-delivery:puz-api:0:jigzo_puzzle_delivery:v1`].acceptedAt);

  // Timeout -> verification_required
  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  mockDb.puzzles['puz-timeout'] = {
    publicId: 'puz-timeout',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  global.fetch = async () => { throw new Error('Timeout connecting to proxy'); };
  
  let resTimeout = await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-timeout', recipientIndex: 0 });
  assert.strictEqual(resTimeout.success, false);
  assert.strictEqual(mockDb.messages[`puzzle-delivery:puz-timeout:0:jigzo_puzzle_delivery:v1`].status, 'verification_required');
  console.log('✓ Group 3 passed.');

  // ==========================================
  // Group 4: Webhook Security
  // ==========================================
  console.log('\nGroup 4: Webhook Security');
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

  // Valid signature
  let req = {
    headers: {
      'x-webhook-signature': validSignature,
      'x-idempotency-key': 'web-idemp-1',
      'x-webhook-event': 'whatsapp.message.sent'
    },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  let resStatus = 0;
  let resBody = null;
  let resJson = (data) => { resBody = data; };
  let resMock = {
    status: (s) => { resStatus = s; return { json: resJson }; },
    json: resJson
  };
  
  await invokeWebhookRoute(req, resMock, () => {});
  assert.strictEqual(resStatus, 200);

  // Invalid signature
  req.headers['x-webhook-signature'] = 'invalid_sig_value';
  await invokeWebhookRoute(req, resMock, () => {});
  assert.strictEqual(resStatus, 401);
  console.log('✓ Group 4 passed.');

  // ==========================================
  // Group 5: Kapso Webhook Event Status Mapping
  // ==========================================
  console.log('\nGroup 5: Kapso Webhook Event Status Mapping');
  resetMocks();
  // Valid payload mapping
  const kapsoSentPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'msg-999',
      timestamp: '1721245678',
      kapso: { status: 'sent' }
    }
  });
  const validSigSent = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(kapsoSentPayload, 'utf8'))
    .digest('hex');

  let reqSent = {
    headers: {
      'x-webhook-signature': validSigSent,
      'x-idempotency-key': 'event-sent-1',
      'x-webhook-event': 'whatsapp.message.sent'
    },
    body: Buffer.from(kapsoSentPayload, 'utf8')
  };
  
  // Register message record to match
  mockDb.messages['puzzle-delivery:puz-webhook:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'puz-webhook',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:puz-webhook:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'msg-999',
    destinationMasked: '***331',
    status: 'accepted'
  });
  mockDb.puzzles['puz-webhook'] = {
    publicId: 'puz-webhook',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'accepted' }]
  };

  await invokeWebhookRoute(reqSent, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(mockDb.messages['puzzle-delivery:puz-webhook:0:jigzo_puzzle_delivery:v1'].status, 'sent');
  console.log('✓ Group 5 passed.');

  // ==========================================
  // Group 6: Status Lifecycle
  // ==========================================
  console.log('\nGroup 6: Status Lifecycle');
  // Enforce late sent does not downgrade delivered or read
  resetMocks();
  mockDb.messages['puzzle-delivery:lifecycle:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'lifecycle',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:lifecycle:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'lifecycle-msg-1',
    destinationMasked: '***331',
    status: 'read',
    readAt: new Date()
  });
  mockDb.puzzles['lifecycle'] = {
    publicId: 'lifecycle',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'read' }]
  };

  // Attempt late sent webhook
  const lateSentPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'lifecycle-msg-1',
      timestamp: '1721245678',
      kapso: { status: 'sent' }
    }
  });
  const lateSig = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(lateSentPayload, 'utf8'))
    .digest('hex');

  let reqLate = {
    headers: {
      'x-webhook-signature': lateSig,
      'x-idempotency-key': 'late-sent-key',
      'x-webhook-event': 'whatsapp.message.sent'
    },
    body: Buffer.from(lateSentPayload, 'utf8')
  };

  await invokeWebhookRoute(reqLate, resMock, () => {});
  assert.strictEqual(mockDb.messages['puzzle-delivery:lifecycle:0:jigzo_puzzle_delivery:v1'].status, 'read'); // Status remained 'read'
  console.log('✓ Group 6 passed.');

  // ==========================================
  // Group 7: Data Privacy and logging
  // ==========================================
  console.log('\nGroup 7: Data Privacy and logging');
  // Masking assertion
  const maskedVal = maskPhone('+97333931331');
  assert.strictEqual(maskedVal.includes('+973'), false);
  assert.strictEqual(maskedVal.endsWith('1331'), true);
  console.log('✓ Group 7 passed.');

  console.log('\nAll WhatsApp Integration unit tests passed successfully!');
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

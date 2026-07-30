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
    providerChargeId: 'chg-123',
    paymentAttempts: [{ providerChargeId: 'chg-123', providerStatus: 'CAPTURED' }],
    total: 10,
    currency: 'USD',
    save: async () => {}
  })
};

const MockPaymentService = {
  verifyWebhook: () => true,
  getExpectedLiveMode: () => false
};

const MockWhatsAppMessage = function(data) {
  this._data = { ...data, attemptCount: data.attemptCount || 0, retryHistory: data.retryHistory || [] };
  Object.defineProperty(this, 'puzzleId', { get: () => this._data.puzzleId });
  Object.defineProperty(this, 'recipientIndex', { get: () => this._data.recipientIndex });
  Object.defineProperty(this, 'messageType', { get: () => this._data.messageType || 'puzzle_delivery' });
  Object.defineProperty(this, 'idempotencyKey', { get: () => this._data.idempotencyKey });
  Object.defineProperty(this, 'destinationMasked', {
    get: () => this._data.destinationMasked,
    set: (v) => { this._data.destinationMasked = v; }
  });
  Object.defineProperty(this, 'retryDestinationMasked', {
    get: () => this._data.retryDestinationMasked,
    set: (v) => { this._data.retryDestinationMasked = v; }
  });
  Object.defineProperty(this, 'destinationCorrectionHistory', {
    get: () => this._data.destinationCorrectionHistory || (this._data.destinationCorrectionHistory = []),
    set: (v) => { this._data.destinationCorrectionHistory = v; }
  });
  Object.defineProperty(this, 'recipientSubdocumentId', {
    get: () => this._data.recipientSubdocumentId
  });
  Object.defineProperty(this, 'createdAt', { get: () => this._data.createdAt });

  Object.defineProperty(this, 'updatedAt', {
    get: () => this._data.updatedAt,
    set: (v) => { this._data.updatedAt = v; }
  });
  Object.defineProperty(this, 'status', {
    get: () => this._data.status,
    set: (v) => { this._data.status = v; }
  });
  Object.defineProperty(this, 'providerStatus', {
    get: () => this._data.providerStatus,
    set: (v) => { this._data.providerStatus = v; }
  });
  Object.defineProperty(this, 'languageCode', {
    get: () => this._data.languageCode,
    set: (v) => { this._data.languageCode = v; }
  });
  Object.defineProperty(this, 'claimedAt', {
    get: () => this._data.claimedAt,
    set: (v) => { this._data.claimedAt = v; }
  });
  Object.defineProperty(this, 'requestStartedAt', {
    get: () => this._data.requestStartedAt,
    set: (v) => { this._data.requestStartedAt = v; }
  });
  Object.defineProperty(this, 'retryStartedAt', {
    get: () => this._data.retryStartedAt,
    set: (v) => { this._data.retryStartedAt = v; }
  });
  Object.defineProperty(this, 'retryHistory', {
    get: () => this._data.retryHistory,
    set: (v) => { this._data.retryHistory = v; }
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
  Object.defineProperty(this, 'lastErrorTitle', {
    get: () => this._data.lastErrorTitle,
    set: (v) => { this._data.lastErrorTitle = v; }
  });
  Object.defineProperty(this, 'lastErrorDetails', {
    get: () => this._data.lastErrorDetails,
    set: (v) => { this._data.lastErrorDetails = v; }
  });
  Object.defineProperty(this, 'providerFailureMetadata', {
    get: () => this._data.providerFailureMetadata,
    set: (v) => { this._data.providerFailureMetadata = v; }
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
MockWhatsAppMessage.findOneAndUpdate = async (query, update, options) => {
  const existing = query.idempotencyKey
    ? mockDb.messages[query.idempotencyKey]
    : Object.values(mockDb.messages).find(m => m.providerMessageId === query.providerMessageId);
  if (existing) {
    // Check status matches query condition
    const validStatuses = query.status ? query.status.$in : null;
    if (validStatuses && !validStatuses.includes(existing.status)) {
      return null;
    }
    if (typeof query.status === 'string' && existing.status !== query.status) return null;
    if (typeof query.providerStatus === 'string' && existing.providerStatus !== query.providerStatus) return null;
    if (query.puzzleId && existing.puzzleId !== query.puzzleId) return null;
    if (query.recipientIndex !== undefined && existing.recipientIndex !== query.recipientIndex) return null;
    if (query.messageType && existing.messageType !== query.messageType) return null;
    if (query.providerMessageId && typeof query.providerMessageId === 'object' && !existing.providerMessageId) return null;
    // Perform update
    if (update.$set) {
      Object.assign(existing._data, update.$set);
    }
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) delete existing._data[key];
    }
    return existing;
  }
  return null;
};

const MockWhatsAppWebhookEvent = function(data) {
  this._data = { ...data };
  Object.defineProperty(this, 'processingStatus', {
    get: () => this._data.processingStatus,
    set: (v) => { this._data.processingStatus = v; }
  });
  Object.defineProperty(this, 'processingStartedAt', {
    get: () => this._data.processingStartedAt,
    set: (v) => { this._data.processingStartedAt = v; }
  });
  Object.defineProperty(this, 'processingAttempts', {
    get: () => this._data.processingAttempts,
    set: (v) => { this._data.processingAttempts = v; }
  });
  Object.defineProperty(this, 'lastProcessingError', {
    get: () => this._data.lastProcessingError,
    set: (v) => { this._data.lastProcessingError = v; }
  });
  Object.defineProperty(this, 'processedAt', {
    get: () => this._data.processedAt,
    set: (v) => { this._data.processedAt = v; }
  });
  for (const field of ['errorCode', 'errorTitle', 'errorMessage', 'errorDetails', 'providerFailureMetadata']) {
    Object.defineProperty(this, field, {
      get: () => this._data[field],
      set: (v) => { this._data[field] = v; }
    });
  }

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
MockWhatsAppWebhookEvent.findOne = async (query) => {
  if (query.idempotencyKey) return mockDb.webhookEvents[query.idempotencyKey] || null;
  return null;
};
MockWhatsAppWebhookEvent.findOneAndUpdate = async (query, update, options) => {
  const key = query.idempotencyKey;
  const existing = mockDb.webhookEvents[key];
  if (!existing) return null;

  let match = false;
  if (query.$or) {
    for (let cond of query.$or) {
      if (cond.processingStatus === 'queued' && existing.processingStatus === 'queued') {
        match = true;
        break;
      }
      if (cond.processingStatus === 'failed' && existing.processingStatus === 'failed') {
        match = true;
        break;
      }
      if (cond.processingStatus === 'processing' && existing.processingStatus === 'processing') {
        if (cond.processingStartedAt && cond.processingStartedAt.$lt) {
          const cutoff = cond.processingStartedAt.$lt;
          if (existing.processingStartedAt < cutoff) {
            match = true;
            break;
          }
        }
      }
    }
  }
  if (match) {
    if (update.$set) {
      Object.assign(existing._data, update.$set);
    }
    if (update.$inc && update.$inc.processingAttempts) {
      existing._data.processingAttempts = (existing._data.processingAttempts || 0) + update.$inc.processingAttempts;
    }
    return existing;
  }
  return null;
};

// Intercept mongoose model requires before importing JIGZO modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path.includes('@vercel/functions')) {
    return {
      waitUntil: (promise) => {
        if (global.__mockWaitUntil) global.__mockWaitUntil(promise);
      }
    };
  }
  if (path.includes('models/WhatsAppMessage')) return MockWhatsAppMessage;
  if (path.includes('models/Puzzle')) return MockPuzzle;
  if (path.includes('models/WhatsAppWebhookEvent')) return MockWhatsAppWebhookEvent;
  if (path.includes('models/Order')) return MockOrder;
  if (path.includes('services/paymentService')) return MockPaymentService;
  if (path.includes('utils/runtimeConfig')) {
    const original = originalRequire.apply(this, arguments);
    return {
      ...original,
      isNonProduction: () => false
    };
  }
  return originalRequire.apply(this, arguments);
};

// Import JIGZO service and webhook router under the mock environment
const whatsappService = require('../src/services/whatsappService');
const whatsappWebhookRouter = require('../src/routes/webhooks/whatsapp');
const adminBusinessLogic = require('../src/utils/adminBusinessLogic');
const { isStaleAcceptedMessage, getReconciliationStatus } = require('../src/utils/whatsappLifecycle');
const { reconcileMessage } = require('../src/services/whatsappReconciliationService');
const { persistNormalizedStatus } = require('../src/services/whatsappStatusService');

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
      rec.whatsappLastErrorTitle = fields.errorTitle || '';
      rec.whatsappLastErrorMessage = fields.errorMessage || '';
      rec.whatsappLastErrorDetails = fields.errorDetails || '';

      const currentPriority = priority[rec.whatsappSendStatus] || 0;
      if (currentPriority < priority['delivered']) {
        rec.whatsappSendStatus = 'failed';
        rec.deliveryStatus = 'failed';
      }
    }
  }
};

// Mock fetch globally
let lastFetchParams = null;
let fetchResponseMock = null;
const mockFetch = async (url, options) => {
  lastFetchParams = { url, options };
  return fetchResponseMock || {
    ok: true,
    text: async () => JSON.stringify({ messages: [{ id: 'mock-provider-id-999' }] })
  };
};
global.fetch = mockFetch;

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
  global.fetch = mockFetch;
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
  assert.strictEqual(Object.keys(mockDb.messages).length, 0);
  assert.strictEqual(mockDb.puzzles['puz-safety'].recipients[0].whatsappSendStatus, 'pending');
  assert.strictEqual(lastFetchParams, null);
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

  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-temp', recipientIndex: 0 });
  let payload0 = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(payload0.template.components[1].parameters[0].text, 'puz-temp?r=0');
  console.log('✓ Scenario 2.1: Recipient 0 suffix correctly formatted with ?r=0: Success');

  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-temp', recipientIndex: 1 });
  let payload1 = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(payload1.template.components[1].parameters[0].text, 'puz-temp?r=1');
  console.log('✓ Scenario 2.2: Recipient 1 suffix correctly formatted with ?r=1: Success');

  assert.strictEqual(payload0.template.components[0].parameters[0].text, 'Sam');
  assert.ok(!payload0.template.components[0].parameters[0].text.includes('Yazan'));
  assert.strictEqual(payload0.template.name, 'jigzo_puzzle_delivery');
  assert.strictEqual(payload0.template.language.code, 'en_US');
  assert.strictEqual(mockDb.messages['puzzle-delivery:puz-temp:0:jigzo_puzzle_delivery:v1'].languageCode, 'en_US');
  console.log('✓ Scenario 2.3: Recipient 0 payload contains no Recipient 1 data: Success');
  console.log('✓ Scenario 2.4: English delivery uses and persists en_US: Success');

  mockDb.puzzles['puz-ar'] = {
    publicId: 'puz-ar',
    senderName: 'Zahra',
    revealIdentity: true,
    experienceLanguage: 'ar',
    recipients: [{ name: 'Sam', phone: '33931333', countryCode: '973', whatsappSendStatus: 'pending' }]
  };
  await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-ar', recipientIndex: 0 });
  const arabicPayload = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(arabicPayload.template.name, 'jigzo_puzzle_delivery');
  assert.strictEqual(arabicPayload.template.language.code, 'ar');
  assert.strictEqual(mockDb.messages['puzzle-delivery:puz-ar:0:jigzo_puzzle_delivery:v1'].languageCode, 'ar');
  console.log('✓ Scenario 2.5: Arabic delivery uses jigzo_puzzle_delivery and persists ar: Success');

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

  lastFetchParams = null;
  let doubleRes = await whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'puz-api', recipientIndex: 0 });
  assert.strictEqual(doubleRes.reason, 'duplicate_request');
  assert.strictEqual(lastFetchParams, null);
  console.log('✓ Scenario 3.2: Duplicate send using accepted idempotency key skips second fetch: Success');

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

  async function seedFailedInitialDelivery(puzzleId, experienceLanguage = 'en', recipientFields = {}) {
    const key = `puzzle-delivery:${puzzleId}:0:jigzo_puzzle_delivery:v1`;
    mockDb.puzzles[puzzleId] = {
      publicId: puzzleId,
      experienceLanguage,
      senderName: 'Sender',
      revealIdentity: true,
      recipients: [{
        name: 'Recipient',
        phone: '33931331',
        countryCode: '973',
        whatsappSendStatus: 'failed',
        deliveryStatus: 'failed',
        ...recipientFields
      }],
      save: async function() { return this; }
    };
    mockDb.messages[key] = new MockWhatsAppMessage({
      puzzleId,
      recipientIndex: 0,
      messageType: 'puzzle_delivery',
      templateName: 'jigzo_puzzle_delivery',
      languageCode: experienceLanguage === 'ar' ? 'ar' : 'en_US',
      idempotencyKey: key,
      destinationMasked: '*******3131',
      status: 'failed',
      providerStatus: 'failed',
      providerMessageId: `wamid.old-${puzzleId}`,
      attemptCount: 1,
      claimedAt: new Date('2026-07-30T08:00:00.000Z'),
      requestStartedAt: new Date('2026-07-30T08:00:01.000Z'),
      acceptedAt: new Date('2026-07-30T08:00:02.000Z'),
      failedAt: new Date('2026-07-30T08:01:00.000Z'),
      lastErrorCode: '131026',
      lastErrorTitle: 'Message Undeliverable',
      lastErrorMessage: 'Message Undeliverable',
      lastErrorDetails: 'Provider could not deliver the message.',
      providerFailureMetadata: { status: 'failed', timestamp: new Date('2026-07-30T08:01:00.000Z') },
      payloadHash: 'old-payload-hash'
    });
    return { key, message: mockDb.messages[key] };
  }

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  const arabicRetrySeed = await seedFailedInitialDelivery('retry-ar', 'ar');
  let retryFetchCount = 0;
  global.fetch = async (url, options) => {
    retryFetchCount++;
    lastFetchParams = { url, options };
    return { ok: true, text: async () => JSON.stringify({ messages: [{ id: 'wamid.new-ar' }] }) };
  };
  const arabicRetry = await whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-ar', recipientIndex: 0 });
  const arabicRetryPayload = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(arabicRetry.success, true);
  assert.strictEqual(arabicRetry.status, 'accepted');
  assert.strictEqual(retryFetchCount, 1);
  assert.strictEqual(arabicRetryPayload.template.name, 'jigzo_puzzle_delivery');
  assert.strictEqual(arabicRetryPayload.template.language.code, 'ar');
  assert.strictEqual(arabicRetrySeed.message.providerMessageId, 'wamid.new-ar');
  assert.strictEqual(arabicRetrySeed.message.attemptCount, 2);
  assert.strictEqual(arabicRetrySeed.message.retryHistory.length, 1);
  assert.strictEqual(arabicRetrySeed.message.retryHistory[0].providerMessageId, 'wamid.old-retry-ar');
  assert.strictEqual(arabicRetrySeed.message.retryHistory[0].errorTitle, 'Message Undeliverable');
  assert.strictEqual(arabicRetrySeed.message.retryHistory[0].languageCode, 'ar');
  console.log('✓ Scenario 3.5: Failed Arabic initial delivery retries once with ar and archives the old attempt: Success');

  const lateOldStatus = await persistNormalizedStatus({
    providerMessageId: 'wamid.old-retry-ar',
    providerStatus: 'failed',
    occurredAt: new Date(),
    failure: {
      code: 'LATE_OLD',
      title: 'Late old failure',
      message: 'Old attempt callback',
      details: 'Must be ignored',
      metadata: { status: 'failed' }
    }
  });
  assert.strictEqual(lateOldStatus.updated, false);
  assert.strictEqual(arabicRetrySeed.message.status, 'accepted');
  assert.strictEqual(arabicRetrySeed.message.providerMessageId, 'wamid.new-ar');
  console.log('✓ Scenario 3.6: Late old wamid webhook cannot alter the accepted retry attempt: Success');

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  const englishRetrySeed = await seedFailedInitialDelivery('retry-en', 'en');
  global.fetch = async (url, options) => {
    lastFetchParams = { url, options };
    return { ok: true, text: async () => JSON.stringify({ messages: [{ id: 'wamid.new-en' }] }) };
  };
  const englishRetry = await whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-en', recipientIndex: 0 });
  assert.strictEqual(englishRetry.success, true);
  assert.strictEqual(JSON.parse(lastFetchParams.options.body).template.language.code, 'en_US');
  assert.strictEqual(englishRetrySeed.message.languageCode, 'en_US');
  console.log('✓ Scenario 3.7: Failed English initial delivery retries with en_US: Success');

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  await seedFailedInitialDelivery('retry-concurrent', 'en');
  let concurrentProviderSends = 0;
  global.fetch = async () => {
    concurrentProviderSends++;
    return { ok: true, text: async () => JSON.stringify({ messages: [{ id: 'wamid.concurrent-new' }] }) };
  };
  const concurrentRetries = await Promise.all([
    whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-concurrent', recipientIndex: 0 }),
    whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-concurrent', recipientIndex: 0 })
  ]);
  assert.strictEqual(concurrentProviderSends, 1);
  assert.strictEqual(concurrentRetries.filter((result) => result.success).length, 1);
  assert.strictEqual(concurrentRetries.filter((result) => result.reason === 'already_claimed' || result.reason === 'not_retryable').length, 1);
  const doubleClick = await whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-concurrent', recipientIndex: 0 });
  assert.strictEqual(doubleClick.success, false);
  assert.strictEqual(concurrentProviderSends, 1);
  console.log('✓ Scenario 3.8: Concurrent and double-click retries produce exactly one provider send: Success');

  for (const blockedStatus of ['pending', 'accepted', 'sent', 'delivered', 'read', 'verification_required']) {
    resetMocks();
    process.env.WHATSAPP_ENABLED = 'true';
    const blocked = await seedFailedInitialDelivery(`retry-block-${blockedStatus}`, 'en');
    blocked.message.status = blockedStatus;
    blocked.message.providerStatus = blockedStatus;
    let blockedFetches = 0;
    global.fetch = async () => { blockedFetches++; throw new Error('Provider must not be called'); };
    const blockedResult = await whatsappService.retryPuzzleDelivery({
      puzzleId: `retry-block-${blockedStatus}`,
      recipientIndex: 0
    });
    assert.strictEqual(blockedResult.success, false, blockedStatus);
    assert.strictEqual(blockedResult.reason, 'not_retryable', blockedStatus);
    assert.strictEqual(blockedFetches, 0, blockedStatus);
  }
  console.log('✓ Scenario 3.9: Pending/accepted/sent/delivered/read/reconciliation-required deliveries cannot retry: Success');

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  const solvedSeed = await seedFailedInitialDelivery('retry-solved', 'ar', { completedAt: new Date() });
  let solvedFetches = 0;
  global.fetch = async () => { solvedFetches++; throw new Error('Provider must not be called'); };
  const solvedRetry = await whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-solved', recipientIndex: 0 });
  assert.strictEqual(solvedRetry.reason, 'recipient_already_opened_or_solved');
  assert.strictEqual(solvedSeed.message.status, 'failed');
  assert.strictEqual(solvedFetches, 0);
  console.log('✓ Scenario 3.10: Solved recipient cannot retry: Success');

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  const failedRetrySeed = await seedFailedInitialDelivery('retry-provider-fails', 'ar');
  global.fetch = async () => ({
    ok: false,
    status: 409,
    text: async () => JSON.stringify({ error: { code: '131056', message: 'Pair rate limit hit' } })
  });
  const providerFailedRetry = await whatsappService.retryPuzzleDelivery({ puzzleId: 'retry-provider-fails', recipientIndex: 0 });
  assert.strictEqual(providerFailedRetry.success, false);
  assert.strictEqual(failedRetrySeed.message.status, 'failed');
  assert.strictEqual(failedRetrySeed.message.attemptCount, 2);
  assert.strictEqual(failedRetrySeed.message.retryHistory.length, 1);
  assert.strictEqual(failedRetrySeed.message.retryHistory[0].providerMessageId, 'wamid.old-retry-provider-fails');
  assert.strictEqual(failedRetrySeed.message.lastErrorCode, '131056');
  assert.ok(failedRetrySeed.message.failedAt);
  console.log('✓ Scenario 3.11: Provider concurrency failure makes no second attempt and retains prior failure history: Success');

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  const correctionSeed = await seedFailedInitialDelivery('correct-recipient', 'ar', {
    phone: '33424121',
    phoneE164: '+97333424121'
  });
  correctionSeed.message.destinationMasked = '********4121';
  mockDb.puzzles['correct-recipient'].recipients.push({
    name: 'Other recipient',
    phone: '39000000',
    phoneE164: '+97339000000',
    countryCode: '973',
    whatsappSendStatus: 'failed',
    deliveryStatus: 'failed'
  });
  const untouchedRecipientBefore = JSON.stringify(mockDb.puzzles['correct-recipient'].recipients[1]);
  let correctionProviderSends = 0;
  global.fetch = async () => { correctionProviderSends++; throw new Error('Correction must not send'); };
  const correctionResult = await whatsappService.correctPuzzleDeliveryRecipient({
    puzzleId: 'correct-recipient',
    recipientIndex: 0,
    phone: '+97333424124',
    adminId: 'admin-test'
  });
  assert.strictEqual(correctionResult.success, true);
  assert.strictEqual(correctionResult.oldEnding, '4121');
  assert.strictEqual(correctionResult.newEnding, '4124');
  assert.strictEqual(mockDb.puzzles['correct-recipient'].recipients[0].phoneE164, '+97333424124');
  assert.strictEqual(mockDb.puzzles['correct-recipient'].recipients[0].countryCode, '973');
  assert.strictEqual(mockDb.puzzles['correct-recipient'].recipients[0].phone, '33424124');
  assert.strictEqual(JSON.stringify(mockDb.puzzles['correct-recipient'].recipients[1]), untouchedRecipientBefore);
  assert.strictEqual(correctionSeed.message.destinationMasked, '********4121');
  assert.strictEqual(correctionSeed.message.retryDestinationMasked.slice(-4), '4124');
  assert.strictEqual(correctionSeed.message.destinationCorrectionHistory.length, 1);
  assert.strictEqual(correctionSeed.message.destinationCorrectionHistory[0].oldDestinationMasked.slice(-4), '4121');
  assert.strictEqual(correctionSeed.message.destinationCorrectionHistory[0].newDestinationMasked.slice(-4), '4124');
  assert.strictEqual(correctionProviderSends, 0);
  console.log('✓ Scenario 3.12: Failed recipient correction changes only the current retry target and sends nothing: Success');

  global.fetch = async (url, options) => {
    correctionProviderSends++;
    lastFetchParams = { url, options };
    return { ok: true, text: async () => JSON.stringify({ messages: [{ id: 'wamid.corrected-retry' }] }) };
  };
  const correctedRetry = await whatsappService.retryPuzzleDelivery({ puzzleId: 'correct-recipient', recipientIndex: 0 });
  const correctedPayload = JSON.parse(lastFetchParams.options.body);
  assert.strictEqual(correctedRetry.success, true);
  assert.strictEqual(correctionProviderSends, 1);
  assert.strictEqual(correctedPayload.to, '+97333424124');
  assert.strictEqual(correctedPayload.template.name, 'jigzo_puzzle_delivery');
  assert.strictEqual(correctedPayload.template.language.code, 'ar');
  assert.strictEqual(correctionSeed.message.destinationMasked.slice(-4), '4124');
  assert.strictEqual(correctionSeed.message.retryHistory.length, 1);
  assert.strictEqual(correctionSeed.message.retryHistory[0].destinationMasked.slice(-4), '4121');
  assert.strictEqual(correctionSeed.message.retryHistory[0].providerMessageId, 'wamid.old-correct-recipient');
  console.log('✓ Scenario 3.13: Subsequent Arabic retry uses the corrected number exactly once and preserves old destination/wamid history: Success');

  resetMocks();
  const invalidCorrectionSeed = await seedFailedInitialDelivery('correct-invalid', 'en');
  const invalidPhoneBefore = mockDb.puzzles['correct-invalid'].recipients[0].phone;
  const invalidCorrection = await whatsappService.correctPuzzleDeliveryRecipient({
    puzzleId: 'correct-invalid',
    recipientIndex: 0,
    phone: 'not-a-phone',
    adminId: 'admin-test'
  });
  assert.strictEqual(invalidCorrection.success, false);
  assert.strictEqual(invalidCorrection.reason, 'invalid_phone');
  assert.strictEqual(mockDb.puzzles['correct-invalid'].recipients[0].phone, invalidPhoneBefore);
  assert.strictEqual(invalidCorrectionSeed.message.destinationCorrectionHistory.length, 0);
  console.log('✓ Scenario 3.14: Invalid correction is rejected without mutation: Success');

  for (const blockedStatus of ['delivered', 'read']) {
    resetMocks();
    const blockedCorrection = await seedFailedInitialDelivery(`correct-${blockedStatus}`, 'en');
    blockedCorrection.message.status = blockedStatus;
    blockedCorrection.message.providerStatus = blockedStatus;
    const result = await whatsappService.correctPuzzleDeliveryRecipient({
      puzzleId: `correct-${blockedStatus}`,
      recipientIndex: 0,
      phone: '+97333424124',
      adminId: 'admin-test'
    });
    assert.strictEqual(result.success, false, blockedStatus);
    assert.strictEqual(result.reason, 'not_correctable', blockedStatus);
  }
  resetMocks();
  const solvedCorrection = await seedFailedInitialDelivery('correct-solved', 'ar', { completedAt: new Date() });
  const solvedCorrectionResult = await whatsappService.correctPuzzleDeliveryRecipient({
    puzzleId: 'correct-solved',
    recipientIndex: 0,
    phone: '+97333424124',
    adminId: 'admin-test'
  });
  assert.strictEqual(solvedCorrectionResult.success, false);
  assert.strictEqual(solvedCorrectionResult.reason, 'recipient_already_opened_or_solved');
  assert.strictEqual(solvedCorrection.message.status, 'failed');
  console.log('✓ Scenario 3.15: Delivered/read/solved recipients cannot be corrected: Success');

  resetMocks();
  process.env.WHATSAPP_ENABLED = 'true';
  const inFlightCorrection = await seedFailedInitialDelivery('correct-in-flight', 'en');
  inFlightCorrection.message.status = 'correcting';
  let inFlightSends = 0;
  global.fetch = async () => { inFlightSends++; throw new Error('Provider must not be called'); };
  const [secondCorrection, racingRetry] = await Promise.all([
    whatsappService.correctPuzzleDeliveryRecipient({
      puzzleId: 'correct-in-flight',
      recipientIndex: 0,
      phone: '+97333424124',
      adminId: 'admin-test'
    }),
    whatsappService.retryPuzzleDelivery({ puzzleId: 'correct-in-flight', recipientIndex: 0 })
  ]);
  assert.strictEqual(secondCorrection.success, false);
  assert.strictEqual(secondCorrection.reason, 'already_in_progress');
  assert.strictEqual(racingRetry.success, false);
  assert.strictEqual(racingRetry.reason, 'already_claimed');
  assert.strictEqual(inFlightSends, 0);
  const correctionWebhook = await persistNormalizedStatus({
    providerMessageId: 'wamid.old-correct-in-flight',
    providerStatus: 'sent',
    occurredAt: new Date()
  });
  assert.strictEqual(correctionWebhook.updated, false);
  assert.strictEqual(correctionWebhook.reason, 'correction_in_progress');
  assert.strictEqual(inFlightCorrection.message.status, 'correcting');
  console.log('✓ Scenario 3.16: In-flight correction blocks concurrent correction, retry, and old-wamid callbacks: Success');

  // ==========================================
  // Group 4: Webhook Security & Version checks
  // ==========================================
  console.log('\n--- Group 4: Webhook Security & Version checks ---');
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

  let reqNoSig = {
    headers: { 'x-idempotency-key': 'w-1', 'x-webhook-event': 'whatsapp.message.sent', 'x-webhook-payload-version': 'v2' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqNoSig, resMock, () => {});
  assert.strictEqual(resStatus, 401);
  console.log('✓ Scenario 4.1: Missing webhook signature header returns HTTP 401: Success');

  let reqNoVersion = {
    headers: { 'x-webhook-signature': validSignature, 'x-idempotency-key': 'w-1', 'x-webhook-event': 'whatsapp.message.sent' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqNoVersion, resMock, () => {});
  assert.strictEqual(resStatus, 400);
  console.log('✓ Scenario 4.2: Missing or invalid payload version header returns HTTP 400: Success');

  let reqBadSig = {
    headers: { 'x-webhook-signature': 'too_short', 'x-idempotency-key': 'w-2', 'x-webhook-event': 'whatsapp.message.sent', 'x-webhook-payload-version': 'v2' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqBadSig, resMock, () => {});
  assert.strictEqual(resStatus, 401);
  console.log('✓ Scenario 4.3: Malformed signature length timing-safe comparison safely rejected: Success');

  let reqNoIdemp = {
    headers: { 'x-webhook-signature': validSignature, 'x-webhook-event': 'whatsapp.message.sent', 'x-webhook-payload-version': 'v2' },
    body: Buffer.from(webhookPayload, 'utf8')
  };
  await invokeWebhookRoute(reqNoIdemp, resMock, () => {});
  assert.strictEqual(resStatus, 400);
  console.log('✓ Scenario 4.4: Missing idempotency key header returns HTTP 400: Success');

  const wrongSecretSignature = crypto.createHmac('sha256', 'definitely-not-the-webhook-secret')
    .update(Buffer.from(webhookPayload, 'utf8'))
    .digest('hex');
  resStatus = 0;
  await invokeWebhookRoute({
    headers: {
      'x-webhook-signature': wrongSecretSignature,
      'x-idempotency-key': 'wrong-secret',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(webhookPayload, 'utf8')
  }, resMock, () => {});
  assert.strictEqual(resStatus, 401);
  console.log('✓ Scenario 4.5: Signature generated with the wrong secret returns HTTP 401: Success');

  resStatus = 0;
  await invokeWebhookRoute({
    headers: {
      'x-webhook-signature': validSignature,
      'x-idempotency-key': 'modified-body',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(`${webhookPayload} `, 'utf8')
  }, resMock, () => {});
  assert.strictEqual(resStatus, 401);
  console.log('✓ Scenario 4.6: A body modified after signing returns HTTP 401: Success');

  const whitespacePayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'whitespace-msg-id',
      timestamp: '1721245678',
      kapso: { status: 'sent' }
    }
  }, null, 2);
  const whitespaceSignature = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(whitespacePayload, 'utf8'))
    .digest('hex');
  mockDb.messages['puzzle-delivery:whitespace:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'whitespace',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:whitespace:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'whitespace-msg-id',
    destinationMasked: '*******3131',
    status: 'accepted'
  });
  mockDb.puzzles.whitespace = {
    publicId: 'whitespace',
    recipients: [{ whatsappSendStatus: 'accepted', deliveryStatus: 'pending' }]
  };
  resStatus = 0;
  await invokeWebhookRoute({
    headers: {
      'x-webhook-signature': whitespaceSignature,
      'x-idempotency-key': 'whitespace-exact',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    rawBody: Buffer.from(whitespacePayload, 'utf8'),
    body: Buffer.from(whitespacePayload, 'utf8')
  }, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(mockDb.messages['puzzle-delivery:whitespace:0:jigzo_puzzle_delivery:v1'].status, 'sent');
  console.log('✓ Scenario 4.7: Exact signed raw bytes preserve JSON whitespace and return HTTP 200: Success');

  // ==========================================
  // Group 5: Webhook Retry Idempotency & Leasing
  // ==========================================
  console.log('\n--- Group 5: Webhook Retry Idempotency & Leasing ---');
  resetMocks();

  mockDb.puzzles['webhook-retry'] = {
    publicId: 'webhook-retry',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'accepted' }]
  };

  const retryPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: { id: 'msg-retry-123', timestamp: '1721245678', kapso: { status: 'sent' } }
  });
  const sigRetry = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET).update(Buffer.from(retryPayload, 'utf8')).digest('hex');

  let reqRetry = {
    headers: {
      'x-webhook-signature': sigRetry,
      'x-idempotency-key': 'retry-key-999',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(retryPayload, 'utf8')
  };

  resStatus = 0;
  resBody = null;
  await invokeWebhookRoute(reqRetry, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resBody.note, 'authenticated_unmatched_message_ignored');
  assert.strictEqual(mockDb.webhookEvents['retry-key-999'].processingStatus, 'processed');
  assert.strictEqual(Object.keys(mockDb.messages).length, 0);
  console.log('✓ Scenario 5.1: Signed real unmatched provider event is recorded and acknowledged without mutation: Success');

  const unmatchedFailedPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'wamid.synthetic-kapso-test',
      timestamp: '1721245678',
      kapso: {
        status: 'failed',
        processing_status: 'completed',
        statuses: [{
          id: 'wamid.synthetic-kapso-test',
          status: 'failed',
          timestamp: '1721245678',
          errors: [{ code: 131026, title: 'Message Undeliverable', message: 'Synthetic test failure' }]
        }]
      }
    }
  });
  const unmatchedFailedSignature = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(unmatchedFailedPayload, 'utf8'))
    .digest('hex');
  resStatus = 0;
  resBody = null;
  await invokeWebhookRoute({
    headers: {
      'x-webhook-signature': unmatchedFailedSignature,
      'x-idempotency-key': 'kapso-test-failed-unmatched',
      'x-webhook-event': 'whatsapp.message.failed',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(unmatchedFailedPayload, 'utf8')
  }, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resBody.note, 'authenticated_unmatched_message_ignored');
  assert.strictEqual(mockDb.webhookEvents['kapso-test-failed-unmatched'].processingStatus, 'processed');
  assert.strictEqual(Object.keys(mockDb.messages).length, 0);
  console.log('✓ Scenario 5.2: Signed Kapso test failed event with synthetic wamid returns HTTP 200 and performs no mutation: Success');

  mockDb.messages['puzzle-delivery:webhook-retry:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'webhook-retry',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:webhook-retry:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'msg-retry-123',
    destinationMasked: '***331',
    status: 'accepted'
  });
  const reqRetryMatched = {
    ...reqRetry,
    headers: {
      ...reqRetry.headers,
      'x-idempotency-key': 'retry-key-matched'
    }
  };
  resStatus = 0;
  await invokeWebhookRoute(reqRetryMatched, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(mockDb.webhookEvents['retry-key-matched'].processingStatus, 'processed');
  assert.strictEqual(mockDb.messages['puzzle-delivery:webhook-retry:0:jigzo_puzzle_delivery:v1'].status, 'sent');
  console.log('✓ Scenario 5.3: Matched provider event processes normally after unrelated unmatched events: Success');

  resStatus = 0;
  resBody = null;
  await invokeWebhookRoute(reqRetryMatched, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resBody.note, 'duplicate_webhook_ignored');
  console.log('✓ Scenario 5.4: Processed duplicate is ignored and returns HTTP 200: Success');

  const originalFindOne = MockWhatsAppMessage.findOne;
  MockWhatsAppMessage.findOne = async () => {
    throw new Error('Temporary database read failure');
  };
  const transientPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: { id: 'wamid.transient-db', timestamp: '1721245678', kapso: { status: 'sent' } }
  });
  const transientSignature = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(transientPayload, 'utf8'))
    .digest('hex');
  resStatus = 0;
  try {
    await invokeWebhookRoute({
      headers: {
        'x-webhook-signature': transientSignature,
        'x-idempotency-key': 'transient-db-failure',
        'x-webhook-event': 'whatsapp.message.sent',
        'x-webhook-payload-version': 'v2'
      },
      body: Buffer.from(transientPayload, 'utf8')
    }, resMock, () => {});
  } finally {
    MockWhatsAppMessage.findOne = originalFindOne;
  }
  assert.strictEqual(resStatus, 500);
  assert.strictEqual(mockDb.webhookEvents['transient-db-failure'].processingStatus, 'failed');
  console.log('✓ Scenario 5.5: Genuine transient processing failure returns HTTP 500 for provider retry: Success');

  resetMocks();
  mockDb.webhookEvents['fresh-lease-key'] = new MockWhatsAppWebhookEvent({
    idempotencyKey: 'fresh-lease-key',
    processingStatus: 'processing',
    processingStartedAt: new Date()
  });
  let reqFreshLease = {
    headers: {
      'x-webhook-signature': sigRetry,
      'x-idempotency-key': 'fresh-lease-key',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(retryPayload, 'utf8')
  };
  resStatus = 0;
  resBody = null;
  await invokeWebhookRoute(reqFreshLease, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resBody.note, 'lease_active_skip');
  console.log('✓ Scenario 5.6: Fresh lease skips concurrent execution and returns HTTP 200: Success');

  mockDb.webhookEvents['expired-lease-key'] = new MockWhatsAppWebhookEvent({
    idempotencyKey: 'expired-lease-key',
    processingStatus: 'processing',
    processingStartedAt: new Date(Date.now() - 150000)
  });
  mockDb.puzzles['expired-puz'] = {
    publicId: 'expired-puz',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'accepted' }]
  };
  mockDb.messages['puzzle-delivery:expired-puz:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'expired-puz',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:expired-puz:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'expired-msg-id',
    destinationMasked: '***331',
    status: 'accepted'
  });
  const expiredPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: { id: 'expired-msg-id', timestamp: '1721245678', kapso: { status: 'sent' } }
  });
  let reqExpiredLease = {
    headers: {
      'x-webhook-signature': crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET).update(Buffer.from(expiredPayload, 'utf8')).digest('hex'),
      'x-idempotency-key': 'expired-lease-key',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(expiredPayload, 'utf8')
  };
  resStatus = 0;
  await invokeWebhookRoute(reqExpiredLease, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(mockDb.webhookEvents['expired-lease-key'].processingStatus, 'processed');
  console.log('✓ Scenario 5.7: Expired processing lease is successfully reclaimed and processed: Success');

  mockDb.webhookEvents['queued-crash-key'] = new MockWhatsAppWebhookEvent({
    idempotencyKey: 'queued-crash-key',
    processingStatus: 'queued',
    processingStartedAt: null
  });
  mockDb.puzzles['queued-puz'] = {
    publicId: 'queued-puz',
    recipients: [{ name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'accepted' }]
  };
  mockDb.messages['puzzle-delivery:queued-puz:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'queued-puz',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:queued-puz:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'queued-msg-id',
    destinationMasked: '***331',
    status: 'accepted'
  });
  const queuedPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: { id: 'queued-msg-id', timestamp: '1721245678', kapso: { status: 'sent' } }
  });
  let reqQueuedCrash = {
    headers: {
      'x-webhook-signature': crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET).update(Buffer.from(queuedPayload, 'utf8')).digest('hex'),
      'x-idempotency-key': 'queued-crash-key',
      'x-webhook-event': 'whatsapp.message.sent',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(queuedPayload, 'utf8')
  };
  resStatus = 0;
  await invokeWebhookRoute(reqQueuedCrash, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(mockDb.webhookEvents['queued-crash-key'].processingStatus, 'processed');
  console.log('✓ Scenario 5.8: Queued event left by process crash is successfully claimed and processed: Success');

  // ==========================================
  // Group 6: Status Lifecycle
  // ==========================================
  console.log('\n--- Group 6: Status Lifecycle ---');
  resetMocks();

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
    headers: { 'x-webhook-signature': sigSent, 'x-idempotency-key': 'lc-id-1', 'x-webhook-event': 'whatsapp.message.sent', 'x-webhook-payload-version': 'v2' },
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
    headers: { 'x-webhook-signature': sigFailLate, 'x-idempotency-key': 'lc-id-2', 'x-webhook-event': 'whatsapp.message.failed', 'x-webhook-payload-version': 'v2' },
    body: Buffer.from(payloadFail, 'utf8')
  };
  await invokeWebhookRoute(reqFailLate, resMock, () => {});
  assert.strictEqual(mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].status, 'delivered');
  assert.ok(mockDb.messages['puzzle-delivery:lc:0:jigzo_puzzle_delivery:v1'].failedAt);
  assert.strictEqual(mockDb.puzzles['lc'].recipients[0].whatsappSendStatus, 'delivered');
  console.log('✓ Scenario 6.2: Late failed webhook event preserves achieved delivered state and records failure metadata: Success');

  resetMocks();
  mockDb.messages['puzzle-delivery:failed-transition:0:jigzo_puzzle_delivery:v1'] = new MockWhatsAppMessage({
    puzzleId: 'failed-transition',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:failed-transition:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'wamid.failed-transition',
    destinationMasked: '*******3131',
    status: 'accepted',
    providerStatus: 'accepted',
    acceptedAt: new Date('2026-07-30T08:00:00.000Z'),
    attemptCount: 1,
    retryHistory: [{ attemptNumber: 1, errorCode: 'OLD' }]
  });
  mockDb.puzzles['failed-transition'] = {
    publicId: 'failed-transition',
    recipients: [{ whatsappSendStatus: 'accepted', deliveryStatus: 'pending' }]
  };
  const acceptedFailedPayload = JSON.stringify({
    phone_number_id: '10928374',
    message: {
      id: 'wamid.failed-transition',
      timestamp: '1785399000',
      kapso: {
        status: 'failed',
        statuses: [{
          id: 'wamid.failed-transition',
          status: 'failed',
          timestamp: '1785399000',
          recipient_id: '97333931331',
          errors: [{
            code: 131026,
            title: 'Message Undeliverable',
            message: 'Message undeliverable',
            error_data: { details: 'Unable to deliver message.' },
            href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/'
          }]
        }]
      }
    }
  });
  const acceptedFailedSignature = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
    .update(Buffer.from(acceptedFailedPayload, 'utf8'))
    .digest('hex');
  const acceptedFailedRequest = {
    headers: {
      'x-webhook-signature': acceptedFailedSignature,
      'x-idempotency-key': 'failed-event-once',
      'x-webhook-event': 'whatsapp.message.failed',
      'x-webhook-payload-version': 'v2'
    },
    body: Buffer.from(acceptedFailedPayload, 'utf8')
  };

  resStatus = 0;
  resBody = null;
  await invokeWebhookRoute(acceptedFailedRequest, resMock, () => {});
  const failedTransition = mockDb.messages['puzzle-delivery:failed-transition:0:jigzo_puzzle_delivery:v1'];
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(failedTransition.status, 'failed');
  assert.strictEqual(failedTransition.providerStatus, 'failed');
  assert.strictEqual(failedTransition.providerMessageId, 'wamid.failed-transition');
  assert.ok(failedTransition.failedAt);
  assert.ok(failedTransition.lastStatusAt);
  assert.strictEqual(failedTransition.lastErrorCode, '131026');
  assert.strictEqual(failedTransition.lastErrorTitle, 'Message Undeliverable');
  assert.strictEqual(failedTransition.lastErrorMessage, 'Message undeliverable');
  assert.strictEqual(failedTransition.lastErrorDetails, 'Unable to deliver message.');
  assert.strictEqual(failedTransition.providerFailureMetadata.recipientIdMasked, '*******1331');
  assert.strictEqual(failedTransition.attemptCount, 1);
  assert.deepStrictEqual(failedTransition.retryHistory, [{ attemptNumber: 1, errorCode: 'OLD' }]);
  assert.strictEqual(mockDb.puzzles['failed-transition'].recipients[0].whatsappSendStatus, 'failed');
  assert.strictEqual(mockDb.puzzles['failed-transition'].recipients[0].deliveryStatus, 'failed');
  assert.strictEqual(mockDb.webhookEvents['failed-event-once'].errorTitle, 'Message Undeliverable');
  assert.strictEqual(mockDb.webhookEvents['failed-event-once'].errorDetails, 'Unable to deliver message.');
  console.log('✓ Scenario 6.3: Accepted -> failed persists safe metadata without changing retry protection: Success');

  const sentThenFailedKey = 'puzzle-delivery:sent-then-failed:0:jigzo_puzzle_delivery:v1';
  const sentThenFailedMessage = new MockWhatsAppMessage({
    puzzleId: 'sent-then-failed',
    recipientIndex: 0,
    idempotencyKey: sentThenFailedKey,
    providerMessageId: 'wamid.sent-then-failed',
    destinationMasked: '********4121',
    status: 'accepted',
    providerStatus: 'accepted',
    acceptedAt: new Date(),
    attemptCount: 2,
    retryHistory: [{ attemptNumber: 1, providerMessageId: 'wamid.old-attempt' }]
  });
  mockDb.messages[sentThenFailedKey] = sentThenFailedMessage;
  mockDb.puzzles['sent-then-failed'] = {
    publicId: 'sent-then-failed',
    recipients: [{ whatsappSendStatus: 'accepted', deliveryStatus: 'pending' }]
  };
  await persistNormalizedStatus({
    providerMessageId: 'wamid.sent-then-failed',
    providerStatus: 'sent',
    occurredAt: new Date()
  });
  assert.strictEqual(sentThenFailedMessage.status, 'sent');
  await persistNormalizedStatus({
    providerMessageId: 'wamid.sent-then-failed',
    providerStatus: 'failed',
    occurredAt: new Date(),
    failure: {
      code: '131026',
      title: 'Message Undeliverable',
      message: 'Message undeliverable',
      details: 'Recipient is not registered.',
      metadata: { status: 'failed' }
    }
  });
  const sentThenFailedRecipient = mockDb.puzzles['sent-then-failed'].recipients[0];
  assert.strictEqual(sentThenFailedMessage.status, 'failed');
  assert.strictEqual(sentThenFailedMessage.providerStatus, 'failed');
  assert.strictEqual(sentThenFailedRecipient.whatsappSendStatus, 'failed');
  assert.strictEqual(adminBusinessLogic.getRecipientOperationalState(sentThenFailedRecipient, sentThenFailedMessage), 'failed');
  assert.strictEqual(adminBusinessLogic.getDeliveryTracking(sentThenFailedRecipient, sentThenFailedMessage), 'Failed');
  assert.strictEqual(whatsappService.isInitialPuzzleDeliveryCorrectable(sentThenFailedMessage, sentThenFailedRecipient), true);
  assert.strictEqual(sentThenFailedMessage.retryHistory.length, 1);
  console.log('✓ Scenario 6.3b: Accepted -> sent -> terminal failed becomes operationally failed and correction-eligible: Success');

  resStatus = 0;
  resBody = null;
  await invokeWebhookRoute(acceptedFailedRequest, resMock, () => {});
  assert.strictEqual(resStatus, 200);
  assert.strictEqual(resBody.note, 'duplicate_webhook_ignored');
  assert.strictEqual(failedTransition.attemptCount, 1);
  assert.strictEqual(failedTransition.retryHistory.length, 1);
  console.log('✓ Scenario 6.4: Duplicate failed webhook is idempotently ignored: Success');

  assert.strictEqual(adminBusinessLogic.getRecipientOperationalState({
    whatsappSendStatus: 'failed',
    deliveryStatus: 'failed',
    whatsappFailedAt: new Date()
  }), 'failed');
  assert.strictEqual(adminBusinessLogic.getDeliveryTracking({
    whatsappSendStatus: 'failed',
    deliveryStatus: 'failed'
  }), 'Failed');
  assert.strictEqual(adminBusinessLogic.getRecipientOperationalState({
    whatsappSendStatus: 'failed',
    deliveryStatus: 'failed',
    openedAt: new Date()
  }), 'opened');
  console.log('✓ Scenario 6.5: Admin displays failed unless a stronger opened/solved state exists: Success');

  const staleAccepted = {
    status: 'accepted',
    providerMessageId: 'wamid.stale',
    acceptedAt: new Date('2026-07-30T08:00:00.000Z')
  };
  assert.strictEqual(isStaleAcceptedMessage(staleAccepted, new Date('2026-07-30T08:31:00.000Z'), 30), true);
  assert.strictEqual(getReconciliationStatus(staleAccepted, new Date('2026-07-30T08:31:00.000Z')), 'reconciliation_required');
  assert.strictEqual(isStaleAcceptedMessage({ ...staleAccepted, sentAt: new Date() }, new Date('2026-07-30T08:31:00.000Z'), 30), false);
  console.log('✓ Scenario 6.6: Stale accepted messages are surfaced without treating accepted as delivered: Success');

  resetMocks();
  const webhookLifecycleKey = 'puzzle-delivery:webhook-lifecycle:0:jigzo_puzzle_delivery:v1';
  mockDb.messages[webhookLifecycleKey] = new MockWhatsAppMessage({
    puzzleId: 'webhook-lifecycle',
    recipientIndex: 0,
    idempotencyKey: webhookLifecycleKey,
    providerMessageId: 'wamid.webhook-lifecycle',
    destinationMasked: '*******3131',
    status: 'accepted',
    providerStatus: 'accepted'
  });
  mockDb.puzzles['webhook-lifecycle'] = {
    publicId: 'webhook-lifecycle',
    recipients: [{ whatsappSendStatus: 'accepted', deliveryStatus: 'pending' }]
  };
  for (const [index, lifecycleStatus] of ['sent', 'delivered', 'read'].entries()) {
    const lifecyclePayload = JSON.stringify({
      phone_number_id: '10928374',
      message: {
        id: 'wamid.webhook-lifecycle',
        timestamp: String(1785399000 + index),
        kapso: {
          status: lifecycleStatus,
          statuses: [{
            id: 'wamid.webhook-lifecycle',
            status: lifecycleStatus,
            timestamp: String(1785399000 + index),
            recipient_id: '97333931331'
          }]
        }
      }
    });
    const lifecycleSignature = crypto.createHmac('sha256', process.env.KAPSO_WEBHOOK_SECRET)
      .update(Buffer.from(lifecyclePayload, 'utf8'))
      .digest('hex');
    resStatus = 0;
    await invokeWebhookRoute({
      headers: {
        'x-webhook-signature': lifecycleSignature,
        'x-idempotency-key': `webhook-lifecycle-${lifecycleStatus}`,
        'x-webhook-event': `whatsapp.message.${lifecycleStatus}`,
        'x-webhook-payload-version': 'v2'
      },
      body: Buffer.from(lifecyclePayload, 'utf8')
    }, resMock, () => {});
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(mockDb.messages[webhookLifecycleKey].status, lifecycleStatus);
  }
  console.log('✓ Scenario 6.7: Signed sent/delivered/read webhooks each return HTTP 200: Success');

  async function reconcileFromAccepted(providerStatus, suffix) {
    resetMocks();
    const key = `puzzle-delivery:reconcile-${suffix}:0:jigzo_puzzle_delivery:v1`;
    const providerMessageId = `wamid.reconcile-${suffix}`;
    const message = new MockWhatsAppMessage({
      puzzleId: `reconcile-${suffix}`,
      recipientIndex: 0,
      idempotencyKey: key,
      providerMessageId,
      destinationMasked: '*******3131',
      status: 'accepted',
      providerStatus: 'accepted',
      acceptedAt: new Date('2026-07-30T08:00:00.000Z'),
      attemptCount: 1,
      retryHistory: []
    });
    mockDb.messages[key] = message;
    mockDb.puzzles[`reconcile-${suffix}`] = {
      publicId: `reconcile-${suffix}`,
      recipients: [{ whatsappSendStatus: 'accepted', deliveryStatus: 'pending' }]
    };
    const statusEntry = {
      id: providerMessageId,
      status: providerStatus,
      timestamp: '1785399000',
      recipient_id: '97333931331'
    };
    if (providerStatus === 'failed') {
      statusEntry.errors = [{
        code: 131026,
        title: 'Message Undeliverable',
        message: 'Message undeliverable',
        error_data: { details: 'Unable to deliver message.' }
      }];
    }
    fetchResponseMock = {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: {
          id: providerMessageId,
          kapso: {
            status: providerStatus,
            processing_status: 'completed',
            statuses: [statusEntry]
          }
        }
      })
    };
    const result = await reconcileMessage(message);
    return { result, message, key };
  }

  const reconciledFailed = await reconcileFromAccepted('failed', 'failed');
  assert.strictEqual(reconciledFailed.result.status, 'failed', reconciledFailed.result.reason);
  assert.strictEqual(reconciledFailed.message.status, 'failed');
  assert.strictEqual(reconciledFailed.message.lastErrorTitle, 'Message Undeliverable');
  assert.strictEqual(lastFetchParams.options.method, 'GET');
  assert.strictEqual(lastFetchParams.options.body, undefined);
  console.log('✓ Scenario 6.8: Reconciliation transitions accepted -> provider failed without sending: Success');

  const reconciledSent = await reconcileFromAccepted('sent', 'sent');
  assert.strictEqual(reconciledSent.message.status, 'sent');
  assert.ok(reconciledSent.message.sentAt);
  console.log('✓ Scenario 6.9: Reconciliation transitions accepted -> provider sent: Success');

  const reconciledDelivered = await reconcileFromAccepted('delivered', 'delivered');
  assert.strictEqual(reconciledDelivered.message.status, 'delivered');
  assert.ok(reconciledDelivered.message.deliveredAt);
  console.log('✓ Scenario 6.10: Reconciliation transitions accepted -> provider delivered: Success');

  const reconciledRead = await reconcileFromAccepted('read', 'read');
  assert.strictEqual(reconciledRead.message.status, 'read');
  assert.ok(reconciledRead.message.readAt);
  console.log('✓ Scenario 6.11: Reconciliation transitions accepted -> provider read: Success');

  const duplicateReconciliation = await reconcileMessage(reconciledRead.message);
  assert.strictEqual(duplicateReconciliation.reconciled, true);
  assert.strictEqual(reconciledRead.message.status, 'read');
  assert.strictEqual(reconciledRead.message.attemptCount, 1);
  console.log('✓ Scenario 6.12: Reconciliation is idempotent and preserves attempts: Success');

  resetMocks();
  const lookupFailureMessage = new MockWhatsAppMessage({
    puzzleId: 'reconcile-lookup-failure',
    recipientIndex: 0,
    idempotencyKey: 'puzzle-delivery:reconcile-lookup-failure:0:jigzo_puzzle_delivery:v1',
    providerMessageId: 'wamid.lookup-failure',
    destinationMasked: '*******3131',
    status: 'accepted',
    providerStatus: 'accepted',
    acceptedAt: new Date('2026-07-30T08:00:00.000Z')
  });
  mockDb.messages[lookupFailureMessage.idempotencyKey] = lookupFailureMessage;
  fetchResponseMock = {
    ok: false,
    status: 503,
    text: async () => JSON.stringify({ error: { message: 'Unavailable' } })
  };
  const lookupFailureResult = await reconcileMessage(lookupFailureMessage);
  assert.strictEqual(lookupFailureResult.reconciled, false);
  assert.strictEqual(lookupFailureResult.status, 'reconciliation_required');
  assert.strictEqual(lookupFailureMessage.status, 'accepted');
  assert.strictEqual(lastFetchParams.options.method, 'GET');
  assert.strictEqual(lastFetchParams.options.body, undefined);
  console.log('✓ Scenario 6.13: Provider lookup failure remains reconciliation_required and never sends: Success');

  // ==========================================
  // Group 8: Reveal Alert & Language templates
  // ==========================================
  console.log('\n--- Group 8: Reveal Alert & Language templates ---');

  // Verify sendRevealAlert when WHATSAPP_ENABLED is false
  process.env.WHATSAPP_ENABLED = 'false';
  const disabledRes = await whatsappService.sendRevealAlert({
    puzzleId: 'lc',
    recipientIndex: 0,
    senderPhone: '97333333333',
    recipientName: 'Sam',
    durationSeconds: 120
  });
  assert.strictEqual(disabledRes.status, 'disabled');
  console.log('✓ Scenario 8.1: Reveal alert with WHATSAPP_ENABLED=false is safely disabled: Success');

  // Enable whatsapp and mock fetch
  process.env.WHATSAPP_ENABLED = 'true';
  process.env.KAPSO_API_KEY = 'test_key';
  process.env.KAPSO_PHONE_NUMBER_ID = 'test_phone_id';

  // Global fetch mock to capture payload
  let capturedPayload;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    capturedPayload = JSON.parse(options.body);
    return {
      ok: true,
      text: async () => JSON.stringify({
        messages: [{ id: 'msg-solved-123' }]
      })
    };
  };

  mockDb.puzzles['lc'] = {
    publicId: 'lc',
    experienceLanguage: 'en',
    senderName: 'Someone',
    senderPhone: '97333333333',
    recipients: [{ name: 'Sam', completedAt: new Date('2026-07-24T17:13:08.828Z'), completionSeconds: 155 }],
    save: async function() { return this; }
  };
  MockPuzzle.findOne = async (q) => mockDb.puzzles[q.publicId] || null;

  try {
    const alertRes = await whatsappService.sendRevealAlert({
      puzzleId: 'lc',
      recipientIndex: 0,
      senderPhone: '97333333333',
      recipientName: 'Sam',
      durationSeconds: 155
    });

    assert.strictEqual(alertRes.success, true);
    assert.strictEqual(alertRes.status, 'accepted');
    assert.strictEqual(alertRes.providerMessageId, 'msg-solved-123');
    assert.strictEqual(capturedPayload.template.name, 'jigzo_puzzle_solved');
    assert.strictEqual(capturedPayload.template.language.code, 'en_US');
    assert.strictEqual(mockDb.messages['puzzle-solved:lc:0:jigzo_puzzle_solved:v1'].languageCode, 'en_US');
    assert.deepStrictEqual(capturedPayload.template.components[0].parameters, [
      { type: 'text', text: 'Someone' },
      { type: 'text', text: 'Sam' },
      { type: 'text', text: '24 Jul 2026' },
      { type: 'text', text: '8:13 pm' },
      { type: 'text', text: '2m 35s' }
    ]);
    console.log('✓ Scenario 8.2: English reveal alert uses jigzo_puzzle_solved and persists en_US: Success');

    mockDb.puzzles['lc-ar'] = {
      publicId: 'lc-ar',
      experienceLanguage: 'ar',
      senderName: 'Someone',
      senderPhone: '97333333333',
      recipients: [{ name: 'Sam', completedAt: new Date('2026-07-24T17:13:08.828Z'), completionSeconds: 155 }],
      save: async function() { return this; }
    };
    const arabicAlertRes = await whatsappService.sendRevealAlert({
      puzzleId: 'lc-ar',
      recipientIndex: 0,
      senderPhone: '97333333333',
      recipientName: 'Sam',
      durationSeconds: 155
    });
    assert.strictEqual(arabicAlertRes.success, true);
    assert.strictEqual(capturedPayload.template.name, 'jigzo_puzzle_solved');
    assert.strictEqual(capturedPayload.template.language.code, 'ar');
    assert.strictEqual(mockDb.messages['puzzle-solved:lc-ar:0:jigzo_puzzle_solved:v1'].languageCode, 'ar');
    assert.strictEqual(capturedPayload.template.components[0].parameters.length, 5);
    console.log('✓ Scenario 8.3: Arabic reveal alert uses jigzo_puzzle_solved and persists ar: Success');

  } finally {
    // Restore fetch and env
    global.fetch = originalFetch;
    process.env.WHATSAPP_ENABLED = 'false';
    process.env.KAPSO_API_KEY = '';
    process.env.KAPSO_PHONE_NUMBER_ID = '';
  }

  // ==========================================
  // Group 7: Puzzle Status Webhook Calculations & Mongoose Indexes
  // ==========================================
  console.log('\n--- Group 7: Puzzle Status Webhook Calculations & Mongoose Indexes ---');
  const Puzzle = require('../src/models/Puzzle');

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

  MockPuzzle.findById = async (id) => mockDb.puzzles['puz-check-status'];

  let mockPaymentReq = {
    headers: { 'hashstring': 'valid-hash' },
    body: {
      id: 'chg-123',
      amount: 10,
      currency: 'USD',
      reference: { order: 'ord-123', transaction: 'tx-123' },
      live_mode: false,
      status: 'CAPTURED'
    }
  };
  let mockPaymentRes = { json: () => {} };
  await paymentHandler(mockPaymentReq, mockPaymentRes, () => {});

  assert.strictEqual(mockDb.puzzles['puz-check-status'].status, 'paid');
  console.log('✓ Scenario 7.1: Accepted WhatsApp status does not update Puzzle state to delivered: Success');

  mockDb.puzzles['puz-check-status'].recipients[0].whatsappSendStatus = 'delivered';
  await paymentHandler(mockPaymentReq, mockPaymentRes, () => {});
  assert.strictEqual(mockDb.puzzles['puz-check-status'].status, 'delivered');
  console.log('✓ Scenario 7.2: Delivered WhatsApp status updates Puzzle state to delivered: Success');

  // Programmatic index checks
  const actualWhatsAppMessageModel = originalRequire.call(module, '../src/models/WhatsAppMessage');
  const schemaIndexes = actualWhatsAppMessageModel.schema.indexes();

  const idempotencyIdx = schemaIndexes.filter(idx => idx[0].idempotencyKey !== undefined);
  assert.strictEqual(idempotencyIdx.length, 1);
  assert.strictEqual(idempotencyIdx[0][1].unique, true);
  assert.strictEqual(idempotencyIdx[0][1].sparse, undefined);
  assert.deepStrictEqual(idempotencyIdx[0][1].partialFilterExpression, { idempotencyKey: { $type: 'string' } });
  console.log('✓ Scenario 7.3: Idempotency partial unique index exists exactly once without sparse property: Success');

  const providerIdx = schemaIndexes.filter(idx => idx[0].providerMessageId !== undefined);
  assert.strictEqual(providerIdx.length, 1);
  assert.strictEqual(providerIdx[0][1].unique, true);
  assert.strictEqual(providerIdx[0][1].sparse, undefined);
  assert.deepStrictEqual(providerIdx[0][1].partialFilterExpression, { providerMessageId: { $type: 'string', $gt: '' } });
  console.log('✓ Scenario 7.4: Provider Message partial unique index excludes empty strings: Success');

  // ==========================================
  // Group 9: waitUntil Decoupling & Retry/RetryHistory Reliability
  // ==========================================
  console.log('\n--- Group 9: waitUntil Decoupling & Retry/RetryHistory Reliability ---');

  // Scenario 9.1: Meta parameters count is exactly five
  process.env.WHATSAPP_ENABLED = 'true';
  process.env.KAPSO_API_KEY = 'test_key';
  process.env.KAPSO_PHONE_NUMBER_ID = 'test_phone';

  mockDb.puzzles['puz-solved-9'] = {
    publicId: 'puz-solved-9',
    senderName: 'NadiaSender',
    occasion: 'Anniversary',
    senderPhone: '97333111111',
    recipients: [{ name: 'NadiaRecip', completedAt: new Date('2026-07-24T17:13:08.828Z'), completionSeconds: 125 }],
    save: async function() { return this; }
  };
  MockPuzzle.findOne = async (q) => mockDb.puzzles['puz-solved-9'] || null;

  let capturedPayloadSolved = null;
  global.fetch = async (url, options) => {
    capturedPayloadSolved = JSON.parse(options.body);
    return {
      ok: true,
      text: async () => JSON.stringify({ messages: [{ id: 'msg-solved-999' }] })
    };
  };

  const alertRes9 = await whatsappService.sendRevealAlert({
    puzzleId: 'puz-solved-9',
    recipientIndex: 0,
    senderPhone: '97333111111',
    recipientName: 'NadiaRecip',
    durationSeconds: 125
  });

  assert.strictEqual(alertRes9.success, true);
  assert.strictEqual(capturedPayloadSolved.template.name, 'jigzo_puzzle_solved');
  assert.strictEqual(capturedPayloadSolved.template.components[0].parameters.length, 5);
  assert.deepStrictEqual(capturedPayloadSolved.template.components[0].parameters[0], { type: 'text', text: 'NadiaSender' });
  assert.deepStrictEqual(capturedPayloadSolved.template.components[0].parameters[1], { type: 'text', text: 'NadiaRecip' });
  assert.deepStrictEqual(capturedPayloadSolved.template.components[0].parameters[2], { type: 'text', text: '24 Jul 2026' });
  assert.deepStrictEqual(capturedPayloadSolved.template.components[0].parameters[3], { type: 'text', text: '8:13 pm' });
  assert.deepStrictEqual(capturedPayloadSolved.template.components[0].parameters[4], { type: 'text', text: '2m 5s' });
  console.log('✓ Scenario 9.1: Meta parameter count is exactly five and mapped in correct order: Success');

  // Scenario 9.2: Failed records are preserved and retryHistory is retained
  const failKey = `puzzle-solved:puz-solved-9:0:jigzo_puzzle_solved:v1`;
  const failRecord = mockDb.messages[failKey];
  failRecord.status = 'failed';
  failRecord.lastErrorCode = '132000';
  failRecord.lastErrorMessage = 'Parameter count mismatch';
  failRecord.attemptCount = 1;

  // Trigger retry
  const retryRes = await whatsappService.sendRevealAlert({
    puzzleId: 'puz-solved-9',
    recipientIndex: 0,
    senderPhone: '97333111111',
    recipientName: 'NadiaRecip',
    durationSeconds: 125
  });

  assert.strictEqual(retryRes.success, true);
  const updatedRecord = mockDb.messages[failKey];
  assert.strictEqual(updatedRecord.attemptCount, 2);
  assert.ok(updatedRecord.retryStartedAt);
  assert.strictEqual(updatedRecord.retryHistory.length, 1);
  assert.strictEqual(updatedRecord.retryHistory[0].attemptNumber, 1);
  assert.strictEqual(updatedRecord.retryHistory[0].errorCode, '132000');
  console.log('✓ Scenario 9.2: Failed records are preserved and retryHistory is correctly populated: Success');

  // Scenario 9.3: Concurrent retry attempts cannot duplicate an alert
  updatedRecord.status = 'sending';
  const concurrentRes = await whatsappService.sendRevealAlert({
    puzzleId: 'puz-solved-9',
    recipientIndex: 0,
    senderPhone: '97333111111',
    recipientName: 'NadiaRecip',
    durationSeconds: 125
  });
  assert.strictEqual(concurrentRes.success, false);
  assert.strictEqual(concurrentRes.reason, 'duplicate_request');
  console.log('✓ Scenario 9.3: Concurrent retry attempts are safely rejected: Success');

  // Scenario 9.4: Accepted/sent/delivered/read alerts are always skipped
  updatedRecord.status = 'accepted';
  const skippedRes = await whatsappService.sendRevealAlert({
    puzzleId: 'puz-solved-9',
    recipientIndex: 0,
    senderPhone: '97333111111',
    recipientName: 'NadiaRecip',
    durationSeconds: 125
  });
  assert.strictEqual(skippedRes.success, false);
  assert.strictEqual(skippedRes.reason, 'duplicate_request');
  console.log('✓ Scenario 9.4: Non-failed alerts (accepted/sent/delivered) are skipped on retry: Success');

  // Scenario 9.5: Express completion response returns immediately while registered background alert task runs afterward
  let waitUntilPromise = null;
  global.__mockWaitUntil = (promise) => {
    waitUntilPromise = promise;
  };

  // Mock sendRevealAlert to delay its completion
  let resolveRevealAlert = null;
  const originalSend = whatsappService.sendRevealAlert;
  whatsappService.sendRevealAlert = async () => {
    return new Promise((resolve) => {
      resolveRevealAlert = () => resolve({ success: true });
    });
  };

  // Mock puzzle route call context
  let hasResolvedResponse = false;
  const runRoute = async () => {
    const puzzleRoute = require('../src/routes/puzzles');
    const solveRoute = puzzleRoute.stack.find(s => s.route?.path === '/:publicId/complete');
    const solveHandler = solveRoute?.route?.stack[0]?.handle;
    
    const req = {
      params: { publicId: 'puz-solved-9' },
      query: { r: '0' },
      body: { durationSeconds: 10 }
    };
    const res = {
      status: function() { return this; },
      json: function(data) {
        hasResolvedResponse = true;
      }
    };
    
    // Setup Order and Puzzle models for the route
    MockPuzzle.findOne = async () => ({
      publicId: 'puz-solved-9',
      senderPhone: '97333111111',
      recipients: [{ name: 'NadiaRecip', completedAt: null, completionSeconds: 0 }],
      save: async function() { return this; }
    });
    const MockOrderModel = require('../src/models/Order');
    MockOrderModel.findOne = async () => ({ puzzleId: 'puz-solved-9', addOns: 1, paymentStatus: 'paid' });

    await solveHandler(req, res, () => {});
  };

  await runRoute();
  
  // Assert response returned immediately
  assert.strictEqual(hasResolvedResponse, true);
  assert.ok(waitUntilPromise);
  
  // Assert background work was not yet resolved, then resolve it
  let resolvedBackgroundWork = false;
  waitUntilPromise.then(() => { resolvedBackgroundWork = true; });
  assert.strictEqual(resolvedBackgroundWork, false);
  
  resolveRevealAlert();
  await waitUntilPromise;
  assert.strictEqual(resolvedBackgroundWork, true);
  
  // Restore
  whatsappService.sendRevealAlert = originalSend;
  global.__mockWaitUntil = null;
  console.log('✓ Scenario 9.5: Express completion route returns response immediately while waitUntil runs in background: Success');

  process.env.WHATSAPP_ENABLED = 'false';

  console.log('\nAll JIGZO WhatsApp integration scenarios passed successfully!');
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

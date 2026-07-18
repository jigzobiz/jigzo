const assert = require('assert');
const crypto = require('crypto');

// Mock setup for Mongoose models to allow fast database-free unit testing
const mockDb = {
  puzzles: {},
  messages: {},
  webhookEvents: {}
};

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
MockWhatsAppMessage.findOne = async ({ idempotencyKey, providerMessageId }) => {
  if (idempotencyKey) return mockDb.messages[idempotencyKey] || null;
  if (providerMessageId) {
    return Object.values(mockDb.messages).find(m => m.providerMessageId === providerMessageId) || null;
  }
  return null;
};

const MockWhatsAppWebhookEvent = function(data) {
  this._data = { ...data };
  this.save = async () => {
    const key = this._data.idempotencyKey;
    if (mockDb.webhookEvents[key]) {
      const err = new Error('Duplicate key');
      err.code = 11000;
      throw err;
    }
    mockDb.webhookEvents[key] = this;
    return this;
  };
};

// We temporarily replace the global Mock classes in whatsappService context
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path.includes('models/WhatsAppMessage')) return MockWhatsAppMessage;
  if (path.includes('models/Puzzle')) return MockPuzzle;
  if (path.includes('models/WhatsAppWebhookEvent')) return MockWhatsAppWebhookEvent;
  return originalRequire.apply(this, arguments);
};

// Import actual module dependencies AFTER overriding require
const whatsappService = require('../src/services/whatsappService');

// Inject mock updates
const originalUpdateRecipientSnapshot = whatsappService.updateRecipientSnapshot;
whatsappService.updateRecipientSnapshot = async (puzzleId, recipientIndex, fields) => {
  const puzzle = mockDb.puzzles[puzzleId];
  if (puzzle && puzzle.recipients[recipientIndex]) {
    const rec = puzzle.recipients[recipientIndex];
    if (fields.status) rec.whatsappSendStatus = fields.status;
    if (fields.providerMessageId) rec.providerMessageId = fields.providerMessageId;
    if (fields.sentAt) rec.whatsappSentAt = fields.sentAt;
    if (fields.deliveredAt) rec.whatsappDeliveredAt = fields.deliveredAt;
    if (fields.readAt) rec.whatsappReadAt = fields.readAt;
    if (fields.failedAt) rec.whatsappFailedAt = fields.failedAt;
    if (fields.lastStatusAt) rec.whatsappLastStatusAt = fields.lastStatusAt;
    if (fields.errorCode) rec.whatsappLastErrorCode = fields.errorCode;
    if (fields.errorMessage) rec.whatsappLastErrorMessage = fields.errorMessage;
  }
};

// Setup initial state
function resetMocks() {
  mockDb.puzzles = {};
  mockDb.messages = {};
  mockDb.webhookEvents = {};
  process.env.WHATSAPP_ENABLED = 'false';
  process.env.KAPSO_API_KEY = 'mock_key';
  process.env.KAPSO_PHONE_NUMBER_ID = 'mock_phone_id';
}

async function runTests() {
  console.log('Starting JIGZO WhatsApp Delivery Integration Tests...');

  // Test 1: Dormant Safety Checks
  resetMocks();
  mockDb.puzzles['test-puz-1'] = {
    publicId: 'test-puz-1',
    senderName: 'Zahra',
    revealIdentity: true,
    recipients: [
      { name: 'Sam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }
    ]
  };

  let res = await whatsappService.claimAndSendPuzzleDelivery({
    puzzleId: 'test-puz-1',
    recipientIndex: 0
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'disabled');
  assert.strictEqual(mockDb.messages[`puzzle-delivery:test-puz-1:0:jigzo_puzzle_delivery:v1`].status, 'disabled');
  assert.strictEqual(mockDb.puzzles['test-puz-1'].recipients[0].whatsappSendStatus, 'disabled');
  console.log('✓ Test 1: Dormant safety validated successfully.');

  // Test 2: Double Claims Idempotency Checks
  resetMocks();
  mockDb.puzzles['test-puz-2'] = {
    publicId: 'test-puz-2',
    senderName: 'Sara',
    revealIdentity: true,
    recipients: [
      { name: 'Mariam', phone: '33931331', countryCode: '973', whatsappSendStatus: 'pending' }
    ]
  };

  const p1 = whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'test-puz-2', recipientIndex: 0 });
  const p2 = whatsappService.claimAndSendPuzzleDelivery({ puzzleId: 'test-puz-2', recipientIndex: 0 });
  const [res1, res2] = await Promise.all([p1, p2]);

  // One of them is disabled, the other is duplicate_request
  const statuses = [res1.status, res2.status];
  assert.ok(statuses.includes('disabled'));
  
  const reasons = [res1.reason, res2.reason];
  assert.ok(reasons.includes('duplicate_request'));
  console.log('✓ Test 2: Outbound double claim locks verified successfully.');

  // Test 3: Normalization & Logging Checks
  resetMocks();
  const normalized = whatsappService.normalizePhone('3393-1331', '973');
  assert.strictEqual(normalized, '+97333931331');
  console.log('✓ Test 3: Phone number normalization validated successfully.');

  console.log('\nAll WhatsApp Integration unit tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

import axios from 'axios';

// Local storage / Session storage safely wrapped
let inMemoryStorage = {};

const safeGetItem = (type, key) => {
  try {
    if (type === 'local' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (type === 'session' && typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch (e) {}
  return inMemoryStorage[`${type}_${key}`] || null;
};

const safeSetItem = (type, key, value) => {
  try {
    if (type === 'local' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (type === 'session' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return;
    }
  } catch (e) {}
  inMemoryStorage[`${type}_${key}`] = value;
};

// Generates or retrieves an Anonymous ID
function getAnonymousId() {
  const key = 'jigzo_anonymous_id';
  let val = safeGetItem('local', key);
  if (!val) {
    val = 'anon_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    safeSetItem('local', key, val);
  }
  return val;
}

// Generates or retrieves a Session ID
function getSessionId() {
  const key = 'jigzo_session_id';
  let val = safeGetItem('session', key);
  if (!val) {
    val = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    safeSetItem('session', key, val);
  }
  return val;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (err) {}
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
}

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_API_URL || '' : '';

const ALLOWED_EVENTS = new Set([
  'landing_viewed', 'hero_cta_clicked', 'pricing_viewed', 'create_page_viewed',
  'create_started', 'photo_uploaded', 'difficulty_selected', 'occasion_selected',
  'tone_selected', 'message_written', 'recipient_added', 'sender_details_added',
  'create_validation_failed', 'checkout_viewed', 'checkout_blocked', 'checkout_started',
  'payment_succeeded', 'payment_failed', 'payment_cancelled', 'puzzle_created',
  'whatsapp_accepted', 'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read', 'whatsapp_failed',
  'puzzle_opened', 'puzzle_started', 'puzzle_completed', 'reveal_viewed',
  'save_share_clicked', 'share_completed', 'replay_clicked', 'create_your_puzzle_clicked',
  // Restored:
  'occasion_card_click', 'photo_cropped', 'review_opened', 'payment_started', 'waitlist_joined'
]);

const ALLOWED_METADATA_KEYS = new Set([
  'occasion', 'tone', 'difficulty', 'hasRevealAlert', 'recipientsCount',
  'recipientCount', 'amount', 'durationSeconds', 'reason', 'interestType',
  'currency', 'pieceCount', 'step', 'reasonCode', 'method', 'isLocalTest'
]);

const sanitizeMetadata = (metadata) => {
  const sanitized = {};
  if (metadata && typeof metadata === 'object') {
    for (const key of Object.keys(metadata)) {
      if (ALLOWED_METADATA_KEYS.has(key)) {
        sanitized[key] = metadata[key];
      }
    }
  }
  return sanitized;
};

export const analytics = {
  getAnonymousId,
  getSessionId,
  
  track: async (eventType, metadata = {}, identity = {}) => {
    try {
      if (!ALLOWED_EVENTS.has(eventType)) {
        console.warn(`[JIGZO Analytics] Rejected disallowed eventType: ${eventType}`);
        return;
      }

      const anonymousId = getAnonymousId();
      const sessionId = getSessionId();

      const getNormalizedPath = () => {
        const path = window.location.pathname;
        if (path.startsWith('/p/')) {
          return '/p/:publicId';
        }
        return path;
      };

      const pageUrl = getNormalizedPath();
      const sanitizedMeta = sanitizeMetadata(metadata);
      const eventId = generateUUID();

      const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true') ? 'http://localhost:5000' : API_BASE;

      await axios.post(`${baseUrl}/api/analytics/events`, {
        anonymousId,
        sessionId,
        eventType,
        pageUrl,
        metadata: sanitizedMeta,
        eventId,
        identity
      });
    } catch (err) {
      console.warn('[JIGZO Analytics] Failed to log event:', eventType, err.message);
    }
  },

  trackOnce: async (eventType, metadata = {}, scopeKey = '') => {
    const key = `jigzo_tracked_${eventType}_${scopeKey}`;
    const tracked = safeGetItem('session', key);
    if (tracked) return;

    safeSetItem('session', key, 'true');
    await analytics.track(eventType, metadata);
  }
};

import axios from 'axios';

// Get or create anonymousId persisted in localStorage
const getAnonymousId = () => {
  let anonymousId = localStorage.getItem('jigzo_anonymous_id');
  if (!anonymousId) {
    // Generate UUID-like unique string
    anonymousId = 'anon_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('jigzo_anonymous_id', anonymousId);
  }
  return anonymousId;
};

// Get or create sessionId in sessionStorage (expires when tab/browser closes)
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('jigzo_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('jigzo_session_id', sessionId);
  }
  return sessionId;
};

// Default to same-origin (''), so every deployment — Production, Preview, and
// local (via the Vite /api proxy) — talks to its OWN backend. Set VITE_API_URL
// only when a different API origin is deliberately required.
const API_BASE = import.meta.env.VITE_API_URL || '';

const ALLOWED_EVENTS = new Set([
  'landing_viewed', 'hero_cta_clicked', 'pricing_viewed', 'create_page_viewed',
  'create_started', 'photo_uploaded', 'difficulty_selected', 'occasion_selected',
  'tone_selected', 'message_written', 'recipient_added', 'sender_details_added',
  'create_validation_failed', 'checkout_viewed', 'checkout_blocked', 'checkout_started',
  'payment_succeeded', 'payment_failed', 'payment_cancelled', 'puzzle_created',
  'whatsapp_accepted', 'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read', 'whatsapp_failed',
  'puzzle_opened', 'puzzle_started', 'puzzle_completed', 'reveal_viewed',
  'save_share_clicked', 'share_completed', 'replay_clicked', 'create_your_puzzle_clicked'
]);

const ALLOWED_METADATA_KEYS = new Set([
  'occasion', 'tone', 'difficulty', 'hasRevealAlert', 'recipientsCount',
  'recipientCount', 'amount', 'orderId', 'isLocalTest', 'durationSeconds',
  'reason', 'interestType', 'currency'
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
  
  track: async (eventType, metadata = {}) => {
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

      // In local testing, if base URL points to local server, bypass remote
      const baseUrl = import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true' ? 'http://localhost:5000' : API_BASE;

      await axios.post(`${baseUrl}/api/analytics/events`, {
        anonymousId,
        sessionId,
        eventType,
        pageUrl,
        metadata: sanitizedMeta
      });
    } catch (err) {
      console.warn('[JIGZO Analytics] Failed to log event:', eventType, err.message);
    }
  }
};

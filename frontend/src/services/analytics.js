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

// --- Privacy sanitization -------------------------------------------------
// The puzzle publicId is a capability (the link opens the puzzle), so it must
// never leave the page inside analytics. Events carry a route TEMPLATE (no
// query string, no fragment, no real id) and metadata is stripped of
// capability identifiers, tokens and URL-shaped values before transmission.
// The backend re-sanitizes on ingestion; this is the first of two layers.

const PUZZLE_PATH_RE = /\/p\/[^/?#]+/g;
const FORBIDDEN_METADATA_KEYS = ['puzzleid', 'publicid', 'token', 'sig', 'signature', 'cookie'];
const SUSPICIOUS_VALUE_RE = /([a-f0-9]{24,}|https?:\/\/|jigzo_img)/i;

// Exported for reuse by the Vercel Analytics beforeSend hook (main.jsx).
export const sanitizeRoutePath = (pathname) => {
  const path = String(pathname || '/').split(/[?#]/)[0];
  return path.replace(PUZZLE_PATH_RE, '/p/:puzzleId');
};

const sanitizeMetadata = (metadata) => {
  const out = {};
  if (!metadata || typeof metadata !== 'object') return out;
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.includes(key.toLowerCase())) continue;
    if (typeof value === 'string' && SUSPICIOUS_VALUE_RE.test(value)) continue;
    out[key] = value;
  }
  return out;
};

export const analytics = {
  getAnonymousId,
  getSessionId,
  sanitizeRoutePath,

  track: async (eventType, metadata = {}) => {
    try {
      const anonymousId = getAnonymousId();
      const sessionId = getSessionId();
      // Route template only — never window.location.href.
      const pageUrl = sanitizeRoutePath(window.location.pathname);

      // In local testing, if base URL points to local server, bypass remote
      const baseUrl = import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true' ? 'http://localhost:5000' : API_BASE;

      await axios.post(`${baseUrl}/api/analytics/events`, {
        anonymousId,
        sessionId,
        eventType,
        pageUrl,
        metadata: sanitizeMetadata(metadata)
      });
    } catch (err) {
      console.warn('[JIGZO Analytics] Failed to log event:', eventType, err.message);
    }
  }
};

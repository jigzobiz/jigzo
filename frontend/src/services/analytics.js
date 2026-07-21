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

export const analytics = {
  getAnonymousId,
  getSessionId,

  track: async (eventType, metadata = {}) => {
    try {
      const anonymousId = getAnonymousId();
      const sessionId = getSessionId();
      const pageUrl = window.location.href;

      // In local testing, if base URL points to local server, bypass remote
      const baseUrl = import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true' ? 'http://localhost:5000' : API_BASE;

      await axios.post(`${baseUrl}/api/analytics/events`, {
        anonymousId,
        sessionId,
        eventType,
        pageUrl,
        metadata
      });
    } catch (err) {
      console.warn('[JIGZO Analytics] Failed to log event:', eventType, err.message);
    }
  }
};

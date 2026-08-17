const RETURN_KEY = 'jigzo_business_return_to';

export function safeBusinessReturnTo(value) {
  const path = String(value || '');
  return /^\/business\/campaigns\/(?:new|[A-Za-z0-9-]+)$/.test(path) ? path : '/business/campaigns/new';
}

export function rememberBusinessReturnTo(value) {
  const path = safeBusinessReturnTo(value);
  window.localStorage.setItem(RETURN_KEY, path);
  return path;
}

export function consumeBusinessReturnTo() {
  const path = safeBusinessReturnTo(window.localStorage.getItem(RETURN_KEY));
  window.localStorage.removeItem(RETURN_KEY);
  return path;
}

export function isStagingBusinessHost() {
  return window.location.hostname === 'staging.jigzo.biz';
}

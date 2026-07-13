// Canonical Base Price Table (in USD)
const BASE_PRICES = {
  single: { price: 5, insightsPrice: 1 },
  digital: { price: 5, insightsPrice: 1 },
  small: { price: 8, insightsPrice: 1.5 },
  friends: { price: 15, insightsPrice: 2 },
  celebration: { price: 25, insightsPrice: 2.5 },
};

// Cache keys with version suffix for invalidation
const CACHE_KEY_RATES = 'jigzo_exchange_rates_v2';
const CACHE_KEY_CURRENCY = 'jigzo_visitor_currency_v2';

// Supported currencies/rates (initially with fallback rates)
let EXCHANGE_RATES = {
  USD: 1.0,
  BHD: 0.376,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
  SAR: 3.75,
};

// Check if cached rates/currency are in sessionStorage to allow synchronous first-render
try {
  const cachedRates = sessionStorage.getItem(CACHE_KEY_RATES);
  if (cachedRates) {
    EXCHANGE_RATES = JSON.parse(cachedRates);
  }
} catch (e) {}

function getDevCurrencyOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const curParam = urlParams.get('currency');
    if (curParam) {
      const cleanCur = curParam.toUpperCase();
      sessionStorage.setItem(CACHE_KEY_CURRENCY, cleanCur);
      return cleanCur;
    }
  } catch (e) {}
  try {
    const stored = sessionStorage.getItem(CACHE_KEY_CURRENCY);
    if (stored) return stored;
  } catch (e) {}
  return null;
}

export function resolveVisitorCurrency() {
  const devOverride = getDevCurrencyOverride();
  if (devOverride) return devOverride;

  try {
    const cached = sessionStorage.getItem(CACHE_KEY_CURRENCY);
    if (cached) return cached;
  } catch (e) {}

  return 'USD';
}

function getExchangeRate(currencyCode) {
  return EXCHANGE_RATES[currencyCode] || 1.0;
}

export function formatMoney(amount, currencyCode) {
  const cur = currencyCode || resolveVisitorCurrency();
  const rate = getExchangeRate(cur);
  const converted = amount * rate;

  let decimals = 2;
  try {
    decimals = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
    }).resolvedOptions().minimumFractionDigits;
  } catch (e) {
    if (cur === 'BHD' || cur === 'KWD' || cur === 'OMR') decimals = 3;
    else if (cur === 'JPY' || cur === 'KRW') decimals = 0;
  }

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'code',
    });
    let formatted = formatter.format(converted);
    formatted = formatted.replace(/([A-Z]{3})\s*/, '$1 ');
    
    // Clean up trailing decimals for whole numbers
    if (converted % 1 === 0) {
      if (decimals === 2) formatted = formatted.replace(/\.00$/, '');
      else if (decimals === 3) formatted = formatted.replace(/\.000$/, '');
    }
    return formatted;
  } catch (e) {
    let numStr = converted.toFixed(decimals);
    if (converted % 1 === 0) {
      numStr = converted.toFixed(0);
    }
    return cur + ' ' + numStr;
  }
}

export function getLocalizedPrice(tier, currencyCode) {
  const cur = currencyCode || resolveVisitorCurrency();
  const base = BASE_PRICES[tier] ? BASE_PRICES[tier].price : 5;
  return formatMoney(base, cur);
}

// Kick off detection promise
let initPromise = null;
export function initializePricing() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryCur = urlParams.get('currency') || '';

      const url = `/api/pricing/locale` + (queryCur ? `?currency=${queryCur}` : '');
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.currency) {
        if (data.rates) {
          EXCHANGE_RATES = data.rates;
          sessionStorage.setItem(CACHE_KEY_RATES, JSON.stringify(data.rates));
        }
        sessionStorage.setItem(CACHE_KEY_CURRENCY, data.currency);
        window.dispatchEvent(new CustomEvent('jigzo-pricing-updated', { detail: { currency: data.currency } }));
        return data.currency;
      }
    } catch (err) {
      console.error('Failed to load pricing locale from API:', err);
    }
    return resolveVisitorCurrency();
  })();

  return initPromise;
}

// Auto-run on load in the browser
if (typeof window !== 'undefined') {
  initializePricing();
}

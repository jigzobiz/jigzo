// Canonical Base Price Table (in USD)
const BASE_PRICES = {
  single: { price: 5, insightsPrice: 1 },
  digital: { price: 5, insightsPrice: 1 },
  small: { price: 8, insightsPrice: 1.5 },
  friends: { price: 15, insightsPrice: 2 },
  celebration: { price: 25, insightsPrice: 2.5 },
};

// Cache keys with version suffix for invalidation
const CACHE_KEY_QUOTE = 'jigzo_backend_quote_v3';
const CACHE_KEY_CURRENCY = 'jigzo_visitor_currency_v3';

let BACKEND_QUOTE = null;

// USD 5 fallback quote
const FALLBACK_QUOTE = {
  basePriceUsd: 5,
  currency: 'USD',
  rate: 1.0,
  rawConverted: 5.0,
  roundedAmount: 5,
  formatted: 'USD 5',
  packages: {
    single: { basePrice: 5, formattedBase: 'USD 5', insightsPrice: 1, formattedInsights: 'USD 1' },
    small: { basePrice: 8, formattedBase: 'USD 8', insightsPrice: 1.5, formattedInsights: 'USD 1.5' },
    friends: { basePrice: 15, formattedBase: 'USD 15', insightsPrice: 2, formattedInsights: 'USD 2' },
    celebration: { basePrice: 25, formattedBase: 'USD 25', insightsPrice: 2.5, formattedInsights: 'USD 2.5' }
  }
};

// Check if cached quote is in sessionStorage
try {
  const cachedQuote = sessionStorage.getItem(CACHE_KEY_QUOTE);
  if (cachedQuote) {
    BACKEND_QUOTE = JSON.parse(cachedQuote);
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
  const quote = BACKEND_QUOTE || FALLBACK_QUOTE;
  return quote.currency;
}

export function roundPrice(amount, currency) {
  const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
  if (threeDecimalCurrencies.includes(currency)) {
    return Math.ceil(amount * 10) / 10;
  }
  return Math.ceil(amount);
}

export function formatMoney(amount, currencyCode) {
  const quote = BACKEND_QUOTE || FALLBACK_QUOTE;
  const cur = currencyCode || quote.currency;

  // Calculate based on the single backend FX rate source of truth
  const rate = quote.rate || 1.0;
  const rawConverted = amount * rate;
  const rounded = roundPrice(rawConverted, cur);

  const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
  if (threeDecimalCurrencies.includes(cur)) {
    return cur + ' ' + rounded.toFixed(1);
  }
  return cur + ' ' + rounded.toFixed(0);
}

export function getLocalizedPrice(tier, currencyCode) {
  const quote = BACKEND_QUOTE || FALLBACK_QUOTE;
  let key = tier;
  if (tier === 'digital') key = 'single';

  // Return the direct pre-calculated backend rounded quote if possible
  if (quote.packages && quote.packages[key]) {
    return quote.packages[key].formattedBase;
  }

  // Fallback to manual format using the backend quote rate
  const base = BASE_PRICES[tier] ? BASE_PRICES[tier].price : 5;
  return formatMoney(base, currencyCode || quote.currency);
}

export function getPricingDetails(tier, currencyCode) {
  const quote = BACKEND_QUOTE || FALLBACK_QUOTE;
  const cur = currencyCode || quote.currency;
  let key = tier;
  if (tier === 'digital') key = 'single';

  let formatted = '';
  let roundedDisplayAmount = 5;
  let rawConvertedAmount = 5;

  if (quote.packages && quote.packages[key]) {
    formatted = quote.packages[key].formattedBase;
    roundedDisplayAmount = quote.packages[key].basePrice;
    rawConvertedAmount = (BASE_PRICES[tier] ? BASE_PRICES[tier].price : 5) * (quote.rate || 1.0);
  } else {
    const base = BASE_PRICES[tier] ? BASE_PRICES[tier].price : 5;
    rawConvertedAmount = base * (quote.rate || 1.0);
    roundedDisplayAmount = roundPrice(rawConvertedAmount, cur);
    formatted = formatMoney(base, cur);
  }

  return {
    currencyCode: cur,
    rawConvertedAmount,
    roundedDisplayAmount,
    formatted,
    starting: `Starting from ${formatted}`,
    short: `From ${formatted}`
  };
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
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();

      if (data && data.success && data.quote) {
        BACKEND_QUOTE = data.quote;
        sessionStorage.setItem(CACHE_KEY_QUOTE, JSON.stringify(data.quote));
        sessionStorage.setItem(CACHE_KEY_CURRENCY, data.currency);
        window.dispatchEvent(new CustomEvent('jigzo-pricing-updated', { detail: { currency: data.currency } }));
        return data.currency;
      }
      throw new Error('Quote missing in response');
    } catch (err) {
      console.warn('Failed to load pricing locale from API, falling back to USD 5:', err.message);

      // Fallback cleanly to USD 5
      BACKEND_QUOTE = FALLBACK_QUOTE;
      sessionStorage.setItem(CACHE_KEY_QUOTE, JSON.stringify(FALLBACK_QUOTE));
      sessionStorage.setItem(CACHE_KEY_CURRENCY, 'USD');
      window.dispatchEvent(new CustomEvent('jigzo-pricing-updated', { detail: { currency: 'USD' } }));
      return 'USD';
    }
  })();

  return initPromise;
}

// Auto-run on load in the browser
if (typeof window !== 'undefined') {
  initializePricing();
}

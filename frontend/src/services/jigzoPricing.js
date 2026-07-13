/*
 * Landing-page localized pricing helper.
 *
 * Ported verbatim (behaviour-for-behaviour) from the approved static site's
 * js/pricing.js so the homepage shows the same localized starting price
 * (e.g. "USD 5", or "BHD 1.880" / "GBP 3.95" with a ?currency= override).
 *
 * Self-contained and client-only: no network calls, no shared state with the
 * create/receive pricing service (frontend/src/services/pricing.js). Used only
 * by LandingPage. resolveVisitorCountry() is a stub returning "US", so the
 * default currency is USD unless a ?currency=XYZ query param or a stored
 * jigzo_dev_currency override is present.
 */

// Canonical Base Price Table (in USD)
const BASE_PRICES = {
  single: { price: 5, insightsPrice: 1 },
  digital: { price: 5, insightsPrice: 1 },
  small: { price: 8, insightsPrice: 1.5 },
  friends: { price: 15, insightsPrice: 2 },
  celebration: { price: 25, insightsPrice: 2.5 },
};

// Supported currencies with fixed exchange rates relative to USD (fallback/adapter)
const EXCHANGE_RATES = {
  USD: 1.0,
  BHD: 0.376,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
  SAR: 3.75,
};

// Country to Currency Mapping
const COUNTRY_CURRENCY_MAP = {
  US: 'USD', BH: 'BHD', GB: 'GBP', UK: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  AE: 'AED', SA: 'SAR',
};

// 1. Explicit Development Override (Query Param or LocalStorage)
function getDevCurrencyOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const curParam = urlParams.get('currency');
    if (curParam) {
      const cleanCur = curParam.toUpperCase();
      if (EXCHANGE_RATES[cleanCur]) {
        localStorage.setItem('jigzo_dev_currency', cleanCur);
        return cleanCur;
      }
    }
  } catch (e) { /* ignore */ }
  try {
    const stored = localStorage.getItem('jigzo_dev_currency');
    if (stored && EXCHANGE_RATES[stored]) return stored;
  } catch (e) { /* ignore */ }
  return null;
}

// 2. Resolve Country Code (stub fallback, matches static site)
export function resolveVisitorCountry() {
  return 'US';
}

// 3. Resolve Currency Code
export function resolveVisitorCurrency() {
  const devOverride = getDevCurrencyOverride();
  if (devOverride) return devOverride;

  try {
    const cached = sessionStorage.getItem('jigzo_visitor_currency');
    if (cached && EXCHANGE_RATES[cached]) return cached;
  } catch (e) { /* ignore */ }

  const country = resolveVisitorCountry();
  const currency = COUNTRY_CURRENCY_MAP[country] || 'USD';

  try {
    sessionStorage.setItem('jigzo_visitor_currency', currency);
  } catch (e) { /* ignore */ }

  return currency;
}

// 4. Exchange Rate
function getExchangeRate(currencyCode) {
  return EXCHANGE_RATES[currencyCode] || 1.0;
}

// 5. Format Money according to ISO code and local minor units
export function formatMoney(amount, currencyCode) {
  const cur = currencyCode || resolveVisitorCurrency();
  const rate = getExchangeRate(cur);
  const converted = amount * rate;

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'code',
    });
    let formatted = formatter.format(converted);
    formatted = formatted.replace(/([A-Z]{3})\s*/, '$1 ');
    if (cur !== 'BHD' && converted % 1 === 0) {
      formatted = formatted.replace(/\.00$/, '');
    }
    return formatted;
  } catch (e) {
    const decimals = cur === 'BHD' ? 3 : 2;
    let numStr = converted.toFixed(decimals);
    if (cur !== 'BHD' && converted % 1 === 0) {
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

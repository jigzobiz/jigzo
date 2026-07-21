const express = require('express');
const router = express.Router();
const https = require('https');

// Supported currencies by the payment gateway
const SUPPORTED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'AED', 'SAR', 'BHD', 'KWD', 'OMR', 'QAR',
  'CAD', 'AUD', 'JPY', 'SGD', 'HKD', 'NZD', 'CHF', 'SEK', 'NOK',
  'DKK', 'MXN', 'BRL', 'ZAR', 'KRW', 'INR'
]);

// Country to Currency Mapping
const COUNTRY_CURRENCY_MAP = {
  US: 'USD', CA: 'CAD', GB: 'GBP', UK: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', IE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', CY: 'EUR', EE: 'EUR',
  LV: 'EUR', LT: 'EUR', MT: 'EUR', SK: 'EUR', SI: 'EUR', BH: 'BHD', AE: 'AED', SA: 'SAR',
  KW: 'KWD', OM: 'OMR', QA: 'QAR', JP: 'JPY', CN: 'CNY', IN: 'INR', AU: 'AUD', NZ: 'NZD',
  SGD: 'SGD', HK: 'HKD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', MX: 'MXN', BR: 'BRL',
  ZA: 'ZAR', KR: 'KRW', TR: 'TRY', RU: 'RUB', PL: 'PLN', IL: 'ILS'
};

// In-memory cache for exchange rates
let ratesCache = {
  rates: null,
  lastUpdated: 0
};

const FALLBACK_RATES = {
  USD: 1.0,
  BHD: 0.376,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
  SAR: 3.75,
  JPY: 155.0,
  CAD: 1.37,
  AUD: 1.50
};

// Fetch exchange rates (cached for 1 hour) using native https
async function getExchangeRates() {
  const now = Date.now();
  if (ratesCache.rates && now - ratesCache.lastUpdated < 3600000) {
    return ratesCache.rates;
  }

  return new Promise((resolve) => {
    https.get('https://open.er-api.com/v6/latest/USD', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.rates) {
            ratesCache.rates = parsed.rates;
            ratesCache.lastUpdated = now;
            resolve(parsed.rates);
            return;
          }
        } catch (e) {
          console.error('[Pricing] JSON parse error on exchange rates:', e.message);
        }
        resolve(ratesCache.rates || FALLBACK_RATES);
      });
    }).on('error', (err) => {
      console.error('[Pricing] Failed to fetch exchange rates via HTTPS:', err.message);
      resolve(ratesCache.rates || FALLBACK_RATES);
    });
  });
}

/**
 * GET /api/pricing/locale
 * Resolves visitor country, currency, and returns exchange rates and commercial quote.
 */
router.get('/locale', async (req, res) => {
  try {
    const rates = await getExchangeRates();

    let country = req.headers['x-vercel-ip-country'];
    let currency = 'USD';

    // Manual test override ?currency=XXX
    if (req.query.currency) {
      const queryCur = req.query.currency.toUpperCase();
      if (SUPPORTED_CURRENCIES.has(queryCur) && rates[queryCur]) {
        currency = queryCur;
      }
    } else {
      // Geolocate if header is present
      if (country) {
        country = country.toUpperCase();
        currency = COUNTRY_CURRENCY_MAP[country] || 'USD';
      } else {
        // Fallback: try geolocating based on request IP if it's a public IP
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (ip && ip !== '127.0.0.1' && ip !== '::1' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
          // Extract first IP if list
          if (ip.includes(',')) {
            ip = ip.split(',')[0].trim();
          }

          // Perform geolocation lookup via native HTTPS
          await new Promise((resolveGeo) => {
            https.get(`https://ipapi.co/${ip}/json/`, (geoRes) => {
              let geoDataStr = '';
              geoRes.on('data', (chunk) => {
                geoDataStr += chunk;
              });
              geoRes.on('end', () => {
                try {
                  const geoData = JSON.parse(geoDataStr);
                  if (geoData) {
                    if (geoData.currency) {
                      currency = geoData.currency;
                    } else if (geoData.country_code) {
                      country = geoData.country_code.toUpperCase();
                      currency = COUNTRY_CURRENCY_MAP[country] || 'USD';
                    }
                  }
                } catch (e) {
                  console.warn('[Pricing] JSON parse error on IP geolocation:', e.message);
                }
                resolveGeo();
              });
            }).on('error', (err) => {
              console.warn('[Pricing] Geolocation IP lookup failed:', err.message);
              resolveGeo();
            });
          });
        }
      }

      // Validate currency code
      currency = currency.toUpperCase();
      if (!SUPPORTED_CURRENCIES.has(currency) || !rates[currency]) {
        currency = 'USD';
      }
    }

    function roundPrice(amount, cur) {
      const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
      if (threeDecimalCurrencies.includes(cur)) {
        return Math.ceil(amount * 10) / 10;
      }
      return Math.ceil(amount);
    }

    function formatMoney(amount, currencyCode) {
      const rounded = roundPrice(amount, currencyCode);
      const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
      if (threeDecimalCurrencies.includes(currencyCode)) {
        return currencyCode + ' ' + rounded.toFixed(1);
      }
      return currencyCode + ' ' + rounded.toFixed(0);
    }

    // Generate package and upgrade quotes
    const PACK_OPTIONS = [
      { id: "single", price: 5, insightsPrice: 1 },
      { id: "small", price: 8, insightsPrice: 1.50 },
      { id: "friends", price: 15, insightsPrice: 2 },
      { id: "celebration", price: 25, insightsPrice: 2.50 }
    ];

    const rate = rates[currency] || 1.0;

    const packagesQuote = {};
    PACK_OPTIONS.forEach(pkg => {
      const rawPrice = pkg.price * rate;
      const roundedPrice = roundPrice(rawPrice, currency);

      const rawInsights = pkg.insightsPrice * rate;
      const roundedInsights = roundPrice(rawInsights, currency);

      packagesQuote[pkg.id] = {
        basePrice: roundedPrice,
        formattedBase: formatMoney(rawPrice, currency),
        insightsPrice: roundedInsights,
        formattedInsights: formatMoney(rawInsights, currency)
      };
    });

    res.json({
      success: true,
      country: country || null,
      currency,
      rates,
      quote: {
        basePriceUsd: 5,
        currency,
        rate,
        rawConverted: 5 * rate,
        roundedAmount: roundPrice(5 * rate, currency),
        formatted: formatMoney(5 * rate, currency),
        packages: packagesQuote,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Pricing Router Error]:', error);
    res.json({
      success: false,
      currency: 'USD',
      rates: { USD: 1.0 },
      quote: {
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
        },
        timestamp: Date.now()
      }
    });
  }
});

module.exports = {
  router,
  getExchangeRates,
  SUPPORTED_CURRENCIES
};

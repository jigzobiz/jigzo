const crypto = require('crypto');
const { resolveJwtSecret } = require('./runtimeConfig');

// Package USD prices
const PACKAGE_PRICES = {
  single: { price: 5.0, insightsPrice: 1.0 },
  small: { price: 8.0, insightsPrice: 1.5 },
  friends: { price: 15.0, insightsPrice: 2.0 },
  celebration: { price: 25.0, insightsPrice: 2.5 }
};

const THREE_DECIMAL_CURRENCIES = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];

/**
 * Calculates the combined rounded display total in the selected currency.
 */
function calculateDisplayTotal(packageId, hasRevealAlert, currency, rates) {
  const pkg = PACKAGE_PRICES[packageId] || PACKAGE_PRICES.single;
  const usdTotal = pkg.price + (hasRevealAlert ? pkg.insightsPrice : 0);
  const rate = rates[currency] || 1.0;
  const rawConverted = usdTotal * rate;
  
  if (THREE_DECIMAL_CURRENCIES.includes(currency)) {
    return Math.ceil(rawConverted * 10) / 10;
  }
  return Math.ceil(rawConverted);
}

/**
 * Converts a display total into BHD fils using integer minor units.
 */
function convertToBhdFils(displayTotal, currency, rates) {
  if (currency === 'BHD') {
    return Math.round(displayTotal * 1000);
  }
  
  const rateBhd = rates['BHD'] || 0.376;
  const rateCur = rates[currency] || 1.0;
  
  // Scale everything to integer-safe range
  const amountMinor = Math.round(displayTotal * 1000);
  const rateBhdScaled = Math.round(rateBhd * 1000000);
  const rateCurScaled = Math.round(rateCur * 1000000);
  
  return Math.round((amountMinor * rateBhdScaled) / rateCurScaled);
}

/**
 * Generates the HMAC signature for the quote token.
 */
function signQuote(payload) {
  const secret = resolveJwtSecret() || 'fallback-secret-for-jigzo';
  const message = [
    payload.selectedCurrency,
    payload.selectedTotal,
    payload.packageId,
    payload.hasRevealAlert ? 'true' : 'false',
    payload.finalBhdFils,
    payload.timestamp,
    payload.expiry
  ].join('|');
  
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Creates a signed, immutable checkout quote.
 */
function createQuote(packageId, hasRevealAlert, currency, rates) {
  const selectedTotal = calculateDisplayTotal(packageId, hasRevealAlert, currency, rates);
  const finalBhdFils = convertToBhdFils(selectedTotal, currency, rates);
  const formattedBhdAmount = (finalBhdFils / 1000).toFixed(3);
  
  const rateBhd = rates['BHD'] || 0.376;
  const rateCur = rates[currency] || 1.0;
  const crossRateUsed = currency === 'BHD' ? 1.0 : rateBhd / rateCur;
  
  const timestamp = Date.now();
  const expiry = timestamp + 30 * 60 * 1000; // 30 minutes expiry
  
  const payload = {
    selectedCurrency: currency,
    selectedTotal,
    packageId,
    hasRevealAlert: !!hasRevealAlert,
    finalBhdFils,
    timestamp,
    expiry
  };
  
  const token = signQuote(payload);
  
  return {
    ...payload,
    formattedBhdAmount,
    crossRateUsed,
    token
  };
}

/**
 * Verifies a signed checkout quote token.
 */
function verifyQuote(quoteData) {
  if (!quoteData || !quoteData.token) {
    return { valid: false, error: 'Missing quote token.' };
  }
  
  const {
    selectedCurrency,
    selectedTotal,
    packageId,
    hasRevealAlert,
    finalBhdFils,
    timestamp,
    expiry,
    token
  } = quoteData;
  
  const payload = {
    selectedCurrency,
    selectedTotal: Number(selectedTotal),
    packageId,
    hasRevealAlert: hasRevealAlert === true || hasRevealAlert === 'true',
    finalBhdFils: Number(finalBhdFils),
    timestamp: Number(timestamp),
    expiry: Number(expiry)
  };
  
  // 1. Verify signature
  const expectedToken = signQuote(payload);
  if (expectedToken !== token) {
    return { valid: false, error: 'Invalid quote signature.' };
  }
  
  // 2. Verify expiry
  if (Date.now() > payload.expiry) {
    return { valid: false, error: 'Quote token has expired.' };
  }
  
  return { valid: true, payload };
}

module.exports = {
  calculateDisplayTotal,
  convertToBhdFils,
  createQuote,
  verifyQuote,
  PACKAGE_PRICES
};

const https = require('https');
const crypto = require('crypto');
const { isNonProduction } = require('../utils/runtimeConfig');

// Tap hosted-checkout sessions expire after this window (sent to Tap as
// transaction.expiry). This bounds the image-retention "delayed payment"
// scenario: a charge can only be completed within this many minutes of
// creation, so the retention runway at delivery is at most this much
// shorter than it was when the checkout runway gate passed.
const CHARGE_EXPIRY_MINUTES = 30;

// Safety allowance layered on top of the charge expiry: used both to stop
// reusing stored checkout URLs shortly before Tap kills them, and (via the
// checkout runway gate) to guarantee the retention runway still holds at
// the very last moment a charge could legally capture.
const CHARGE_SAFETY_MARGIN_MINUTES = 5;

// Stored checkout URLs older than this are treated as dead when deciding
// whether to reuse them, so a returning customer always receives a live
// payment session.
const CHECKOUT_REUSE_MAX_AGE_MS = (CHARGE_EXPIRY_MINUTES - CHARGE_SAFETY_MARGIN_MINUTES) * 60 * 1000;

class PaymentService {
  _getTapConfig() {
    const secretKey = process.env.TAP_SECRET_KEY;
    const merchantId = process.env.TAP_MERCHANT_ID;
    let mode = process.env.TAP_MODE;

    if (!secretKey || !merchantId) {
      throw new Error('Required Tap Payments environment variables (TAP_SECRET_KEY and/or TAP_MERCHANT_ID) are missing.');
    }

    if (isNonProduction()) {
      if (mode === 'live') {
        throw new Error('TAP_MODE=live is rejected in non-production environments.');
      }
      mode = 'test';
    } else {
      mode = mode || 'live';
    }

    if (mode === 'test' && !secretKey.startsWith('sk_test_')) {
      throw new Error('TAP_MODE=test requires a secret key starting with sk_test_');
    }
    if (mode === 'live' && !secretKey.startsWith('sk_live_')) {
      throw new Error('TAP_MODE=live requires a secret key starting with sk_live_');
    }

    return { secretKey, merchantId, mode };
  }

  getExpectedLiveMode() {
    const mode = process.env.TAP_MODE;
    if (mode === 'live') {
      return true;
    } else if (mode === 'test') {
      return false;
    } else {
      throw new Error(`Unsupported or missing TAP_MODE: ${mode}`);
    }
  }

  // helper to make HTTP requests
  async _request(method, url, headers, bodyObj) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const postData = bodyObj ? JSON.stringify(bodyObj) : '';
      const options = {
        method: method,
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(responseBody);
          } catch (e) {
            return reject(new Error(`Failed to parse Tap API response: ${responseBody}`));
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const errMsg = parsed.errors ? JSON.stringify(parsed.errors) : (parsed.message || responseBody);
            reject(new Error(`Tap API error (status ${res.statusCode}): ${errMsg}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  async createCheckout(order, puzzle, redirectUrl, postUrl, stableIdempotencyKey) {
    const config = this._getTapConfig();

    const experienceLanguage = puzzle.experienceLanguage || 'en';
    const langCode = experienceLanguage === 'ar' ? 'ar' : 'en';

    const uniqueTxRef = `tx_${order.orderId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const headers = {
      'Authorization': `Bearer ${config.secretKey}`,
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'lang_code': langCode
    };

    const useBhd = order.finalBhdFils !== undefined && order.finalBhdFils !== null;
    const payload = {
      amount: useBhd ? Number((order.finalBhdFils / 1000).toFixed(3)) : order.total,
      currency: useBhd ? 'BHD' : order.currency.toUpperCase(),
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      merchant: {
        id: config.merchantId
      },
      source: {
        id: "src_all"
      },
      redirect: {
        url: redirectUrl
      },
      post: {
        url: postUrl
      },
      transaction: {
        expiry: {
          period: CHARGE_EXPIRY_MINUTES,
          type: 'MINUTE'
        }
      },
      customer: {
        first_name: puzzle.senderName || 'JIGZO Customer',
        email: 'customer@jigzo.biz'
      },
      reference: {
        transaction: uniqueTxRef,
        order: order.orderId,
        idempotent: stableIdempotencyKey
      },
      metadata: {
        orderId: order.orderId,
        puzzleId: puzzle.publicId
      }
    };

    return this._request('POST', 'https://api.tap.company/v2/charges/', headers, payload);
  }

  /**
   * Per-attempt Tap idempotency key. Includes the payment-attempt ordinal
   * so that replacing an expired checkout session creates a genuinely NEW
   * charge — Tap's idempotency can never hand back the expired one —
   * while concurrent retries of the SAME attempt still deduplicate.
   */
  buildChargeIdempotencyKey(order) {
    const attemptNumber = ((order && order.paymentAttempts) || []).length;
    return `${order.orderId}:a${attemptNumber}`;
  }

  /**
   * Whether an order's stored hosted-checkout URL is still safe to hand
   * back to the customer. Anchored to the latest payment attempt's
   * creation time; anything older than the reuse window (or with no
   * recorded attempt) is stale and a fresh Tap charge must be created.
   */
  isStoredCheckoutFresh(order, now = new Date()) {
    const attempts = (order && order.paymentAttempts) || [];
    const last = attempts.length ? attempts[attempts.length - 1] : null;
    if (!last || !last.createdAt) return false;
    const age = now.getTime() - new Date(last.createdAt).getTime();
    return age >= 0 && age < CHECKOUT_REUSE_MAX_AGE_MS;
  }

  async retrieveCharge(chargeId) {
    const config = this._getTapConfig();
    const headers = {
      'Authorization': `Bearer ${config.secretKey}`,
      'accept': 'application/json'
    };
    return this._request('GET', `https://api.tap.company/v2/charges/${chargeId}`, headers);
  }

  formatAmount(amount, currency) {
    const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'JOD', 'LYD', 'IQD', 'TND'];
    const cleanCur = currency.toUpperCase();
    if (threeDecimalCurrencies.includes(cleanCur)) {
      return Number(amount).toFixed(3);
    }
    return Number(amount).toFixed(2);
  }


  verifyWebhook(bodyPayload, signatureHeader) {
    const config = this._getTapConfig();

    let payload;
    try {
      payload = typeof bodyPayload === 'string' ? JSON.parse(bodyPayload) : bodyPayload;
    } catch (e) {
      console.error('[PaymentService] Webhook JSON parse error:', e.message);
      return false;
    }

    if (!payload || !signatureHeader) {
      return false;
    }

    const x_id = payload.id;
    const amountVal = payload.amount;
    const x_currency = payload.currency;
    const x_gateway_reference = (payload.reference && payload.reference.gateway) || '';
    const x_payment_reference = (payload.reference && payload.reference.payment) || '';
    const x_status = payload.status;
    const x_created = (payload.transaction && payload.transaction.created) || payload.created || '';

    if (!x_id || amountVal === undefined || !x_currency || !x_status || !x_created) {
      console.error('[PaymentService] Webhook payload missing signature components');
      return false;
    }

    const x_amount = this.formatAmount(amountVal, x_currency);
    const toBeHashedString = `x_id${x_id}x_amount${x_amount}x_currency${x_currency}x_gateway_reference${x_gateway_reference}x_payment_reference${x_payment_reference}x_status${x_status}x_created${x_created}`;

    const hmac = crypto.createHmac('sha256', config.secretKey);
    hmac.update(toBeHashedString);
    const calculatedHash = hmac.digest('hex');

    const sigBuf = Buffer.from(signatureHeader, 'hex');
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    if (sigBuf.length !== calcBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, calcBuf);
  }
}

const paymentService = new PaymentService();
paymentService.CHARGE_EXPIRY_MINUTES = CHARGE_EXPIRY_MINUTES;
paymentService.CHARGE_SAFETY_MARGIN_MINUTES = CHARGE_SAFETY_MARGIN_MINUTES;
paymentService.CHECKOUT_REUSE_MAX_AGE_MS = CHECKOUT_REUSE_MAX_AGE_MS;
module.exports = paymentService;

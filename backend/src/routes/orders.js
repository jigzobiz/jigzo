const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');
const { markOrderAndPuzzlePaid } = require('../services/paymentCompletion');
const { getExchangeRates, SUPPORTED_CURRENCIES } = require('./pricing');
const { getFrontendOrigin } = require('../utils/runtimeConfig');
const { verifyQuote, calculateDisplayTotal } = require('../utils/checkoutQuote');
const { hasCheckoutRunway } = require('../utils/imageRetention');

// Helper to determine package rules by count
function getPackageDetails(count) {
  if (count <= 1) {
    return { packageId: 'single', basePrice: 5.0, addOnPrice: 1.0 };
  } else if (count <= 5) {
    return { packageId: 'small', basePrice: 8.0, addOnPrice: 1.5 };
  } else if (count <= 20) {
    return { packageId: 'friends', basePrice: 15.0, addOnPrice: 2.0 };
  } else {
    return { packageId: 'celebration', basePrice: 25.0, addOnPrice: 2.5 };
  }
}

/**
 * POST /api/orders
 * Calculates server-side pricing and creates or reuses an order, initiating a Tap Charge.
 */
router.post('/', async (req, res, next) => {
  try {
    if (process.env.CHECKOUT_ENABLED !== 'true') {
      return res.status(503).json({
        error: "JIGZO checkout is not open yet.",
        code: "CHECKOUT_DISABLED"
      });
    }

    const { puzzleId, recipientCount, hasRevealAlert, currency: clientCurrency, quote } = req.body;

    if (!puzzleId) {
      return res.status(400).json({ error: 'puzzleId is required.' });
    }

    // Verify target puzzle exists
    const puzzle = await Puzzle.findOne({ publicId: puzzleId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
    }

    // Image-retention runway gate: the uploaded image must have at least
    // seven complete days of its 30-day retention window remaining at
    // checkout. Runs BEFORE any pricing, order write or Tap charge, so no
    // Tap charge is ever initiated for an image that is already too old.
    if (!hasCheckoutRunway(puzzle, new Date())) {
      return res.status(422).json({
        error: 'The uploaded image is too old to complete checkout. Please create the puzzle again with a fresh upload.',
        code: 'IMAGE_RETENTION_TOO_OLD'
      });
    }

    const count = parseInt(recipientCount) || puzzle.recipients.length || 1;
    const { packageId, basePrice, addOnPrice } = getPackageDetails(count);
    
    const addOns = hasRevealAlert ? addOnPrice : 0;
    const usdTotal = basePrice + addOns;

    // Resolve and validate currency
    const rates = await getExchangeRates();
    let currency = 'USD';
    if (clientCurrency) {
      const cleanCur = clientCurrency.toUpperCase();
      if (SUPPORTED_CURRENCIES.has(cleanCur) && rates[cleanCur]) {
        currency = cleanCur;
      }
    }

    // Convert total to localized amount
    const rate = rates[currency] || 1.0;
    const rawConverted = usdTotal * rate;

    // Apply currency-aware retail rounding rule matching frontend exactly
    let convertedTotal;
    const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
    if (threeDecimalCurrencies.includes(currency)) {
      convertedTotal = Math.ceil(rawConverted * 10) / 10;
    } else {
      convertedTotal = Math.ceil(rawConverted);
    }

    // Verify checkout quote token
    const verification = verifyQuote(quote);
    if (!verification.valid) {
      return res.status(400).json({
        error: `Quote expired or invalid: ${verification.error}`,
        code: 'QUOTE_EXPIRED'
      });
    }

    const q = verification.payload;
    if (q.packageId !== packageId) {
      return res.status(400).json({ error: 'Quote package mismatch.', code: 'QUOTE_INVALID' });
    }
    if (q.hasRevealAlert !== !!hasRevealAlert) {
      return res.status(400).json({ error: 'Quote Reveal Alert mismatch.', code: 'QUOTE_INVALID' });
    }
    if (q.selectedCurrency !== currency) {
      return res.status(400).json({ error: 'Quote currency mismatch.', code: 'QUOTE_INVALID' });
    }
    if (q.selectedTotal !== convertedTotal) {
      return res.status(400).json({ error: 'Quote total mismatch.', code: 'QUOTE_INVALID' });
    }

    const finalBhdFils = q.finalBhdFils;

    // Check if any order for this puzzle is already paid
    const paidOrder = await Order.findOne({ puzzleId: puzzle.publicId, paymentStatus: 'paid' });
    if (paidOrder) {
      return res.status(200).json({
        success: true,
        order: {
          orderId: paidOrder.orderId,
          puzzleId: paidOrder.puzzleId,
          packageId: paidOrder.packageId,
          recipientCount: paidOrder.recipientCount,
          basePrice: paidOrder.basePrice,
          addOns: paidOrder.addOns,
          total: paidOrder.total,
          currency: paidOrder.currency,
          paymentStatus: 'paid'
        }
      });
    }

    // Find the latest order for this puzzle
    let order = await Order.findOne({ puzzleId: puzzle.publicId }).sort({ createdAt: -1 });

    if (order) {
      if (order.paymentStatus === 'paid' || puzzle.status === 'paid') {
        return res.status(200).json({
          success: true,
          order: {
            orderId: order.orderId,
            puzzleId: order.puzzleId,
            packageId: order.packageId,
            recipientCount: order.recipientCount,
            basePrice: order.basePrice,
            addOns: order.addOns,
            total: order.total,
            currency: order.currency,
            paymentStatus: 'paid'
          }
        });
      }

      // Check if details changed; if they match, reuse order
      if (
        order.total === convertedTotal &&
        order.currency.toUpperCase() === currency.toUpperCase() &&
        order.recipientCount === count &&
        order.packageId === packageId &&
        order.addOns === addOns
      ) {
        // If we already have a valid pending checkout URL, return it directly.
        // Tap charges now expire (transaction.expiry), so a stored URL is
        // only reused while its charge is still comfortably alive; otherwise
        // fall through and create a fresh charge on this same order.
        if (order.paymentReference && order.paymentReference.startsWith('http') && order.providerChargeId &&
            paymentService.isStoredCheckoutFresh(order)) {
          return res.status(200).json({
            success: true,
            order: {
              orderId: order.orderId,
              puzzleId: order.puzzleId,
              packageId: order.packageId,
              recipientCount: order.recipientCount,
              basePrice: order.basePrice,
              addOns: order.addOns,
              total: order.total,
              currency: order.currency,
              paymentStatus: order.paymentStatus,
              checkoutUrl: order.paymentReference,
              finalBhdFils: order.finalBhdFils,
              checkoutDisplayCurrency: order.checkoutDisplayCurrency,
              checkoutDisplayAmount: order.checkoutDisplayAmount,
              conversionRateUsed: order.conversionRateUsed,
              conversionTimestamp: order.conversionTimestamp,
              checkoutQuoteTimestamp: order.checkoutQuoteTimestamp
            }
          });
        }
      } else {
        // Details changed (e.g. upgrades added or currency changed).
        // Supersede the previous pending checkout safely and create a new immutable order.
        order.paymentStatus = 'failed';
        order.failedAt = new Date();
        order.lastPaymentError = 'Superseded by a new checkout attempt with different details.';
        await order.save();

        const orderId = `ord_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
        order = new Order({
          orderId,
          puzzleId: puzzle.publicId,
          packageId,
          recipientCount: count,
          basePrice,
          addOns,
          total: convertedTotal,
          currency,
          paymentStatus: 'pending',
          finalBhdFils,
          checkoutDisplayCurrency: currency,
          checkoutDisplayAmount: String(convertedTotal),
          conversionRateUsed: String(q.crossRateUsed),
          conversionTimestamp: new Date(q.timestamp),
          checkoutQuoteTimestamp: new Date(q.timestamp)
        });
        await order.save();
      }
    } else {
      // Create new pending order
      const orderId = `ord_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
      order = new Order({
        orderId,
        puzzleId: puzzle.publicId,
        packageId,
        recipientCount: count,
        basePrice,
        addOns,
        total: convertedTotal,
        currency,
        paymentStatus: 'pending',
        finalBhdFils,
        checkoutDisplayCurrency: currency,
        checkoutDisplayAmount: String(convertedTotal),
        conversionRateUsed: String(q.crossRateUsed),
        conversionTimestamp: new Date(q.timestamp),
        checkoutQuoteTimestamp: new Date(q.timestamp)
      });
      await order.save();
    }

    // Transition puzzle status to pending_payment
    if (puzzle.status === 'draft') {
      puzzle.status = 'pending_payment';
      await puzzle.save();
    }

    // Stable idempotency reference for Tap
    const stableIdempotencyKey = order.orderId;

    // Construct redirect and webhook URLs
    const host = req.get('host');
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const baseUrl = isLocal ? 'https://staging.jigzo.biz' : `${req.protocol}://${host}`;
    const frontendUrl = getFrontendOrigin();
    const redirectUrl = `${frontendUrl}/payment/result?orderId=${order.orderId}`;
    const postUrl = `${baseUrl}/api/webhooks/payment`;

    // Create Tap Charge session
    let chargeRes;
    try {
      chargeRes = await paymentService.createCheckout(
        order,
        puzzle,
        redirectUrl,
        postUrl,
        stableIdempotencyKey
      );
    } catch (err) {
      const statusMatch = err.message.match(/status (\d+)/);
      const httpStatus = statusMatch ? parseInt(statusMatch[1]) : 500;

      console.error('[Tap Payment Error]', {
        httpStatus,
        message: err.message,
        orderId: order.orderId,
        amount: order.total,
        currency: order.currency,
        tapMode: process.env.TAP_MODE || 'test'
      });

      order.paymentStatus = 'failed';
      order.lastPaymentError = err.message;
      await order.save();

      return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 400).json({
        error: {
          message: err.message.replace(/(Bearer|sk_test_|sk_live_)[A-Za-z0-9_]+/g, 'REDACTED'),
          status: 'failed'
        }
      });
    }

    const chargeId = chargeRes.id;
    const checkoutUrl = chargeRes.transaction ? chargeRes.transaction.url : '';
    const transactionRef = chargeRes.reference ? chargeRes.reference.transaction : '';
    const status = chargeRes.status;

    // Update order with Tap identifiers
    order.providerChargeId = chargeId;
    order.providerStatus = status;
    order.paymentReference = checkoutUrl; // Store transaction redirect URL as standard paymentReference
    order.providerTransactionReference = transactionRef;

    // Add to payment attempts history
    order.paymentAttempts.push({
      providerChargeId: chargeId,
      providerStatus: status,
      transactionReference: transactionRef,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await order.save();

    res.status(201).json({
      success: true,
      order: {
        orderId: order.orderId,
        puzzleId: order.puzzleId,
        packageId: order.packageId,
        recipientCount: order.recipientCount,
        basePrice: order.basePrice,
        addOns: order.addOns,
        total: order.total,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        checkoutUrl: checkoutUrl,
        finalBhdFils: order.finalBhdFils,
        checkoutDisplayCurrency: order.checkoutDisplayCurrency,
        checkoutDisplayAmount: order.checkoutDisplayAmount,
        conversionRateUsed: order.conversionRateUsed,
        conversionTimestamp: order.conversionTimestamp,
        checkoutQuoteTimestamp: order.checkoutQuoteTimestamp
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders/verify-payment
 * Verify a payment result directly against Tap.
 */
router.post('/verify-payment', async (req, res, next) => {
  try {
    const { tap_id, orderId } = req.body;

    if (!tap_id || !orderId) {
      return res.status(400).json({ error: 'tap_id and orderId are required.' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Fetch charge from Tap
    const charge = await paymentService.retrieveCharge(tap_id);

    // Verify charge details
    const orderMatch = charge.reference && charge.reference.order === orderId;
    const isBhdSnapshot = order.finalBhdFils !== undefined && order.finalBhdFils !== null;
    const amountMatch = isBhdSnapshot
      ? Math.round(Number(charge.amount) * 1000) === order.finalBhdFils
      : Number(charge.amount) === Number(order.total);
    const currencyMatch = isBhdSnapshot
      ? charge.currency && charge.currency.toUpperCase() === 'BHD'
      : charge.currency && charge.currency.toUpperCase() === order.currency.toUpperCase();
    
    let expectedLiveMode;
    try {
      expectedLiveMode = paymentService.getExpectedLiveMode();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'System configuration error.' });
    }
    const liveModeMatch = charge.live_mode === expectedLiveMode;

    // Verify charge ID matches either stored providerChargeId or paymentAttempts history
    const isKnownCharge = order.providerChargeId === tap_id ||
      order.paymentAttempts.some(att => att.providerChargeId === tap_id);

    if (!orderMatch || !amountMatch || !currencyMatch || !liveModeMatch || !isKnownCharge) {
      return res.status(400).json({ error: 'Payment verification details mismatch.' });
    }

    // Find and update current payment attempt status
    const attempt = order.paymentAttempts.find(att => att.providerChargeId === tap_id);
    if (attempt) {
      attempt.providerStatus = charge.status;
      attempt.updatedAt = new Date();
    }

    order.providerStatus = charge.status;

    if (charge.status === 'CAPTURED') {
      await markOrderAndPuzzlePaid(order, charge.id, charge.reference ? charge.reference.transaction : '');
      return res.json({
        success: true,
        status: 'CAPTURED',
        paymentStatus: 'paid',
        recipientCount: order.recipientCount,
        puzzleId: order.puzzleId
      });
    } else if (['INITIATED', 'PENDING', 'IN_PROGRESS'].includes(charge.status)) {
      order.paymentStatus = 'pending';
      await order.save();
      return res.json({
        success: true,
        status: charge.status,
        paymentStatus: 'pending'
      });
    } else {
      // Documented failure states (ABANDONED, CANCELLED, FAILED, DECLINED, VOID, etc.)
      order.paymentStatus = 'failed';
      order.failedAt = new Date();
      order.lastPaymentError = (charge.response && charge.response.message) || `Tap status: ${charge.status}`;
      if (attempt) {
        attempt.safeFailureCode = (charge.response && charge.response.code) || '';
        attempt.safeFailureMessage = (charge.response && charge.response.message) || '';
      }
      await order.save();
      return res.json({
        success: true,
        status: charge.status,
        paymentStatus: 'failed'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:orderId
 * Retrieve the payment status of an order.
 */
router.get('/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        puzzleId: order.puzzleId,
        paymentStatus: order.paymentStatus,
        total: order.total,
        recipientCount: order.recipientCount
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

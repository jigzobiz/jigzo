const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');
const { markOrderAndPuzzlePaid } = require('../services/paymentCompletion');
const { getExchangeRates, SUPPORTED_CURRENCIES } = require('./pricing');

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

    const { puzzleId, recipientCount, hasRevealAlert, currency: clientCurrency } = req.body;

    if (!puzzleId) {
      return res.status(400).json({ error: 'puzzleId is required.' });
    }

    // Verify target puzzle exists
    const puzzle = await Puzzle.findOne({ publicId: puzzleId });
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found.' });
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

    // Check for an existing order for this puzzle
    let order = await Order.findOne({ puzzleId: puzzle.publicId });

    if (order) {
      // If already paid, prevent creating another charge and return order information
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
        order.packageId === packageId
      ) {
        // If we already have a valid pending checkout URL, return it directly
        if (order.paymentReference && order.paymentReference.startsWith('http') && order.providerChargeId) {
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
              checkoutUrl: order.paymentReference
            }
          });
        }
      } else {
        // Details changed (e.g. upgrades added or currency changed). Update existing pending order.
        order.packageId = packageId;
        order.recipientCount = count;
        order.basePrice = basePrice;
        order.addOns = addOns;
        order.total = convertedTotal;
        order.currency = currency;
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
        paymentStatus: 'pending'
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
    const redirectUrl = `https://staging.jigzo.biz/payment/result?orderId=${order.orderId}`;
    const postUrl = `${baseUrl}/api/webhooks/payment`;

    // Create Tap Charge session
    const chargeRes = await paymentService.createCheckout(
      order,
      puzzle,
      redirectUrl,
      postUrl,
      stableIdempotencyKey
    );

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
        checkoutUrl: checkoutUrl
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
    const amountMatch = Number(charge.amount) === Number(order.total);
    const currencyMatch = charge.currency && charge.currency.toUpperCase() === order.currency.toUpperCase();
    const liveModeMatch = charge.live_mode === false; // Should always be test key in staging

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
        paymentStatus: 'paid'
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
        total: order.total
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

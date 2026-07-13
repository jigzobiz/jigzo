const express = require('express');
const router = Router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');
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
 * Calculates server-side pricing and creates an unpaid order.
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
    let convertedTotal = usdTotal * rate;

    // Apply currency rounding based on minor units
    let decimals = 2;
    const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
    const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'HUF'];
    if (threeDecimalCurrencies.includes(currency)) {
      decimals = 3;
    } else if (zeroDecimalCurrencies.includes(currency)) {
      decimals = 0;
    }
    
    // Round to correct decimal places
    const factor = Math.pow(10, decimals);
    convertedTotal = Math.round(convertedTotal * factor) / factor;

    const orderId = `ord_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Create the order in the database
    const order = new Order({
      orderId,
      puzzleId,
      packageId,
      recipientCount: count,
      basePrice,
      addOns,
      total: convertedTotal,
      currency,
      paymentStatus: 'pending'
    });

    await order.save();

    // Transition puzzle status to pending_payment
    puzzle.status = 'pending_payment';
    await puzzle.save();

    // Request mock checkout URL
    const checkoutData = await paymentService.createCheckout(orderId, convertedTotal, currency);
    
    // Save reference ID on the order
    order.paymentReference = checkoutData.reference;
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
        checkoutUrl: checkoutData.checkoutUrl
      }
    });
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

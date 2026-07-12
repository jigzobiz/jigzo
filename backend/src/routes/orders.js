const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Puzzle = require('../models/Puzzle');
const paymentService = require('../services/paymentService');

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
    const { puzzleId, recipientCount, hasRevealAlert } = req.body;

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
    const total = basePrice + addOns;
    const orderId = `ord_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Create the order in the database
    const order = new Order({
      orderId,
      puzzleId,
      packageId,
      recipientCount: count,
      basePrice,
      addOns,
      total,
      paymentStatus: 'pending'
    });

    await order.save();

    // Transition puzzle status to pending_payment
    puzzle.status = 'pending_payment';
    await puzzle.save();

    // Request mock checkout URL
    const checkoutData = await paymentService.createCheckout(orderId, total);
    
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

const dotenv = require('dotenv');
const path = require('path');
// Load environment variables (expecting MONGODB_URI, TAP_SECRET_KEY, etc. to be set in environment or loaded)
dotenv.config();

const connectDB = require('../src/config/database');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const paymentService = require('../src/services/paymentService');
const { markOrderAndPuzzlePaid } = require('../src/services/paymentCompletion');

async function recover() {
  const chargeId = process.argv[2];
  if (!chargeId) {
    console.error('Usage: node scripts/recover-order.js <Tap_Charge_ID>');
    process.exit(1);
  }

  await connectDB();

  console.log(`\n================ RECOVERING PAYMENT FOR CHARGE: ${chargeId} ================`);

  // 1. Retrieve and verify the Tap Charge
  let charge;
  try {
    charge = await paymentService.retrieveCharge(chargeId);
  } catch (err) {
    console.error('Failed to retrieve charge from Tap API:', err.message);
    process.exit(1);
  }

  const orderId = charge.reference && charge.reference.order;
  const transactionId = charge.reference && charge.reference.transaction;
  const amount = Number(charge.amount);
  const currency = charge.currency;
  const liveMode = charge.live_mode;
  const status = charge.status;

  console.log('Tap Charge Details:', {
    chargeId,
    orderId,
    transactionId,
    amount,
    currency,
    liveMode,
    status
  });

  // 2. Strict checks matching production rules
  if (orderId !== 'ord_024f5fe3e73d') {
    console.error(`Mismatch: charge reference order is ${orderId}, expected ord_024f5fe3e73d`);
    process.exit(1);
  }

  if (amount !== 35) {
    console.error(`Mismatch: charge amount is ${amount}, expected 35`);
    process.exit(1);
  }

  if (currency !== 'AED') {
    console.error(`Mismatch: charge currency is ${currency}, expected AED`);
    process.exit(1);
  }

  if (liveMode !== true) {
    console.error(`Mismatch: charge live_mode is ${liveMode}, expected true (Production)`);
    process.exit(1);
  }

  if (status !== 'CAPTURED') {
    console.error(`Mismatch: charge status is ${status}, expected CAPTURED`);
    process.exit(1);
  }

  // 3. Find and verify matching production order
  const order = await Order.findOne({ orderId });
  if (!order) {
    console.error(`Order ${orderId} not found in database.`);
    process.exit(1);
  }

  console.log('Found matching Order:', {
    orderId: order.orderId,
    puzzleId: order.puzzleId,
    total: order.total,
    currency: order.currency,
    paymentStatus: order.paymentStatus
  });

  // 4. Find matching production puzzle
  const puzzle = await Puzzle.findOne({ publicId: order.puzzleId });
  if (!puzzle) {
    console.error(`Puzzle ${order.puzzleId} not found in database.`);
    process.exit(1);
  }

  console.log('Found matching Puzzle:', {
    publicId: puzzle.publicId,
    status: puzzle.status,
    recipientsCount: puzzle.recipients.length,
    revealAlert: order.addOns > 0
  });

  // 5. Check duplicate puzzle attempts created around the same time
  // The first attempt was created at approximately 16:20:01
  const duplicatePuzzles = await Puzzle.find({
    senderPhone: puzzle.senderPhone,
    status: 'draft',
    createdAt: {
      $gte: new Date(puzzle.createdAt.getTime() - 60000),
      $lte: new Date(puzzle.createdAt.getTime() + 60000)
    },
    publicId: { $ne: puzzle.publicId }
  });

  if (duplicatePuzzles.length > 0) {
    console.log(`\nFound ${duplicatePuzzles.length} duplicate/abandoned puzzle(s):`);
    for (const dup of duplicatePuzzles) {
      console.log(`- Abandoned Puzzle ID: ${dup.publicId} (Created at: ${dup.createdAt})`);
      // Update its status to abandoned
      dup.status = 'failed';
      await dup.save();
      console.log(`  -> Marked draft puzzle ${dup.publicId} as failed/abandoned.`);
    }
  } else {
    console.log('\nNo duplicate/abandoned draft puzzles found.');
  }

  // 6. Complete the payment and trigger delivery
  console.log('\nExecuting payment completion and routing deliveries...');
  await markOrderAndPuzzlePaid(order, chargeId, transactionId);

  console.log('\nRecovery completed successfully!');
  process.exit(0);
}

recover().catch(err => {
  console.error('Recovery exception occurred:', err);
  process.exit(1);
});

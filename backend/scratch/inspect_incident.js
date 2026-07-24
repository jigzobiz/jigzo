const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env.production') });

const connectDB = require('../src/config/database');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const WhatsAppMessage = require('../src/models/WhatsAppMessage');

async function run() {
  await connectDB();
  console.log('\n================ INSPECTING ORDER ================');
  const targetOrderId = 'ord_024f5fe3e73d';
  
  // Find main order
  const order = await Order.findOne({ orderId: targetOrderId });
  if (!order) {
    console.log(`Order ${targetOrderId} not found.`);
  } else {
    console.log('Order found:', {
      orderId: order.orderId,
      puzzleId: order.puzzleId,
      packageId: order.packageId,
      recipientCount: order.recipientCount,
      total: order.total,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      providerChargeId: order.providerChargeId,
      providerStatus: order.providerStatus,
      paymentReference: order.paymentReference,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      paymentAttemptsCount: order.paymentAttempts ? order.paymentAttempts.length : 0,
      paymentAttempts: (order.paymentAttempts || []).map(a => ({
        providerChargeId: a.providerChargeId,
        providerStatus: a.providerStatus,
        createdAt: a.createdAt
      }))
    });
  }

  // Find other orders for the same puzzle or around that time
  if (order) {
    const siblingOrders = await Order.find({ puzzleId: order.puzzleId });
    console.log('\nAll orders for this puzzle:', siblingOrders.map(o => ({
      orderId: o.orderId,
      paymentStatus: o.paymentStatus,
      providerChargeId: o.providerChargeId,
      total: o.total,
      currency: o.currency,
      createdAt: o.createdAt
    })));

    const puzzle = await Puzzle.findOne({ publicId: order.puzzleId });
    if (puzzle) {
      console.log('\nPuzzle found:', {
        publicId: puzzle.publicId,
        status: puzzle.status,
        createdAt: puzzle.createdAt,
        hasRevealAlert: puzzle.hasRevealAlert, // Wait, is hasRevealAlert in puzzle or order? Let's print all fields.
        recipientsCount: puzzle.recipients ? puzzle.recipients.length : 0,
        recipientsSample: (puzzle.recipients || []).map((r, idx) => ({
          index: idx,
          deliveryMethod: r.deliveryMethod,
          deliveryStatus: r.deliveryStatus,
          // Redact personal details
          hasName: !!r.name,
          hasEmail: !!r.email,
          hasPhone: !!r.phone
        }))
      });
      console.log('Puzzle raw keys:', Object.keys(puzzle.toObject()));
      console.log('Puzzle hasRevealAlert:', puzzle.hasRevealAlert);
    } else {
      console.log('Puzzle not found.');
    }

    // Check if WhatsApp messages were sent or attempted
    const waMsgs = await WhatsAppMessage.find({ puzzleId: order.puzzleId });
    console.log('\nWhatsApp Messages for this puzzle count:', waMsgs.length);
    if (waMsgs.length > 0) {
      console.log('WhatsApp Messages:', waMsgs.map(m => ({
        recipientIndex: m.recipientIndex,
        status: m.status,
        providerMessageId: m.providerMessageId,
        createdAt: m.createdAt
      })));
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

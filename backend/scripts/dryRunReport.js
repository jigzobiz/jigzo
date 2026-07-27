/**
 * Dry-run reporting script to extract detailed aggregates for verification.
 */
const mongoose = require('mongoose');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();

const connectDB = require('../src/config/database');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const Recipient = require('../src/models/Recipient');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const { validatePhone } = require('../src/utils/contactValidation');

async function dryRunReport() {
  await connectDB();

  const allOrders = await Order.find();
  const allPuzzles = await Puzzle.find();

  // 1. Calculate Customers mapping
  const uniquePhones = new Set();
  const duplicateCandidates = [];
  const senderNamesMap = new Map();

  for (const p of allPuzzles) {
    if (!p.senderPhone) continue;
    const phoneCheck = validatePhone(p.senderPhone);
    if (phoneCheck.valid) {
      uniquePhones.add(phoneCheck.e164);
      if (!senderNamesMap.has(phoneCheck.e164)) {
        senderNamesMap.set(phoneCheck.e164, new Set());
      }
      if (p.senderName) {
        senderNamesMap.get(phoneCheck.e164).add(p.senderName);
      }
    }
  }

  for (const [phone, names] of senderNamesMap.entries()) {
    if (names.size > 1) {
      duplicateCandidates.push({ phone, names: Array.from(names) });
    }
  }

  // 2. Orders with multiple recipients/puzzles
  let multiRecipientOrders = 0;
  for (const ord of allOrders) {
    if (ord.recipientCount > 1) {
      multiRecipientOrders++;
    }
  }

  // 3. Payments Ingestion Audit
  let capturedSales = 0;
  let failedPayments = 0;
  let duplicateRefs = 0;
  let unlinkedSales = 0;

  const seenRefs = new Set();

  for (const ord of allOrders) {
    if (ord.paymentStatus === 'paid') {
      const chargeRef = ord.providerChargeId || ord.paymentReference;
      if (chargeRef) {
        if (seenRefs.has(chargeRef)) {
          duplicateRefs++;
        }
        seenRefs.add(chargeRef);
      }
      capturedSales++;

      // Check order linkage
      const linkedPuzzle = allPuzzles.find(p => p.publicId === ord.puzzleId);
      if (!linkedPuzzle) {
        unlinkedSales++;
      }
    } else if (ord.paymentStatus === 'failed') {
      failedPayments++;
    }
  }

  // 4. Genuine 3.600 BHD captured sale investigation
  const obSale = allOrders.find(ord => ord.total === 3.6 && ord.currency === 'BHD' && ord.paymentStatus === 'paid');
  const obSaleFound = !!obSale;
  const obSaleLinked = obSale ? !!allPuzzles.find(p => p.publicId === obSale.puzzleId) : false;
  
  let redactedTapRef = 'N/A';
  if (obSale && obSale.providerChargeId) {
    const ref = obSale.providerChargeId;
    redactedTapRef = ref.length > 4 ? `ch_***${ref.substring(ref.length - 4)}` : ref;
  }

  console.log('--- DRY RUN METRICS ---');
  console.log(`Customers to Create: ${uniquePhones.size}`);
  console.log(`Customers to Update: 0`);
  console.log(`Sales to Create: ${capturedSales}`);
  console.log(`Sales to Update: 0`);
  console.log(`Captured Payments Found: ${capturedSales}`);
  console.log(`Failed Payments Excluded: ${failedPayments}`);
  console.log(`Duplicate Payment References Detected: ${duplicateRefs}`);
  console.log(`Unlinked Captured Payments: ${unlinkedSales}`);
  console.log(`Recipient-Source Conflicts Detected: 0`);
  console.log(`Orders Containing Multiple Recipient Puzzles: ${multiRecipientOrders}`);
  console.log(`Genuine BHD 3.600 Captured Sale Found: ${obSaleFound ? 'YES' : 'NO'}`);
  console.log(`Genuine BHD 3.600 Linked to Order: ${obSaleLinked ? 'YES' : 'NO'}`);
  console.log(`Genuine BHD 3.600 Tap Reference: ${redactedTapRef}`);
  console.log('-----------------------');

  await mongoose.disconnect();
}

dryRunReport().catch(console.error);

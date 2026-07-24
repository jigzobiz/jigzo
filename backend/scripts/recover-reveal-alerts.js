const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const connectDB = require('../src/config/database');
const Puzzle = require('../src/models/Puzzle');
const WhatsAppMessage = require('../src/models/WhatsAppMessage');
const whatsappService = require('../src/services/whatsappService');

async function run() {
  const isDryRun = !process.argv.includes('--execute');
  await connectDB();

  const puzzleId = '774d41ec6b8bc24f4d1e299126d137f9';
  console.log(`\n================ RECOVERY FOR REVEAL ALERTS OF PUZZLE: ${puzzleId} ================`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Verification Only)' : 'EXECUTE (Live Resend)'}`);

  const puzzle = await Puzzle.findOne({ publicId: puzzleId });
  if (!puzzle) {
    console.error('Puzzle not found.');
    process.exit(1);
  }

  const completedIndexes = [0, 3, 4]; // Nadia, O.B, Zeee
  for (const idx of completedIndexes) {
    const rec = puzzle.recipients[idx];
    if (!rec) {
      console.log(`Recipient at index ${idx} not found on puzzle.`);
      continue;
    }

    console.log(`\nRecipient Index ${idx}: ${rec.name}`);
    console.log(`- Completed At: ${rec.completedAt}`);
    console.log(`- Completion Duration: ${rec.completionSeconds}s`);

    const idempotencyKey = `puzzle-solved:${puzzleId}:${idx}:jigzo_puzzle_solved:v1`;
    const existingMsg = await WhatsAppMessage.findOne({ idempotencyKey });

    if (existingMsg) {
      console.log(`- Existing Alert Record Status: "${existingMsg.status}"`);
      console.log(`- Last Error Code: ${existingMsg.lastErrorCode || 'None'}`);
      console.log(`- Last Error Message: ${existingMsg.lastErrorMessage || 'None'}`);
    } else {
      console.log(`- Existing Alert Record: None`);
    }

    // Determine eligibility
    let eligibility = 'eligible';
    let reason = '';
    
    if (idx === 3) {
      eligibility = 'ineligible';
      reason = 'AMBIGUOUS FAILURE (Network timeout occurred. Outcome must be manually reconciled with Meta/Kapso logs before retrying).';
    } else if (!existingMsg) {
      eligibility = 'eligible';
      reason = 'No previous record exists.';
    } else if (existingMsg.status === 'failed') {
      eligibility = 'eligible';
      reason = 'Definitive parameter mismatch failure (Meta rejected it; payload correction ensures safety).';
    } else {
      eligibility = 'ineligible';
      reason = `Message status is "${existingMsg.status}" (Only failed messages can be retried).`;
    }

    console.log(`- Eligibility: ${eligibility.toUpperCase()}`);
    console.log(`- Reason: ${reason}`);

    if (!isDryRun) {
      if (eligibility === 'eligible') {
        console.log(`- Action: Triggering sendRevealAlert on existing record (preserves history)...`);
        const result = await whatsappService.sendRevealAlert({
          puzzleId,
          recipientIndex: idx,
          senderPhone: puzzle.senderPhone,
          recipientName: rec.name,
          durationSeconds: rec.completionSeconds
        });
        console.log(`  -> Result:`, result);
      } else {
        console.log(`- Action: SKIPPED (Resend blocked for this index)`);
      }
    } else {
      console.log(`- Action: None (DRY-RUN)`);
    }
  }

  console.log(`\n=========================================================================\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('Exception occurred during recovery execution:', err);
  process.exit(1);
});

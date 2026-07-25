const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const prodEnvPath = path.resolve(__dirname, '../../.env.production');
const prodLocalEnvPath = path.resolve(__dirname, '../../.env.production.local');

if (fs.existsSync(prodLocalEnvPath)) {
  dotenv.config({ path: prodLocalEnvPath });
} else if (fs.existsSync(prodEnvPath)) {
  dotenv.config({ path: prodEnvPath });
} else {
  dotenv.config();
}

const connectDB = require('../src/config/database');
const Puzzle = require('../src/models/Puzzle');
const WhatsAppMessage = require('../src/models/WhatsAppMessage');
const whatsappService = require('../src/services/whatsappService');

async function run() {
  const isDryRun = !process.argv.includes('--execute');
  
  // Parse recipient index argument
  const idxArg = process.argv.find(arg => arg.startsWith('--recipient-index='));
  if (!idxArg) {
    console.error('Error: --recipient-index=<number> argument is required.');
    process.exit(1);
  }
  const idx = parseInt(idxArg.split('=')[1], 10);
  if (isNaN(idx)) {
    console.error('Error: recipient index must be a valid number.');
    process.exit(1);
  }

  await connectDB();

  const puzzleId = '774d41ec6b8bc24f4d1e299126d137f9';
  console.log(`\n================ RECOVERY FOR REVEAL ALERTS OF PUZZLE: ${puzzleId} ================`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Verification Only)' : 'EXECUTE (Live Resend)'}`);

  const puzzle = await Puzzle.findOne({ publicId: puzzleId });
  if (!puzzle) {
    console.error('Puzzle not found.');
    process.exit(1);
  }

  if (idx !== 3) {
    console.log(`Skipping index ${idx}: Only index 3 (O.B) is targeted for this dedicated recovery.`);
    process.exit(0);
  }

  const rec = puzzle.recipients[idx];
  if (!rec) {
    console.error(`Recipient at index ${idx} not found on puzzle.`);
    process.exit(1);
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
  
  if (existingMsg && existingMsg.status === 'accepted') {
    eligibility = 'ineligible';
    reason = `Message status is already "accepted".`;
  } else {
    eligibility = 'eligible';
    reason = `O.B alert is verified as NOT delivered/accepted and is safe to retry.`;
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

  console.log(`\n=========================================================================\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('Exception occurred during recovery execution:', err);
  process.exit(1);
});

const express = require('express');
const crypto = require('crypto');
const Puzzle = require('../../models/Puzzle');
const Order = require('../../models/Order');
const JourneyEvent = require('../../models/JourneyEvent');
const {
  addDays,
  earlierDate,
  computeInitialDueAt,
  computePostCompletionDueAt,
  DAY_MS
} = require('../../utils/imageRetention');
const { sanitizePageUrl, scrubMetadata } = require('../../utils/analyticsSanitize');
const { runFinalRetentionStamp } = require('../../utils/migrationFinalStamp');

/**
 * TEMPORARY, READ-ONLY reporting endpoint.
 *
 * Runs the exact dry-run classification logic of
 * backend/scripts/backfill-image-retention.js and
 * backend/scripts/sanitize-journeyevents.js from INSIDE the deployed
 * backend, where MONGODB_URI is already available via process.env —
 * so production migration dry-run counts can be produced without ever
 * retrieving that (Sensitive-type) secret onto a local machine.
 *
 * Guarantees:
 *  - No `--apply` equivalent exists. There is no write path in this file:
 *    every database call below is find / findOne / countDocuments.
 *  - Returns aggregate counts only — no customer data, no complete
 *    publicIds, no image URLs, no metadata content.
 *  - Same CRON_SECRET Bearer + timing-safe-compare pattern as the other
 *    internal routes; 401 before any database read.
 *
 * Intended to be removed once the migration review work is complete.
 */

const router = express.Router();

function safeTokenEqual(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return receivedBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

const CAPABILITY_URL_RE = /\/p\/(?!:puzzleId)[^/?#]+/;

const KNOWN_PUZZLE_STATUSES = [
  'draft', 'pending_payment', 'paid', 'preparing', 'ready',
  'partially_delivered', 'delivered', 'failed', 'expired'
];

/**
 * Mirrors backfill-image-retention.js's manual-review classification, but
 * returns the full reasoning (not just a boolean) so the report can break
 * the 25-record bucket down by status/reason without a second DB pass.
 * Read-only: Order.findOne only.
 */
async function classifyManualReview(puzzle, now) {
  const statusTriggered = ['pending_payment', 'paid', 'preparing'].includes(puzzle.status);
  const order = await Order.findOne({ puzzleId: puzzle.publicId }).sort({ createdAt: -1 });
  const orderPaymentStatus = order ? order.paymentStatus : null;
  const refunded = orderPaymentStatus === 'refunded';
  const recentlyPaid = orderPaymentStatus === 'paid' && !!order.paidAt &&
    now.getTime() - order.paidAt.getTime() < 7 * DAY_MS;
  const isManualReview = statusTriggered || refunded || recentlyPaid;
  return { isManualReview, orderPaymentStatus, refunded, recentlyPaid };
}

async function buildImageRetentionReport(now) {
  const counts = {
    totalStoredImages: 0,
    olderThan30Days: 0,
    deadlineAlreadyPassed: 0,
    stillWithinRetention: 0,
    allRecipientsCompleted: 0,
    incompleteRecipients: 0,
    manualReview: 0,
    legacyUploads: 0,
    unclassified: 0
  };

  // Breakdown of the manualReview bucket only. Dimensions can overlap
  // (e.g. a "delivered" puzzle can also be "recentlyPaid" if its order
  // paid within the last 7 days) — byPuzzleStatus values sum to exactly
  // manualReview; refundedOrder / recentlyPaidOrder are separate,
  // independently-overlapping counts, not additional partition slices.
  const manualReviewBreakdown = {
    byPuzzleStatus: {},
    refundedOrder: 0,
    recentlyPaidOrder: 0,
    activePaidOrder: 0,       // order.paymentStatus === 'paid' (not refunded)
    allRecipientsCompleted: 0,
    incompleteRecipients: 0,
    ageDaysOldest: null,
    ageDaysYoungest: null
  };
  for (const status of KNOWN_PUZZLE_STATUSES) manualReviewBreakdown.byPuzzleStatus[status] = 0;
  manualReviewBreakdown.byPuzzleStatus.other = 0;

  // READ-ONLY: countDocuments only, no updateMany.
  counts.legacyUploads = await Puzzle.countDocuments({
    imageStorageId: null,
    imageDeletedAt: null,
    cropImageUrl: { $regex: '^/uploads/' }
  });

  // READ-ONLY: find().cursor() streams documents; nothing is written back.
  const cursor = Puzzle.find({ imageStorageId: { $ne: null } }).cursor();

  for (let puzzle = await cursor.next(); puzzle != null; puzzle = await cursor.next()) {
    try {
      counts.totalStoredImages += 1;

      const storedAt = puzzle.imageStoredAt || puzzle.createdAt;
      if (storedAt && now.getTime() - storedAt.getTime() > 30 * DAY_MS) {
        counts.olderThan30Days += 1;
      }

      const recipients = Array.isArray(puzzle.recipients) ? puzzle.recipients : [];
      const allCompleted = recipients.length > 0 && recipients.every(r => r.completedAt);
      if (allCompleted) {
        counts.allRecipientsCompleted += 1;
      } else {
        counts.incompleteRecipients += 1;
      }

      // Matches the backfill script: manual-review records are surfaced
      // separately rather than folded into the deadline classification,
      // since their disposition depends on payment/delivery context.
      const review = await classifyManualReview(puzzle, now);
      if (review.isManualReview) {
        counts.manualReview += 1;

        const statusKey = KNOWN_PUZZLE_STATUSES.includes(puzzle.status) ? puzzle.status : 'other';
        manualReviewBreakdown.byPuzzleStatus[statusKey] += 1;
        if (review.refunded) manualReviewBreakdown.refundedOrder += 1;
        if (review.recentlyPaid) manualReviewBreakdown.recentlyPaidOrder += 1;
        if (review.orderPaymentStatus === 'paid' && !review.refunded) {
          manualReviewBreakdown.activePaidOrder += 1;
        }
        if (allCompleted) {
          manualReviewBreakdown.allRecipientsCompleted += 1;
        } else {
          manualReviewBreakdown.incompleteRecipients += 1;
        }
        if (storedAt) {
          const ageDays = (now.getTime() - storedAt.getTime()) / DAY_MS;
          if (manualReviewBreakdown.ageDaysOldest === null || ageDays > manualReviewBreakdown.ageDaysOldest) {
            manualReviewBreakdown.ageDaysOldest = ageDays;
          }
          if (manualReviewBreakdown.ageDaysYoungest === null || ageDays < manualReviewBreakdown.ageDaysYoungest) {
            manualReviewBreakdown.ageDaysYoungest = ageDays;
          }
        }

        continue;
      }

      // Prefer an already-stamped deadline (set live by the deployed
      // creation-time code); otherwise compute it exactly as the backfill
      // script would.
      let dueAt = puzzle.imageDeletionDueAt;
      if (!dueAt && storedAt) {
        dueAt = computeInitialDueAt(storedAt);
        if (allCompleted) {
          const latestCompletedAt = recipients.reduce(
            (latest, r) => (r.completedAt > latest ? r.completedAt : latest),
            recipients[0].completedAt
          );
          dueAt = earlierDate(dueAt, computePostCompletionDueAt(latestCompletedAt));
        }
      }

      if (dueAt && dueAt.getTime() <= now.getTime()) {
        counts.deadlineAlreadyPassed += 1;
      } else if (dueAt) {
        counts.stillWithinRetention += 1;
      } else {
        counts.unclassified += 1;
      }
    } catch (err) {
      counts.unclassified += 1;
    }
  }

  // Round ages to 2 decimals for a readable report; null stays null when
  // there were no manual-review records (or none with a known storedAt).
  const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);
  manualReviewBreakdown.ageDaysOldest = round2(manualReviewBreakdown.ageDaysOldest);
  manualReviewBreakdown.ageDaysYoungest = round2(manualReviewBreakdown.ageDaysYoungest);

  counts.manualReviewBreakdown = manualReviewBreakdown;
  return counts;
}

async function buildAnalyticsReport() {
  const counts = {
    totalInspected: 0,
    realPuzzleUrls: 0,
    rawPublicIds: 0,
    queryStringsOrTokens: 0,
    sensitiveMetadata: 0,
    unclassified: 0
  };

  // READ-ONLY: find().cursor() streams documents; nothing is written back.
  const cursor = JourneyEvent.find({}).cursor();

  for (let event = await cursor.next(); event != null; event = await cursor.next()) {
    try {
      counts.totalInspected += 1;

      const rawUrl = event.pageUrl || '';
      const rawMetadata = (event.metadata && typeof event.metadata === 'object') ? event.metadata : {};

      const hasCapabilityUrl = CAPABILITY_URL_RE.test(rawUrl);
      const hasQueryOrHash = /[?#]/.test(rawUrl) || /^https?:\/\//i.test(rawUrl);
      const hasPuzzleId = 'puzzleId' in rawMetadata || 'publicId' in rawMetadata;

      if (hasCapabilityUrl) counts.realPuzzleUrls += 1;
      if (hasQueryOrHash) counts.queryStringsOrTokens += 1;
      if (hasPuzzleId) counts.rawPublicIds += 1;

      // sanitizePageUrl is invoked (unused result) purely to prove the
      // report is exercising the same code path the real migration uses,
      // matching the "same classification logic" requirement.
      sanitizePageUrl(rawUrl);
      const safeMetadata = scrubMetadata(rawMetadata);
      const metadataChanged = JSON.stringify(rawMetadata) !== JSON.stringify(safeMetadata);
      if (metadataChanged && !hasPuzzleId) counts.sensitiveMetadata += 1;
    } catch (err) {
      counts.unclassified += 1;
    }
  }

  return counts;
}

router.get('/', async (req, res, next) => {
  try {
    // Authenticate BEFORE any database read.
    // Same pattern as the other internal routes (Bearer + timing-safe
    // compare, 401 before any DB read). MIGRATION_DRYRUN_SECRET is an
    // additional, narrowly-scoped credential accepted alongside
    // CRON_SECRET solely because CRON_SECRET is a Vercel Sensitive
    // variable — write-only once set, so its value cannot be retrieved
    // by anyone (including the project owner) to make a manual call.
    // Remove this alternate check together with the endpoint itself.
    const authorization = req.headers.authorization || '';
    const cronSecret = process.env.CRON_SECRET;
    const altSecret = process.env.MIGRATION_DRYRUN_SECRET;
    const authorizedByCron = cronSecret && safeTokenEqual(authorization, `Bearer ${cronSecret}`);
    const authorizedByAlt = altSecret && safeTokenEqual(authorization, `Bearer ${altSecret}`);
    if (!authorizedByCron && !authorizedByAlt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const [imageRetention, analytics, finalStamp] = await Promise.all([
      buildImageRetentionReport(now),
      buildAnalyticsReport(),
      runFinalRetentionStamp({ apply: false, now })
    ]);

    // Read-only completeness check: does every stored image have BOTH
    // imageStoredAt and imageDeletionDueAt? (dry-run only — apply:false
    // above guarantees zero writes here.)
    imageRetention.retentionFieldCompleteness = finalStamp.counts;

    return res.json({ success: true, imageRetention, analytics });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

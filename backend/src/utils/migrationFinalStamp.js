const Puzzle = require('../models/Puzzle');
const Order = require('../models/Order');
const { logRef } = require('./puzzleRef');
const { MANUAL_RESOLUTION_IMAGE_EXPIRED } = require('../services/paymentCompletion');
const {
  earlierDate,
  computeInitialDueAt,
  computePostCompletionDueAt,
  DAY_MS
} = require('./imageRetention');

const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

/**
 * Builds a non-identifying detail summary for one overdue-on-computation
 * record (skipOverdue mode). Never includes publicId, image URLs,
 * customer contact info, messages, or payment identifiers — only status
 * enums, booleans, and day counts. Read-only: Order.findOne only.
 */
async function buildOverdueDetail(puzzle, now, imageStoredAt, allCompletedAt, dueAt) {
  const order = await Order.findOne({ puzzleId: puzzle.publicId }).sort({ createdAt: -1 });
  const paymentExists = !!order;
  const refunded = !!(order && order.paymentStatus === 'refunded');
  const paidWithinLast7Days = !!(
    order && order.paymentStatus === 'paid' && order.paidAt &&
    now.getTime() - order.paidAt.getTime() < 7 * DAY_MS
  );
  const hasManualResolutionMarker = !!(order && order.lastPaymentError === MANUAL_RESOLUTION_IMAGE_EXPIRED);

  return {
    puzzleStatus: puzzle.status,
    imageAgeDays: round2((now.getTime() - imageStoredAt.getTime()) / DAY_MS),
    daysSinceAllRecipientsCompleted: allCompletedAt ? round2((now.getTime() - allCompletedAt.getTime()) / DAY_MS) : null,
    deadlineOverdueDays: round2((now.getTime() - dueAt.getTime()) / DAY_MS),
    paymentExists,
    paidWithinLast7Days,
    deliveredSuccessfully: puzzle.status === 'delivered',
    allRecipientsCompleted: !!allCompletedAt,
    refunded,
    hasManualResolutionMarker
  };
}

/**
 * ENTIRELY TEMPORARY — final one-time retention stamp pass. Unlike
 * migrationBackfill.js (which deliberately SKIPS manual-review puzzles,
 * pending human disposition), this stamps stored images missing a
 * deadline, including previously-manual-review records — used only after
 * those 25 records were explicitly reviewed and cleared by the operator.
 *
 * Two modes:
 *  - mode: 'allOrNothing' (default) — if computing the deadline for ANY
 *    eligible record would already be in the past (or is unclassifiable),
 *    the entire call refuses to write anything (`stopped: true`).
 *  - mode: 'skipOverdue' — stamps every SAFE (future-deadline) record,
 *    and leaves any overdue-on-computation or unclassifiable record
 *    completely untouched (no stamp, no 'blocked' status change, nothing)
 *    — returning a non-identifying `overdueDetails` summary for each
 *    instead, for manual operator review.
 *
 * In both modes:
 *  - Never touches a record that already has imageDeletionDueAt set —
 *    the update filter guards on `imageDeletionDueAt: null`, so an
 *    existing deadline can never be extended, shortened, or touched.
 *  - Never touches Order, payment, or delivery status.
 *  - Never deletes anything.
 *
 * Delete this file together with the temporary dry-run/apply endpoints
 * once the migration review work is finished.
 */
async function runFinalRetentionStamp({ apply = false, now = new Date(), mode = 'allOrNothing' } = {}) {
  const skipOverdue = mode === 'skipOverdue';
  const counts = {
    totalStoredImages: 0,
    withImageStoredAt: 0,
    withImageDeletionDueAt: 0,
    missingEither: 0,
    wouldStamp: 0,
    wouldBeOverdue: 0,
    unclassified: 0,
    applied: 0
  };
  const overdueRefs = [];
  const overdueDetails = [];
  const toStamp = [];

  const cursor = Puzzle.find({ imageStorageId: { $ne: null } }).cursor();

  for (let puzzle = await cursor.next(); puzzle != null; puzzle = await cursor.next()) {
    counts.totalStoredImages += 1;

    try {
      const hasStoredAt = !!puzzle.imageStoredAt;
      const hasDueAt = !!puzzle.imageDeletionDueAt;
      if (hasStoredAt) counts.withImageStoredAt += 1;
      if (hasDueAt) counts.withImageDeletionDueAt += 1;
      if (!hasStoredAt || !hasDueAt) counts.missingEither += 1;

      // Eligible for stamping ONLY when the deadline itself is missing —
      // a record that already has one is never touched (never extended).
      if (hasDueAt) continue;

      const imageStoredAt = puzzle.imageStoredAt || puzzle.createdAt;
      const recipients = Array.isArray(puzzle.recipients) ? puzzle.recipients : [];
      let allCompletedAt = null;
      if (recipients.length > 0 && recipients.every(r => r.completedAt)) {
        allCompletedAt = recipients.reduce(
          (latest, r) => (r.completedAt > latest ? r.completedAt : latest),
          recipients[0].completedAt
        );
      }

      let dueAt = computeInitialDueAt(imageStoredAt);
      if (allCompletedAt) {
        dueAt = earlierDate(dueAt, computePostCompletionDueAt(allCompletedAt));
      }

      const overdue = dueAt.getTime() <= now.getTime();
      if (overdue) {
        counts.wouldBeOverdue += 1;
        overdueRefs.push(logRef(puzzle.publicId));
        if (skipOverdue) {
          overdueDetails.push(await buildOverdueDetail(puzzle, now, imageStoredAt, allCompletedAt, dueAt));
          continue; // never stamped, never included in toStamp
        }
      } else {
        counts.wouldStamp += 1;
      }

      toStamp.push({ id: puzzle._id, imageStoredAt, allCompletedAt, dueAt });
    } catch (err) {
      // A record that can't be safely classified is left untouched either
      // way — conservative by design: an unreadable record must never
      // silently bypass a safety check or be guessed at.
      counts.unclassified += 1;
    }
  }

  // allOrNothing: refuse to write ANYTHING if even one eligible record's
  // computed deadline is already in the past, or is unclassifiable.
  if (!skipOverdue && (counts.wouldBeOverdue > 0 || counts.unclassified > 0)) {
    return { counts, overdueRefs, overdueDetails: [], stopped: true };
  }

  if (apply) {
    for (const item of toStamp) {
      await Puzzle.updateOne(
        { _id: item.id, imageDeletionDueAt: null },
        {
          $set: {
            imageStoredAt: item.imageStoredAt,
            allRecipientsCompletedAt: item.allCompletedAt,
            imageDeletionDueAt: item.dueAt,
            imageDeletionStatus: 'scheduled'
          }
        }
      );
      counts.applied += 1;
    }
  }

  // Sort overdue details by most-overdue-first for a stable, meaningful
  // Legacy A / Legacy B style ordering at the caller.
  overdueDetails.sort((a, b) => b.deadlineOverdueDays - a.deadlineOverdueDays);

  return { counts, overdueRefs: skipOverdue ? overdueRefs : [], overdueDetails, stopped: false };
}

module.exports = { runFinalRetentionStamp };

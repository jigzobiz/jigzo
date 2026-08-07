const Puzzle = require('../models/Puzzle');
const { logRef } = require('./puzzleRef');
const {
  earlierDate,
  computeInitialDueAt,
  computePostCompletionDueAt
} = require('./imageRetention');

/**
 * ENTIRELY TEMPORARY — final one-time retention stamp pass. Unlike
 * migrationBackfill.js (which deliberately SKIPS manual-review puzzles,
 * pending human disposition), this stamps EVERY stored image missing a
 * deadline, including previously-manual-review records — used only after
 * those 25 records were explicitly reviewed and cleared by the operator.
 *
 * Safety differs from the standard backfill on purpose:
 *  - ALL-OR-NOTHING: if computing the deadline for ANY eligible record
 *    would already be in the past, the entire call refuses to write
 *    anything (`stopped: true`) rather than silently marking it
 *    'blocked' with a review buffer. The operator re-reviews instead.
 *  - Never touches a record that already has imageDeletionDueAt set —
 *    the update filter guards on `imageDeletionDueAt: null`, so an
 *    existing deadline can never be extended, shortened, or touched.
 *  - Never touches Order, payment, or delivery status.
 *  - Never deletes anything.
 *
 * Delete this file together with the temporary dry-run/apply endpoints
 * once the migration review work is finished.
 */
async function runFinalRetentionStamp({ apply = false, now = new Date() } = {}) {
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
      } else {
        counts.wouldStamp += 1;
      }

      toStamp.push({ id: puzzle._id, imageStoredAt, allCompletedAt, dueAt });
    } catch (err) {
      // A record that can't be safely classified is treated the same as
      // "possibly overdue" for the gate below — conservative by design:
      // an unreadable record must never silently bypass the safety check.
      counts.unclassified += 1;
    }
  }

  // All-or-nothing safety gate: refuse to write ANYTHING if even one
  // eligible record's computed deadline is already in the past, OR if
  // any record could not be safely classified at all.
  if (counts.wouldBeOverdue > 0 || counts.unclassified > 0) {
    return { counts, overdueRefs, stopped: true };
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

  return { counts, overdueRefs: [], stopped: false };
}

module.exports = { runFinalRetentionStamp };

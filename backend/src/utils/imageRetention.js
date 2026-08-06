/**
 * Image retention rule for customer-uploaded puzzle images.
 *
 * imageDeletionDueAt = the EARLIER of:
 *   1. imageStoredAt + RETENTION_MAX_DAYS (30 days); or
 *   2. allRecipientsCompletedAt + POST_COMPLETION_DAYS (7 days),
 *      once every intended recipient has completed the puzzle.
 *
 * The deadline may only stay the same or move earlier — never later.
 */

const RETENTION_MAX_DAYS = 30;
const POST_COMPLETION_DAYS = 7;
const CHECKOUT_MIN_RUNWAY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Initial deadline stamped when the image is written to GridFS. */
function computeInitialDueAt(imageStoredAt) {
  return addDays(imageStoredAt, RETENTION_MAX_DAYS);
}

/** Candidate deadline once all recipients completed. Callers apply $min. */
function computePostCompletionDueAt(allRecipientsCompletedAt) {
  return addDays(allRecipientsCompletedAt, POST_COMPLETION_DAYS);
}

/** Earlier of two dates; tolerates a missing existing deadline. */
function earlierDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * Milliseconds of retention left before the 30-day cap.
 * Falls back to createdAt for records that predate imageStoredAt.
 */
function remainingRetentionMs(puzzle, now) {
  const storedAt = puzzle.imageStoredAt || puzzle.createdAt;
  if (!storedAt) return 0;
  return addDays(storedAt, RETENTION_MAX_DAYS).getTime() - now.getTime();
}

/** Checkout requires at least CHECKOUT_MIN_RUNWAY_DAYS of retention left. */
function hasCheckoutRunway(puzzle, now) {
  return remainingRetentionMs(puzzle, now) >= CHECKOUT_MIN_RUNWAY_DAYS * DAY_MS;
}

/**
 * Access gate: true when the image must no longer be served, regardless of
 * whether physical cleanup has already run.
 */
function isImageExpired(puzzle, now) {
  if (puzzle.imageDeletedAt) return true;
  if (puzzle.imageDeletionStatus === 'blocked' || puzzle.imageDeletionStatus === 'deleted') return true;
  if (puzzle.imageDeletionDueAt && now.getTime() > puzzle.imageDeletionDueAt.getTime()) return true;
  return false;
}

/**
 * Atomic update pair for recipient completion. Both are single-document
 * MongoDB updates, so simultaneous completion requests cannot double-write:
 *
 * Step 1 matches the recipient SUBDOCUMENT by _id via $elemMatch and only
 * while its completedAt is unset, making repeat completions no-ops.
 *
 * Deliberately NOT a numeric positional path ("recipients.0.completedAt"):
 * in a MongoDB QUERY a numeric path component over an array is ambiguous
 * (it also tries a field literally named "0" inside elements, which is
 * always missing — and null equality matches missing), so a numeric-path
 * null guard matches every time and the guard silently stops guarding.
 */
function buildRecipientCompletionUpdate(publicId, recipientId, now, completionSeconds) {
  return {
    filter: {
      publicId,
      recipients: { $elemMatch: { _id: recipientId, completedAt: null } }
    },
    update: {
      $set: {
        'recipients.$.completedAt': now,
        'recipients.$.completionSeconds': completionSeconds
      }
    }
  };
}

/**
 * Step 2: fires only while allRecipientsCompletedAt is unset AND no recipient
 * remains incomplete. $min guarantees the deadline can only move earlier.
 */
function buildAllRecipientsCompleteUpdate(publicId, now) {
  return {
    filter: {
      publicId,
      allRecipientsCompletedAt: null,
      recipients: { $not: { $elemMatch: { completedAt: null } } }
    },
    update: {
      $set: { allRecipientsCompletedAt: now },
      $min: { imageDeletionDueAt: computePostCompletionDueAt(now) }
    }
  };
}

module.exports = {
  RETENTION_MAX_DAYS,
  POST_COMPLETION_DAYS,
  CHECKOUT_MIN_RUNWAY_DAYS,
  DAY_MS,
  addDays,
  computeInitialDueAt,
  computePostCompletionDueAt,
  earlierDate,
  remainingRetentionMs,
  hasCheckoutRunway,
  isImageExpired,
  buildRecipientCompletionUpdate,
  buildAllRecipientsCompleteUpdate
};

const express = require('express');
const crypto = require('crypto');
const { runBackfillImageRetention } = require('../../utils/migrationBackfill');
const { runSanitizeJourneyEvents } = require('../../utils/migrationSanitizeJourney');
const { runFinalRetentionStamp } = require('../../utils/migrationFinalStamp');

/**
 * TEMPORARY, WRITE-CAPABLE endpoint — the counterpart to
 * /api/internal/migrations/dry-run. Applies EXACTLY the same apply-mode
 * logic as the two migration scripts, invoked from inside the deployed
 * backend (where MONGODB_URI is already available via process.env)
 * because that variable is Vercel Sensitive-typed and cannot be
 * retrieved onto a local machine to run the CLI scripts directly.
 *
 * Safety:
 *  - POST only — a GET (prefetch, crawler, accidental link visit) can
 *    never trigger a write.
 *  - Same Bearer auth as the dry-run endpoint (CRON_SECRET or
 *    MIGRATION_DRYRUN_SECRET), timing-safe compare, 401 before any DB
 *    work.
 *  - ALSO requires an explicit body field {"confirm":"I_UNDERSTAND"} —
 *    the HTTP-path equivalent of the CLI scripts' own
 *    JIGZO_PRODUCTION_APPLY confirmation requirement — so a valid
 *    Bearer token alone can never trigger a write.
 *  - {"target":"imageRetention"|"analytics"|"finalRetentionStamp"}
 *    selects exactly ONE migration per call, so each can be applied and
 *    verified independently. "finalRetentionStamp" additionally stamps
 *    previously-manual-review records once cleared by the operator.
 *    Its default mode is all-or-nothing: it refuses to write anything if
 *    any eligible record's computed deadline is already in the past.
 *    Pass {"mode":"skipOverdue"} to instead stamp every safe
 *    (future-deadline) record while leaving overdue-on-computation
 *    records completely untouched, returning a non-identifying
 *    `overdueDetails` summary for each instead. Pass {"dryRun":true}
 *    (with finalRetentionStamp) to preview either mode without writing.
 *  - Delegates to the SAME functions the CLI scripts use
 *    (src/utils/migrationBackfill.js, migrationSanitizeJourney.js) — no
 *    duplicated migration logic, no risk of behavioral drift.
 *  - Returns aggregate counts only.
 *
 * Remove together with the dry-run endpoint once migration work is done.
 */

const router = express.Router();

function safeTokenEqual(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return receivedBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

router.post('/', async (req, res, next) => {
  try {
    // Authenticate BEFORE any database work.
    const authorization = req.headers.authorization || '';
    const cronSecret = process.env.CRON_SECRET;
    const altSecret = process.env.MIGRATION_DRYRUN_SECRET;
    const authorizedByCron = cronSecret && safeTokenEqual(authorization, `Bearer ${cronSecret}`);
    const authorizedByAlt = altSecret && safeTokenEqual(authorization, `Bearer ${altSecret}`);
    if (!authorizedByCron && !authorizedByAlt) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Explicit, separate confirmation — matches the CLI scripts'
    // JIGZO_PRODUCTION_APPLY gate. Authentication alone never applies.
    const { confirm, target } = req.body || {};
    if (confirm !== 'I_UNDERSTAND') {
      return res.status(400).json({ error: 'Missing or invalid confirm field.' });
    }
    if (!['imageRetention', 'analytics', 'finalRetentionStamp'].includes(target)) {
      return res.status(400).json({ error: 'target must be "imageRetention", "analytics", or "finalRetentionStamp".' });
    }

    const now = new Date();
    if (target === 'imageRetention') {
      const { counts } = await runBackfillImageRetention({ apply: true, now });
      return res.json({ success: true, target, applied: true, counts });
    }

    if (target === 'analytics') {
      const { counts } = await runSanitizeJourneyEvents({ apply: true });
      return res.json({ success: true, target, applied: true, counts });
    }

    // finalRetentionStamp: default mode is all-or-nothing (writes NOTHING
    // if any eligible record is overdue/unclassifiable). mode:"skipOverdue"
    // instead stamps every safe record and reports overdueDetails for the
    // rest, untouched. dryRun:true previews either mode without writing.
    const mode = req.body.mode === 'skipOverdue' ? 'skipOverdue' : 'allOrNothing';
    const wantsApply = req.body.dryRun !== true;
    const result = await runFinalRetentionStamp({ apply: wantsApply, now, mode });
    if (result.stopped) {
      return res.status(409).json({
        success: false,
        target,
        applied: false,
        stopped: true,
        reason: 'One or more eligible records have an already-past calculated deadline; nothing was written.',
        counts: result.counts
      });
    }
    return res.json({
      success: true,
      target,
      applied: wantsApply,
      mode,
      counts: result.counts,
      overdueDetails: result.overdueDetails
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

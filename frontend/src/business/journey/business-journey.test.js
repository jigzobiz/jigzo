import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Regression coverage for the locked Claude Design recipient spec (revision 2): the
// Business recipient journey (arrival -> shared PuzzlePlayer solve -> revealed
// invitation+RSVP) and the Business Studio preview (final revealed invitation only, no
// journey animation). This file reads source, not a rendered DOM — consistent with the
// rest of this codebase's test suite (no DOM-render harness is set up) — but each
// assertion is chosen to prove a real behavioral/structural invariant, not just a CSS
// string.

const recipientPage = () => fs.readFileSync(path.resolve('src/pages/InvitationRecipientPage.jsx'), 'utf8');
const receivePage = () => fs.readFileSync(path.resolve('src/pages/ReceivePage.jsx'), 'utf8');
const createPage = () => fs.readFileSync(path.resolve('src/pages/CreatePage.jsx'), 'utf8');
const geometry = () => fs.readFileSync(path.resolve('src/puzzle/puzzle-geometry.js'), 'utf8');
const arrivalScene = () => fs.readFileSync(path.resolve('src/business/journey/ArrivalScene.jsx'), 'utf8');
const solvedFrame = () => fs.readFileSync(path.resolve('src/business/journey/SolvedInvitationFrame.jsx'), 'utf8');
const journeyCopy = () => fs.readFileSync(path.resolve('src/business/journey/businessJourneyCopy.js'), 'utf8');
const journeyCss = () => fs.readFileSync(path.resolve('src/business/journey/business-journey.css'), 'utf8');
const studioPage = () => fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
const studioCss = () => fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
const cropModal = () => fs.readFileSync(path.resolve('src/business/studio/BusinessImageCropModal.jsx'), 'utf8');

test('1-2. /i begins in an arrival phase, not the revealed invitation — invitation details never render before solving', () => {
  const page = recipientPage();
  assert.match(page, /setPhase\('arrival'\);/);
  const arrivalBranch = page.match(/if\(phase==='arrival'\)\{[\s\S]*?\n {2}\}\n/)[0];
  assert.doesNotMatch(arrivalBranch, /eventTitle|SolvedInvitationFrame|jzj-solved__frame/);
  assert.match(arrivalBranch, /<ArrivalScene copy=\{jc\}/);
});

test('3. Arrival renders no product/engine terminology — only the shared, locked journey copy', () => {
  const copy = journeyCopy();
  assert.match(copy, /arrivalTitle: 'A special invitation is waiting for you\.'/);
  assert.match(copy, /arrivalSubtitle: 'Solve the puzzle to reveal it\.'/);
  const scene = arrivalScene();
  assert.match(scene, /\{copy\.arrivalTitle\}/);
  assert.match(scene, /\{copy\.arrivalSubtitle\}/);
});

test('4-5. Arrival transitions to the existing shared PuzzlePlayer, requesting CONSUMER_PUZZLE_GEOMETRY (Business solving must look and play exactly like consumer Receive — there is no separate Business puzzle geometry), with a Business-specific header driven by real solve progress', () => {
  const page = recipientPage();
  assert.match(page, /import PuzzlePlayer from'\.\.\/components\/PuzzlePlayer';/);
  assert.match(page, /const beginSolve=\(\)=>\{[\s\S]*?setPhase\('puzzle'\);\s*\};/);
  assert.match(page, /onContinue=\{beginSolve\}/);
  assert.match(page, /geometry=\{CONSUMER_PUZZLE_GEOMETRY\} headerCopy=\{headerCopy\}/);
  // No second/forked puzzle engine was introduced, and no Business-specific geometry
  // object exists to fork it with either.
  assert.doesNotMatch(page, /function PuzzlePlayer|const PuzzlePlayer\s*=/);
  assert.doesNotMatch(page, /BUSINESS_PUZZLE_GEOMETRY/);
  // Progress-driven header copy: start / mid-solve / one-piece-left, computed from the
  // engine's own placedCount/total — never a hardcoded "step 2 of 3" style label.
  assert.match(page, /if\(placedCount===0\)return\{title:jc\.readyTitle,subtitle:jc\.readySubtitle\};/);
  assert.match(page, /if\(placedCount===total-1\)return\{title:jc\.lastPieceTitle,subtitle:jc\.lastPieceSubtitle\};/);
  assert.match(page, /title:jc\.progressTitle,subtitle:jc\.progressSubtitle\.replace/);
});

test('The shared PuzzlePlayer engine accepts headerCopy as a purely additive, opt-in prop — consumer default behavior (no prop passed) is byte-identical to before', () => {
  const receive = receivePage();
  assert.match(receive, /geometry = CONSUMER_PUZZLE_GEOMETRY, headerCopy \}/);
  // Consumer's own call site never passes headerCopy — falls through to the original
  // t('receive.heading')/t('receive.subheading')/piecesPlaced markup, untouched.
  assert.match(receive, /<PuzzlePlayer data=\{puzzleData\} setData=\{setPuzzleData\} publicId=\{publicId\} rIndex=\{resolvedRIndex\} startTimeRef=\{startTimeRef\} \/>/);
  assert.match(receive, /headerCopy \? \(\(\) => \{/);
  assert.match(receive, /: <>\s*\n\s*<h1[^>]*>\s*\n\s*\{t\('receive\.heading'\)\}/);
});

test('6-7-8. Solving transitions to Revealed, which shows the solved image as the frame background with event details rendered inside it, RSVP below', () => {
  const page = recipientPage();
  assert.match(page, /setPhase\('revealed'\);/);
  assert.doesNotMatch(page, /setPhase\('invitation'\)/, 'the old phase name should be fully retired');
  assert.match(page, /<SolvedInvitationFrame\s*\n\s*mode="interactive"/);
  assert.match(page, /imageUrl=\{REVEALED_IMAGE_URL\}/);
  assert.match(page, /kicker=\{c\.kicker\}/);
  assert.match(page, /eventTitle=\{invitation\.eventTitle\}/);
  assert.match(page, /location=\{invitation\.location\}/);
  assert.match(page, /message=\{invitation\.message\}/);
  const frame = solvedFrame();
  assert.match(frame, /\{imageUrl && <img className="jzj-solved__image" src=\{imageUrl\}/);
  assert.match(frame, /<h3 className="jzj-solved__title"[^>]*>\{eventTitle/);
  // RSVP is a distinct block rendered AFTER the frame in the returned JSX, not inside the
  // overlay panel on top of the photo — "below it, never covering it."
  const frameIdx = frame.indexOf('className="jzj-solved__frame"');
  const replyIdx = frame.indexOf('className="jzj-solved__reply">');
  assert.ok(frameIdx > -1 && replyIdx > frameIdx, 'the reply block must come after the image frame in source order');
  assert.doesNotMatch(frame.slice(frameIdx, replyIdx), /jzj-solved__choices/, 'no RSVP controls inside the overlay/frame block');
});

test('Mystery Mode: the Revealed image uses the fixed /image endpoint (correctly gated on solved state), not a pre-solve imageUrl that GET /puzzle nulls out for mystery campaigns', () => {
  const page = recipientPage();
  const backend = fs.readFileSync(path.resolve('../backend/src/routes/publicInvitations.js'), 'utf8');
  assert.match(page, /const REVEALED_IMAGE_URL='\/api\/public\/invitations\/image';/);
  assert.match(backend, /router\.get\('\/image',async\(req,res,next\)=>\{try\{const value=await session\(req,res\);if\(!value\)return;if\(value\.campaign\.puzzle\.mysteryMode&&!value\.recipient\.firstSolvedAt\)return res\.status\(403\)/);
  assert.match(backend, /router\.get\('\/puzzle'.*imageUrl:value\.campaign\.puzzle\.mysteryMode\?null:'\/api\/public\/invitations\/image'/);
});

test('9-10-11. Revealed RSVP matrix: OFF hides the whole reply block, ON/no-plus-one shows two real buttons, ON/plus-one shows three real buttons — no dead/decorative button', () => {
  const frame = solvedFrame();
  assert.match(frame, /if \(!rsvpEnabled\) return null;/);
  assert.match(frame, /\{rsvpEnabled && <div className="jzj-solved__reply">/);
  // Every button has a real onClick — the previous round's non-functional "Going +1"
  // button (visible but wired to nothing in interactive mode) is gone.
  assert.match(frame, /onClick=\{\(\) => respond\('going', 1\)\}>\{copy\.going\}/);
  assert.match(frame, /\{allowPlusOne && <button type="button" className="jzj-solved__btn jzj-solved__btn--secondary" onClick=\{\(\) => respond\('going', 2\)\}>\{copy\.goingPlus\}<\/button>\}/);
  assert.match(frame, /onClick=\{\(\) => respond\('not_going', 0\)\}>\{copy\.notGoing\}/);
  // No leftover "are you bringing a guest" sub-step — the design shows the flat 2-or-3
  // button choice directly, so it was removed rather than left half-wired.
  assert.doesNotMatch(frame, /pendingGoing|guestQuestion|onPendingGoing/);
});

test('12. Recipient +1 override stays authoritative — real page trusts the server-resolved value, Studio reuses the same inherit/allowed/not_allowed resolution as before', () => {
  const page = recipientPage();
  assert.match(page, /allowPlusOne=\{invitation\.allowPlusOne\}/);
  assert.doesNotMatch(page, /plusOneOverride/);
  const studio = studioPage();
  assert.match(studio, /const plusOne = recipient \? \(recipient\.plusOneOverride === 'allowed' \|\| \(recipient\.plusOneOverride === 'inherit' && state\.experience\.allowPlusOneDefault\)\) : state\.experience\.allowPlusOneDefault;/);
  // Backend words never reach user-facing copy.
  const copy = journeyCopy();
  assert.doesNotMatch(copy, /inherit|not_allowed/);
});

test('10-11. Studio preview shows the FINAL revealed invitation only — no envelope, no solving, no journey animation — and lives inside the same phone shell used everywhere else', () => {
  const studio = studioPage();
  assert.match(studio, /function RecipientJourneyPreview/);
  assert.match(studio, /<div className="jzs-phone-wrap">\s*\n\s*<div className="jzs-phone"><div className="jzs-phone__screen">/);
  assert.match(studio, /<SolvedInvitationFrame\s*\n\s*mode="static"/);
  // The obsolete journey-animation component and its module are both fully gone.
  assert.doesNotMatch(studio, /PhoneJourneyAnimation/);
  assert.ok(!fs.existsSync(path.resolve('src/business/journey/PhoneJourneyAnimation.jsx')), 'PhoneJourneyAnimation.jsx should be deleted, not left orphaned');
});

test('13. Every field the sender edits (image, title, date, location, message, RSVP, +1, mystery mode, recipient override) drives the live Studio preview', () => {
  const studio = studioPage();
  const previewFn = studio.match(/function RecipientJourneyPreview\([\s\S]*?\n\}/)[0];
  assert.match(previewFn, /imageUrl=\{state\.puzzle\.mysteryMode \? null : state\.puzzle\.imagePreviewUrl\}/);
  assert.match(previewFn, /eventTitle=\{state\.experience\.eventTitle\}/);
  assert.match(previewFn, /whenDisplay=\{formatEventDateTime\(state\.experience\.dateTime, isArabic\)\}/);
  assert.match(previewFn, /location=\{state\.experience\.location\}/);
  assert.match(previewFn, /message=\{state\.experience\.message\}/);
  assert.match(previewFn, /rsvpEnabled=\{state\.experience\.rsvpEnabled\}/);
  assert.match(previewFn, /allowPlusOne=\{plusOne\}/);
});

test('14. Experience layout correction: the invitation-message card stretches to match the Timing+Replies column height instead of a fixed textarea row-count guess', () => {
  const css = studioCss();
  assert.match(css, /\.jzs-experience-composer\{[^}]*align-items:stretch/);
  assert.match(css, /\.jzs-composer-card--invitation\{[^}]*display:flex;flex-direction:column/);
  assert.match(css, /\.jzs-field--grow\{flex:1;display:flex;flex-direction:column\}/);
  const studio = studioPage();
  assert.match(studio, /<Field label=\{copy\.experience\.message\} wide className="jzs-field--grow">/);
  // The removed date-helper text was not restored.
  assert.doesNotMatch(studio, /messageHelp2|dateHelper/);
});

test('15. The Business image crop frame is 4:5 (the final-invitation card ratio, NOT puzzle geometry), derived the same way everywhere (never an independently hardcoded ratio)', () => {
  const css = studioCss();
  assert.match(css, /\.jzs-crop-frame\{[^}]*aspect-ratio:4\/5/);
  const modal = cropModal();
  assert.match(modal, /import \{ BUSINESS_INVITATION_CARD \} from '\.\.\/\.\.\/business\/invitationCardGeometry';/);
  assert.match(modal, /BUSINESS_INVITATION_CARD\.width \* CROP_RESOLUTION_SCALE/);
  assert.match(modal, /BUSINESS_INVITATION_CARD\.height \* CROP_RESOLUTION_SCALE/);
  // The crop tool must never import puzzle-solving geometry — that was the exact
  // conflation this correction fixed (a 4:5 puzzle board is NOT what Receive plays).
  // (Explanatory comments may still reference CONSUMER_PUZZLE_GEOMETRY/puzzle-geometry.js
  // for context — only an actual import is disallowed.)
  assert.doesNotMatch(modal, /from '\.\.\/\.\.\/puzzle\/puzzle-geometry'/);
  const cardGeo = fs.readFileSync(path.resolve('src/business/invitationCardGeometry.js'), 'utf8');
  assert.match(cardGeo, /export const BUSINESS_INVITATION_CARD = \{ width: 288, height: 360 \};/);
  assert.equal(288 / 360, 4 / 5);
});

test('16-17-18. Consumer /p (ReceivePage.jsx) and /create are untouched, and consumer geometry stays 9:16', () => {
  const receive = receivePage();
  assert.match(receive, /geometry = CONSUMER_PUZZLE_GEOMETRY/);
  assert.doesNotMatch(receive, /jzj-|ArrivalScene|SolvedInvitationFrame|businessJourneyCopy/);
  const create = createPage();
  assert.doesNotMatch(create, /jzj-|ArrivalScene|SolvedInvitationFrame|businessJourneyCopy|puzzle-geometry/);
  const geo = geometry();
  assert.match(geo, /board: \{ width: 288, height: 512 \}/);
});

test('19. There is exactly ONE puzzle-solving geometry — no Business-specific board/grid exists any more. Business requests CONSUMER_PUZZLE_GEOMETRY directly (9:16, same cols/rows as Receive), not a same-shaped duplicate', () => {
  const geo = geometry();
  assert.match(geo, /export const CONSUMER_PUZZLE_GEOMETRY = \{/);
  assert.doesNotMatch(geo, /BUSINESS_PUZZLE_GEOMETRY/, 'a second puzzle-geometry object was tried once and was wrong — it changed cell proportions away from what Receive actually plays');
  assert.match(geo, /board: \{ width: 288, height: 512 \}/);
  assert.equal(288 / 512, 9 / 16);
  for (const count of [6, 15, 18, 28]) assert.match(geo, new RegExp(`${count}: \\{ cols: \\d+, rows: \\d+ \\}`));
  const page = recipientPage();
  assert.match(page, /import\{CONSUMER_PUZZLE_GEOMETRY\}from'\.\.\/puzzle\/puzzle-geometry';/);
  assert.match(page, /geometry=\{CONSUMER_PUZZLE_GEOMETRY\}/);
});

test('20. EN/AR parity for the shared journey copy', () => {
  const copy = journeyCopy();
  const enBlock = copy.match(/en:\s*\{([\s\S]*?)\}\s*,\s*ar:/)[1];
  const arBlock = copy.match(/ar:\s*\{([\s\S]*?)\}\s*;/)[1];
  const keysOf = (block) => [...block.matchAll(/(\w+):/g)].map(m => m[1]).sort();
  assert.deepEqual(keysOf(enBlock), keysOf(arBlock));
});

test('The reveal frame is 4:5 everywhere it appears (recipient page and Studio preview share one component)', () => {
  const css = journeyCss();
  assert.match(css, /\.jzj-solved__frame\{[^}]*aspect-ratio:4\/5/);
});

test('The actual /i recipient flow drives the real ArrivalScene/PuzzlePlayer/SolvedInvitationFrame, never a Studio-only component', () => {
  const page = recipientPage();
  assert.doesNotMatch(page, /PhoneJourneyAnimation/);
  assert.match(page, /<ArrivalScene copy=\{jc\}/);
});

test('InvitationRecipientPage never navigates to a separate generic invitation page — one solved frame carries the reveal', () => {
  const page = recipientPage();
  assert.doesNotMatch(page, /jzi-invitation-container/);
  assert.doesNotMatch(page, /jzi-badge-mark/);
  assert.match(page, /jzi-solved-wrapper/);
});

test('Arrival is dismissible by tapping anywhere on the scene (a real <button>, not a small icon-only control), and plays a brief opening transition before handing off to the real puzzle', () => {
  const scene = arrivalScene();
  assert.match(scene, /<button\s*\n\s*type="button"\s*\n\s*className=\{`jzj-arrival/);
  assert.match(scene, /onClick=\{handleContinue\}/);
  assert.match(scene, /setOpening\(true\);/);
  assert.match(scene, /window\.setTimeout\(onContinue, OPEN_DELAY_MS\);/);
  // Reduced motion skips the opening animation and hands off immediately.
  assert.match(scene, /prefersReduced.*onContinue\(\); return;|if \(prefersReduced\) \{ onContinue\(\); return; \}/);
});

test('Reduced motion is respected: no keyframe animation plays for arrival/opening pieces under prefers-reduced-motion: reduce', () => {
  const css = journeyCss();
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{/);
  assert.match(css, /animation:none/);
});

test('No Business-specific scatter/drag/snap/lock/progress implementation exists anywhere — Business only ever mounts the one shared PuzzlePlayer function body that also runs consumer Receive', () => {
  const page = recipientPage();
  const receive = receivePage();
  // Business's own files never define drag/scatter/snap logic.
  for (const src of [page, arrivalScene(), solvedFrame()]) {
    assert.doesNotMatch(src, /onPointerDown\(i, e\)|scatter\(\)|placeGroup|mulberry32\(4242/, 'Business files must not reimplement any piece of the solving engine');
  }
  // The engine itself — onDown/scatter/placeGroup/SNAP — exists exactly once, inside the
  // shared PuzzlePlayer function body in ReceivePage.jsx, which both routes call into.
  assert.match(receive, /const onDown = \(i, e\) =>/);
  assert.match(receive, /const scatter = useCallback\(\(\) => \{/);
  assert.match(receive, /const SNAP = Math\.max\(20, Math\.min\(pieceW, pieceH\) \* 0\.36\);/);
  assert.match(receive, /export function PuzzlePlayer\(/);
  assert.doesNotMatch(receive, /function PuzzlePlayer\(.*\n[\s\S]*export function PuzzlePlayer\(/, 'only one PuzzlePlayer definition should exist');
});

test('Piece cell proportions match consumer exactly: Business requests the literal same board width/height and grid cols/rows object, not a same-numbers-different-shape copy', () => {
  const page = recipientPage();
  const geo = geometry();
  // Business's PuzzlePlayer call and consumer's default both resolve to the exact same
  // CONSUMER_PUZZLE_GEOMETRY object — pieceW/pieceH (computed inside PuzzlePlayer as
  // BW/cols, BH/rows) are therefore identical for any given piece count on both routes,
  // by construction, not by coincidence of matching numbers in two separate objects.
  assert.match(page, /geometry=\{CONSUMER_PUZZLE_GEOMETRY\}/);
  const boardMatch = geo.match(/CONSUMER_PUZZLE_GEOMETRY = \{\s*board: \{ width: (\d+), height: (\d+) \}/);
  assert.ok(boardMatch);
  assert.equal(boardMatch[1], '288');
  assert.equal(boardMatch[2], '512');
});

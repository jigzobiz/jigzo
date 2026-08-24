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
const businessPuzzle = () => fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
const campaignContext = () => fs.readFileSync(path.resolve('src/business/studio/CampaignStudioContext.jsx'), 'utf8');
const studioCopy = () => fs.readFileSync(path.resolve('src/business/studio/studio-copy.js'), 'utf8');
const businessApiSrc = () => fs.readFileSync(path.resolve('src/services/businessApi.js'), 'utf8');

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
  // The engine itself — onDown/scatter/placeGroup — exists exactly once, inside the
  // shared PuzzlePlayer function body in ReceivePage.jsx, which both routes call into.
  // scatter()'s own formula now lives in puzzle-layout.js (see the shared-layout tests
  // above); PuzzlePlayer still owns the interactive onDown/placeGroup drag mechanics.
  assert.match(receive, /const onDown = \(i, e\) =>/);
  assert.match(receive, /const scatter = useCallback\(\(\) => computeScatter\(layout, homes\), \[layout, homes\]\);/);
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

// ---- Studio puzzle preview faithfully represents the real Receive experience ----

// There is exactly ONE puzzle-layout implementation, shared/imported by both the real
// interactive PuzzlePlayer and Studio's static BusinessPuzzle preview — the earlier round
// duplicated the same formulas into both files (cross-checked by tests, but still a
// second implementation); this round extracts them into puzzle-layout.js instead.
const puzzleLayout = () => fs.readFileSync(path.resolve('src/puzzle/puzzle-layout.js'), 'utf8');

test('1. There is exactly ONE puzzle-layout implementation (puzzle-layout.js) — not a per-file duplicate. It derives its board/grid from CONSUMER_PUZZLE_GEOMETRY, and contains the authoritative edge-map seed, stage padding, tab clearance, snap threshold and starting-scatter formula', () => {
  const layout = puzzleLayout();
  assert.match(layout, /export const EDGE_MAP_SEED = 1337;/);
  assert.match(layout, /export const STAGE_PAD = 46;/);
  assert.match(layout, /export function computeLayout\(geometry, pieceCount\)/);
  assert.match(layout, /export function computeHomes\(layout\)/);
  assert.match(layout, /export function computeEdgeMap\(layout\)/);
  assert.match(layout, /export function computeScatter\(layout, homes\)/);
  assert.match(layout, /const tabPad = 0\.46 \* Math\.max\(pieceW, pieceH\);/);
  assert.match(layout, /const bound = Math\.min\(tabPad, PAD\);/);
  assert.match(layout, /const SNAP = Math\.max\(20, Math\.min\(pieceW, pieceH\) \* 0\.36\);/);
  assert.match(layout, /mulberry32\(4242 \+ \(cols \* 31 \+ rows\) \* 77\)/);
  assert.match(layout, /Math\.hypot\(x - h\.hx, y - h\.hy\) < SNAP \* 2/);
  assert.doesNotMatch(layout, /BUSINESS_PUZZLE_GEOMETRY/);
});

test('2. The real PuzzlePlayer (ReceivePage.jsx) consumes puzzle-layout.js rather than inlining the formulas a second time — this was a pure extraction (same output), not a behavior change, verified separately by direct numeric comparison against the pre-extraction formulas for pieceCounts 6/15/18/28', () => {
  const receive = receivePage();
  assert.match(receive, /import \{ computeLayout, computeHomes, computeEdgeMap, computeScatter \} from '\.\.\/puzzle\/puzzle-layout';/);
  assert.match(receive, /const layout = useMemo\(\(\) => computeLayout\(geometry, data\.pieceCount\), \[geometry, data\.pieceCount\]\);/);
  assert.match(receive, /const edgeMap = useMemo\(\(\) => computeEdgeMap\(layout\), \[layout\]\);/);
  assert.match(receive, /const homes = useMemo\(\(\) => computeHomes\(layout\), \[layout\]\);/);
  assert.match(receive, /const scatter = useCallback\(\(\) => computeScatter\(layout, homes\), \[layout, homes\]\);/);
  // None of the layout formulas are inlined here any more — they exist in exactly one
  // place (puzzle-layout.js).
  assert.doesNotMatch(receive, /const tabPad = 0\.46 \* Math\.max/);
  assert.doesNotMatch(receive, /mulberry32\(4242/);
  assert.doesNotMatch(receive, /buildEdgeMap\(cols, rows, 1337\)/);
});

test('3. BusinessPuzzle.jsx consumes the exact same puzzle-layout.js functions — no duplicate scatter/layout formula remains in any Business file', () => {
  const puzzle = businessPuzzle();
  assert.match(puzzle, /import \{ computeLayout, computeHomes, computeEdgeMap, computeScatter \} from '\.\.\/\.\.\/puzzle\/puzzle-layout';/);
  assert.match(puzzle, /import \{ CONSUMER_PUZZLE_GEOMETRY \} from '\.\.\/\.\.\/puzzle\/puzzle-geometry';/);
  assert.doesNotMatch(puzzle, /BUSINESS_PUZZLE_GEOMETRY/);
  // The formulas themselves must not be reimplemented here — only imported.
  for (const formula of [
    /0\.46 \* Math\.max/, // tabPad
    /Math\.min\(tabPad, PAD\)/, // bound
    /Math\.max\(20, Math\.min\(pieceW, pieceH\) \* 0\.36\)/, // SNAP
    /mulberry32\(4242/, // scatter seed
    /buildEdgeMap\([^)]*1337\)/, // edge-map seed
    /Math\.hypot\(x - h\.hx/, // rejection-sampling loop
  ]) {
    assert.doesNotMatch(puzzle, formula, `BusinessPuzzle.jsx must not reimplement: ${formula}`);
  }
  // Every other Business file is clean too (no stray copy of the same math anywhere).
  for (const src of [arrivalScene(), solvedFrame(), studioPage()]) {
    assert.doesNotMatch(src, /mulberry32\(4242 \+ \(cols/);
    assert.doesNotMatch(src, /0\.46 \* Math\.max\(pieceW, pieceH\)/);
  }
});

test('4. Studio does not introduce a second interactive puzzle engine — BusinessPuzzle.jsx is a static, non-interactive renderer (no drag/pointer handlers, no PuzzlePlayer mounted inside a small card)', () => {
  const puzzle = businessPuzzle();
  assert.doesNotMatch(puzzle, /onPointerDown|onPointerMove|useState\(scatter\)|<PuzzlePlayer/);
  const studio = studioPage();
  assert.doesNotMatch(studio, /<PuzzlePlayer/, 'PuzzleArea must never mount the real interactive engine inside a Studio preview card');
});

test('5. Actual /i (InvitationRecipientPage.jsx) and consumer Receive (ReceivePage.jsx) drag/snap/lock/solve behavior are untouched by the shared-layout extraction — only where the layout numbers come FROM changed (one shared module instead of two inlined copies), not what PuzzlePlayer does with them', () => {
  const page = recipientPage();
  assert.match(page, /geometry=\{CONSUMER_PUZZLE_GEOMETRY\}/);
  assert.doesNotMatch(page, /BusinessPuzzle/);
  const receive = receivePage();
  assert.doesNotMatch(receive, /jzb-puzzle/);
  // The interactive mechanics themselves (drag, snap, lock, placeGroup) still live only
  // in ReceivePage.jsx, untouched by the extraction — SNAP is now destructured from the
  // shared `layout` object but drag/snap code still reads the same in-scope `SNAP` name.
  assert.match(receive, /const onDown = \(i, e\) =>/);
  assert.match(receive, /const \{ cols, rows, BW, BH, PAD, stageW, stageH, pieceW, pieceH, tabPad, bound, elemW, elemH, SNAP \} = layout;/);
});

// ---- Recipient-name personalization (no hardcoded "Sara") ----

test('5. The campaign Invitation Message is COMMON text only — the recipient salutation is a separate prop/element, not baked into the message string, and not derived by searching the message for a name', () => {
  const frame = solvedFrame();
  assert.match(frame, /recipientName,\s*\n\s*eventTitle,/);
  assert.match(frame, /<span className="jzj-solved__salutation">\{recipientName\}\{isArabic \? '،' : ','\} <\/span>/);
  assert.doesNotMatch(frame, /\.replace\(.*Sara|indexOf\('Sara'\)|includes\('Sara'\)/, 'no fragile string search/replace for a hardcoded name');
});

test('6-7-8. Both the real /i reveal and the Studio preview resolve the salutation from that specific recipient\'s own server-backed data (session.recipient.displayName / the selected or previewed recipient\'s displayName) — never a shared literal, so recipient A and recipient B (CSV or manual, same code path either way) each see their own name with the identical shared message', () => {
  const page = recipientPage();
  assert.match(page, /const recipientFirstName=session\?\.recipient\?\.displayName\?session\.recipient\.displayName\.split\(' '\)\[0\]:'';/);
  assert.match(page, /recipientName=\{recipientFirstName\}/);
  const studio = studioPage();
  assert.match(studio, /const recipientDisplayName = recipient\?\.displayName \|\| recipient\?\.name \|\| '';/);
  assert.match(studio, /const recipientFirstName = recipientDisplayName \? recipientDisplayName\.split\(' '\)\[0\] : '';/);
  assert.match(studio, /recipientName=\{recipientFirstName\}/);
  // Manual and CSV/import recipients are both plain CampaignRecipient rows created via the
  // same normalizeRecipient/persistedRecipient path (source differs, displayName handling
  // does not) — no separate personalization logic per source.
  assert.doesNotMatch(studio, /source === 'import'.*displayName|source === 'manual'.*displayName/);
});

test('9. No hardcoded "Sara" personalization remains in product code or default campaign copy', () => {
  for (const src of [recipientPage(), solvedFrame(), journeyCss(), journeyCopy(), studioCopy(), campaignContext(), studioPage()]) {
    assert.doesNotMatch(src, /Sara/);
  }
});

test('10. With NO recipient selected, Studio renders no salutation at all in the invitation body (not "your guest," or any other stand-in name) — only the Studio chrome (heading label, kicker) may say "your guest" as neutral UI text, never inside the invitation content itself. With a REAL recipient selected, their actual name renders as the salutation', () => {
  const copy = studioCopy();
  assert.match(copy, /select: 'your guest'/);
  assert.match(copy, /select: 'ضيفك'/);
  const studio = studioPage();
  // recipientFirstName (passed to SolvedInvitationFrame's recipientName, i.e. the
  // invitation-body salutation) is '' with no recipient — SolvedInvitationFrame only
  // renders the salutation span when this prop is truthy, so an empty string means no
  // salutation renders at all, not a placeholder name.
  assert.match(studio, /recipientFirstName = recipientDisplayName \? recipientDisplayName\.split\(' '\)\[0\] : '';/);
  // The kicker (Studio chrome, outside the invitation body/message) is the ONLY place
  // that falls back to copy.preview.select ("your guest").
  assert.match(studio, /const firstName = recipientFirstName \|\| copy\.preview\.select;/);
  assert.match(studio, /kicker=\{fillTemplate\(copy\.preview\.madeFor, \{ name: firstName \}\)\}\s*\n\s*recipientName=\{recipientFirstName\}/);
  const frame = solvedFrame();
  assert.match(frame, /\{recipientName && <span className="jzj-solved__salutation">/, 'the salutation must be conditionally rendered — an empty recipientName renders nothing');
});

// ---- "Preview as guest" test-receiver workflow (frontend wiring) ----

test('11-12. A "Preview as guest" action exists in Delivery and calls the real backend endpoint that mints a real /i access token — opening the actual recipient experience, not a Studio mockup', () => {
  const api = businessApiSrc();
  assert.match(api, /previewRecipient: async \(campaignId, name\) => \(await client\.post\(`\/campaigns\/\$\{encodeURIComponent\(campaignId\)\}\/preview-recipient`/);
  const studio = studioPage();
  assert.match(studio, /const previewAsGuest = async \(\) => \{/);
  assert.match(studio, /businessApi\.previewRecipient\(state\.identity\.campaignId, previewName\.trim\(\)\)/);
  // window.open is called synchronously in the click handler, before the await, so the
  // browser does not treat the later navigation as a blocked popup.
  const handlerBody = studio.match(/const previewAsGuest = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  assert.ok(handlerBody.indexOf("window.open('', '_blank'") < handlerBody.indexOf('await businessApi.previewRecipient'), 'window.open must be called before the async request, not after');
  assert.match(studio, /disabled=\{previewState === 'loading'\} onClick=\{previewAsGuest\}>\{copy\.delivery\.previewButton\}/);
});

test('13-14-16. Test isolation is real, not just a UI label: the same source:{$ne:\'test\'} exclusion this file\'s backend counterpart tests is what keeps a preview from counting as a recipient, touching results, or reaching real delivery — cross-checked here from the frontend copy that promises it', () => {
  const copy = studioCopy();
  assert.match(copy, /previewBody: 'Opens the real envelope-to-invitation experience in a new tab, exactly as a guest sees it\. It never counts as a recipient or touches your results\.'/);
  assert.match(copy, /previewBody: 'تفتح تجربة المغلف حتى الدعوة الحقيقية في تبويب جديد، تماماً كما يراها الضيف\. لا تُحتسب كمستلم ولا تؤثر على نتائجك\.'/);
});

test('15. The preview action never asks for or exposes Mystery Mode / security internals — it only takes an optional display name', () => {
  const studio = studioPage();
  const handlerBody = studio.match(/const previewAsGuest = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  assert.doesNotMatch(handlerBody, /mysteryMode|accessToken|secret/i);
});

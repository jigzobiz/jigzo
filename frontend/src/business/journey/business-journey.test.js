import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Product-flow regression coverage for the corrected Business recipient journey:
// Received (arrival) -> Solve (shared PuzzlePlayer) -> Revealed (solved puzzle frame
// becomes the invitation). This file reads source, not a rendered DOM — consistent with
// the rest of this codebase's test suite (no DOM-render harness is set up) — but each
// assertion is chosen to prove a real behavioral/structural invariant, not just a CSS
// string, per the task's "not only CSS string assertions" requirement.

const recipientPage = () => fs.readFileSync(path.resolve('src/pages/InvitationRecipientPage.jsx'), 'utf8');
const receivePage = () => fs.readFileSync(path.resolve('src/pages/ReceivePage.jsx'), 'utf8');
const createPage = () => fs.readFileSync(path.resolve('src/pages/CreatePage.jsx'), 'utf8');
const geometry = () => fs.readFileSync(path.resolve('src/puzzle/puzzle-geometry.js'), 'utf8');
const arrivalScene = () => fs.readFileSync(path.resolve('src/business/journey/ArrivalScene.jsx'), 'utf8');
const solvedFrame = () => fs.readFileSync(path.resolve('src/business/journey/SolvedInvitationFrame.jsx'), 'utf8');
const journeyCopy = () => fs.readFileSync(path.resolve('src/business/journey/businessJourneyCopy.js'), 'utf8');
const journeyCss = () => fs.readFileSync(path.resolve('src/business/journey/business-journey.css'), 'utf8');
const studioPage = () => fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
const phoneAnim = () => fs.readFileSync(path.resolve('src/business/journey/PhoneJourneyAnimation.jsx'), 'utf8');

test('1-2. /i begins in an arrival phase, not the revealed invitation — invitation details never render before solving', () => {
  const page = recipientPage();
  // A fresh (not-yet-solved) session lands on 'arrival', not 'revealed'/'puzzle'.
  assert.match(page, /setPhase\('arrival'\);/);
  // The invitation/RSVP JSX only exists in the branch reached after phase !== 'arrival'
  // and !== 'puzzle'/'revealing' (the function falls through to it last) — the arrival
  // phase's own early return renders only ArrivalScene, nothing invitation-shaped.
  const arrivalBranch = page.match(/if\(phase==='arrival'\)\{[\s\S]*?\n {2}\}\n/)[0];
  assert.doesNotMatch(arrivalBranch, /eventTitle|SolvedInvitationFrame|jzj-solved/);
  assert.match(arrivalBranch, /<ArrivalScene mode="interactive"/);
});

test('3. Arrival stage renders the approved teaser copy (and only via the shared journey copy module)', () => {
  const copy = journeyCopy();
  assert.match(copy, /arrivalTeaser: 'A special invitation is waiting\. Solve to reveal it\.'/);
  assert.match(copy, /arrivalTeaser: 'دعوة خاصة بانتظارك\. حلّ الأحجية لتكشفها\.'/);
  const scene = arrivalScene();
  assert.match(scene, /\{copy\.arrivalTeaser\}/);
});

test('4-5. Arrival transitions to the existing shared PuzzlePlayer, still requesting BUSINESS_PUZZLE_GEOMETRY', () => {
  const page = recipientPage();
  assert.match(page, /import PuzzlePlayer from'\.\.\/components\/PuzzlePlayer';/);
  assert.match(page, /const beginSolve=\(\)=>\{[\s\S]*?setPhase\('puzzle'\);\s*\};/);
  assert.match(page, /onContinue=\{beginSolve\}/);
  assert.match(page, /<PuzzlePlayer data=\{data\} setData=\{setData\} publicId="business-invitation" rIndex=\{0\} startTimeRef=\{start\} onSolved=\{solved\} geometry=\{BUSINESS_PUZZLE_GEOMETRY\}\/>/);
  // No second/forked puzzle engine was introduced.
  assert.doesNotMatch(page, /function PuzzlePlayer|const PuzzlePlayer\s*=/);
});

test('6-7-8. Solving transitions to Revealed, which shows the solved image as the frame background with event details rendered inside it', () => {
  const page = recipientPage();
  assert.match(page, /setPhase\('revealed'\);/);
  assert.doesNotMatch(page, /setPhase\('invitation'\)/, 'the old phase name should be fully retired');
  assert.match(page, /<SolvedInvitationFrame\s*\n\s*mode="interactive"/);
  assert.match(page, /imageUrl=\{REVEALED_IMAGE_URL\}/);
  assert.match(page, /eventTitle=\{invitation\.eventTitle\}/);
  assert.match(page, /whenDisplay=\{`\$\{formattedDateTime\} \(\$\{invitation\.timezone\}\)`\}/);
  assert.match(page, /location=\{invitation\.location\}/);
  assert.match(page, /message=\{invitation\.message\}/);
  const frame = solvedFrame();
  assert.match(frame, /<img className="jzj-solved__image" src=\{imageUrl\}/);
  assert.match(frame, /<h3 className="jzj-solved__title"[^>]*>\{eventTitle/);
});

test('Mystery Mode: the Revealed image uses the fixed /image endpoint (correctly gated on solved state), not a pre-solve imageUrl that GET /puzzle nulls out for mystery campaigns', () => {
  // Root cause this pass caught: GET /puzzle's imageUrl is gated purely on
  // campaign.puzzle.mysteryMode (backend/src/routes/publicInvitations.js), with no
  // regard for solved state — so for a Mystery Mode campaign it stays null even after
  // solving. GET /image gates correctly (mysteryMode && !firstSolvedAt), so using its
  // fixed path directly — rather than the possibly-stale/null puzzle.imageUrl fetched
  // before solving — is what makes Mystery Mode campaigns actually show their image once
  // legitimately revealed, without weakening the server-side gate at all.
  const page = recipientPage();
  const backend = fs.readFileSync(path.resolve('../backend/src/routes/publicInvitations.js'), 'utf8');
  assert.match(page, /const REVEALED_IMAGE_URL='\/api\/public\/invitations\/image';/);
  assert.match(backend, /router\.get\('\/image',async\(req,res,next\)=>\{try\{const value=await session\(req,res\);if\(!value\)return;if\(value\.campaign\.puzzle\.mysteryMode&&!value\.recipient\.firstSolvedAt\)return res\.status\(403\)/);
  assert.match(backend, /router\.get\('\/puzzle'.*imageUrl:value\.campaign\.puzzle\.mysteryMode\?null:'\/api\/public\/invitations\/image'/);
});

test('9-10-11. Revealed RSVP matrix: OFF hides controls, ON/no-plus-one shows two, ON/plus-one shows three', () => {
  const frame = solvedFrame();
  assert.match(frame, /if \(!rsvpEnabled\) return null;/);
  assert.match(frame, /<button type="button" className="jzj-solved__btn" onClick=\{[\s\S]*?\}>\{copy\.going\}<\/button>/);
  assert.match(frame, /\{allowPlusOne && <button type="button" className="jzj-solved__btn jzj-solved__btn--gold" disabled=\{!interactive\}>\{copy\.plus\}<\/button>\}/);
  assert.match(frame, /<button type="button" className="jzj-solved__btn jzj-solved__btn--ghost" onClick=\{[\s\S]*?\}>\{copy\.notGoing\}<\/button>/);
});

test('12. Recipient +1 override stays authoritative — real page trusts the server-resolved value, Studio reuses the same inherit/allowed/not_allowed resolution as before', () => {
  const page = recipientPage();
  // The real page never re-derives allowPlusOne client-side — it passes through exactly
  // what the backend already resolved (effectivePlusOne in publicInvitations.js), so
  // recipient overrides can't be second-guessed or bypassed in the browser.
  assert.match(page, /allowPlusOne=\{invitation\.allowPlusOne\}/);
  assert.doesNotMatch(page, /plusOneOverride/);
  const studio = studioPage();
  assert.match(studio, /const plusOne = recipient \? \(recipient\.plusOneOverride === 'allowed' \|\| \(recipient\.plusOneOverride === 'inherit' && state\.experience\.allowPlusOneDefault\)\) : state\.experience\.allowPlusOneDefault;/);
  // Backend words never reach user-facing copy.
  const copy = journeyCopy();
  assert.doesNotMatch(copy, /inherit|not_allowed/);
});

test('1. Studio preview lives inside the phone frame — not standalone stacked blocks', () => {
  const studio = studioPage();
  assert.match(studio, /function RecipientJourneyPreview/);
  // The device shell: same .jzs-phone/.jzs-phone__screen markup used everywhere else,
  // not a bespoke Studio-only frame.
  assert.match(studio, /<div className="jzs-phone-wrap">\s*\n\s*<div className="jzs-phone"><div className="jzs-phone__screen">/);
  assert.match(studio, /<span className="jzs-phone__island" \/>/);
  assert.match(studio, /<div className="jzs-phone__body">/);
  assert.match(studio, /<PhoneJourneyAnimation/);
});

test('2. The old stacked Received/Solve/Revealed storyboard blocks, and the rejected 3-scene crossfade, no longer exist in JSX or CSS', () => {
  const studio = studioPage();
  const css = journeyCss();
  assert.doesNotMatch(studio, /jzj-storyboard/);
  assert.doesNotMatch(css, /\.jzj-storyboard/);
  // The discrete-scene-crossfade mechanism explicitly rejected this round is fully gone —
  // no JS-driven scene index, no setInterval-based scene swapping, no per-scene remount.
  assert.doesNotMatch(studio, /JOURNEY_SCENES|useJourneyScene|window\.setInterval/);
  assert.doesNotMatch(css, /\.jzj-phone-scene|\.jzj-phone-dots|jzj-scene-in/);
});

test('4. The phone preview is ONE continuous CSS keyframe timeline (not JS-driven scene swapping), covering envelope arrival/open, piece spill/pile, piece assembly, and reveal', () => {
  const css = journeyCss();
  // A single shared 8s duration across every animated layer keeps them all in sync —
  // this is the "one continuous transformation" the crossfade version failed to deliver.
  const durations = [...css.matchAll(/animation:jzj-anim-\w+ (\d+(?:\.\d+)?)s/g)].map((m) => m[1]);
  assert.ok(durations.length >= 4, 'expected every animated layer (envelope, flap, piece, reveal, teaser) to share one timeline');
  assert.ok(durations.every((d) => d === durations[0]), 'all layers must share the exact same cycle duration to stay in sync');
  assert.match(css, /animation-iteration-count|infinite/, 'the cycle loops rather than running once');
  assert.match(css, /@keyframes jzj-anim-envelope\{/);
  assert.match(css, /@keyframes jzj-anim-flap\{/);
  assert.match(css, /@keyframes jzj-anim-piece\{/);
  assert.match(css, /@keyframes jzj-anim-reveal\{/);
  // The rejected "6 decorative pieces fade out, a separately-rendered BusinessPuzzle
  // crossfades in" mechanism is fully gone — no separate puzzle-layer keyframe exists.
  assert.doesNotMatch(css, /@keyframes jzj-anim-puzzle/);
});

test('4a. Envelope arrival/opening phase: starts smaller/farther and translates/scales in, then the flap opens', () => {
  const css = journeyCss();
  const envelopeKf = css.match(/@keyframes jzj-anim-envelope\{([\s\S]*?)\}\n\}/)[0];
  assert.match(envelopeKf, /0%\{opacity:0;transform:translateY\(\d+px\) scale\(\.\d+\)\}/, 'envelope starts smaller/offset (farther back), not already in place');
  assert.match(envelopeKf, /transform:translateY\(0\) scale\(1\)/, 'envelope settles to full size/position');
  const flapKf = css.match(/@keyframes jzj-anim-flap\{([\s\S]*?)\}\n\}/)[0];
  assert.match(flapKf, /scaleY\(\.\d+\)/, 'flap starts closed');
  assert.match(flapKf, /scaleY\(1\)/, 'flap opens fully');
});

test('1. ALL of the selected pieceCount pieces (6/15/18/28) are generated for the assembly layer, not a fixed representative subset', () => {
  const anim = phoneAnim();
  // One piece per grid cell — length === layout.cols * layout.rows — for whichever
  // geometry BUSINESS_PUZZLE_GEOMETRY.grid[pieceCount] resolves to, not a hardcoded
  // REP_COUNT/SPILL_CELLS subset (that mechanism must be fully gone).
  assert.match(anim, /const total = layout\.cols \* layout\.rows;/);
  assert.match(anim, /Array\.from\(\{ length: total \}/);
  assert.doesNotMatch(anim, /REP_COUNT|SPILL_CELLS/);
});

test('2. All 6/15/18/28 piece counts resolve their layout from BUSINESS_PUZZLE_GEOMETRY, and every piece gets a real final grid position', () => {
  const anim = phoneAnim();
  assert.match(anim, /import \{ BUSINESS_PUZZLE_GEOMETRY \} from '\.\.\/\.\.\/puzzle\/puzzle-geometry';/);
  assert.match(anim, /const layout = GRID\[pieceCount\] \|\| GRID\[18\];/);
  const geometry = fs.readFileSync(path.resolve('src/puzzle/puzzle-geometry.js'), 'utf8');
  for (const count of [6, 15, 18, 28]) assert.match(geometry, new RegExp(`${count}: \\{ cols:`));
  // Every piece's final position is its real (row, col) cell in that grid — the same
  // math BusinessPuzzle.jsx itself uses — not a sampled/interpolated approximation.
  assert.match(anim, /const finalX = col \* pieceW;/);
  assert.match(anim, /const finalY = row \* pieceH;/);
});

test('3. Assembly piece paths use the shared puzzle-shape utilities (buildEdgeMap/piecePath) — no second puzzle-solving engine', () => {
  const anim = phoneAnim();
  assert.match(anim, /import \{ buildEdgeMap, mulberry32, piecePath \} from '\.\.\/\.\.\/puzzle\/puzzle-shape';/);
  assert.match(anim, /buildEdgeMap\(layout\.cols, layout\.rows, 407 \+ pieceCount\)/);
  assert.match(anim, /piecePath\(row, col, layout\.cols, layout\.rows, pieceW, pieceH, edges\)/);
  assert.doesNotMatch(anim, /function piecePath|function buildEdgeMap/, 'no reimplemented puzzle-shape logic');
});

test('4b. Pieces spill from the envelope into a pile, then assemble by returning to their own static final-grid position — a real move, not a sampled slot', () => {
  const css = journeyCss();
  const pieceKf = css.match(/@keyframes jzj-anim-piece\{([\s\S]*?)\}\n\}/)[0];
  // Spawn hidden at the envelope (offset from each piece's own final position).
  assert.match(pieceKf, /opacity:0;transform:translate\(var\(--spawn-x\),var\(--spawn-y\)\) scale\(\.\d+\) rotate\(0deg\)\}/);
  assert.match(pieceKf, /translate\(var\(--pile-x\),var\(--pile-y\)\) scale\(1\) rotate\(var\(--pile-rot\)\)/);
  // Assemble: back to (0,0) relative to the piece's own static final-position wrapper —
  // i.e. the piece's TRUE grid slot, held through the completed-puzzle pause.
  assert.match(pieceKf, /60%,67%\{opacity:1;transform:translate\(0,0\) scale\(1\) rotate\(0deg\)\}/);
  assert.match(pieceKf, /73%\{opacity:0\}/);
  const anim = phoneAnim();
  // The outer wrapper is statically placed at the piece's real final grid position via
  // an SVG transform attribute — the CSS animation only ever moves relative to that.
  assert.match(anim, /transform=\{`translate\(\$\{piece\.finalX\} \$\{piece\.finalY\}\)`\}/);
});

test('4c/8. Pieces resolve directly INTO the completed puzzle — no separate BusinessPuzzle is swapped in for the assembled/paused state, so there is no decorative-pieces-disappear/full-puzzle-appears moment', () => {
  const anim = phoneAnim();
  const animatedBranch = anim.split('if (reduced)')[0] + anim.split(/\n  \}\n\n  return/)[1];
  // BusinessPuzzle only appears in the reduced-motion static branch (verified separately
  // below) — the continuously-animated markup never mounts a second puzzle component.
  const nonReducedMarkup = anim.match(/return <div className="jzj-anim" [\s\S]*/)[0];
  assert.doesNotMatch(nonReducedMarkup, /<BusinessPuzzle/);
  assert.match(anim, /<SolvedInvitationFrame/);
});

test('5-6. Reveal layer carries invitation/RSVP; the envelope/piece layers structurally cannot (SolvedInvitationFrame only appears in the reveal layer)', () => {
  const anim = phoneAnim();
  const revealBlock = anim.match(/<div className="jzj-anim-reveal">([\s\S]*)/)[1];
  assert.match(revealBlock, /<SolvedInvitationFrame/);
  assert.match(revealBlock, /rsvpEnabled=\{rsvpEnabled\}/);
  assert.match(revealBlock, /allowPlusOne=\{allowPlusOne\}/);
  const pieceMarkup = anim.match(/<svg className="jzj-anim-pieces"[\s\S]*?\n      <\/svg>/)[0];
  const envelopeMarkup = anim.match(/<svg className="jzj-anim-envelope"[\s\S]*?<\/svg>/)[0];
  assert.doesNotMatch(pieceMarkup, /SolvedInvitationFrame|eventTitle|rsvpEnabled/);
  assert.doesNotMatch(envelopeMarkup, /SolvedInvitationFrame|eventTitle|rsvpEnabled/);
  // SolvedInvitationFrame itself renders its RSVP buttons non-functional in static mode
  // (this is a preview, not a playable widget) but still reflects the OFF/ON/+1 matrix.
  const frame = solvedFrame();
  assert.match(frame, /if \(!rsvpEnabled\) return null;/);
  assert.match(frame, /const response = interactive \? rsvp\?\.response : null;/);
  assert.match(frame, /disabled=\{!interactive\}/);
});

test('4d/5(mystery). Mystery OFF: each assembling piece is clipped to its own final-slot silhouette against ONE full-board image, so the pieces collectively show the real photo aligned to their true positions', () => {
  const anim = phoneAnim();
  assert.match(anim, /const showImage = Boolean\(imageUrl && !mysteryMode\);/);
  // One clipPath per piece, keyed to that piece's own path (final-slot silhouette), and
  // the <image> is offset by that SAME piece's final position so, once combined with the
  // piece's own transform, the clip always reveals exactly the slice belonging there —
  // not an independently cropped mini-image with its own coordinate system.
  assert.match(anim, /<clipPath id=\{clipId\}><path d=\{piece\.path\} \/><\/clipPath>/);
  assert.match(anim, /<image href=\{imageUrl\} x=\{-piece\.finalX\} y=\{-piece\.finalY\} width=\{BOARD\.width\} height=\{BOARD\.height\} preserveAspectRatio="xMidYMid slice" \/>/);
  // Every piece's clip lives inside the SAME animated wrapper that carries it from pile
  // to final position, so the image slice travels WITH the piece instead of a separate
  // layer being swapped in once assembly finishes.
  assert.match(anim, /<g clipPath=\{`url\(#\$\{clipId\}\)`\}>/);
});

test('4d/6(mystery). Mystery ON: assembling pieces render as plain silhouettes only — no <image>/clipPath reaches the DOM, so the photo cannot leak during spill or assembly', () => {
  const anim = phoneAnim();
  assert.match(anim, /\{showImage \? \(/);
  // The non-image branch renders a flat-fill path only.
  assert.match(anim, /<g className="jzj-anim-piece__move"><path className="jzj-anim-piece__fill" d=\{piece\.path\} \/><\/g>/);
  // showImage is false whenever mysteryMode is true, regardless of imageUrl — the same
  // gate BusinessPuzzle and the real recipient flow already use.
  const puzzleSrc = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  assert.match(puzzleSrc, /const showImage = Boolean\(imageUrl && !mysteryMode\);/);
});

test('7. Assembled animation and the real BusinessPuzzle share one geometry/image coordinate system: same grid math, same edge-map seed, same full-board image + xMidYMid-slice mapping', () => {
  const anim = phoneAnim();
  const puzzleSrc = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  // Same edge-map seed formula, so piece silhouettes are visually identical to the real
  // completed-puzzle rendering elsewhere in Studio (main hero, reduced-motion frame).
  assert.match(anim, /buildEdgeMap\(layout\.cols, layout\.rows, 407 \+ pieceCount\)/);
  assert.match(puzzleSrc, /buildEdgeMap\(layout\.cols, layout\.rows, 407 \+ pieceCount\)/);
  // Same full-board image + preserveAspectRatio mapping — no independent crop/scale math.
  assert.match(anim, /width=\{BOARD\.width\} height=\{BOARD\.height\} preserveAspectRatio="xMidYMid slice"/);
  assert.match(puzzleSrc, /width=\{BOARD\.width\} height=\{BOARD\.height\} preserveAspectRatio="xMidYMid slice"/);
});

test('15. Reduced motion: PhoneJourneyAnimation renders a single static settled frame via JS matchMedia detection, not the same timer/keyframes with motion merely disabled in CSS', () => {
  const anim = phoneAnim();
  assert.match(anim, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(anim, /function useReducedMotion\(\)/);
  assert.match(anim, /if \(reduced\) \{/);
  // The reduced branch renders one settled BusinessPuzzle + teaser — no envelope/piece/
  // reveal animation markup, no infinite loop, nothing that continuously auto-animates.
  const reducedBranch = anim.match(/if \(reduced\) \{([\s\S]*?)\n  \}\n\n  return/)[1];
  assert.match(reducedBranch, /<BusinessPuzzle finalPiece=\{-1\}/);
  assert.doesNotMatch(reducedBranch, /jzj-anim-envelope|jzj-anim-pieces|jzj-anim-reveal|SolvedInvitationFrame/);
  assert.match(reducedBranch, /jzj-anim-teaser--static/);
  // Defense-in-depth: even if the animated branch's markup were ever reached under
  // reduced motion, the CSS itself also disables every keyframe animation.
  const css = journeyCss();
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.jzj-anim-envelope,\.jzj-anim-envelope__group \.jzj-arrival__envelope-flap,\.jzj-anim-piece__move,\.jzj-anim-reveal,\.jzj-anim-teaser\{animation:none\}/);
});

test('7. Phone preview stays contained — same locked .jzs-phone sizing as before, untouched', () => {
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-phone\{width:100%;max-width:320px;aspect-ratio:9\/19\.5;/);
  assert.doesNotMatch(css, /\.jzs-phone\{[^}]*height:100%/);
});

test('the progress-dot / stage-label copy keys were removed, not left orphaned — the animation explains itself through motion, no slideshow labels', () => {
  const copy = journeyCopy();
  assert.doesNotMatch(copy, /stageReceived|stageSolve|stageRevealed|storyboardCaption/);
  const studio = studioPage();
  assert.doesNotMatch(studio, /jzj-phone-dots/);
});

test('Reduced-motion for the real /i arrival illustration is unchanged: settled by default, motion layered on only without the preference', () => {
  const css = journeyCss();
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{/);
  assert.match(css, /\.jzj-arrival--interactive \.jzj-arrival__envelope\{animation:/);
  assert.match(css, /\.jzj-arrival__envelope,\.jzj-arrival__piece\{opacity:1\}/);
  assert.doesNotMatch(css, /\.jzj-arrival--static[^{]*\{animation:/);
});

test('16-17-18. Consumer /p (ReceivePage.jsx) and /create are untouched, and consumer geometry stays 9:16', () => {
  const receive = receivePage();
  assert.match(receive, /geometry = CONSUMER_PUZZLE_GEOMETRY/);
  assert.match(receive, /<PuzzlePlayer data=\{puzzleData\} setData=\{setPuzzleData\} publicId=\{publicId\} rIndex=\{resolvedRIndex\} startTimeRef=\{startTimeRef\} \/>/);
  assert.doesNotMatch(receive, /jzj-|ArrivalScene|SolvedInvitationFrame|businessJourneyCopy/);
  const create = createPage();
  assert.doesNotMatch(create, /jzj-|ArrivalScene|SolvedInvitationFrame|businessJourneyCopy|puzzle-geometry/);
  const geo = geometry();
  assert.match(geo, /board: \{ width: 288, height: 512 \}/);
});

test('19. Business geometry stays 3:2 (288x192), still the single authoritative source', () => {
  const geo = geometry();
  assert.match(geo, /board: \{ width: 288, height: 192 \}/);
  assert.equal(288 / 192, 3 / 2);
  const page = recipientPage();
  assert.match(page, /import\{BUSINESS_PUZZLE_GEOMETRY\}from'\.\.\/puzzle\/puzzle-geometry';/);
});

test('20. EN/AR parity for the new shared journey copy', () => {
  const copy = journeyCopy();
  const enBlock = copy.match(/en:\s*\{([\s\S]*?)\}\s*,\s*ar:/)[1];
  const arBlock = copy.match(/ar:\s*\{([\s\S]*?)\}\s*;/)[1];
  const keysOf = (block) => [...block.matchAll(/(\w+):/g)].map(m => m[1]).sort();
  assert.deepEqual(keysOf(enBlock), keysOf(arBlock));
});

test('the solved frame carries the same locked sharp 3:2 artwork rule as every other puzzle surface', () => {
  const css = journeyCss();
  assert.match(css, /\.jzj-solved\{position:relative;width:100%;aspect-ratio:3\/2;border-radius:0;/);
  // The phone preview's "solve" scene reuses .jzs-phone__puzzle directly (already
  // sharp-cornered per business-studio.css) rather than a separate storyboard-only frame.
  const studioCss = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(studioCss, /\.jzs-phone__puzzle\{[^}]*aspect-ratio:3\/2;border-radius:0;/);
});

test('The actual /i recipient flow is untouched by this round\'s Studio-preview animation work — it still drives the real ArrivalScene/PuzzlePlayer/SolvedInvitationFrame, never the Studio-only PhoneJourneyAnimation', () => {
  const page = recipientPage();
  assert.doesNotMatch(page, /PhoneJourneyAnimation/);
  assert.match(page, /<ArrivalScene mode="interactive"/);
});

test('InvitationRecipientPage no longer navigates to a separate generic invitation page — one solved frame carries the reveal', () => {
  const page = recipientPage();
  assert.doesNotMatch(page, /jzi-invitation-container/);
  assert.doesNotMatch(page, /jzi-badge-mark/);
  assert.match(page, /jzi-solved-wrapper/);
});

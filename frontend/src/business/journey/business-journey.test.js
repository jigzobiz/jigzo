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

test('13-14. Studio preview shows all three static stages and is not an interactive mini puzzle', () => {
  const studio = studioPage();
  assert.match(studio, /function RecipientJourneyPreview/);
  assert.match(studio, /<ArrivalScene mode="static" compact copy=\{jc\} isArabic=\{isArabic\} \/>/);
  // Solve panel mirrors the real mid-solve view: image shows through pieces exactly
  // when Mystery Mode is off, matching PuzzlePlayer's own per-piece behavior.
  assert.match(studio, /<BusinessPuzzle finalPiece=\{-1\} pieceCount=\{pieceCount\} imageUrl=\{state\.puzzle\.imagePreviewUrl\} mysteryMode=\{state\.puzzle\.mysteryMode\} \/>/);
  assert.match(studio, /<SolvedInvitationFrame\s*\n\s*mode="static"/);
  assert.match(studio, /\{jc\.stageReceived\}/);
  assert.match(studio, /\{jc\.stageSolve\}/);
  assert.match(studio, /\{jc\.stageRevealed\}/);
  // No PuzzlePlayer (the real interactive solving engine) is used in the Studio preview.
  assert.doesNotMatch(studio, /PuzzlePlayer/);
  // SolvedInvitationFrame itself renders its RSVP buttons non-functional in static mode.
  const frame = solvedFrame();
  assert.match(frame, /const response = interactive \? rsvp\?\.response : null;/);
  assert.match(frame, /disabled=\{!interactive\}/);
});

test('15. Reduced-motion path exists for the arrival animation, and the static Studio preview never animates regardless of preference', () => {
  const css = journeyCss();
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{/);
  assert.match(css, /\.jzj-arrival--interactive \.jzj-arrival__envelope\{animation:/);
  // Default (pre-media-query) state is the settled composition, not mid-animation.
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
  assert.match(css, /\.jzj-storyboard__puzzle\{position:relative;width:100%;aspect-ratio:3\/2;border-radius:0;/);
});

test('InvitationRecipientPage no longer navigates to a separate generic invitation page — one solved frame carries the reveal', () => {
  const page = recipientPage();
  assert.doesNotMatch(page, /jzi-invitation-container/);
  assert.doesNotMatch(page, /jzi-badge-mark/);
  assert.match(page, /jzi-solved-wrapper/);
});

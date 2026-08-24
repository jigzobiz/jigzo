import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_IMAGE_MAX_BYTES, BUSINESS_IMAGE_TARGET_BYTES, prepareBusinessImage, businessImageScale } from './business-image-upload.js';
import fs from 'node:fs';
import path from 'node:path';

test('Business image payload stays below the target and Vercel request ceiling', () => {
  assert.equal(BUSINESS_IMAGE_MAX_BYTES, 3 * 1024 * 1024);
  assert.equal(BUSINESS_IMAGE_TARGET_BYTES, Math.floor(1.5 * 1024 * 1024));
  assert.ok(BUSINESS_IMAGE_MAX_BYTES < 4.5 * 1024 * 1024);
  const api = fs.readFileSync(path.resolve('src/services/businessApi.js'), 'utf8');
  assert.match(api, /persistPuzzle: async \(campaignId, image\)[\s\S]+?'Content-Type': image\.type/);
  assert.doesNotMatch(api, /persistPuzzle[\s\S]+?\{ cropData \}/);
});

test('Business image dimensions are bounded without upscaling', () => {
  assert.equal(businessImageScale(1200, 800), 1);
  assert.equal(businessImageScale(3200, 1600), 0.5);
  assert.equal(businessImageScale(1600, 3200), 0.5);
});

function imageAdapters({ width, height, transparent = false, encodedSize }) {
  return {
    loadImage: async () => ({ naturalWidth: width, naturalHeight: height }),
    readDataUrl: async blob => `data:${blob.type};base64,test`,
    createCanvas: () => {
      const canvas = { width: 0, height: 0 };
      const context = {
        drawImage() {},
        getImageData: () => {
          const data = new Uint8ClampedArray(64 * 4).fill(255);
          if (transparent) for (let index = 3; index < data.length; index += 4) data[index] = 0;
          return { data };
        }
      };
      canvas.getContext = () => context;
      canvas.toBlob = callback => callback({ size: encodedSize(canvas.width, canvas.height), type: transparent ? 'image/png' : 'image/webp' });
      return canvas;
    }
  };
}

test('large JPEG is resized and reduced below the target', async () => {
  const result = await prepareBusinessImage(
    { type: 'image/jpeg', size: 5 * 1024 * 1024 },
    imageAdapters({ width: 4000, height: 3000, encodedSize: (width, height) => Math.floor(width * height * 0.3) })
  );
  assert.deepEqual(result.before, { width: 4000, height: 3000 });
  assert.deepEqual(result.after, { width: 1600, height: 1200 });
  assert.ok(result.blob.size <= BUSINESS_IMAGE_TARGET_BYTES);
  assert.equal(result.blob.type, 'image/webp');
});

test('large transparent PNG stays PNG and is reduced safely', async () => {
  const result = await prepareBusinessImage(
    { type: 'image/png', size: 6 * 1024 * 1024 },
    imageAdapters({ width: 3000, height: 2000, transparent: true, encodedSize: (width, height) => Math.floor(width * height * 0.8) })
  );
  assert.equal(result.blob.type, 'image/png');
  assert.ok(result.blob.size <= BUSINESS_IMAGE_TARGET_BYTES);
  assert.ok(Math.max(result.after.width, result.after.height) <= 1600);
});

test('small image is returned without enlargement or re-encoding', async () => {
  const file = { type: 'image/jpeg', size: 200000 };
  const result = await prepareBusinessImage(file, imageAdapters({ width: 800, height: 600, encodedSize: () => 1 }));
  assert.equal(result.blob, file);
  assert.deepEqual(result.after, { width: 800, height: 600 });
});

test('invalid image is rejected before processing', async () => {
  await assert.rejects(() => prepareBusinessImage({ type: 'image/gif', size: 100 }), /JPEG, PNG or WebP/);
});

test('persisted image drives the main workspace hero and the Studio final-invitation preview, while Mystery Mode hides only the recipient-facing image', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  // Main workspace hero (PuzzleArea).
  assert.match(page, /BusinessPuzzle finalPiece=\{7\} pieceCount=\{pieceCount\} imageUrl=\{state\.puzzle\.imagePreviewUrl\}/);
  // The final-invitation Studio preview hands the live image/mystery state straight
  // through to the SAME SolvedInvitationFrame component the real recipient sees —
  // mystery-gated exactly once, at the call site, not re-derived inside the frame.
  assert.match(page, /imageUrl=\{state\.puzzle\.mysteryMode \? null : state\.puzzle\.imagePreviewUrl\}/);
  assert.match(puzzle, /showImage = Boolean\(imageUrl && !mysteryMode\)/);
  assert.match(puzzle, /preserveAspectRatio="xMidYMid slice"/);
  // The old animated-journey component is fully retired, not left as dead code.
  assert.ok(!fs.existsSync(path.resolve('src/business/journey/PhoneJourneyAnimation.jsx')));
});

test('BusinessPuzzle pieces get a real fill on the Studio page, not the SVG default black', () => {
  // BusinessPuzzle.jsx is imported by BusinessCampaignStudioPage.jsx, but that page only loads
  // business-studio.css (business-landing.css is landing-page-only). Regression: business-studio.css
  // must carry its own .jzb-puzzle rules, or every piece falls back to an opaque black SVG fill and
  // hides the uploaded image even when Mystery Mode is off.
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(page, /import '\.\.\/\.\.\/business\/studio\/business-studio\.css'/);
  assert.doesNotMatch(page, /import '\.\.\/\.\.\/business\/landing\/business-landing\.css'/);
  assert.match(css, /\.jzb-puzzle__piece\{fill:url\(#jzbPuzzleInk\)/);
  assert.match(css, /\.jzb-puzzle--image \.jzb-puzzle__piece\{fill:none\}/);
});

test('all four persisted difficulty choices drive real editor geometry', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const geometry = fs.readFileSync(path.resolve('src/puzzle/puzzle-geometry.js'), 'utf8');
  const context = fs.readFileSync(path.resolve('src/business/studio/CampaignStudioContext.jsx'), 'utf8');
  // BusinessPuzzle.jsx no longer defines its own grid literals — it reads GRID from
  // CONSUMER_PUZZLE_GEOMETRY (the one and only puzzle-solving geometry, shared with
  // consumer Receive), so the four piece counts are verified against that one
  // authoritative source instead. The Studio preview no longer needs pieceCount at all
  // (it shows the final revealed invitation, not a puzzle render) — only PuzzleArea's own
  // workspace hero does.
  for (const count of [6, 15, 18, 28]) assert.match(geometry, new RegExp(`${count}: \\{ cols:`));
  assert.equal((page.match(/pieceCount=\{pieceCount\}/g) || []).length, 1);
  assert.match(context, /difficultyId: campaign\.puzzle\?\.difficultyId/);
  assert.match(context, /puzzle: \{ difficultyId: state\.puzzle\.difficultyId/);
});

test('manual recipient entry uses only name contact method contact and +1 override', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(page, /blank = \(\) => \(\{ localId: crypto\.randomUUID\(\), name: '', contactMethod: 'email', contact: '', plusOneOverride: 'inherit' \}\)/);
  assert.doesNotMatch(page, /form\.countryCode|form\.language|form\.externalRef|form\.invitationMessageOverride/);
});

test('manual and imported recipients share one dense inline-editable grid', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(page, /className="jzs-recipient-grid" role="table"/);
  assert.match(page, /setDrafts\(value\s*=>\s*\[\.\.\.value,\s*blank\(\)\]\)/);
  assert.match(page, /editableRows\s*\|\|\s*\[\]/);
  assert.match(page, /commitRecipientImport/);
  assert.doesNotMatch(page, /jzs-recipient-form|jzs-import-review|Confirm ready rows/);
  assert.match(page, /Invalid email format/);
  assert.match(page, /Phone number doesn’t look right/);
  assert.match(page, /Duplicate recipient/);
  assert.doesNotMatch(page, />\{copy\.recipients\.save\}<\/button>/);
  assert.match(page, /window\.setTimeout\(\(\)\s*=>\s*persistRow\(row,\s*isDraft,\s*id\),\s*650\)/);
  assert.match(page, /type:\s*'PREVIEW_RECIPIENT'/);
  assert.match(page, /aria-label=\{isArabic\s*\?\s*'إزالة المستلم'\s*:\s*'Remove recipient'\}/);
  assert.match(css, /\.jzs-recipient-grid__head,\.jzs-recipient-row/);
  assert.match(css, /\.jzs-recipient-row__grid\{height:56px/);
  assert.match(css, /\.jzs-recipient-grid__head\{height:46px[^}]+font-size:12\.5px/);
  // The +1 control is a genuine two-state ON/OFF toggle now (locked design decision): it must
  // never surface a third "Campaign default"/inherit label, and clicking must write allowed/not_allowed
  // directly, only reading the campaign default to decide the toggle's initial rendered position.
  assert.doesNotMatch(page, /'الحملة':'Campaign'|Campaign default/);
  assert.match(page, /plusOneOverride === 'allowed' \|\| \(row\.plusOneOverride === 'inherit' && state\.experience\.allowPlusOneDefault\)/);
  assert.match(page, /'plusOneOverride', on \? 'not_allowed' : 'allowed'/);
});

test('Studio cannot upload before a persisted campaign identity exists', () => {
  const source = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(source, /uploadReady = Boolean\(state\.sync\.hydrated && state\.identity\.campaignId\)/);
  assert.match(source, /disabled=\{!uploadReady\}/);
  assert.match(source, /if \(!uploadReady\)[\s\S]+?return;[\s\S]+?persistPuzzle\(state\.identity\.campaignId/);
});

test('durable campaign hydration and navigation do not wait for recipient loading', () => {
  const source = fs.readFileSync(path.resolve('src/business/studio/CampaignStudioContext.jsx'), 'utf8');
  assert.match(source, /dispatch\(\{ type: 'HYDRATE', campaign \}\); if \(!campaignId\) onCreated\(campaign\.campaignId\); try \{ const recipientRows/);
});

test('area navigation has localized next and previous actions without a Review next action', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const copy = fs.readFileSync(path.resolve('src/business/studio/studio-copy.js'), 'utf8');
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(page, /className="jzs-canvas-nav"/);
  assert.match(page, /state\.studio\.activeArea < 5/);
  assert.match(copy, /nextTo: 'Next: \{\{area\}\}'/);
  assert.match(copy, /nextTo: 'التالي: \{\{area\}\}'/);
  assert.match(css, /\.jzs-canvas-nav\{/);
  assert.match(css, /@media\(max-width:900px\)/);
});

test('Recipients toolbar reads Download template, Upload CSV, Add recipient, all as real buttons', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const actions = page.match(/<div className="jzs-recipient-toolbar__actions">[\s\S]*?<\/div>\s*<\/div>/)[0];
  const templateIndex = actions.indexOf('copy.recipients.template');
  const uploadIndex = actions.indexOf('copy.recipients.upload');
  const addIndex = actions.indexOf('copy.recipients.add');
  assert.ok(templateIndex > -1 && uploadIndex > -1 && addIndex > -1, 'all three actions present');
  assert.ok(templateIndex < uploadIndex && uploadIndex < addIndex, 'DOM order is Download template, Upload CSV, Add recipient');
  assert.match(actions, /className="jzs-action jzs-action--ghost jzs-action--sm" type="button" onClick=\{download\}>\{copy\.recipients\.template\}/);
  assert.doesNotMatch(page, /jzs-text-action" onClick=\{download\}/);
});

test('Review recap rows stack value and detail as separate blocks instead of concatenating them', () => {
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(css, /\.jzs-recap-row__value\{display:block/);
  assert.match(css, /\.jzs-recap-row__detail\{display:block/);
  assert.match(page, /<span className="jzs-recap-row__value" dir="auto">\{row\.value\}<\/span><span className="jzs-recap-row__detail" dir="auto">\{row\.detail\}<\/span>/);
});

test('Review only claims Scheduled after the backend has actually persisted a schedule', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const copy = fs.readFileSync(path.resolve('src/business/studio/studio-copy.js'), 'utf8');
  assert.match(page, /const isScheduled = state\.identity\.status === 'scheduled';/);
  assert.match(page, /\{isLater \? \(isScheduled \? <>/);
  assert.match(page, /notScheduledHeadline/);
  // canSchedule already folds in validation.valid (which the backend blocks on zero ready recipients)
  // plus a parsed local date/time and no schedule errors — the CTA must stay wired to it either way.
  assert.match(page, /disabled=\{!canSchedule \|\| launching \|\| scheduling\} onClick=\{schedule\}>\{copy\.review\.changeSchedule\}/);
  assert.match(page, /disabled=\{!canSchedule \|\| launching \|\| scheduling\} onClick=\{schedule\}>\{copy\.review\.scheduleButton\}/);
  assert.match(copy, /notScheduledHeadline: 'Not scheduled yet\.'/);
  assert.match(copy, /notScheduledHeadline: 'لم تتم الجدولة بعد\.'/);
});

test('phone preview plus-one reflects the campaign default even before a recipient is selected', () => {
  // Regression: plusOne used to hard-fall-back to false whenever no recipient was
  // selected/previewed yet, so toggling "Allow a plus one" in Experience had no visible
  // effect until a specific recipient existed. It must reflect allowPlusOneDefault live.
  // The computation itself is unchanged by the journey-preview rewrites — only where its
  // result is consumed (SolvedInvitationFrame's allowPlusOne prop) changed.
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(page, /const plusOne = recipient \? \(recipient\.plusOneOverride === 'allowed' \|\| \(recipient\.plusOneOverride === 'inherit' && state\.experience\.allowPlusOneDefault\)\) : state\.experience\.allowPlusOneDefault;/);
  assert.match(page, /allowPlusOne=\{plusOne\}/);
});

test('Business image upload reuses the consumer crop-stage math instead of a new positioning system', () => {
  const hook = fs.readFileSync(path.resolve('src/components/imageCropStage.js'), 'utf8');
  const consumer = fs.readFileSync(path.resolve('src/pages/CreatePage.jsx'), 'utf8');
  const modal = fs.readFileSync(path.resolve('src/business/studio/BusinessImageCropModal.jsx'), 'utf8');
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  // The clamp/capture math in the shared hook is a faithful port of CreatePage.jsx's own
  // crop math (same formulas), not a reimplemented/invented alternative.
  const containScaleFormula = 'const containScale = Math.min(Wf / Wi, Hf / Hi);';
  assert.ok(hook.includes(containScaleFormula), 'shared hook has the contain-scale formula');
  assert.ok(consumer.includes(containScaleFormula), 'consumer /create still has the same formula (untouched)');
  assert.match(hook, /export function useImageCropStage/);
  assert.match(modal, /import \{ useImageCropStage \} from '\.\.\/\.\.\/components\/imageCropStage'/);
  // CreatePage.jsx (locked consumer flow) is not modified to depend on the new shared module.
  assert.doesNotMatch(consumer, /imageCropStage/);
  // Business wires file selection into the crop modal, and only persists after the user
  // confirms a crop — the raw file is never uploaded directly.
  assert.match(page, /reader\.onload = \(e\) => setCropSrc\(e\.target\.result\);/);
  assert.match(page, /const applyCrop = async \(croppedBlob\) => \{/);
  assert.match(page, /const prepared = await prepareBusinessImage\(croppedBlob\);/);
  assert.match(page, /await businessApi\.persistPuzzle\(state\.identity\.campaignId, prepared\.blob\);/);
  assert.match(page, /\{cropSrc && <BusinessImageCropModal imgSrc=\{cropSrc\}/);
});

test('one authoritative geometry module defines puzzle-SOLVING geometry only — Business does not maintain a second, differently-shaped copy', () => {
  // Corrective round: an earlier pass gave Business its own BUSINESS_PUZZLE_GEOMETRY with
  // the SAME cols/rows as consumer but a different (4:5) board — which silently changed
  // piece cell proportions (and therefore piece shapes) away from what Receive actually
  // plays, even though the grid numbers matched. The locked requirement is that Business
  // solving looks and plays EXACTLY like consumer Receive, so there is now only one
  // puzzle-geometry object, and Business imports it directly.
  const geometry = fs.readFileSync(path.resolve('src/puzzle/puzzle-geometry.js'), 'utf8');
  assert.match(geometry, /export const CONSUMER_PUZZLE_GEOMETRY = \{/);
  assert.doesNotMatch(geometry, /BUSINESS_PUZZLE_GEOMETRY/);
  assert.match(geometry, /board: \{ width: 288, height: 512 \}/);
  assert.match(geometry, /6: \{ cols: 2, rows: 3 \}/);
  assert.match(geometry, /15: \{ cols: 3, rows: 5 \}/);
  assert.match(geometry, /18: \{ cols: 3, rows: 6 \}/);
  assert.match(geometry, /28: \{ cols: 4, rows: 7 \}/);
  assert.equal(288 / 512, 9 / 16);
  // The Business FINAL-INVITATION card ratio (4:5) lives in a completely separate module,
  // not in puzzle-geometry.js — it is presentation of the solved image, not puzzle shape.
  const cardGeo = fs.readFileSync(path.resolve('src/business/invitationCardGeometry.js'), 'utf8');
  assert.match(cardGeo, /export const BUSINESS_INVITATION_CARD = \{ width: 288, height: 360 \};/);
  assert.equal(288 / 360, 4 / 5);
});

test('consumer PuzzlePlayer defaults to CONSUMER_PUZZLE_GEOMETRY and stays 9:16 when no geometry is supplied', () => {
  const receive = fs.readFileSync(path.resolve('src/pages/ReceivePage.jsx'), 'utf8');
  assert.match(receive, /import \{ CONSUMER_PUZZLE_GEOMETRY \} from '\.\.\/puzzle\/puzzle-geometry';/);
  assert.match(receive, /geometry = CONSUMER_PUZZLE_GEOMETRY/);
  assert.match(receive, /const g = geometry\.grid\[data\.pieceCount\] \|\| \{ cols: 3, rows: 6 \};/);
  assert.match(receive, /const BW = geometry\.board\.width, BH = geometry\.board\.height, PAD = 46;/);
  // The consumer route (/p/:publicId, /receive.html) calls PuzzlePlayer without a
  // geometry override, so it gets the default above — unchanged, byte-for-byte.
  assert.match(receive, /<PuzzlePlayer data=\{puzzleData\} setData=\{setPuzzleData\} publicId=\{publicId\} rIndex=\{resolvedRIndex\} startTimeRef=\{startTimeRef\} \/>/);
  assert.doesNotMatch(receive, /<PuzzlePlayer data=\{puzzleData\}[^>]*geometry=/);
  // The old module-level GRID_FOR constant/hardcoded BW/BH literals are gone — geometry
  // now flows in through the prop, not a second definition living in this file.
  assert.doesNotMatch(receive, /^const GRID_FOR = \{/m);
  assert.doesNotMatch(receive, /const BW = 288, BH = 512, PAD = 46;/);
});

test('Business invitation explicitly requests CONSUMER_PUZZLE_GEOMETRY from the same shared PuzzlePlayer — solving must look and play exactly like consumer Receive', () => {
  // /i (InvitationRecipientPage) is exclusively the Business recipient route — reached
  // only via the Business invitation session/token exchange (invitationApi), never by
  // consumer traffic — so requesting this geometry unconditionally here is not a
  // client-guessable inference, it's what this whole page always is. It requests the
  // SAME object consumer's own default resolves to (not a same-shaped duplicate).
  const invitationPage = fs.readFileSync(path.resolve('src/pages/InvitationRecipientPage.jsx'), 'utf8');
  assert.match(invitationPage, /import\{CONSUMER_PUZZLE_GEOMETRY\}from'\.\.\/puzzle\/puzzle-geometry';/);
  assert.match(invitationPage, /<PuzzlePlayer data=\{data\} setData=\{setData\} publicId="business-invitation" rIndex=\{0\} startTimeRef=\{start\} onSolved=\{solved\} geometry=\{CONSUMER_PUZZLE_GEOMETRY\} headerCopy=\{headerCopy\}\/>/);
  // It still imports the one shared PuzzlePlayer — no separate Business solving engine.
  assert.match(invitationPage, /import PuzzlePlayer from'\.\.\/components\/PuzzlePlayer';/);
  const shim = fs.readFileSync(path.resolve('src/components/PuzzlePlayer.jsx'), 'utf8');
  assert.match(shim, /export \{ PuzzlePlayer as default, PuzzlePlayer \} from '\.\.\/pages\/ReceivePage';/);
});

test('BusinessPuzzle Studio preview (the puzzle-solving preview, not the final-invitation preview) and the real recipient solve both read CONSUMER_PUZZLE_GEOMETRY from one file', () => {
  // Regression (twice now): BusinessPuzzle.jsx previously defined its own board/grid
  // literals independent of the real solving engine, then later read a Business-specific
  // geometry that LOOKED shared but silently used a different (4:5) board shape, changing
  // piece proportions away from Receive. Both this Studio preview and the real
  // InvitationRecipientPage solve path must import the SAME CONSUMER_PUZZLE_GEOMETRY from
  // the one puzzle-geometry.js module — no local re-definition, no Business-specific
  // shape, in either file.
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  assert.match(puzzle, /import \{ CONSUMER_PUZZLE_GEOMETRY \} from '\.\.\/\.\.\/puzzle\/puzzle-geometry';/);
  assert.match(puzzle, /const \{ board: BOARD, grid: GRID \} = CONSUMER_PUZZLE_GEOMETRY;/);
  assert.doesNotMatch(puzzle, /const BOARD_W = \d/);
  assert.doesNotMatch(puzzle, /BUSINESS_PUZZLE_LAYOUTS|BUSINESS_PUZZLE_GEOMETRY/);
});

test('two independent ratio tracks, never conflated: puzzle SOLVING is 9:16 (same as consumer Receive) everywhere it is previewed/played; the FINAL INVITATION card is 4:5 everywhere it is cropped/previewed/revealed', () => {
  // One uploaded/baked image feeds both tracks — no duplicate storage, no destructive
  // re-crop. The crop tool frames the FINAL card (4:5); at solve time the puzzle piece
  // renderer's own `preserveAspectRatio="xMidYMid slice"` (a plain center-crop cover fit,
  // identical mechanism consumer Receive already uses for every uploaded photo regardless
  // of its native shape) re-slices that SAME image into the narrower 9:16 solving board —
  // not a second stored asset, not a distortion of either shape.
  const geometry = fs.readFileSync(path.resolve('src/puzzle/puzzle-geometry.js'), 'utf8');
  const cardGeo = fs.readFileSync(path.resolve('src/business/invitationCardGeometry.js'), 'utf8');
  const modal = fs.readFileSync(path.resolve('src/business/studio/BusinessImageCropModal.jsx'), 'utf8');
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  const journeyCss = fs.readFileSync(path.resolve('src/business/journey/business-journey.css'), 'utf8');

  // SOLVING track — 9:16, CONSUMER_PUZZLE_GEOMETRY, everywhere the puzzle itself renders.
  const boardMatch = geometry.match(/CONSUMER_PUZZLE_GEOMETRY = \{\s*board: \{ width: (\d+), height: (\d+) \}/);
  assert.ok(boardMatch, 'CONSUMER_PUZZLE_GEOMETRY board found');
  assert.equal(Number(boardMatch[1]) / Number(boardMatch[2]), 9 / 16);
  assert.match(puzzle, /width=\{BOARD\.width\} height=\{BOARD\.height\} preserveAspectRatio="xMidYMid slice"/);
  assert.match(css, /\.jzs-puzzle-hero svg\{width:100%;aspect-ratio:9\/16;display:block\}/);
  assert.match(css, /\.jzs-difficulty-card__art\{[^}]*aspect-ratio:9\/16/);

  // FINAL-INVITATION track — 4:5, BUSINESS_INVITATION_CARD, everywhere the revealed card
  // is cropped, previewed, or shown.
  const cardMatch = cardGeo.match(/BUSINESS_INVITATION_CARD = \{ width: (\d+), height: (\d+) \}/);
  assert.ok(cardMatch, 'BUSINESS_INVITATION_CARD found');
  assert.equal(Number(cardMatch[1]) / Number(cardMatch[2]), 4 / 5);
  assert.match(modal, /import \{ BUSINESS_INVITATION_CARD \} from '\.\.\/\.\.\/business\/invitationCardGeometry';/);
  assert.match(modal, /const OUTPUT_W = BUSINESS_INVITATION_CARD\.width \* CROP_RESOLUTION_SCALE;/);
  assert.match(modal, /const OUTPUT_H = BUSINESS_INVITATION_CARD\.height \* CROP_RESOLUTION_SCALE;/);
  assert.match(modal, /stage\.captureCrop\(OUTPUT_W, OUTPUT_H/);
  assert.match(css, /\.jzs-crop-frame\{[^}]*aspect-ratio:4\/5/);
  assert.match(journeyCss, /\.jzj-solved__frame\{[^}]*aspect-ratio:4\/5/);

  // The two tracks must never share a source file/constant.
  assert.doesNotMatch(geometry, /4\/5|width: 360/);
  assert.doesNotMatch(cardGeo, /9\/16|height: 512/);
});

test('landing-page BusinessPuzzle usages are pinned to their prior square footprint across both geometry passes', () => {
  // BusinessPuzzle.jsx is shared with the locked marketing landing page. Its internal
  // viewBox has changed twice now (square -> 9:16 -> 3:2) while fixing Studio issues;
  // without an explicit aspect-ratio pin, the landing page's unrelated containers (which
  // never declared their own height) would inherit whatever the latest intrinsic ratio
  // is and visibly resize. These must stay pinned to 1:1 regardless of further Studio-
  // only geometry changes, matching how they rendered before any of this work started.
  const css = fs.readFileSync(path.resolve('src/business/landing/business-landing.css'), 'utf8');
  assert.match(css, /\.jzb-experience-core__puzzle \{ width: 205px; aspect-ratio: 1;/);
  assert.match(css, /\.jzb-studio__puzzle \{ width: min\(390px,100%\); aspect-ratio: 1;/);
  assert.match(css, /\.jzb-recipient__puzzle \{ width: 74%; aspect-ratio: 1;/);
});

test('area headings use the available desktop width instead of an arbitrary narrow cap', () => {
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-area-intro\{max-width:min\(100%,860px\);margin-bottom:32px\}/);
  assert.match(css, /\.jzs-area-intro h1\{max-width:100%/);
  assert.match(css, /\.jzs-area-intro p\{max-width:100%/);
  assert.doesNotMatch(css, /\.jzs-area-intro h1\{max-width:600px/);
  assert.doesNotMatch(css, /\.jzs-area-intro p\{max-width:560px/);
});

test('crop UI copy exists and stays parity-complete across EN/AR', () => {
  const copy = fs.readFileSync(path.resolve('src/business/studio/studio-copy.js'), 'utf8');
  for (const key of ['cropTitle', 'cropHint', 'cropApply', 'cropCancel', 'rotateLeft', 'rotateRight']) {
    const matches = copy.match(new RegExp(`${key}: '[^']+'`, 'g')) || [];
    assert.equal(matches.length, 2, `${key} should appear once in EN and once in AR`);
  }
});

test('BusinessPuzzle fills its board exactly, no letterboxing margin around the assembled puzzle', () => {
  // Root cause of the oversized main puzzle frame / phone puzzle card / difficulty
  // thumbnails: the viewBox added a tabPad margin (0.46 * cell size) equally to width
  // and height. Boundary edges are always flat (piecePath: dir=0 on every outer edge),
  // so an assembled puzzle's silhouette never extends past the board rectangle — that
  // margin was unnecessary, and because it was an equal *absolute* px added to a 3:2
  // (non-square) board, it also distorted the SVG's own aspect ratio away from 3:2,
  // which is what actually caused every 3:2 CSS container around it to letterbox.
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  assert.match(puzzle, /const viewBox = `0 0 \$\{BOARD\.width\} \$\{BOARD\.height\}`;/);
  assert.doesNotMatch(puzzle, /tabPad/);
});

test('puzzle-frame containers have small deliberate padding, not a giant presentation mat', () => {
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-difficulty-card__art svg\{position:absolute;inset:5px\}/);
});

test('the puzzle-art frame is sharp-cornered and exactly 9:16 (same as consumer Receive — it previews SOLVING, not the final invitation) on every surface — main preview and difficulty cards', () => {
  // Root cause: .jzs-difficulty-card__art (border-radius:10px) wrapped a sharp-cornered
  // assembled puzzle (BusinessPuzzle's pieces tile a plain rectangle — see
  // BusinessPuzzle.jsx) in a rounded outer frame, the same "rounded frame around sharp
  // content" mismatch .jzs-puzzle-hero had before its own fix. .jzs-difficulty-card (the
  // outer selectable card) intentionally keeps its own --radius-md; only
  // .jzs-difficulty-card__art (the inner artwork area) goes sharp. This ratio has been
  // 3:2, then briefly 4:5 (wrongly, when a since-reverted round gave Business its own
  // puzzle geometry), now 9:16 — matching CONSUMER_PUZZLE_GEOMETRY, since BusinessPuzzle's
  // own viewBox is always BOARD.width x BOARD.height and would otherwise letterbox inside
  // a stale-ratio container. This component previews the SOLVING experience; the 4:5
  // final-invitation card lives only in SolvedInvitationFrame/business-journey.css and
  // the crop tool (.jzs-crop-frame below), never here. The Studio-phone-preview variant
  // of this frame (.jzs-phone__puzzle) no longer exists — the phone preview now renders
  // the final SolvedInvitationFrame directly.
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-puzzle-hero\{[^}]*border-radius:0;/);
  assert.match(css, /\.jzs-puzzle-hero svg\{width:100%;aspect-ratio:9\/16;/);
  assert.match(css, /\.jzs-difficulty-card__art\{[^}]*aspect-ratio:9\/16;border-radius:0;/);
  assert.doesNotMatch(css, /\.jzs-phone__puzzle/, 'the old Studio-phone puzzle preview frame is fully retired, not left as dead CSS');
  // The final-invitation crop frame stays 4:5 — a genuinely different concern, correctly
  // NOT matching the puzzle-preview ratio above.
  assert.match(css, /\.jzs-crop-frame\{[^}]*aspect-ratio:4\/5/);
  // The outer difficulty selection card keeps its own design-system radius — only the
  // nested artwork area goes sharp.
  assert.match(css, /\.jzs-difficulty-card\{text-align:start;padding:12px;border-radius:var\(--radius-md\);/);
});

test('main puzzle frame has mathematically equal padding on all four sides, sharp corners, no per-side compensation', () => {
  // Regression: .jzs-puzzle-hero previously forced aspect-ratio:3/2 on the OUTER box
  // while the svg used inset:12px (equal on all sides per the CSS shorthand) — but
  // subtracting equal absolute px from a non-square box does not leave an exactly-matching
  // inner area, so the svg content letterboxed on one axis only, producing visibly
  // unequal margins (and off-center content) despite the inset value itself being equal.
  // Fix: no aspect-ratio on the frame — its height is derived from content instead. The
  // svg carries its own aspect-ratio (9:16, matching CONSUMER_PUZZLE_GEOMETRY — this
  // previews the puzzle solve, not the final invitation card) sized to the padded width,
  // and uniform `padding` + `display:grid;place-items:center` wraps it with truly equal
  // spacing on every side; no separate top/right/bottom/left values to drift out of sync.
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-puzzle-hero\{[^}]*padding:12px;box-sizing:border-box;border-radius:0;[^}]*display:grid;place-items:center\}/);
  assert.doesNotMatch(css, /\.jzs-puzzle-hero\{[^}]*aspect-ratio:/);
  assert.match(css, /\.jzs-puzzle-hero svg\{width:100%;aspect-ratio:9\/16;display:block\}/);
  // The piece-count badge keeps its existing anchor.
  assert.match(css, /\.jzs-puzzle-hero__badge\{position:absolute;inset-inline-start:16px;bottom:16px/);
});

test('Mystery Mode is a compact settings row: label left, toggle anchored to the far right edge', () => {
  // Regression: .jzs-mystery-card is display:flex with a SINGLE child (the Toggle's
  // .jzs-toggle-row label). Flex does not stretch a lone item to fill the row, so the
  // toggle-row sized to its own content width (label text + 52px switch) and sat at the
  // start of the row instead of spanning it — leaving the switch stranded near the
  // middle of an otherwise oversized card instead of anchored at the right edge, plus a
  // large unused area to the right. Forcing the toggle-row to width:100% lets its own
  // grid (1fr label column, fixed 52px switch column) push the switch to the true right
  // edge. Also removed the toggle-row's own extra 6px vertical padding, which was
  // doubling up on top of the card's own padding.
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-mystery-card\{[^}]*padding:14px 20px;/);
  assert.match(css, /\.jzs-mystery-card \.jzs-toggle-row\{width:100%;padding:0\}/);
  // The Toggle component's own grid (label column vs fixed-width switch column) still
  // provides the vertical centering and right-anchoring once it's allowed to fill width.
  assert.match(css, /\.jzs-toggle-row\{position:relative;display:grid;grid-template-columns:1fr 52px;align-items:center/);
});

test('phone shell derives its height from its own width instead of an ambiguous ancestor chain', () => {
  // Regression: .jzs-phone used height:100% capped by max-height:640px, but
  // .jzs-preview gets align-self:start + (previously) overflow-y:hidden at desktop
  // width (see the min-width:901px block), which breaks percentage-height resolution
  // down the chain (.jzs-phone -> .jzs-phone__screen -> .jzs-phone__body's flex:1
  // scroll containment). aspect-ratio removes the ambiguity: height is always derived
  // from the phone's own definite width, so overflow:hidden/auto inside it behaves
  // predictably regardless of how the surrounding grid/sticky layout resolves.
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-phone\{width:100%;max-width:320px;aspect-ratio:9\/19\.5;/);
  assert.doesNotMatch(css, /\.jzs-phone\{[^}]*height:100%/);
  assert.doesNotMatch(css, /\.jzs-phone\{[^}]*max-height:640px/);
  // The sticky preview column must scroll, not hard-clip, if its content ever exceeds
  // the viewport — hidden here would silently cut content off with no way to reach it.
  assert.match(css, /\.jzs-preview\{position:sticky;top:24px;align-self:start;max-height:calc\(100vh - 48px\);overflow-y:auto\}/);
});

// The old single "final invitation" phone mockup (a static jzs-invitation/jzs-rsvp block
// shown as the only content) went through three since-corrected attempts before landing
// on the current design: first three stacked storyboard blocks outside any phone, then a
// setInterval-driven crossfade between three static scenes inside the phone, then a
// continuous animation where only 6 decorative pieces assembled before fading into a
// separately-rendered BusinessPuzzle (rejected as a "pieces disappear, puzzle appears"
// discontinuity). RecipientJourneyPreview now mounts PhoneJourneyAnimation inside the
// same .jzs-phone shell — ONE continuous CSS-keyframe timeline where ALL of the selected
// pieceCount pieces (6/15/18/28) spill/pile and assemble by animating back to their own
// real BUSINESS_PUZZLE_GEOMETRY grid position, so the pieces themselves resolve into the
// completed puzzle (no swap) — then reveal into SolvedInvitationFrame -> RSVP hold ->
// loop — see business/journey/business-journey.test.js for full coverage: per-piece
// image clipping for Mystery OFF, concealment for Mystery ON, RSVP matrix inside
// SolvedInvitationFrame, no backend terminology in copy, JS-matchMedia reduced-motion.

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

test('persisted image drives editor and live recipient puzzle while Mystery Mode hides only the recipient image', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  assert.match(page, /BusinessPuzzle finalPiece=\{4\} pieceCount=\{pieceCount\} imageUrl=\{state\.puzzle\.imagePreviewUrl\} mysteryMode=\{state\.puzzle\.mysteryMode\}/);
  assert.match(page, /BusinessPuzzle finalPiece=\{7\} pieceCount=\{pieceCount\} imageUrl=\{state\.puzzle\.imagePreviewUrl\}/);
  assert.match(puzzle, /showImage = Boolean\(imageUrl && !mysteryMode\)/);
  assert.match(puzzle, /preserveAspectRatio="xMidYMid slice"/);
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

test('all four persisted difficulty choices drive real editor and phone geometry', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  const context = fs.readFileSync(path.resolve('src/business/studio/CampaignStudioContext.jsx'), 'utf8');
  for (const count of [6, 15, 18, 28]) assert.match(puzzle, new RegExp(`${count}: \\{ columns:`));
  assert.equal((page.match(/pieceCount=\{pieceCount\}/g) || []).length, 2);
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
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(page, /const plusOne = recipient \? \(recipient\.plusOneOverride === 'allowed' \|\| \(recipient\.plusOneOverride === 'inherit' && state\.experience\.allowPlusOneDefault\)\) : state\.experience\.allowPlusOneDefault;/);
  assert.match(page, /\{plusOne && <button type="button">\{copy\.preview\.guest\}<\/button>\}/);
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

test('the crop stage bakes the real 9:16 puzzle-board output, not an arbitrary square', () => {
  // The real shared puzzle player (ReceivePage.jsx: BW=288,BH=512) and the consumer
  // /create crop (CreatePage.jsx: OUT_W=540,OUT_H=960) both bake to a fixed 9:16 board —
  // every piece count just subdivides that same rectangle differently. Business must
  // bake to the same ratio so the crop the customer approves is exactly what fills the
  // puzzle board later, with no further slicing.
  const modal = fs.readFileSync(path.resolve('src/business/studio/BusinessImageCropModal.jsx'), 'utf8');
  const receive = fs.readFileSync(path.resolve('src/pages/ReceivePage.jsx'), 'utf8');
  assert.match(modal, /const OUTPUT_W = 540;/);
  assert.match(modal, /const OUTPUT_H = 960;/);
  assert.match(modal, /stage\.captureCrop\(OUTPUT_W, OUTPUT_H/);
  assert.match(modal, /className="jzs-crop-frame"/);
  assert.match(receive, /BW = 288, BH = 512/);
  assert.equal(540 / 960, 288 / 512);
});

test('puzzle workspace, phone preview, and difficulty cards all frame the puzzle at its real 9:16 board aspect, not a guessed one', () => {
  // Regression #1: these three containers used a 4:3 rectangle around what was assumed
  // to be a square puzzle board — that pillarboxed it inside a much larger empty frame.
  // Regression #2 (caught in review): "square" was itself wrong. BusinessPuzzle.jsx used
  // to invent its own landscape columns/rows per piece count on a square 280x280 canvas;
  // the real shared player (ReceivePage.jsx GRID_FOR) uses a fixed 288x512 (9:16) board
  // for every piece count, only the grid subdividing it changes. All three containers
  // must match that real, constant 9:16 board — not 4:3, and not 1:1.
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-puzzle-hero\{[^}]*aspect-ratio:9\/16/);
  assert.match(css, /\.jzs-phone__puzzle\{[^}]*aspect-ratio:9\/16/);
  assert.match(css, /\.jzs-difficulty-card__art\{[^}]*aspect-ratio:9\/16/);
  assert.match(css, /\.jzs-difficulty-card__art svg\{position:absolute;inset:0;width:100%;height:100%\}/);
});

test('BusinessPuzzle grid and board match the real shared puzzle player exactly', () => {
  const puzzle = fs.readFileSync(path.resolve('src/business/landing/BusinessPuzzle.jsx'), 'utf8');
  const receive = fs.readFileSync(path.resolve('src/pages/ReceivePage.jsx'), 'utf8');
  const puzzleGrid = {}, receiveGrid = {};
  for (const m of puzzle.matchAll(/(\d+): \{ columns: (\d+), rows: (\d+) \}/g)) puzzleGrid[m[1]] = `${m[2]}x${m[3]}`;
  for (const m of receive.matchAll(/(\d+): \{ cols: (\d+), rows: (\d+) \}/g)) receiveGrid[m[1]] = `${m[2]}x${m[3]}`;
  assert.deepEqual(puzzleGrid, { '6': '2x3', '15': '3x5', '18': '3x6', '28': '4x7' });
  assert.deepEqual(puzzleGrid, receiveGrid, 'Business preview grid must equal the real player grid for every piece count');
  assert.match(puzzle, /const BOARD_W = 288;/);
  assert.match(puzzle, /const BOARD_H = 512;/);
});

test('landing-page BusinessPuzzle usages are pinned to their prior square footprint (locked design unaffected)', () => {
  // BusinessPuzzle.jsx is shared with the locked marketing landing page. Its internal
  // viewBox just changed from square to 9:16 to fix the Studio; without an explicit
  // aspect-ratio pin, the landing page's unrelated containers (which never declared their
  // own height) would inherit the new taller intrinsic ratio and visibly balloon. These
  // must stay pinned to 1:1, matching how they rendered before this fix.
  const css = fs.readFileSync(path.resolve('src/business/landing/business-landing.css'), 'utf8');
  assert.match(css, /\.jzb-experience-core__puzzle \{ width: 205px; aspect-ratio: 1;/);
  assert.match(css, /\.jzb-studio__puzzle \{ width: min\(390px,100%\); aspect-ratio: 1;/);
  assert.match(css, /\.jzb-recipient__puzzle \{ width: 74%; aspect-ratio: 1;/);
});

test('mystery mode card is compact, not an oversized empty box', () => {
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(css, /\.jzs-mystery-card\{[^}]*padding:16px 20px/);
  assert.match(css, /\.jzs-mystery-card \.jzs-toggle-row\{padding:6px 0\}/);
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

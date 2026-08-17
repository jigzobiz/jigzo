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

test('desktop area navigation has localized next and previous actions without a Review next action', () => {
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  const copy = fs.readFileSync(path.resolve('src/business/studio/studio-copy.js'), 'utf8');
  const css = fs.readFileSync(path.resolve('src/business/studio/business-studio.css'), 'utf8');
  assert.match(page, /className="jzs-desktop-nav"/);
  assert.match(page, /state\.studio\.activeArea < 5/);
  assert.match(copy, /nextTo: 'Next: \{\{area\}\}'/);
  assert.match(copy, /nextTo: 'التالي: \{\{area\}\}'/);
  assert.match(css, /@media\(max-width:820px\)\{\.jzs-desktop-nav\{display:none\}\}/);
});

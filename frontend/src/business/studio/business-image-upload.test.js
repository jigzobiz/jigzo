import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_IMAGE_MAX_BYTES, businessImageScale } from './business-image-upload.js';

test('Business image payload stays below the Vercel request ceiling before base64 encoding', () => {
  assert.equal(BUSINESS_IMAGE_MAX_BYTES, 3 * 1024 * 1024);
  assert.ok(Math.ceil(BUSINESS_IMAGE_MAX_BYTES * 4 / 3) < 4.5 * 1024 * 1024);
});

test('Business image dimensions are bounded without upscaling', () => {
  assert.equal(businessImageScale(1200, 800), 1);
  assert.equal(businessImageScale(4096, 2048), 0.5);
  assert.equal(businessImageScale(2048, 4096), 0.5);
});

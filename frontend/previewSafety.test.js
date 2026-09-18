import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertPreviewFrontendSafety } from './previewSafety.js';

test('Preview build fails closed for production API origin and accepts same-origin configuration', () => {
  assert.throws(() => assertPreviewFrontendSafety({ VERCEL_ENV: 'preview', VITE_API_URL: 'https://jigzo.biz' }), /VITE_API_URL must be unset/);
  assert.doesNotThrow(() => assertPreviewFrontendSafety({ VERCEL_ENV: 'preview' }));
  assert.doesNotThrow(() => assertPreviewFrontendSafety({ VERCEL_ENV: 'production', VITE_API_URL: 'https://jigzo.biz' }));
  const config = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(config, /assertPreviewFrontendSafety\(\{ \.\.\.loadEnv\(mode, process\.cwd\(\), ''\), \.\.\.process\.env \}\)/);
});

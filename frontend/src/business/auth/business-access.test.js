import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { safeBusinessReturnTo } from './businessAccess.js';

test('Business return destinations are limited to Studio routes', () => {
  assert.equal(safeBusinessReturnTo('/business/campaigns/new'), '/business/campaigns/new');
  assert.equal(safeBusinessReturnTo('/business/campaigns/abc-123'), '/business/campaigns/abc-123');
  assert.equal(safeBusinessReturnTo('https://evil.example'), '/business/campaigns/new');
  assert.equal(safeBusinessReturnTo('/create'), '/business/campaigns/new');
});

test('Studio 401 handling redirects through the Business login boundary', () => {
  const context = fs.readFileSync(path.resolve('src/business/studio/CampaignStudioContext.jsx'), 'utf8');
  const page = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(context, /error\.response\?\.status === 401/);
  assert.match(context, /message: 'Session expired'/);
  assert.match(page, /\/business\/login\?returnTo=/);
});

test('Business login uses the existing magic-link endpoint and clear success copy', () => {
  const login = fs.readFileSync(path.resolve('src/pages/business/BusinessLoginPage.jsx'), 'utf8');
  const api = fs.readFileSync(path.resolve('src/services/businessApi.js'), 'utf8');
  assert.match(api, /post\('\/auth\/request-link', \{ email \}\)/);
  assert.match(login, /Check your email for your secure sign-in link\./);
});

test('landing sign-in CTA is restricted to the custom staging hostname', () => {
  const access = fs.readFileSync(path.resolve('src/business/auth/businessAccess.js'), 'utf8');
  const landing = fs.readFileSync(path.resolve('src/pages/business/BusinessLandingPage.jsx'), 'utf8');
  assert.match(access, /hostname === 'staging\.jigzo\.biz'/);
  assert.match(landing, /accessHref = isStagingBusinessHost\(\) \? '\/business\/login' : null/);
});

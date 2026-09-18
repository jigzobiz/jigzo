import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { recipientPresentationRows } from './recipientPresentation.js';

const saved = (id, name) => ({ recipientId: id, name });
const draft = (id, name) => ({ localId: id, name });
const names = rows => rows.map(row => row.name);

test('picker selection keeps valid then invalid order after immediate save', () => {
  assert.deepEqual(names(recipientPresentationRows([saved('v', 'Valid')], [draft('i', 'Invalid')],
    [{ localId: 'lv', recipientId: 'v' }, { localId: 'i' }])), ['Valid', 'Invalid']);
});

test('picker selection keeps invalid then valid order after immediate save', () => {
  assert.deepEqual(names(recipientPresentationRows([saved('v', 'Valid')], [draft('i', 'Invalid')],
    [{ localId: 'i' }, { localId: 'lv', recipientId: 'v' }])), ['Invalid', 'Valid']);
});

test('picker selection keeps valid invalid valid order across saves', () => {
  assert.deepEqual(names(recipientPresentationRows([saved('v1', 'First'), saved('v2', 'Third')], [draft('i', 'Second')],
    [{ localId: 'l1', recipientId: 'v1' }, { localId: 'i' }, { localId: 'l2', recipientId: 'v2' }])), ['First', 'Second', 'Third']);
});

test('manual rows remain in place ahead of selected contacts', () => {
  assert.deepEqual(names(recipientPresentationRows([saved('m', 'Manual saved'), saved('v', 'Selected valid')],
    [draft('md', 'Manual draft'), draft('i', 'Selected invalid')],
    [{ localId: 'i' }, { localId: 'lv', recipientId: 'v' }])),
  ['Manual saved', 'Manual draft', 'Selected invalid', 'Selected valid']);
});

test('Studio records selected slots before saving and maps saved recipient IDs back into them', () => {
  const source = fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
  assert.match(source, /setSelectedOrder\(current => \[\.\.\.current, \.\.\.accepted\.map/);
  assert.match(source, /recipientPresentationRows\(persistedRows, drafts, selectedOrder\)/);
  assert.match(source, /recipientId: created\.recipientId/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { pickerAvailable, internationalPhone, recipientPhoneIdentity, selectedContactRows, startPickerSelection, nextContactSelectionBatchId, partitionContactSelection, mergeContactRecipients } from './contactPicker.js';
import fs from 'node:fs';
import path from 'node:path';

test('Contact Picker is shown only in a secure top level browser with the picker API', () => {
  const contacts = { select() {}, getProperties() {} };
  const top = {};
  top.self = top;
  top.top = top;
  top.isSecureContext = true;
  assert.equal(pickerAvailable({ contacts }, top), true);
  assert.equal(pickerAvailable({}, top), false);
  assert.equal(pickerAvailable({ contacts }, { ...top, isSecureContext: false }), false);
  assert.equal(pickerAvailable({ contacts }, { ...top, top: {} }), false);
});

test('only contact names and phone choices are extracted', () => {
  assert.deepEqual(selectedContactRows([{ name: ['Sam'], tel: ['+973 3393 1331', '+973 3900 0000'], email: ['private@example.com'], address: ['private'] }]),
    [{ name: 'Sam', numbers: ['+973 3393 1331', '+973 3900 0000'] }]);
  assert.deepEqual(selectedContactRows([]), []);
});

test('explicit international code is required and equivalent phone formatting deduplicates', () => {
  assert.equal(internationalPhone('33931331').valid, false);
  assert.equal(internationalPhone('33931331').raw, '33931331');
  assert.equal(internationalPhone('+973 3393 1331').e164, '+97333931331');
  assert.equal(recipientPhoneIdentity('+973', '33931331'), recipientPhoneIdentity('', '+973 3393 1331'));
});

test('each picker invocation clears a previous multi-number choice before cancel, empty, or single-number result', () => {
  const source = fs.readFileSync(path.resolve('src/components/ContactPickerButton.jsx'), 'utf8');
  assert.match(source, /const open = async \(\) => \{[\s\S]*?startPickerSelection\(setPending\);[\s\S]*?navigator\.contacts\.select/);
  for (const nextResult of ['cancel', 'empty', 'single']) {
    let pending = [{ name: 'Old', numbers: ['+97311111111', '+97322222222'], choice: '' }];
    startPickerSelection(value => { pending = value; });
    if (nextResult === 'single') {
      const rows = selectedContactRows([{ name: ['New'], tel: ['+97333333333'] }]);
      assert.equal(rows[0].numbers.length, 1);
    }
    if (nextResult === 'empty') assert.deepEqual(selectedContactRows([]), []);
    assert.deepEqual(pending, [], `${nextResult} cannot expose stale number choices`);
  }
});

const empty = () => [{ name: '', phone: '', dial: '+973', deliveryMethod: 'whatsapp', email: '' }];
const contact = (name, ...tel) => ({ name: [name], tel });

test('one or several single-number contacts add immediately without a confirmation', () => {
  const one = partitionContactSelection([contact('A', '+97333931331')], 1);
  assert.equal(one.pending.length, 0);
  assert.deepEqual(mergeContactRecipients(empty(), one.immediate).recipients.map(row => row.name), ['A']);
  const many = partitionContactSelection([contact('A', '+97333931331'), contact('B', '+97339000000')], 2);
  assert.equal(many.pending.length, 0);
  assert.deepEqual(mergeContactRecipients(empty(), many.immediate).recipients.map(row => row.name), ['A', 'B']);
});

test('multi-number contacts alone show choices; mixed batches add singles and retain original order as choices resolve', () => {
  const multi = partitionContactSelection([contact('Only', '+97333931331', '+97339000000')], 3);
  assert.equal(multi.immediate.length, 0);
  assert.equal(multi.pending.length, 1);
  const mixed = partitionContactSelection([
    contact('First', '+97333931331'),
    contact('Second', '+97339000000', '+97336000000'),
    contact('Third', '+12025550123'),
    contact('Fourth', '+12025550124', '+12025550125')
  ], 4);
  assert.deepEqual(mixed.immediate.map(row => row.name), ['First', 'Third']);
  assert.deepEqual(mixed.pending.map(row => row.name), ['Second', 'Fourth']);
  let rows = mergeContactRecipients(empty(), mixed.immediate).recipients;
  rows = mergeContactRecipients(rows, [{ ...mixed.pending[1], phone: mixed.pending[1].numbers[0] }]).recipients;
  rows = mergeContactRecipients(rows, [{ ...mixed.pending[0], phone: mixed.pending[0].numbers[1] }]).recipients;
  assert.deepEqual(rows.map(row => row.name), ['First', 'Second', 'Third', 'Fourth']);
});

test('cancellation leaves already added singles and drops unresolved choices', () => {
  const mixed = partitionContactSelection([contact('Single', '+97333931331'), contact('Multi', '+97339000000', '+97336000000')], 5);
  const rows = mergeContactRecipients(empty(), mixed.immediate).recipients;
  let pending = mixed.pending;
  startPickerSelection(value => { pending = value; });
  assert.deepEqual(rows.map(row => row.name), ['Single']);
  assert.deepEqual(pending, []);
});

test('new picker invocations retain distinct batch IDs after a UI remount', () => {
  assert.notEqual(nextContactSelectionBatchId(), nextContactSelectionBatchId());
});

test('missing country code remains an editable row and duplicates are skipped', () => {
  const selected = partitionContactSelection([contact('Needs correction', '33931331'), contact('Valid', '+97339000000')], 6);
  const result = mergeContactRecipients(empty(), selected.immediate);
  assert.equal(result.added, 2);
  assert.equal(result.recipients[0].dial, '');
  assert.equal(result.recipients[0].phone, '33931331');
  assert.equal(result.recipients[0].fromContact, true);
  const duplicates = mergeContactRecipients(result.recipients, [
    { name: 'Duplicate', phone: '+973 3900 0000', batchId: 7, selectionOrder: 0 },
    { name: 'Duplicate raw', phone: '33931331', batchId: 7, selectionOrder: 1 }
  ]);
  assert.equal(duplicates.duplicates, 2);
  assert.equal(duplicates.recipients.length, 2);
});

test('50-recipient cap applies across immediate and later number choices', () => {
  const rows = Array.from({ length: 49 }, (_, index) => ({ name: `Existing ${index}`, phone: `20255501${String(index).padStart(2, '0')}`, dial: '+1', deliveryMethod: 'whatsapp' }));
  const result = mergeContactRecipients(rows, [
    { name: 'A', phone: '+97333931331', batchId: 8, selectionOrder: 0 },
    { name: 'B', phone: '+97339000000', batchId: 8, selectionOrder: 1 }
  ]);
  assert.equal(result.recipients.length, 50);
  assert.equal(result.overLimit, 1);
});

test('picker UI resolves each number directly without Add selected contacts action', () => {
  const source = fs.readFileSync(path.resolve('src/components/ContactPickerButton.jsx'), 'utf8');
  assert.match(source, /onSelect\(immediate\)/);
  assert.match(source, /onSelect\(\[\{ name: row\.name, phone: event\.target\.value/);
  assert.doesNotMatch(source, /Add selected contacts|إضافة المحددين/);
});

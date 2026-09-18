import test from 'node:test';
import assert from 'node:assert/strict';
import { pickerAvailable, internationalPhone, recipientPhoneIdentity, selectedContactRows } from './contactPicker.js';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../JIGZO/ContactPickerBridge.js', import.meta.url), 'utf8');

function loadBridge({ host = 'staging.jigzo.biz', configuredHost = 'staging.jigzo.biz',
                      topLevel = true, handler } = {}) {
  const window = { isSecureContext: true, webkit: { messageHandlers: { jigzoContacts: handler } } };
  window.top = topLevel ? window : {};
  const navigator = {};
  runInNewContext(source.replaceAll('__JIGZO_ALLOWED_HOST__', configuredHost), {
    window, navigator, location: { protocol: 'https:', hostname: host }, Promise, TypeError, Object, Array, Set
  });
  return navigator;
}

test('native picker appears only on JIGZO main frame and waits for a user click', async () => {
  const calls = [];
  const handler = { postMessage: request => { calls.push(request); return Promise.resolve([]); } };
  assert.equal(loadBridge({ host: 'other.example', handler }).contacts, undefined);
  assert.equal(loadBridge({ host: 'jigzo.biz', handler }).contacts, undefined);
  assert.ok(loadBridge({ host: 'jigzo.biz', configuredHost: 'jigzo.biz', handler }).contacts);
  assert.equal(loadBridge({ topLevel: false, handler }).contacts, undefined);
  const navigator = loadBridge({ handler });
  assert.deepEqual(Array.from(await navigator.contacts.getProperties()), ['name', 'tel']);
  assert.equal(calls.length, 0);
  await navigator.contacts.select(['name', 'tel'], { multiple: true });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),
    [{ action: 'select', fields: ['name', 'tel'], multiple: true }]);
});

test('selected names and phone choices retain the existing React picker shape', async () => {
  const rows = [{ name: ['Sara'], tel: ['+973 3393 1331', '+973 3900 0000'] },
    { name: ['Omar'], tel: ['33931331'] }];
  const navigator = loadBridge({ handler: { postMessage: () => Promise.resolve(rows) } });
  assert.deepEqual(await navigator.contacts.select(['name', 'tel'], { multiple: true }), rows);
  await assert.rejects(navigator.contacts.select(['email'], { multiple: true }), TypeError);
  await assert.rejects(navigator.contacts.select(['name', 'tel'], { multiple: false }), TypeError);
});

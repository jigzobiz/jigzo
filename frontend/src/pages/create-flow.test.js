import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import en from '../i18n/locales/en.js';
import ar from '../i18n/locales/ar.js';

const source = fs.readFileSync(new URL('./CreatePage.jsx', import.meta.url), 'utf8');
const step = (number) => source.split(`{currentStep === ${number} && (`)[1]?.split(/\{currentStep === \d && \(/)[0] || '';

test('five sequential screens keep sender, recipients, identity, and review in order', () => {
  for (let i = 1; i <= 5; i++) assert.ok(step(i), `step ${i} exists`);
  assert.match(source, /Step \$\{step\} of 5/);
  assert.match(step(2), /value=\{senderName\}/);
  assert.match(step(2), /value=\{senderPhone\}/);
  assert.match(step(2), /value=\{message\}/);
  assert.doesNotMatch(step(3), /value=\{senderName\}|value=\{senderPhone\}/);
  assert.match(step(3), /recipients\.map\(\(rec, idx\)/);
  assert.match(step(4), /setRevealIdentity\(true\)/);
  assert.match(step(4), /setRevealIdentity\(false\)/);
  assert.match(step(4), /showIdentity=\{revealIdentity\}/);
  assert.match(step(5), /create\.review\.title/);
});

test('recipient and sender data still feed the original creation payloads', () => {
  assert.equal((source.match(/senderName,\s*senderPhone: normalizePhoneInput\(`\$\{senderDial\}\$\{senderPhone\}`\)/g) || []).length, 2);
  assert.equal((source.match(/recipients: formattedRecipients/g) || []).length, 2);
  assert.match(source, /packageForRecipientCount\(recipients\.length\)/);
  assert.match(source, /mergeContactRecipients\(recipients, selected\)/);
  assert.match(source, /recipients\.length < 50/);
  assert.match(source, /recipientPhoneIdentity\(r\.dial, r\.phone\)/);
  assert.match(source, /<ContactPickerButton onSelect=\{addSelectedContacts\}/);
  assert.match(source, /recipient-name-picker-row[\s\S]*?<input type="text" placeholder=\{t\('create\.delivery\.recipientPlaceholder'\)\}[\s\S]*?<ContactPickerButton onSelect=\{addSelectedContacts\}/);
  assert.match(source, /rec\.fromContact && !normalizePhoneInput[\s\S]*?startsWith\('\+'\)/);
});

test('recipient count drives the visible package and price', () => {
  assert.match(source, /packageForRecipientCount\(recipients\.length\)/);
  assert.match(step(3), /count: recipients\.length, package: t/);
  assert.match(step(3), /price: formatPrice\(currentPack\.price\)/);
});

test('new sender, recipient, and identity copy exists in English and Arabic', () => {
  for (const locale of [en, ar]) {
    assert.ok(locale.create.progress.step5);
    assert.ok(locale.create.sender.from);
    assert.ok(locale.create.delivery.to);
    assert.ok(locale.create.delivery.personalizedEach);
    assert.ok(locale.create.delivery.packageSummary);
    assert.ok(locale.create.identity.reveal);
    assert.ok(locale.create.identity.anonymous);
  }
});

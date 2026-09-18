import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { zonedTimeToUtcIso, utcIsoToZonedParts } from './timezone-utils.js';

// Regression coverage for the Business Studio timezone bug: campaign timezone must be
// the single source of truth for event date/time, exactly like it already is for
// scheduled delivery. timezone-utils.js is plain JS (no JSX), so it's imported and
// actually EXECUTED here for real proof — everything touching CampaignStudioContext.jsx
// or BusinessCampaignStudioPage.jsx (JSX, not directly importable by node --test in this
// codebase) is verified structurally via fs.readFileSync + regex, consistent with the
// rest of this suite.

const studioContextSrc = () => fs.readFileSync(path.resolve('src/business/studio/CampaignStudioContext.jsx'), 'utf8');
const studioPageSrc = () => fs.readFileSync(path.resolve('src/pages/business/BusinessCampaignStudioPage.jsx'), 'utf8');
const homePageSrc = () => fs.readFileSync(path.resolve('src/pages/business/BusinessHomePage.jsx'), 'utf8');
const recipientPageSrc = () => fs.readFileSync(path.resolve('src/pages/InvitationRecipientPage.jsx'), 'utf8');

test('1. Asia/Bahrain 2026-10-24 19:30 serializes to the correct absolute UTC instant (Bahrain is a fixed UTC+3, no DST)', () => {
  assert.equal(zonedTimeToUtcIso('2026-10-24', '19:30', 'Asia/Bahrain'), '2026-10-24T16:30:00.000Z');
});

test('2. That UTC instant hydrates back to 19:30 in Asia/Bahrain', () => {
  assert.deepEqual(utcIsoToZonedParts('2026-10-24T16:30:00.000Z', 'Asia/Bahrain'), { date: '2026-10-24', time: '19:30' });
});

test('3. A different timezone produces a genuinely different UTC instant for the same wall-clock time', () => {
  const bahrain = zonedTimeToUtcIso('2026-10-24', '19:30', 'Asia/Bahrain');
  const dubai = zonedTimeToUtcIso('2026-10-24', '19:30', 'Asia/Dubai');
  assert.equal(dubai, '2026-10-24T15:30:00.000Z'); // Dubai is UTC+4, one hour ahead of Bahrain
  assert.notEqual(bahrain, dubai);
});

test('4. Serialization and hydration do NOT depend on the executing environment\'s own system timezone', () => {
  // Run the same conversion in child processes under different TZ env vars and confirm
  // identical results — this is what actually proves independence from "browser/system
  // timezone", not just asserting a value once under whatever TZ this test happens to run in.
  const moduleUrl = pathToFileURL(path.resolve('src/business/studio/timezone-utils.js')).href;
  const script = `
    import { zonedTimeToUtcIso, utcIsoToZonedParts } from '${moduleUrl}';
    console.log(JSON.stringify({
      toUtc: zonedTimeToUtcIso('2026-10-24','19:30','Asia/Bahrain'),
      fromUtc: utcIsoToZonedParts('2026-10-24T16:30:00.000Z','Asia/Bahrain')
    }));
  `;
  const runUnder = (tz) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }));
  const underUtc = runUnder('UTC');
  const underNewYork = runUnder('America/New_York');
  const underTokyo = runUnder('Asia/Tokyo');
  assert.deepEqual(underUtc, underNewYork);
  assert.deepEqual(underUtc, underTokyo);
  assert.equal(underUtc.toUtc, '2026-10-24T16:30:00.000Z');
  assert.deepEqual(underUtc.fromUtc, { date: '2026-10-24', time: '19:30' });
});

test('4b. The conversion is also correct across a DST transition (a zone that actually observes DST, unlike Bahrain/Dubai)', () => {
  assert.equal(zonedTimeToUtcIso('2026-07-01', '12:00', 'America/New_York'), '2026-07-01T16:00:00.000Z'); // EDT, UTC-4
  assert.equal(zonedTimeToUtcIso('2026-01-01', '12:00', 'America/New_York'), '2026-01-01T17:00:00.000Z'); // EST, UTC-5
});

test('5. Studio hydration reconstructs the campaign-local wall-clock digits from a stored UTC instant (fromServer), which is what the event preview/Review summary display', () => {
  const src = studioContextSrc();
  // fromServer computes ONE timezone (the campaign's own, from invitation.timezone) and
  // uses it for BOTH eventDateTime and scheduledSendAt hydration — a single source of
  // truth, not two independently-derived timezone reads.
  assert.match(src, /const timezone = campaign\.invitation\?\.timezone \|\| 'Asia\/Bahrain';/);
  assert.match(src, /const eventParts = campaign\.invitation\?\.eventDateTime \? utcIsoToZonedParts\(campaign\.invitation\.eventDateTime, timezone\) : \{ date: '', time: '' \};/);
  assert.match(src, /dateTime: eventParts\.date && eventParts\.time \? `\$\{eventParts\.date\}T\$\{eventParts\.time\}` : ''/);
  // Verify the actual digits: a campaign stored with eventDateTime=16:30Z and
  // timezone=Asia/Bahrain must hydrate experience.dateTime to the datetime-local value
  // "2026-10-24T19:30" — exactly what the native input, phone preview and Review summary
  // all read directly as the campaign-local wall clock.
  const parts = utcIsoToZonedParts('2026-10-24T16:30:00.000Z', 'Asia/Bahrain');
  assert.equal(`${parts.date}T${parts.time}`, '2026-10-24T19:30');
});

test('6. Serialization converts the wall-clock + campaign timezone into a true UTC instant before it ever reaches the backend (toServer)', () => {
  const src = studioContextSrc();
  assert.match(src, /const \[eventDate, eventTime\] = \(state\.experience\.dateTime \|\| ''\)\.split\('T'\);/);
  assert.match(src, /eventDateTime: zonedTimeToUtcIso\(eventDate, eventTime, state\.experience\.timezone\)/);
  // The old bug: sending the raw datetime-local string as-is, with no conversion.
  assert.doesNotMatch(src, /eventDateTime: state\.experience\.dateTime \|\| null/);
});

test('7. Recipient-facing event time is derived from the stored UTC instant formatted with the campaign timezone, not the recipient\'s browser locale/zone (untouched this pass)', () => {
  const page = recipientPageSrc();
  assert.match(page, /new Date\(invitation\.eventDateTime\)\.toLocaleString\([^)]*timeZone:invitation\.timezone/);
  // Combined with test 6 (a true UTC instant is now always stored) this proves the
  // recipient sees the intended campaign-local hour end to end, regardless of their own
  // device's timezone or locale (locale may change formatting, never the instant/zone).
});

test('8. Scheduled delivery conversion is unchanged and still correct — same shared timezone-utils functions, same call site', () => {
  const page = studioPageSrc();
  assert.match(page, /zonedTimeToUtcIso\(state\.schedule\.date, state\.schedule\.time, state\.experience\.timezone\)/);
  const src = studioContextSrc();
  assert.match(src, /const parts = campaign\.scheduledSendAt \? utcIsoToZonedParts\(campaign\.scheduledSendAt, timezone\) : \{ date: '', time: '' \};/);
  // The scheduling call site was not edited to use a second/different conversion path —
  // both eventDateTime and scheduledSendAt hydration now share the exact same `timezone`
  // constant computed once at the top of fromServer.
  const fromServerBody = src.match(/export function fromServer\(state, campaign\) \{([\s\S]*?)\n\}/)[0];
  assert.equal((fromServerBody.match(/utcIsoToZonedParts\(/g) || []).length, 2);
});

test('9. RSVP deadline stays an untouched date-only value — no timezone conversion introduced for it', () => {
  const src = studioContextSrc();
  assert.match(src, /rsvpDeadline: campaign\.invitation\?\.rsvpDeadline \? String\(campaign\.invitation\.rsvpDeadline\)\.slice\(0, 10\) : ''/);
  assert.match(src, /rsvpDeadline: state\.experience\.rsvpDeadline \|\| null/);
  // Neither the read (hydration) nor write (serialization) side of rsvpDeadline calls
  // the timezone-conversion helper — it stays a plain passthrough date-only string.
  const rsvpReadValue = src.match(/rsvpDeadline: (campaign\.invitation\?\.rsvpDeadline[^,]+),/)[1];
  const rsvpWriteValue = src.match(/rsvpDeadline: (state\.experience\.rsvpDeadline[^,]+),/)[1];
  assert.doesNotMatch(rsvpReadValue, /zonedTimeToUtcIso|utcIsoToZonedParts/);
  assert.doesNotMatch(rsvpWriteValue, /zonedTimeToUtcIso|utcIsoToZonedParts/);
});

test('10. No consumer code was touched by this fix', () => {
  const receive = fs.readFileSync(path.resolve('src/pages/ReceivePage.jsx'), 'utf8');
  const create = fs.readFileSync(path.resolve('src/pages/CreatePage.jsx'), 'utf8');
  assert.doesNotMatch(receive, /timezone-utils|CampaignStudioContext/);
  assert.doesNotMatch(create, /timezone-utils|CampaignStudioContext/);
});

test('11. Other Business surfaces (campaign list Home page) that display event timing also use the campaign timezone, not the viewer\'s browser zone', () => {
  const home = homePageSrc();
  assert.match(home, /formatDate\(campaign\.invitation\.eventDateTime, isArabic, campaign\.invitation\?\.timezone\)/g);
  const eventDateTimeCalls = [...home.matchAll(/formatDate\(campaign\.invitation\.eventDateTime,[^)]*\)/g)];
  assert.equal(eventDateTimeCalls.length, 2);
  for (const call of eventDateTimeCalls) assert.match(call[0], /campaign\.invitation\?\.timezone/);
  // campaign.updatedAt is a record-modification timestamp, not event timing — correctly
  // left showing in the viewer's own local time, not forced through campaign timezone.
  assert.match(home, /formatDate\(campaign\.updatedAt, isArabic\)/);
});

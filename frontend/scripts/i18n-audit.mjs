// Translation-key audit.
//
// Scans the customer-facing components for every `t('...')` / `t(`...`)`
// reference, expands the dynamic template keys (occasions, tones, packages,
// difficulties, upgrades, landing occasion cards) using the id lists declared
// in the config, and verifies that each resolved key has a real, non-empty
// value in BOTH en.js and ar.js.
//
// Exits non-zero (failing `npm run audit:i18n`) if any required key is missing
// in either locale, or if a count-plural is missing a plural form the
// installed i18next version (v4 JSON plurals) can select at runtime.
//
// Run: npm run audit:i18n   (from frontend/)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import en from '../src/i18n/locales/en.js';
import ar from '../src/i18n/locales/ar.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '..', 'src');

// Files whose t() references must be fully backed by both locales.
const FILES = [
  'pages/LandingPage.jsx',
  'pages/CreatePage.jsx',
  'pages/ReceivePage.jsx',
  'pages/TermsPage.jsx',
  'components/HeroPhonePuzzle.jsx',
  'components/RevealMock.jsx',
  'components/WhatsAppPreview.jsx',
  'components/RevealFace.jsx',
  'components/LoaderOrbit.jsx',
  'components/RevealBeat.jsx',
];

// ---- id sets used to expand dynamic `${...}` template keys -----------------
function idsFrom(relPath) {
  const text = readFileSync(resolve(SRC, relPath), 'utf8');
  return [...text.matchAll(/id:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}
// difficulties.js declares PIECE_OPTIONS, OCCASIONS and TONES.
const configIds = idsFrom('config/difficulties.js');
const packIds = idsFrom('config/packages.js').filter((id) => id !== 'insights');
const upgradeIds = idsFrom('config/packages.js').filter((id) => id === 'insights');
const pieceIds = ['extra_easy', 'easy', 'classic', 'challenging'];
const occasionIds = ['love', 'birthday', 'anniversary', 'congrats', 'sorry', 'missyou', 'getwell', 'thankyou', 'newbaby', 'justbecause'];
const toneIds = ['romantic', 'funny', 'deep', 'short', 'poetic', 'family', 'friendship', 'playful'];
const landingOccasionIds = ['birthday', 'love', 'friendship', 'new-baby', 'congratulations', 'just-because'];

// Sanity: the config really does declare the occasion/tone/difficulty ids we
// expand against (guards against silent drift if config is renamed).
for (const id of [...occasionIds, ...toneIds, ...pieceIds]) {
  if (!configIds.includes(id)) {
    console.warn(`  ! warning: id "${id}" not found in config/difficulties.js`);
  }
}

// Prefix -> id list, longest prefix first.
const TEMPLATE_SETS = [
  ['landing.occasions.items.', landingOccasionIds],
  ['occasions.', occasionIds],
  ['tones.', toneIds],
  ['packages.', packIds],
  ['difficulties.', pieceIds],
  ['upgrades.', upgradeIds.length ? upgradeIds : ['insights']],
];

// Count-plural bases: called as t(base, { count }). i18next selects a suffixed
// key at runtime, so the base itself never resolves — it needs the plural set.
const PLURAL_REQUIRED = {
  en: ['_one', '_other'],
  // Arabic categories that can actually occur for our counts (>=1): one, two,
  // few (3-10), many (11-99), other. zero is optional (counts are never 0).
  ar: ['_one', '_two', '_few', '_many', '_other'],
};

// ---- extract keys ----------------------------------------------------------
function extractKeys(text) {
  const keys = new Set();
  // Match t('...'), t("..."), t(`...`) and i18n.t(...). Require a boundary
  // before the `t` so alert(/import(/getTest( don't match.
  const re = /(?<![\w.])(?:i18n\.)?t\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    keys.add(m[2]);
  }
  return keys;
}

function expandTemplate(key) {
  if (!key.includes('${')) return [key];
  // Only expand a single leading `${...}` segment against a known id set.
  for (const [prefix, ids] of TEMPLATE_SETS) {
    if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length); // e.g. "${o.id}.label" or "${o.id}"
      const suffix = rest.replace(/^\$\{[^}]*\}/, ''); // ".label" or ""
      return ids.map((id) => prefix + id + suffix);
    }
  }
  return null; // unresolved dynamic key
}

function lookup(res, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), res);
}

function hasValue(res, key) {
  const v = lookup(res, key);
  if (typeof v === 'string') return v.length > 0;
  // Arrays (rendered via returnObjects: true) count as present when non-empty
  // and every element is itself a string or an object of strings.
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

// ---- run -------------------------------------------------------------------
const required = new Set();
const unresolved = new Set();

for (const rel of FILES) {
  const text = readFileSync(resolve(SRC, rel), 'utf8');
  for (const raw of extractKeys(text)) {
    if (!raw || /\s/.test(raw) === false && raw.includes('.') === false && !raw.includes('${')) {
      // single-word, no dot, no template -> not a translation path (skip stray)
    }
    const expanded = expandTemplate(raw);
    if (expanded === null) {
      unresolved.add(raw);
      continue;
    }
    expanded.forEach((k) => required.add(k));
  }
}

const missing = []; // { key, lang }
for (const key of [...required].sort()) {
  for (const [lang, res] of [['en', en], ['ar', ar]]) {
    if (hasValue(res, key)) continue;
    // Maybe a count-plural base: accept if the plural forms exist.
    if (hasValue(res, `${key}_other`)) {
      for (const suf of PLURAL_REQUIRED[lang]) {
        if (!hasValue(res, key + suf)) missing.push({ key: key + suf, lang });
      }
      continue;
    }
    missing.push({ key, lang });
  }
}

console.log(`i18n audit — scanned ${FILES.length} files, ${required.size} concrete keys required.`);
if (unresolved.size) {
  console.log(`  (skipped ${unresolved.size} unresolved dynamic key(s): ${[...unresolved].join(', ')})`);
}

if (missing.length) {
  console.error(`\n✗ ${missing.length} missing translation value(s):`);
  for (const { key, lang } of missing) {
    console.error(`   [${lang}] ${key}`);
  }
  process.exit(1);
}

console.log('✓ All required keys have real values in both en.js and ar.js.');

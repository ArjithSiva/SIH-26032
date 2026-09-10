// Uses whatever's already in process.env, but also reads backend/.env
// directly first (a tiny inline parser, so this script has no dependency
// on the `dotenv` package needing to be resolvable from this directory) -
// so running `npm run generate:translations` from backend/ picks up
// BHASHINI_USER_ID/BHASHINI_API_KEY from backend/.env automatically,
// without needing them exported in your shell separately.
const fs = require('fs');
const path = require('path');

function loadBackendEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env) && value) process.env[key] = value;
  }
}
loadBackendEnv();

const { translateBatch, isConfigured } = require('../backend/utils/bhashiniClient');

const LOCALES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');
// All 22 languages of the Eighth Schedule to the Constitution, plus English
// as the source. The IVR simulator deliberately keeps its own separate,
// hand-verified prompt set limited to en/ta/hi/te (see
// backend/controllers/ivrController.js) - it is NOT affected by this list.
const TARGET_LANGS = [
  'as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml',
  'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur',
];

async function run() {
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const keys = Object.keys(en);
  const values = Object.values(en);

  if (!isConfigured()) {
    console.warn(
      '[generate:translations] BHASHINI_USER_ID/BHASHINI_API_KEY not set - writing English text into ' +
        'every locale file as a placeholder so the app still builds. Re-run this once the keys are ' +
        'configured to get real translations.'
    );
  }

  for (const lang of TARGET_LANGS) {
    const outPath = path.join(LOCALES_DIR, `${lang}.json`);
    let translatedValues = values;

    if (isConfigured()) {
      // Only re-translate keys that are new or whose English text changed
      // since the last run, so this stays cheap to re-run as the app grows.
      let existing = {};
      try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch { /* first run */ }
      const existingEn = fs.existsSync(path.join(LOCALES_DIR, '.en.snapshot.json'))
        ? JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, '.en.snapshot.json'), 'utf8'))
        : {};

      const toTranslateIdx = keys
        .map((k, i) => i)
        .filter((i) => en[keys[i]] !== existingEn[keys[i]] || !(keys[i] in existing));

      if (toTranslateIdx.length > 0) {
        const results = await translateBatch(toTranslateIdx.map((i) => values[i]), lang);
        toTranslateIdx.forEach((i, j) => { existing[keys[i]] = results[j]; });
      }
      translatedValues = keys.map((k) => existing[k] ?? en[k]);
      console.log(`[generate:translations] ${lang}: translated ${toTranslateIdx.length}/${keys.length} string(s).`);
    }

    const out = Object.fromEntries(keys.map((k, i) => [k, translatedValues[i]]));
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  }

  fs.writeFileSync(path.join(LOCALES_DIR, '.en.snapshot.json'), JSON.stringify(en, null, 2) + '\n');
  console.log('[generate:translations] Done.');
}

run().catch((err) => {
  console.error('[generate:translations] Failed:', err.message);
  process.exit(1);
});

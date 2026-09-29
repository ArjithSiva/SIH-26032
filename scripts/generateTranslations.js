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

const { translateBatchChunked, isConfigured } = require('../backend/utils/bhashiniClient');

const LOCALES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'locales');
const META_DIR = path.join(LOCALES_DIR, '.meta');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');
// All 22 languages of the Eighth Schedule to the Constitution, plus English
// as the source. The IVR simulator deliberately keeps its own separate,
// hand-verified prompt set limited to en/ta/hi/te (see
// backend/controllers/ivrController.js) - it is NOT affected by this list.
const TARGET_LANGS = [
  'as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml',
  'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur',
];

// IMPORTANT: history of this file. It used to compare the current en.json
// against ONE SHARED ".en.snapshot.json" written unconditionally after any
// run where Bhashini keys were merely *present* (not after a run that
// actually succeeded). That meant:
//   - a single failed API call for one language got treated exactly like a
//     successful translation and was never retried, and
//   - success/failure for one language could never be told apart from any
//     other language, because the snapshot was global, not per-language.
// Fixed by keeping a small per-language "meta" file
// (frontend/src/locales/.meta/<lang>.json) that records, for each key, the
// exact English source text that was successfully translated to produce
// the value currently sitting in <lang>.json. A key is only considered
// "done" for a language if that meta file has it AND its recorded English
// text still matches en.json. Anything else - never translated, source
// text changed, or a previous attempt for THIS language failed - gets
// retried on the next run, and a failure for one language can no longer
// mask or be masked by another language's success.
function loadJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

async function run() {
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const keys = Object.keys(en);
  const configured = isConfigured();
  fs.mkdirSync(META_DIR, { recursive: true });

  if (!configured) {
    console.warn(
      '[generate:translations] BHASHINI_USER_ID/BHASHINI_API_KEY not set - writing English text into ' +
        'every locale file as a placeholder so the app still builds. Re-run this once the keys are ' +
        'configured to get real translations.'
    );
    for (const lang of TARGET_LANGS) {
      const outPath = path.join(LOCALES_DIR, `${lang}.json`);
      fs.writeFileSync(outPath, JSON.stringify(en, null, 2) + '\n');
      // Deliberately do NOT write a meta file here - an unconfigured
      // placeholder run must never be trusted as "already translated" by a
      // later configured run.
    }
    console.log('[generate:translations] Done (placeholder mode).');
    return;
  }

  let anyFailures = false;

  for (const lang of TARGET_LANGS) {
    const outPath = path.join(LOCALES_DIR, `${lang}.json`);
    const metaPath = path.join(META_DIR, `${lang}.json`);
    const existing = loadJsonSafe(outPath);
    const meta = loadJsonSafe(metaPath);

    const toTranslateKeys = keys.filter((k) => meta[k] !== en[k]);

    if (toTranslateKeys.length === 0) {
      console.log(`[generate:translations] ${lang}: translated 0/${keys.length} string(s) (already up to date).`);
      continue;
    }

    // Fill in any key that's never existed in this locale file at all (e.g.
    // a brand-new key) with English as an interim value up front, so the
    // output file stays complete/valid even if a chunk further down fails.
    for (const k of keys) if (!(k in existing)) existing[k] = en[k];

    let translatedCount = 0;
    const persistChunk = (chunkTexts, chunkTranslations, startIndex) => {
      chunkTexts.forEach((_, i) => {
        const k = toTranslateKeys[startIndex + i];
        existing[k] = chunkTranslations[i];
        meta[k] = en[k];
      });
      translatedCount += chunkTexts.length;
      // Persist after every chunk, not just at the end of the language -
      // this way a chunk that fails later doesn't discard translations
      // that already succeeded (see translateBatchChunked doc comment).
      fs.writeFileSync(outPath, JSON.stringify(existing, null, 2) + '\n');
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
    };

    try {
      await translateBatchChunked(toTranslateKeys.map((k) => en[k]), lang, 'en', persistChunk);
      console.log(`[generate:translations] ${lang}: translated ${translatedCount}/${keys.length} string(s).`);
    } catch (err) {
      anyFailures = true;
      // Whatever chunks succeeded before this one failed have already been
      // written by persistChunk above. Keys not yet translated simply
      // aren't in meta yet, so meta[k] !== en[k] still holds for them and
      // they'll be retried (in fresh, hopefully smaller-context chunks) on
      // the next run - only the genuinely-unfinished tail is redone.
      console.error(
        `[generate:translations] ${lang}: FAILED after ${translatedCount}/${toTranslateKeys.length} pending string(s) - ${err.message}`
      );
    }
  }

  if (anyFailures) {
    console.error(
      '[generate:translations] One or more languages failed - see the FAILED lines above for the real ' +
        'HTTP status/response from Bhashini. Nothing for a failed language was cached as done, so re-run ' +
        'this command after addressing the cause and only the failed keys will be retried.'
    );
  }
  console.log('[generate:translations] Done.');
}

run().catch((err) => {
  console.error('[generate:translations] Failed:', err.message);
  process.exit(1);
});

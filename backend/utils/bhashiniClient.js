const axios = require('axios');

// --- Bhashini/ULCA auth, in two steps -------------------------------------
// 1) Send your userID + ulcaApiKey (from "My Profile -> Generate API Key" on
//    the ULCA portal) to the Pipeline Config endpoint, asking for the tasks
//    you need (translation, tts). It replies with the specific model/
//    service IDs for each task PLUS a separate `inferenceApiKey` - a third
//    value you don't generate yourself, it's handed back by this call.
// 2) Send the actual text/audio to the Inference (compute) endpoint,
//    authenticated with that inferenceApiKey instead of your original one.
//
// Configure via env vars:
//   BHASHINI_USER_ID       - "userID" from your ULCA profile
//   BHASHINI_API_KEY       - "ulcaApiKey" from your ULCA profile
//   BHASHINI_PIPELINE_ID   - optional, defaults to the public MeitY pipeline
const ULCA_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_PIPELINE_ID = '64392f96daac500b55c543cd';

// BCP-47-ish locale used for TTS voice selection where Bhashini wants one -
// mirrors the codes already used for browser speechSynthesis elsewhere in
// the app, kept here so this file has no dependency on the frontend.
// Covers English plus all 22 languages of the Eighth Schedule, since the
// website's own text (see frontend/src/context/LanguageContext.jsx) now
// offers all of them - the IVR simulator deliberately keeps using only
// en/ta/hi/te (its hand-verified prompt set), so it never asks for
// anything outside that set regardless of what's listed here.
const ISO_LANG = {
  en: 'en', as: 'as', bn: 'bn', brx: 'brx', doi: 'doi', gu: 'gu', hi: 'hi',
  kn: 'kn', ks: 'ks', kok: 'kok', mai: 'mai', ml: 'ml', mni: 'mni', mr: 'mr',
  ne: 'ne', or: 'or', pa: 'pa', sa: 'sa', sat: 'sat', sd: 'sd', ta: 'ta',
  te: 'te', ur: 'ur',
};

let cachedPipeline = null; // { inferenceApiKey, callbackUrl, translationServiceId, ttsServiceId, fetchedAt }
const PIPELINE_CACHE_MS = 6 * 60 * 60 * 1000; // config rarely changes - re-fetch every 6h at most

function isConfigured() {
  return Boolean(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY);
}

async function getPipelineConfig() {
  if (cachedPipeline && Date.now() - cachedPipeline.fetchedAt < PIPELINE_CACHE_MS) {
    return cachedPipeline;
  }

  const { data } = await axios.post(
    ULCA_CONFIG_URL,
    {
      pipelineTasks: [{ taskType: 'translation' }, { taskType: 'tts' }],
      pipelineRequestConfig: { pipelineId: process.env.BHASHINI_PIPELINE_ID || DEFAULT_PIPELINE_ID },
    },
    {
      headers: {
        userID: process.env.BHASHINI_USER_ID,
        ulcaApiKey: process.env.BHASHINI_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const translationConfig = data.pipelineResponseConfig?.find((c) => c.taskType === 'translation');
  const ttsConfig = data.pipelineResponseConfig?.find((c) => c.taskType === 'tts');

  cachedPipeline = {
    inferenceApiKey: data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value,
    inferenceEndpoint: data.pipelineInferenceAPIEndPoint?.callbackUrl,
    translationServiceId: translationConfig?.config?.[0]?.serviceId,
    ttsServiceId: ttsConfig?.config?.[0]?.serviceId,
    fetchedAt: Date.now(),
  };
  return cachedPipeline;
}

/** Translates `text` into `targetLang` via Bhashini. Falls back to the
 * original text unchanged if Bhashini isn't configured or the call fails,
 * same behaviour the old Google-based service had, so nothing upstream
 * needs a try/catch of its own. */
async function translateText(text, targetLang, sourceLang = 'en') {
  const iso = ISO_LANG[targetLang];
  if (!isConfigured() || !text || !iso || targetLang === sourceLang) return text;

  try {
    const pipeline = await getPipelineConfig();
    if (!pipeline.translationServiceId) return text;

    const { data } = await axios.post(
      pipeline.inferenceEndpoint,
      {
        pipelineTasks: [
          {
            taskType: 'translation',
            config: {
              language: { sourceLanguage: ISO_LANG[sourceLang] || 'en', targetLanguage: iso },
              serviceId: pipeline.translationServiceId,
            },
          },
        ],
        inputData: { input: [{ source: text }] },
      },
      {
        headers: { Authorization: pipeline.inferenceApiKey, 'Content-Type': 'application/json' },
        timeout: 8000,
      }
    );
    return data?.pipelineResponse?.[0]?.output?.[0]?.target ?? text;
  } catch (err) {
    console.error('[bhashini] translateText failed, using original text:', err.message);
    return text;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Translates several strings in one call - cheaper than one call each.
 * STRICT version: throws instead of swallowing failures, so a caller that
 * needs to know whether translation actually happened (as opposed to
 * silently falling back to English) can tell the difference. The error
 * message includes the HTTP status/response body when available, since
 * that's usually the only way to tell an auth problem from an unsupported-
 * language-pair problem from a malformed-request problem.
 *
 * Retries up to 3 attempts with backoff (3s, then 8s) before giving up,
 * because in practice the very first call for a language after the
 * pipeline has been idle for a while times out purely from a cold start on
 * Bhashini's side, and previously succeeded only on a second manual
 * `npm run generate:translations`. A language whose model is genuinely
 * unhealthy (not just cold) will still exhaust all 3 attempts and throw,
 * same as before. */
async function translateBatchRaw(texts, targetLang, sourceLang = 'en') {
  if (!isConfigured()) {
    throw new Error('Bhashini is not configured - BHASHINI_USER_ID/BHASHINI_API_KEY missing');
  }
  const iso = ISO_LANG[targetLang];
  if (!iso) throw new Error(`No ISO code mapped for target language "${targetLang}"`);
  if (!texts?.length) return [];
  if (targetLang === sourceLang) return texts;

  const pipeline = await getPipelineConfig();
  if (!pipeline.translationServiceId) {
    throw new Error(
      'Pipeline Config did not return a translation serviceId for this pipeline - check BHASHINI_PIPELINE_ID'
    );
  }
  if (!pipeline.inferenceApiKey || !pipeline.inferenceEndpoint) {
    throw new Error(
      'Pipeline Config did not return an inferenceApiKey/callbackUrl - the response shape may have changed'
    );
  }

  const RETRY_DELAYS_MS = [3000, 8000]; // 3 total attempts: initial + 2 retries
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    let data;
    try {
      ({ data } = await axios.post(
        pipeline.inferenceEndpoint,
        {
          pipelineTasks: [
            {
              taskType: 'translation',
              config: {
                language: { sourceLanguage: ISO_LANG[sourceLang] || 'en', targetLanguage: iso },
                serviceId: pipeline.translationServiceId,
              },
            },
          ],
          inputData: { input: texts.map((source) => ({ source })) },
        },
        {
          headers: { Authorization: pipeline.inferenceApiKey, 'Content-Type': 'application/json' },
          timeout: 20000,
        }
      ));
    } catch (err) {
      // Surface the real HTTP status + response body (Bhashini usually puts
      // the actual reason there - e.g. unsupported language pair for this
      // model, bad auth, quota) rather than just axios's generic message.
      const status = err.response?.status;
      const body = err.response?.data ? JSON.stringify(err.response.data).slice(0, 500) : err.message;
      lastError = new Error(`Inference call failed${status ? ` (HTTP ${status})` : ''}: ${body}`);

      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[bhashini] ${targetLang}: attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} failed (${lastError.message}) - retrying in ${delay / 1000}s...`
        );
        await sleep(delay);
        continue;
      }
      throw lastError;
    }

    const outputs = data?.pipelineResponse?.[0]?.output;
    if (!outputs || outputs.length !== texts.length) {
      lastError = new Error(`Unexpected response shape from Bhashini inference endpoint: ${JSON.stringify(data).slice(0, 500)}`);
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`[bhashini] ${targetLang}: attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} got an unexpected response - retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw lastError;
    }
    return outputs.map((o) => o?.target);
  }
  // Unreachable - the loop above always either returns or throws - but keeps
  // this function's control flow obviously exhaustive to a reader/linter.
  throw lastError;
}

/** Translates a large list of strings by splitting it into smaller chunks
 * and calling translateBatchRaw (with its existing retry-on-cold-start
 * logic) once per chunk, instead of sending everything in a single
 * inference call. This exists because the Bhashini inference endpoint
 * reliably returns "DHRUVA-101: Failed to send request" for every language
 * once a batch gets into the hundreds of strings (e.g. after a large i18n
 * key migration) - the exact same call that works fine at a few dozen
 * strings fails outright at 500+. Batch size defaults to 40 and can be
 * tuned via BHASHINI_TRANSLATE_BATCH_SIZE without a code change.
 *
 * onChunkDone(chunkTexts, chunkTranslations, startIndex), if provided, is
 * called synchronously after each chunk succeeds - callers use this to
 * persist progress immediately, so a failure on a later chunk doesn't
 * discard translations that already succeeded. Throws (after persisting
 * whatever succeeded via onChunkDone) as soon as one chunk exhausts its
 * retries, same "fail loudly" contract as translateBatchRaw. */
async function translateBatchChunked(texts, targetLang, sourceLang = 'en', onChunkDone) {
  if (!texts?.length) return [];
  const chunkSize = Number(process.env.BHASHINI_TRANSLATE_BATCH_SIZE) || 40;

  const results = [];
  for (let start = 0; start < texts.length; start += chunkSize) {
    const chunk = texts.slice(start, start + chunkSize);
    const translated = await translateBatchRaw(chunk, targetLang, sourceLang);
    results.push(...translated);
    if (onChunkDone) onChunkDone(chunk, translated, start);
  }
  return results;
}

/** Backward-compatible wrapper used by the IVR simulator, which needs to
 * always get *something* back to speak - falls back to the original text
 * unchanged and just logs on failure, same as before. Anything that needs
 * to know whether translation actually succeeded (e.g. the site-wide
 * translation generator) should use translateBatchRaw directly instead. */
async function translateBatch(texts, targetLang, sourceLang = 'en') {
  try {
    return await translateBatchRaw(texts, targetLang, sourceLang);
  } catch (err) {
    console.error('[bhashini] translateBatch failed, using original text:', err.message);
    return texts;
  }
}

/** Converts `text` to speech via Bhashini TTS. Returns a base64-encoded
 * audio string (WAV) on success, or null if unconfigured/unavailable - the
 * caller (routes/ivrRoutes.js) falls back to browser speechSynthesis when
 * this comes back null, so the feature degrades gracefully without a key. */
async function textToSpeech(text, lang, gender = 'female') {
  const iso = ISO_LANG[lang];
  if (!isConfigured() || !text || !iso) return null;

  try {
    const pipeline = await getPipelineConfig();
    if (!pipeline.ttsServiceId) return null;

    const { data } = await axios.post(
      pipeline.inferenceEndpoint,
      {
        pipelineTasks: [
          {
            taskType: 'tts',
            config: {
              language: { sourceLanguage: iso },
              serviceId: pipeline.ttsServiceId,
              gender,
              samplingRate: 8000,
            },
          },
        ],
        inputData: { input: [{ source: text }] },
      },
      {
        headers: { Authorization: pipeline.inferenceApiKey, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent ?? null;
  } catch (err) {
    console.error('[bhashini] textToSpeech failed:', err.message);
    return null;
  }
}

module.exports = {
  translateText,
  translateBatch,
  translateBatchRaw,
  translateBatchChunked,
  textToSpeech,
  isConfigured,
};

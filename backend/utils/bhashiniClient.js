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

/** Translates several strings in one call - cheaper than one call each. */
async function translateBatch(texts, targetLang, sourceLang = 'en') {
  const iso = ISO_LANG[targetLang];
  if (!isConfigured() || !texts?.length || !iso || targetLang === sourceLang) return texts;

  try {
    const pipeline = await getPipelineConfig();
    if (!pipeline.translationServiceId) return texts;

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
        inputData: { input: texts.map((source) => ({ source })) },
      },
      {
        headers: { Authorization: pipeline.inferenceApiKey, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    const outputs = data?.pipelineResponse?.[0]?.output;
    if (!outputs) return texts;
    return outputs.map((o, i) => o?.target ?? texts[i]);
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

module.exports = { translateText, translateBatch, textToSpeech, isConfigured };

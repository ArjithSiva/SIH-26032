// The brief calls for "predefined and verified voice recordings instead of
// dynamically translating every sentence". For the prototype we keep that
// spirit but avoid needing audio assets: prompts are predefined, translated
// text per step/language. Playback uses Bhashini text-to-speech when
// configured (see /api/ivr/tts below and utils/bhashiniClient.js), falling
// back to the browser's own speechSynthesis on the frontend if it isn't.
//
// For any language beyond these 4 pre-verified ones, getPrompt/getAllPrompts
// fall back to translating the English text on the fly via Bhashini
// (see utils/translateService.js) - this only ever affects languages this
// file doesn't already carry hand-written text for.
const { translateText, translateBatch } = require('../utils/translateService');
const { textToSpeech, isConfigured: bhashiniConfigured } = require('../utils/bhashiniClient');

const PROMPTS = {
  welcome: {
    en: 'Welcome to the procurement service.',
    ta: 'கொள்முதல் சேவைக்கு வரவேற்கிறோம்.',
    hi: 'खरीद सेवा में आपका स्वागत है।',
    te: 'సేకరణ సేవకు స్వాగతం.',
  },
  language_select: {
    en: 'Press 1 for English. Press 2 for Tamil. Press 3 for Hindi. Press 4 for Telugu.',
    ta: 'ஆங்கிலத்திற்கு 1 அழுத்தவும். தமிழுக்கு 2 அழுத்தவும். இந்திக்கு 3 அழுத்தவும். தெலுங்குக்கு 4 அழுத்தவும்.',
    hi: 'अंग्रेज़ी के लिए 1 दबाएं। तमिल के लिए 2 दबाएं। हिंदी के लिए 3 दबाएं। तेलुगु के लिए 4 दबाएं।',
    te: 'ఇంగ్లీష్ కోసం 1 నొక్కండి. తమిళం కోసం 2 నొక్కండి. హిందీ కోసం 3 నొక్కండి. తెలుగు కోసం 4 నొక్కండి.',
  },
  main_menu: {
    en: 'Press 1 to book a procurement token. Press 2 to check token status. Press 3 to check procurement status. Press 4 to check payment status. Press 5 to change language.',
    ta: 'கொள்முதல் டோக்கன் பதிவு செய்ய 1 அழுத்தவும். டோக்கன் நிலையை அறிய 2 அழுத்தவும். கொள்முதல் நிலையை அறிய 3 அழுத்தவும். கட்டண நிலையை அறிய 4 அழுத்தவும். மொழியை மாற்ற 5 அழுத்தவும்.',
    hi: 'खरीद टोकन बुक करने के लिए 1 दबाएं। टोकन की स्थिति जानने के लिए 2 दबाएं। खरीद की स्थिति जानने के लिए 3 दबाएं। भुगतान की स्थिति जानने के लिए 4 दबाएं। भाषा बदलने के लिए 5 दबाएं।',
    te: 'సేకరణ టోకెన్ బుక్ చేయడానికి 1 నొక్కండి. టోకెన్ స్థితి కోసం 2 నొక్కండి. సేకరణ స్థితి కోసం 3 నొక్కండి. చెల్లింపు స్థితి కోసం 4 నొక్కండి. భాష మార్చడానికి 5 నొక్కండి.',
  },
  choose_centre: {
    en: 'Please choose a procurement centre from the list.',
    ta: 'பட்டியலிலிருந்து ஒரு கொள்முதல் மையத்தைத் தேர்ந்தெடுக்கவும்.',
    hi: 'सूची में से एक खरीद केंद्र चुनें।',
    te: 'జాబితా నుండి ఒక సేకరణ కేంద్రాన్ని ఎంచుకోండి.',
  },
  choose_date: {
    en: 'Please choose an available date.',
    ta: 'கிடைக்கக்கூடிய தேதியைத் தேர்ந்தெடுக்கவும்.',
    hi: 'एक उपलब्ध तारीख चुनें।',
    te: 'అందుబాటులో ఉన్న తేదీని ఎంచుకోండి.',
  },
  choose_slot: {
    en: 'Please choose an available time slot.',
    ta: 'கிடைக்கக்கூடிய நேர இடைவெளியைத் தேர்ந்தெடுக்கவும்.',
    hi: 'एक उपलब्ध समय स्लॉट चुनें।',
    te: 'అందుబాటులో ఉన్న సమయ స్లాట్‌ను ఎంచుకోండి.',
  },
  booking_confirmed: {
    en: 'Your booking is confirmed. Your token number will be read out now.',
    ta: 'உங்கள் முன்பதிவு உறுதி செய்யப்பட்டது. உங்கள் டோக்கன் எண் இப்போது வாசிக்கப்படும்.',
    hi: 'आपकी बुकिंग की पुष्टि हो गई है। आपका टोकन नंबर अब सुनाया जाएगा।',
    te: 'మీ బుకింగ్ నిర్ధారించబడింది. మీ టోకెన్ నంబర్ ఇప్పుడు చదవబడుతుంది.',
  },
  invalid_input: {
    en: 'Sorry, that is not a valid option. Please try again.',
    ta: 'மன்னிக்கவும், இது சரியான தேர்வு அல்ல. மீண்டும் முயற்சிக்கவும்.',
    hi: 'क्षमा करें, यह एक मान्य विकल्प नहीं है। कृपया पुनः प्रयास करें।',
    te: 'క్షమించండి, ఇది సరైన ఎంపిక కాదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
  },
};

// GET /api/ivr/prompt/:step?lang=ta
async function getPrompt(req, res) {
  const { step } = req.params;
  const lang = req.query.lang || 'en';

  const stepPrompts = PROMPTS[step];
  if (!stepPrompts) return res.status(404).json({ message: `Unknown IVR step "${step}"` });

  if (stepPrompts[lang]) {
    return res.json({ step, lang, text: stepPrompts[lang] });
  }
  // No hand-written translation for this language - translate the English
  // base text on the fly (no-op if BHASHINI_USER_ID/BHASHINI_API_KEY aren't set).
  const text = await translateText(stepPrompts.en, lang);
  res.json({ step, lang, text, machineTranslated: text !== stepPrompts.en });
}

// GET /api/ivr/prompts?lang=ta  - the whole menu tree at once, so the
// frontend simulator can preload every prompt for the call in one request.
async function getAllPrompts(req, res) {
  const lang = req.query.lang || 'en';
  const steps = Object.keys(PROMPTS);

  const missing = steps.filter((step) => !PROMPTS[step][lang]);
  const translated = missing.length
    ? await translateBatch(missing.map((step) => PROMPTS[step].en), lang)
    : [];

  const out = {};
  steps.forEach((step) => {
    out[step] = PROMPTS[step][lang] || translated[missing.indexOf(step)] || PROMPTS[step].en;
  });
  res.json({ lang, prompts: out });
}

// POST /api/ivr/translate  { text, targetLang }
// General-purpose translation for dynamic content that can't be
// pre-written (e.g. a centre's name, a farmer's own complaint text).
async function translateArbitraryText(req, res) {
  const { text, targetLang, sourceLang } = req.body;
  if (!text || !targetLang) {
    return res.status(400).json({ message: 'text and targetLang are required' });
  }
  const translated = await translateText(text, targetLang, sourceLang || 'en');
  res.json({ text: translated, machineTranslated: translated !== text });
}

// POST /api/ivr/speak  { text, lang, gender? }
// Text-to-speech for BOTH the fixed prompts and dynamic spoken content
// (centre names, dates, slot times) that can't be pre-recorded - the
// frontend always sends the final assembled sentence here rather than
// trying to pre-generate audio for every possible combination. Returns
// { audioContent: <base64 wav> } on success, or { audioContent: null } if
// Bhashini isn't configured / the call failed, so the frontend can fall
// back to the browser's own speechSynthesis without treating it as an error.
async function speak(req, res) {
  const { text, lang, gender } = req.body;
  if (!text || !lang) return res.status(400).json({ message: 'text and lang are required' });

  const audioContent = await textToSpeech(text, lang, gender);
  res.json({ audioContent, bhashiniConfigured: bhashiniConfigured() });
}

module.exports = { getPrompt, getAllPrompts, translateArbitraryText, speak };

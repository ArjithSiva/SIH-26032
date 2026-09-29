import api from '../api/api.js';

const BCP47 = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN' };

let currentAudio = null;

function base64ToBlobUrl(base64, mimeType = 'audio/wav') {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

function speakWithBrowserVoice(text, lang) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = BCP47[lang] || 'en-IN';
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Speaks `text` in `lang` ('en' | 'ta' | 'hi' | 'te'), using real Bhashini
 * TTS audio when the backend has it configured, and falling back to the
 * browser's own voice otherwise - callers don't need to know which one
 * actually happened. Resolves once playback finishes (or immediately if
 * nothing could be played).
 */
export async function speakText(text, lang) {
  if (!text) return;
  cancelSpeech();

  try {
    const { data } = await api.post('/ivr/speak', { text, lang });
    if (data.audioContent) {
      const url = base64ToBlobUrl(data.audioContent);
      currentAudio = new Audio(url);
      await new Promise((resolve) => {
        currentAudio.onended = resolve;
        currentAudio.onerror = resolve;
        currentAudio.play().catch(resolve);
      });
      URL.revokeObjectURL(url);
      return;
    }
  } catch {
    // fall through to the browser voice below
  }
  await speakWithBrowserVoice(text, lang);
}

/** Stops whatever is currently being spoken (Bhashini audio or browser voice). */
export function cancelSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

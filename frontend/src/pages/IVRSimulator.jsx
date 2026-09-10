import { useEffect, useRef, useState } from 'react';
import api from '../api/api.js';
import PhoneKeypad from '../components/PhoneKeypad.jsx';
import { speakText, cancelSpeech } from '../utils/speech.js';

const LANG_BY_KEY = { 1: 'en', 2: 'ta', 3: 'hi', 4: 'te' };

// Small connector-phrase dictionary for assembling spoken option lists
// (centre names, dates, slot times) that can't be pre-recorded/pre-written
// like the fixed PROMPTS on the backend - these few words are all that's
// pre-translated here, and the dynamic value (name/date/time) is read as-is
// in between them, then the whole assembled sentence goes through Bhashini
// TTS in one /ivr/speak call (see utils/speech.js).
const OPTION_PHRASES = {
  en: { option: (n) => `Option ${n}.`, inDistrict: (d) => `in ${d} district.`, seatsLeft: (n) => `${n} seats left.` },
  ta: { option: (n) => `விருப்பம் ${n}.`, inDistrict: (d) => `${d} மாவட்டத்தில்.`, seatsLeft: (n) => `${n} இடங்கள் மீதம்.` },
  hi: { option: (n) => `विकल्प ${n}.`, inDistrict: (d) => `${d} जिले में।`, seatsLeft: (n) => `${n} सीटें बाकी हैं।` },
  te: { option: (n) => `ఎంపిక ${n}.`, inDistrict: (d) => `${d} జిల్లాలో.`, seatsLeft: (n) => `${n} సీట్లు మిగిలి ఉన్నాయి.` },
};

export default function IVRSimulator() {
  const [muted, setMuted] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [connected, setConnected] = useState(false);
  const [farmer, setFarmer] = useState(null);
  const [lang, setLang] = useState('en');
  const [step, setStep] = useState('idle'); // idle -> language_select -> main_menu -> ...
  const [promptText, setPromptText] = useState('');
  const [captionLog, setCaptionLog] = useState([]);
  const [options, setOptions] = useState([]); // [{key, label, value}]
  const [flowData, setFlowData] = useState({}); // accumulates centre/date/slot/crop selections
  const [error, setError] = useState('');
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const langRef = useRef(lang);
  langRef.current = lang;

  function speak(text) {
    setCaptionLog((log) => [...log, text]);
    if (mutedRef.current) return;
    speakText(text, langRef.current);
  }

  // Reads out every option in the list, one after another - this is what
  // actually lets a real phone caller (who can't see the on-screen option
  // buttons the simulator also renders) hear the centre names, dates or
  // slot times instead of just the generic "please choose..." prompt.
  async function speakOptions(items) {
    const phrases = OPTION_PHRASES[langRef.current] || OPTION_PHRASES.en;
    for (const item of items) {
      if (mutedRef.current) break;
      const sentence = `${phrases.option(item.key)} ${item.spoken}`;
      setCaptionLog((log) => [...log, sentence]);
      // eslint-disable-next-line no-await-in-loop
      await speakText(sentence, langRef.current);
    }
  }

  async function playPrompt(stepKey, languageOverride) {
    const useLang = languageOverride || lang;
    try {
      const { data } = await api.get(`/ivr/prompt/${stepKey}`, { params: { lang: useLang } });
      setPromptText(data.text);
      speak(data.text);
    } catch {
      setPromptText('');
    }
  }

  async function startCall(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.get('/auth/farmer/lookup', { params: { mobileNumber } });
      setFarmer(data);
      setConnected(true);
      setLang(data.preferredLanguage || 'en');
      setStep('language_select');
      await playPrompt('welcome', data.preferredLanguage);
      await playPrompt('language_select', data.preferredLanguage);
    } catch (err) {
      setError(err.response?.data?.message || 'This number is not registered. Register on the web app first.');
    }
  }

  async function goToMainMenu() {
    setStep('main_menu');
    setOptions([]);
    setFlowData({});
    await playPrompt('main_menu');
  }

  async function loadCentres() {
    const { data } = await api.get('/centres');
    const items = data.slice(0, 9).map((c, i) => ({
      key: String(i + 1),
      label: `${c.name} (${c.district})`,
      value: c,
      spoken: `${c.name}, ${(OPTION_PHRASES[langRef.current] || OPTION_PHRASES.en).inDistrict(c.district)}`,
    }));
    setOptions(items);
    setStep('choose_centre');
    await playPrompt('choose_centre');
    await speakOptions(items);
  }

  async function loadDates(centre) {
    const { data } = await api.get('/slots/upcoming-dates', { params: { days: 5 } });
    const items = data.dates.map((d, i) => ({ key: String(i + 1), label: d, value: d, spoken: d }));
    setOptions(items);
    setFlowData((f) => ({ ...f, centre }));
    setStep('choose_date');
    await playPrompt('choose_date');
    await speakOptions(items);
  }

  async function loadSlots(date) {
    const { data } = await api.get('/slots', { params: { centreId: flowData.centre._id, date } });
    const available = data.slots.filter((s) => s.status === 'available');
    const items = available.slice(0, 9).map((s, i) => ({
      key: String(i + 1),
      label: `${s.startTime}-${s.endTime} (${s.remaining} left)`,
      value: s,
      spoken: `${s.startTime} to ${s.endTime}. ${(OPTION_PHRASES[langRef.current] || OPTION_PHRASES.en).seatsLeft(s.remaining)}`,
    }));
    setOptions(items);
    setFlowData((f) => ({ ...f, date }));
    setStep('choose_slot');
    await playPrompt('choose_slot');
    await speakOptions(items);
  }

  async function confirmBooking(slot) {
    setFlowData((f) => ({ ...f, slot }));
    try {
      const crop = flowData.centre.supportedCrops?.[0] || 'Paddy';
      const { data: booking } = await api.post('/bookings', {
        farmerId: farmer._id,
        slotId: slot._id,
        crop,
        channel: 'ivr',
      });
      setFlowData((f) => ({ ...f, booking }));
      setStep('booking_confirmed');
      await playPrompt('booking_confirmed');
      speak(`Token ${booking.token.split('').join(' ')}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
      setStep('main_menu');
    }
  }

  async function checkTokenStatus() {
    const { data } = await api.get(`/bookings/farmer/${farmer._id}`);
    if (!data.length) {
      speak('You have no bookings yet.');
      return;
    }
    const latest = data[0];
    const { data: detail } = await api.get(`/bookings/token/${latest.token}`);
    speak(
      `Your latest token is ${latest.token.split('').join(' ')}. ${
        detail.queue.aheadCount > 0
          ? `${detail.queue.aheadCount} farmers are ahead of you.`
          : 'You are next or currently being served.'
      }`
    );
  }

  async function checkProcurementStatus() {
    const { data } = await api.get(`/bookings/farmer/${farmer._id}`);
    if (!data.length) return speak('You have no bookings yet.');
    speak(`Procurement stage: ${data[0].procurementStage.replace(/_/g, ' ')}.`);
  }

  async function checkPaymentStatus() {
    const { data } = await api.get(`/bookings/farmer/${farmer._id}`);
    if (!data.length) return speak('You have no bookings yet.');
    const b = data[0];
    speak(
      b.paymentStatus === 'completed'
        ? `Payment of rupees ${b.paidAmount} has been completed.`
        : `Payment status: ${b.paymentStatus.replace(/_/g, ' ')}.`
    );
  }

  async function handleKey(key) {
    if (step === 'language_select') {
      const chosen = LANG_BY_KEY[key];
      if (!chosen) return playPrompt('invalid_input').then(() => playPrompt('language_select'));
      setLang(chosen);
      await goToMainMenuWithLang(chosen);
      return;
    }

    if (step === 'main_menu') {
      if (key === '1') return loadCentres();
      if (key === '2') return checkTokenStatus();
      if (key === '3') return checkProcurementStatus();
      if (key === '4') return checkPaymentStatus();
      if (key === '5') { setStep('language_select'); return playPrompt('language_select'); }
      return playPrompt('invalid_input').then(() => playPrompt('main_menu'));
    }

    if (step === 'choose_centre') {
      const match = options.find((o) => o.key === key);
      if (!match) return playPrompt('invalid_input').then(() => playPrompt('choose_centre'));
      return loadDates(match.value);
    }

    if (step === 'choose_date') {
      const match = options.find((o) => o.key === key);
      if (!match) return playPrompt('invalid_input').then(() => playPrompt('choose_date'));
      return loadSlots(match.value);
    }

    if (step === 'choose_slot') {
      const match = options.find((o) => o.key === key);
      if (!match) return playPrompt('invalid_input').then(() => playPrompt('choose_slot'));
      return confirmBooking(match.value);
    }

    if (step === 'booking_confirmed') {
      return goToMainMenu();
    }
  }

  async function goToMainMenuWithLang(useLang) {
    setStep('main_menu');
    await playPrompt('main_menu', useLang);
  }

  function endCall() {
    cancelSpeech();
    setConnected(false);
    setFarmer(null);
    setStep('idle');
    setCaptionLog([]);
    setOptions([]);
    setFlowData({});
    setPromptText('');
  }

  useEffect(() => () => cancelSpeech(), []);

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-h1">IVR simulator</h1>
      <p className="mt-1 text-p2 text-muted">
        Simulates calling in from a feature phone. Same backend, same bookings — just reached by keypad
        instead of a screen.
      </p>

      <div className="card mt-6">
        {!connected && (
          <form onSubmit={startCall} className="space-y-4">
            <div>
              <label className="field-label">Calling from (registered mobile number)</label>
              <input
                required
                pattern="[0-9]{10}"
                className="field-input"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="9876543210"
              />
            </div>
            {error && <p className="text-p2 text-danger">{error}</p>}
            <button type="submit" className="btn-primary w-full">📞 Start call</button>
          </form>
        )}

        {connected && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-p2 text-muted">Connected as {farmer.name}</p>
              <div className="flex gap-2">
                <button onClick={() => setMuted((m) => !m)} className="btn-outline px-2 py-1 text-small">
                  {muted ? 'Unmute voice' : 'Mute voice'}
                </button>
                <button onClick={endCall} className="btn-outline px-2 py-1 text-small text-danger">End call</button>
              </div>
            </div>

            <div className="mt-4 min-h-[80px] rounded bg-primary-light p-4 text-p2 text-primary-dark">
              {promptText || '...'}
            </div>

            {options.length > 0 && (
              <ul className="mt-3 space-y-1 text-p2">
                {options.map((o) => (
                  <li key={o.key}><strong>{o.key}.</strong> {o.label}</li>
                ))}
              </ul>
            )}

            {step === 'booking_confirmed' && flowData.booking && (
              <p className="mt-3 text-center text-h1 text-primary">{flowData.booking.token}</p>
            )}

            <div className="mt-5">
              <PhoneKeypad onPress={handleKey} disabled={step === 'idle'} />
            </div>

            <details className="mt-4 text-small text-muted">
              <summary className="cursor-pointer">Call transcript (captions)</summary>
              <ul className="mt-2 space-y-1">
                {captionLog.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { MotionDiv, cardMotion } from '../../components/motion.js';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { joinFarmerRoom } = useSocket();
  const { t } = useLanguage();

  const [mobileNumber, setMobileNumber] = useState(location.state?.mobileNumber || '');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [stage, setStage] = useState('mobile'); // 'mobile' | 'otp'
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function requestOTP(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/farmer/request-otp', { mobileNumber });
      setDevCode(data.devCode || null);
      setStage('otp');
    } catch (err) {
      setError(err.response?.data?.message || t('farmerLogin.error.otpRequestFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOTP(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/farmer/verify-otp', { mobileNumber, code: otp });
      login(data.token, data.farmer, 'farmer');
      joinFarmerRoom(data.farmer._id);
      navigate(data.farmer.registrationComplete ? '/farmer/home' : '/farmer/register');
    } catch (err) {
      setError(err.response?.data?.message || t('farmerLogin.error.invalidOtp'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-142px)] place-items-center bg-gradient-to-br from-primary-light/40 to-[#EEF7FB] px-5 py-12">
      <MotionDiv className="card w-full max-w-md" {...cardMotion}>
        <h1 className="text-h1">{t('farmerLogin.title')}</h1>
        {location.state?.justRegistered && (
          <p className="mt-1 text-p2 text-primary">{t('farmerLogin.justRegistered')}</p>
        )}

        {stage === 'mobile' && (
          <form onSubmit={requestOTP} className="mt-6 space-y-4">
            <div>
              <label className="field-label">{t('farmerLogin.mobileLabel')}</label>
              <input
                required
                pattern="[0-9]{10}"
                className="field-input"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
            {error && <p className="text-p2 text-danger animate-shake">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? t('farmerLogin.sending') : t('farmerLogin.sendOtp')}
            </button>
          </form>
        )}

        {stage === 'otp' && (
          <form onSubmit={verifyOTP} className="mt-6 space-y-4">
            {devCode && (
              <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
                {t('farmerLogin.demoModeNotice')} <strong>{devCode}</strong>.
              </p>
            )}
            <div>
              <label className="field-label">{t('farmerLogin.otpLabel')}</label>
              <input
                required
                inputMode="numeric"
                className="field-input text-center text-xl tracking-[0.4em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            {error && <p className="text-p2 text-danger animate-shake">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? t('farmerLogin.verifying') : t('farmerLogin.verifyAndContinue')}
            </button>
            <button type="button" onClick={() => setStage('mobile')} className="btn-outline w-full">
              {t('farmerLogin.changeMobile')}
            </button>
          </form>
        )}

        <p className="mt-4 text-p2 text-muted">
          {t('farmerLogin.newFarmer')} <Link to="/farmer/register" className="text-primary underline">{t('farmerLogin.registerHere')}</Link>
        </p>

        <div className="mt-6 border-t border-border pt-4 text-center text-p2">
          <p className="font-bold text-ink">{t('home.help.heading')}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/about" className="text-primary underline">{t('nav.about')}</Link>
            <Link to="/centres/schedules" className="text-primary underline">{t('home.help.centres')}</Link>
            <a href="tel:1800XXXXXXX" className="text-primary underline">{t('home.help.contact')}</a>
          </div>
        </div>
      </MotionDiv>
    </div>
  );
}

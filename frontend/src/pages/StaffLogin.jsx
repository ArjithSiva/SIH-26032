import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { MotionDiv, cardMotion } from '../components/motion.js';

export default function StaffLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/staff/login', { username, password });
      login(data.token, data.staff, data.staff.role);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || t('staffLogin.error.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-142px)] place-items-center bg-gradient-to-br from-primary-light/40 to-[#EEF7FB] px-5 py-12">
      <MotionDiv className="card w-full max-w-md" {...cardMotion}>
        <h1 className="text-h1">{t('staffLogin.title')}</h1>
        <p className="mt-1 text-p2 text-muted">{t('staffLogin.subtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="field-label">{t('staffLogin.username')}</label>
            <input required className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('staffLogin.password')}</label>
            <input
              required
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-p2 text-danger animate-shake">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('staffLogin.loggingIn') : t('staffLogin.login')}
          </button>
        </form>

        <p className="mt-4 rounded bg-accent-light px-3 py-2 text-small text-accent-dark">
          {t('staffLogin.demoAccountNotice')}
        </p>
        <p className="mt-3 text-p2 text-muted">
          {t('staffLogin.lookingForOfficerLogin')} <Link to="/officer/login" className="text-primary underline">{t('staffLogin.goHere')}</Link>
        </p>
      </MotionDiv>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { MotionDiv, cardMotion } from '../../components/motion.js';

export default function OfficerLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { joinCentreRoom } = useSocket();
  const { t } = useLanguage();
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/centres').then(({ data }) => setCentres(data));
  }, []);

  const centreOptions = centres.map((c) => ({
    value: c._id,
    label: `${c.name} (${c.village}, ${c.taluk}, ${c.district})`,
  }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/officer/login', { centreId, password });
      login(data.token, data.staff, 'officer');
      joinCentreRoom(centreId);
      navigate('/officer/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || t('officerLogin.error.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-142px)] place-items-center bg-gradient-to-br from-primary-light/40 to-[#EEF7FB] px-5 py-12">
      <MotionDiv className="card w-full max-w-md" {...cardMotion}>
        <h1 className="text-h1">{t('officerLogin.title')}</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="text-p2 text-danger animate-shake">{error}</p>}
          <SearchableSelect
            label={t('officerLogin.centreLabel')}
            options={centreOptions}
            value={centreId}
            onChange={setCentreId}
            placeholder={t('officerLogin.centreSearchPlaceholder')}
          />
          <div>
            <label className="field-label">{t('officerLogin.passwordLabel')}</label>
            <input
              type="password"
              required
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting || !centreId} className="btn-primary w-full">
            {submitting ? t('officerLogin.loggingIn') : t('officerLogin.login')}
          </button>
        </form>
        <p className="mt-4 text-p2 text-muted">
          <Link to="/staff/login" className="text-primary underline">{t('officerLogin.stateAdminLoginLink')}</Link>
        </p>
      </MotionDiv>
    </div>
  );
}

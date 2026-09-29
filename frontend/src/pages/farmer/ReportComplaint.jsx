import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { API_BASE_URL } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import { MotionForm, MotionDiv, sectionMotion, cardMotion } from '../../components/motion.js';

const MAX_FILES = 3;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, matches the backend limit
// API_BASE_URL is e.g. "http://localhost:5000/api" - uploaded files are
// served from the server root at /uploads/..., not under /api.
const UPLOADS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const STATUS_KEYS = {
  open: 'reportComplaint.status.open',
  in_progress: 'reportComplaint.status.inProgress',
  resolved: 'reportComplaint.status.resolved',
};

const CATEGORY_KEYS = [
  { value: 'long_wait', key: 'reportComplaint.category.longWait' },
  { value: 'rude_behaviour', key: 'reportComplaint.category.rudeBehaviour' },
  { value: 'wrong_weight', key: 'reportComplaint.category.wrongWeight' },
  { value: 'payment_delay', key: 'reportComplaint.category.paymentDelay' },
  { value: 'other', key: 'reportComplaint.category.other' },
];

export default function ReportComplaint() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]); // File[]
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const preferred = session.profile.preferredCentres || [];
    if (preferred.length && typeof preferred[0] === 'object') {
      setCentres(preferred);
    } else {
      api.get('/centres').then(({ data }) => setCentres(data));
    }
    api.get(`/complaints/farmer/${session.profile._id}`).then(({ data }) => setHistory(data)).catch(() => {});
  }, [session.profile]);

  const centreOptions = centres.map((c) => ({ value: c._id, label: c.name }));

  function handleFilesSelected(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file after removing it

    for (const f of picked) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(t('reportComplaint.error.fileType'));
        return;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setError(t('reportComplaint.error.fileSize'));
        return;
      }
    }
    setError('');
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (files.length === 0) {
      setError(t('reportComplaint.error.attachmentRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('farmerId', session.profile._id);
      form.append('centreId', centreId);
      form.append('category', category);
      form.append('message', message);
      files.forEach((f) => form.append('attachments', f));

      // Do NOT set Content-Type manually here - letting axios/the browser
      // set it (with the multipart boundary) automatically is what makes
      // this work; setting it by hand strips the boundary and the server
      // can't parse any field out of the request.
      await api.post('/complaints', form);
      setSubmitted(true);
      setMessage('');
      setFiles([]);
      const { data } = await api.get(`/complaints/farmer/${session.profile._id}`);
      setHistory(data);
    } catch (err) {
      setError(err.response?.data?.message || t('reportComplaint.error.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 animate-fade-in">
      <Link to="/farmer/home" className="text-p2 text-primary underline">← {t('nav.home')}</Link>
      <h1 className="mt-2 text-h1">{t('reportComplaint.title')}</h1>
      <p className="mt-1 text-p2 text-muted">{t('reportComplaint.subtitle')}</p>

      <MotionForm onSubmit={handleSubmit} className="card mt-6 space-y-4" {...sectionMotion}>
        {error && <p className="text-p2 text-danger">{error}</p>}
        {submitted && <p className="text-p2 text-primary">{t('reportComplaint.submittedNotice')}</p>}

        <SearchableSelect label={t('reportComplaint.centreLabel')} options={centreOptions} value={centreId} onChange={setCentreId} />

        <div>
          <label className="field-label">{t('reportComplaint.categoryLabel')}</label>
          <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_KEYS.map((c) => <option key={c.value} value={c.value}>{t(c.key)}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">{t('reportComplaint.messageLabel')}</label>
          <textarea required rows={4} className="field-input" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <div>
          <label className="field-label">{t('reportComplaint.attachmentsLabel')}</label>
          <p className="text-small text-muted">{t('reportComplaint.attachmentsHint')}</p>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-p2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-danger text-small underline">
                    {t('reportComplaint.removeFile')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length < MAX_FILES && (
            <div className="mt-2 space-y-2">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                multiple
                onChange={handleFilesSelected}
                className="field-input"
              />
              {files.length === 0 && (
                <label className="btn-outline flex w-full cursor-pointer items-center justify-center gap-2">
                  📷 {t('reportComplaint.takePhoto')}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting || !centreId} className="btn-primary w-full">
          {submitting ? t('reportComplaint.submitting') : t('reportComplaint.submit')}
        </button>
      </MotionForm>

      {history.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">{t('reportComplaint.historyTitle')}</h2>
          <div className="space-y-2">
            {history.map((c, i) => (
              <MotionDiv key={c._id} className="card" {...cardMotion} transition={{ ...cardMotion.transition, delay: i * 0.06 }}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{c.centre?.name}</p>
                  <span className="text-small capitalize text-muted">{t(STATUS_KEYS[c.status] || c.status)}</span>
                </div>
                <p className="mt-1 text-p2 text-muted">{c.message}</p>
                {c.attachments?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.attachments.map((a, i) => (
                      <a
                        key={a}
                        href={`${UPLOADS_BASE_URL}/uploads/${a}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-small text-primary underline"
                      >
                        {t('reportComplaint.attachmentLink')} {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </MotionDiv>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

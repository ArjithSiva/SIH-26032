import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';

const CATEGORIES = [
  { value: 'long_wait', label: 'Long wait / queue not moving' },
  { value: 'rude_behaviour', label: 'Rude behaviour from staff' },
  { value: 'wrong_weight', label: 'Incorrect weight or quantity recorded' },
  { value: 'payment_delay', label: 'Payment delay' },
  { value: 'other', label: 'Other' },
];

export default function ReportComplaint() {
  const { session } = useAuth();
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/complaints', { farmerId: session.profile._id, centreId, category, message });
      setSubmitted(true);
      setMessage('');
      const { data } = await api.get(`/complaints/farmer/${session.profile._id}`);
      setHistory(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not file complaint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 animate-fade-in">
      <Link to="/farmer/home" className="text-p2 text-primary underline">← Home</Link>
      <h1 className="mt-2 text-h1">Report / Complaint</h1>
      <p className="mt-1 text-p2 text-muted">Tell us what happened at a procurement centre - the state admin will review it.</p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        {error && <p className="text-p2 text-danger">{error}</p>}
        {submitted && <p className="text-p2 text-primary">Complaint submitted. Thank you.</p>}

        <SearchableSelect label="Which centre is this about?" options={centreOptions} value={centreId} onChange={setCentreId} />

        <div>
          <label className="field-label">Type of issue</label>
          <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">Describe the issue</label>
          <textarea required rows={4} className="field-input" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <button type="submit" disabled={submitting || !centreId} className="btn-primary w-full">
          {submitting ? 'Submitting...' : 'Submit complaint'}
        </button>
      </form>

      {history.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">Your past complaints</h2>
          <div className="space-y-2">
            {history.map((c) => (
              <div key={c._id} className="card">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{c.centre?.name}</p>
                  <span className="text-small capitalize text-muted">{c.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-1 text-p2 text-muted">{c.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

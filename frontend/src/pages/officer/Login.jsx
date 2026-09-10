import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';

export default function OfficerLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { joinCentreRoom } = useSocket();
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
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-h1">Procurement Centre Login</h1>
      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        {error && <p className="text-p2 text-danger">{error}</p>}
        <SearchableSelect
          label="Your centre"
          options={centreOptions}
          value={centreId}
          onChange={setCentreId}
          placeholder="Search your centre by name, village or district..."
        />
        <div>
          <label className="field-label">Password</label>
          <input
            type="password"
            required
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting || !centreId} className="btn-primary w-full">
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-p2 text-muted">
        <Link to="/staff/login" className="text-primary underline">State admin login</Link>
      </p>
    </div>
  );
}

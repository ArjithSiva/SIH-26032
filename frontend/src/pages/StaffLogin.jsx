import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function StaffLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

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
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-h1">State admin login</h1>
      <p className="mt-1 text-p2 text-muted">For the Master/State admin account.</p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="field-label">Username</label>
          <input required className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Password</label>
          <input
            required
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-p2 text-danger">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-4 rounded bg-accent-light px-3 py-2 text-small text-accent-dark">
        Demo account (after running the seed script): admin / admin123
      </p>
      <p className="mt-3 text-p2 text-muted">
        Looking for a procurement centre login? <Link to="/officer/login" className="text-primary underline">Go here</Link>
      </p>
    </div>
  );
}

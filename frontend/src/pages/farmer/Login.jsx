import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { joinFarmerRoom } = useSocket();

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
      setError(err.response?.data?.message || 'Could not send OTP');
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
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-h1">Farmer login</h1>
      {location.state?.justRegistered && (
        <p className="mt-1 text-p2 text-primary">Registered. Log in with your mobile number to continue.</p>
      )}

      {stage === 'mobile' && (
        <form onSubmit={requestOTP} className="card mt-6 space-y-4">
          <div>
            <label className="field-label">Mobile number</label>
            <input
              required
              pattern="[0-9]{10}"
              className="field-input"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
            />
          </div>
          {error && <p className="text-p2 text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={verifyOTP} className="card mt-6 space-y-4">
          {devCode && (
            <p className="rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
              Demo mode: no real SMS is sent. Your OTP is <strong>{devCode}</strong>.
            </p>
          )}
          <div>
            <label className="field-label">Enter OTP</label>
            <input
              required
              inputMode="numeric"
              className="field-input"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
          {error && <p className="text-p2 text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Verifying...' : 'Verify & continue'}
          </button>
          <button type="button" onClick={() => setStage('mobile')} className="btn-outline w-full">
            Change mobile number
          </button>
        </form>
      )}

      <p className="mt-4 text-p2 text-muted">
        New farmer? <Link to="/farmer/register" className="text-primary underline">Register here</Link>
      </p>
    </div>
  );
}

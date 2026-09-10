import { useEffect, useState, useCallback } from 'react';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

const NEXT_STAGE = {
  checked_in: 'weighing',
  weighing: 'quality_verification',
  quality_verification: 'procurement_completed',
};

const NEXT_STAGE_LABEL = {
  checked_in: 'Start weighing',
  weighing: 'Mark quality verified',
  quality_verification: 'Mark procurement completed',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BookingRow({ booking, onRefresh }) {
  const [crop, setCrop] = useState(booking.crop || '');
  const [quantity, setQuantity] = useState(booking.quantity || '');
  const [paidAmount, setPaidAmount] = useState(booking.estimatedValue || '');
  const [busy, setBusy] = useState(false);

  async function act(fn) {
    setBusy(true);
    try {
      await fn();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const checkIn = () => act(() => api.post(`/queue/${booking._id}/check-in`));
  const callNext = () => act(() => api.post(`/queue/${booking._id}/call-next`));
  const markAbsent = () => act(() => api.post(`/queue/${booking._id}/mark-absent`));
  const advanceStage = (stage) => act(() => api.post(`/procurement/${booking._id}/stage`, { stage }));
  const saveQuantity = () =>
    act(() => api.post(`/procurement/${booking._id}/quantity`, { crop, quantity: Number(quantity) }));
  const markPaymentProcessing = () => act(() => api.post(`/payments/${booking._id}`, { status: 'processing' }));
  const completePayment = () =>
    act(() => api.post(`/payments/${booking._id}`, { status: 'completed', paidAmount: Number(paidAmount) }));

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-primary">{booking.token} · {booking.startTime}–{booking.endTime}</p>
          <p className="text-p2 text-muted">{booking.farmer?.name} · {booking.farmer?.mobileNumber}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={booking.queueStatus} />
          <StatusBadge status={booking.paymentStatus} />
        </div>
      </div>

      <p className="mt-2 text-small text-muted">Stage: {booking.procurementStage.replace(/_/g, ' ')}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {booking.procurementStage === 'booked' && booking.queueStatus === 'waiting' && (
          <button disabled={busy} onClick={checkIn} className="btn-outline text-p2">Check in</button>
        )}

        {booking.procurementStage === 'checked_in' && booking.queueStatus === 'waiting' && (
          <>
            <button disabled={busy} onClick={callNext} className="btn-primary text-p2">Call next</button>
            <button disabled={busy} onClick={markAbsent} className="btn-outline text-p2">Mark absent</button>
          </>
        )}

        {NEXT_STAGE[booking.procurementStage] && booking.queueStatus === 'processing' && (
          <button
            disabled={busy}
            onClick={() => advanceStage(NEXT_STAGE[booking.procurementStage])}
            className="btn-primary text-p2"
          >
            {NEXT_STAGE_LABEL[booking.procurementStage]}
          </button>
        )}
      </div>

      {(booking.procurementStage === 'weighing' || booking.procurementStage === 'quality_verification') && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div>
            <label className="field-label">Crop</label>
            <input className="field-input w-32" value={crop} onChange={(e) => setCrop(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Quantity ({booking.unit || 'unit'}s)</label>
            <input
              type="number"
              className="field-input w-28"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <button disabled={busy || !crop || !quantity} onClick={saveQuantity} className="btn-outline text-p2">
            Save
          </button>
        </div>
      )}

      {booking.procurementStage === 'procurement_completed' && booking.paymentStatus === 'pending' && (
        <div className="mt-3 border-t border-border pt-3">
          <button disabled={busy} onClick={markPaymentProcessing} className="btn-outline text-p2">
            Start payment processing
          </button>
        </div>
      )}

      {booking.paymentStatus === 'processing' && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div>
            <label className="field-label">Amount to pay (₹)</label>
            <input
              type="number"
              className="field-input w-32"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </div>
          <button disabled={busy || !paidAmount} onClick={completePayment} className="btn-primary text-p2">
            Complete payment
          </button>
        </div>
      )}
    </div>
  );
}

const DAY_LABELS = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
const ALL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function CentreSettingsPanel({ centreId }) {
  const [centre, setCentre] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('');
  const [capacityPerSlot, setCapacityPerSlot] = useState('');
  const [workingDays, setWorkingDays] = useState([]);
  const [crops, setCrops] = useState([]); // [{name, maxQuantity}]

  useEffect(() => {
    api.get(`/centres/${centreId}`).then(({ data }) => {
      setCentre(data);
      setOpeningTime(data.openingTime);
      setClosingTime(data.closingTime);
      setSlotDurationMinutes(data.slotDurationMinutes);
      setCapacityPerSlot(data.capacityPerSlot);
      setWorkingDays(data.workingDays || []);
      setCrops(data.crops?.length ? data.crops : [{ name: '', maxQuantity: '' }]);
    });
  }, [centreId]);

  function toggleDay(day) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function updateCropRow(i, field, value) {
    setCrops((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function addCropRow() {
    setCrops((prev) => [...prev, { name: '', maxQuantity: '' }]);
  }

  function removeCropRow(i) {
    setCrops((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const { data } = await api.put(`/centres/${centreId}`, {
        openingTime,
        closingTime,
        slotDurationMinutes: Number(slotDurationMinutes),
        capacityPerSlot: Number(capacityPerSlot),
        workingDays,
        crops: crops
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name.trim(), maxQuantity: c.maxQuantity ? Number(c.maxQuantity) : null })),
      });
      setCentre(data);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!centre) return <p className="mt-4 text-p2 text-muted">Loading centre settings...</p>;

  const limits = centre.policyLimits || {};

  return (
    <form onSubmit={handleSave} className="mt-5 space-y-5">
      <p className="text-p2 text-muted">
        Bounds in <em>italics</em> below are set by the state admin and can't be exceeded from here.
      </p>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {saved && <p className="text-p2 text-primary">Settings saved.</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Opening time <em className="text-muted">(from {limits.earliestOpeningTime})</em></label>
          <input type="time" className="field-input" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Closing time <em className="text-muted">(until {limits.latestClosingTime})</em></label>
          <input type="time" className="field-input" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label">
            Slot duration (min) <em className="text-muted">({limits.minSlotDurationMinutes}-{limits.maxSlotDurationMinutes})</em>
          </label>
          <input
            type="number"
            className="field-input"
            value={slotDurationMinutes}
            onChange={(e) => setSlotDurationMinutes(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">
            Queue limit per slot <em className="text-muted">({limits.minCapacityPerSlot}-{limits.maxCapacityPerSlot})</em>
          </label>
          <input
            type="number"
            className="field-input"
            value={capacityPerSlot}
            onChange={(e) => setCapacityPerSlot(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="field-label">Working days</label>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => toggleDay(d)}
              className={`rounded border px-3 py-1 text-p2 ${
                workingDays.includes(d) ? 'border-primary bg-primary-light text-primary-dark' : 'border-border text-muted'
              }`}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">Crops accepted &amp; max quantity per farmer (kg)</label>
        <div className="space-y-2">
          {crops.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="Crop name"
                value={c.name}
                onChange={(e) => updateCropRow(i, 'name', e.target.value)}
              />
              <input
                type="number"
                className="field-input w-32"
                placeholder="Max qty"
                value={c.maxQuantity ?? ''}
                onChange={(e) => updateCropRow(i, 'maxQuantity', e.target.value)}
              />
              <button type="button" onClick={() => removeCropRow(i)} className="btn-outline px-3 text-danger">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCropRow} className="mt-2 text-p2 text-primary underline">+ Add crop</button>
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? 'Saving...' : 'Save settings'}
      </button>
    </form>
  );
}

function ChangeOfficerPasswordPanel({ centreId }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/centres/${centreId}/password`, { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-5 space-y-3">
      <h2 className="text-p2 font-semibold text-muted">Change centre login password</h2>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {success && <p className="text-p2 text-primary">Password updated.</p>}
      <input type="password" required placeholder="Current password" className="field-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <input type="password" required minLength={6} placeholder="New password" className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <input type="password" required placeholder="Confirm new password" className="field-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <button type="submit" disabled={saving} className="btn-outline w-full">{saving ? 'Saving...' : 'Change password'}</button>
    </form>
  );
}

export default function OfficerDashboard() {
  const { session } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [queueData, setQueueData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('queue'); // queue | settings

  const load = useCallback(() => {
    api
      .get(`/queue/centre/${session.profile.centre}/date/${date}`)
      .then(({ data }) => setQueueData(data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load queue'));
  }, [session.profile.centre, date]);

  useEffect(() => {
    if (tab === 'queue') load();
  }, [load, tab]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{session.profile.centreName || session.profile.name}</h1>
        {tab === 'queue' && (
          <input type="date" className="field-input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
      </div>

      {session.profile.mustChangePassword && (
        <p className="mt-3 rounded bg-accent-light px-3 py-2 text-p2 text-accent-dark">
          This centre is still using its starting password. Please set your own in Centre settings below.
        </p>
      )}

      <div className="mt-4 flex gap-2 border-b border-border">
        {['queue', 'settings'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-p2 capitalize ${tab === t ? 'border-b-2 border-primary font-semibold text-primary' : 'text-muted'}`}
          >
            {t === 'queue' ? "Today's queue" : 'Centre settings'}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-p2 text-danger">{error}</p>}

      {tab === 'queue' && (
        <>
          {queueData && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(queueData.summary).map(([key, value]) => (
                <div key={key} className="card text-center">
                  <p className="text-h1 text-primary">{value}</p>
                  <p className="text-small capitalize text-muted">{key.replace(/([A-Z])/g, ' $1')}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {queueData?.bookings.length === 0 && (
              <p className="text-p2 text-muted">No bookings for this date yet.</p>
            )}
            {queueData?.bookings.map((b) => (
              <BookingRow key={b._id} booking={b} onRefresh={load} />
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <CentreSettingsPanel centreId={session.profile.centre} />
          <ChangeOfficerPasswordPanel centreId={session.profile.centre} />
        </>
      )}
    </div>
  );
}

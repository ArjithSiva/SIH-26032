import { useEffect, useState, useCallback } from 'react';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import NotificationCentre from '../../components/NotificationCentre.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { MotionDiv, MotionForm, cardMotion, sectionMotion } from '../../components/motion.js';

const NEXT_STAGE = {
  checked_in: 'weighing',
  weighing: 'quality_verification',
  quality_verification: 'procurement_completed',
};

const NEXT_STAGE_KEYS = {
  checked_in: 'officerDashboard.action.startWeighing',
  weighing: 'officerDashboard.action.markQualityVerified',
  quality_verification: 'officerDashboard.action.markProcurementCompleted',
};

const STAGE_KEYS = {
  booked: 'trackBooking.stage.booked',
  checked_in: 'trackBooking.stage.checkedIn',
  weighing: 'trackBooking.stage.weighing',
  quality_verification: 'trackBooking.stage.qualityVerification',
  procurement_completed: 'trackBooking.stage.procurementCompleted',
  payment_processing: 'trackBooking.stage.paymentProcessing',
  payment_completed: 'trackBooking.stage.paymentCompleted',
};

const SUMMARY_KEYS = {
  totalBooked: 'officerDashboard.summary.totalBooked',
  checkedIn: 'officerDashboard.summary.checkedIn',
  completed: 'officerDashboard.summary.completed',
  waiting: 'officerDashboard.summary.waiting',
  remainingToday: 'officerDashboard.summary.remainingToday',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BookingRow({ booking, onRefresh, t }) {
  const [crop, setCrop] = useState(booking.crop || '');
  const [quantity, setQuantity] = useState(booking.quantity || '');
  const [busy, setBusy] = useState(false);

  async function act(fn) {
    setBusy(true);
    try {
      await fn();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || t('officerDashboard.error.actionFailed'));
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
  // The centre's only payment action now - processing and completing the
  // payment moved to the admin (see paymentController.js). This just sends
  // it to admin's review queue.
  const requestPayment = () => act(() => api.post(`/payments/${booking._id}/request`));

  return (
    <MotionDiv className="card" {...cardMotion}>
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

      <p className="mt-2 text-small text-muted">{t('officerDashboard.stageLabel')}: {t(STAGE_KEYS[booking.procurementStage] || '') || booking.procurementStage.replace(/_/g, ' ')}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {booking.procurementStage === 'booked' && booking.queueStatus === 'waiting' && (
          <button disabled={busy} onClick={checkIn} className="btn-outline text-p2">{t('officerDashboard.action.checkIn')}</button>
        )}

        {booking.procurementStage === 'checked_in' && booking.queueStatus === 'waiting' && (
          <>
            <button disabled={busy} onClick={callNext} className="btn-primary text-p2">{t('officerDashboard.action.callNext')}</button>
            <button disabled={busy} onClick={markAbsent} className="btn-outline text-p2">{t('officerDashboard.action.markAbsent')}</button>
          </>
        )}

        {/* Procurement paperwork (weighing/quality/completion) can - and
            often does - continue after the live queue has moved on to the
            next farmer (queueStatus flips to 'completed' the moment
            someone else in the same slot is called next). Gating this on
            queueStatus === 'processing' left a booking permanently stuck
            with no way forward the moment that happened - it's gated on
            procurementStage alone now, only excluding a booking that was
            actually marked absent or cancelled. */}
        {NEXT_STAGE[booking.procurementStage] && !['absent', 'cancelled'].includes(booking.queueStatus) && (
          <button
            disabled={busy}
            onClick={() => advanceStage(NEXT_STAGE[booking.procurementStage])}
            className="btn-primary text-p2"
          >
            {t(NEXT_STAGE_KEYS[booking.procurementStage])}
          </button>
        )}
      </div>

      {(booking.procurementStage === 'weighing' || booking.procurementStage === 'quality_verification') && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div>
            <label className="field-label">{t('officerDashboard.crop')}</label>
            <input className="field-input w-32" value={crop} onChange={(e) => setCrop(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('officerDashboard.quantity')} ({booking.unit || t('qrGatePass.unitFallback')}s)</label>
            <input
              type="number"
              className="field-input w-28"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <button disabled={busy || !crop || !quantity} onClick={saveQuantity} className="btn-outline text-p2">
            {t('common.save')}
          </button>
        </div>
      )}

      {booking.procurementStage === 'procurement_completed' && booking.paymentStatus === 'pending' && (
        <div className="mt-3 border-t border-border pt-3">
          <button disabled={busy} onClick={requestPayment} className="btn-outline text-p2">
            {t('officerDashboard.action.requestPayment')}
          </button>
        </div>
      )}

      {booking.paymentStatus === 'requested' && (
        <p className="mt-3 border-t border-border pt-3 text-p2 text-muted">{t('officerDashboard.payment.awaitingAdmin')}</p>
      )}

      {booking.paymentStatus === 'processing' && (
        <p className="mt-3 border-t border-border pt-3 text-p2 text-muted">{t('officerDashboard.payment.beingProcessed')}</p>
      )}
    </MotionDiv>
  );
}

const DAY_KEYS = {
  MO: 'day.mon', TU: 'day.tue', WE: 'day.wed', TH: 'day.thu',
  FR: 'day.fri', SA: 'day.sat', SU: 'day.sun',
};
const ALL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function CentreSettingsPanel({ centreId, t }) {
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
      setError(err.response?.data?.message || t('officerDashboard.settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (!centre) return <p className="mt-4 text-p2 text-muted">{t('officerDashboard.settings.loading')}</p>;

  const limits = centre.policyLimits || {};

  return (
    <form onSubmit={handleSave} className="mt-5 space-y-5">
      <p className="text-p2 text-muted">{t('officerDashboard.settings.boundsNote')}</p>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {saved && <p className="text-p2 text-primary">{t('officerDashboard.settings.saved')}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">{t('officerDashboard.settings.openingTime')} <em className="text-muted">({t('officerDashboard.settings.from')} {limits.earliestOpeningTime})</em></label>
          <input type="time" className="field-input" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label">{t('officerDashboard.settings.closingTime')} <em className="text-muted">({t('officerDashboard.settings.until')} {limits.latestClosingTime})</em></label>
          <input type="time" className="field-input" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label">
            {t('officerDashboard.settings.slotDuration')} <em className="text-muted">({limits.minSlotDurationMinutes}-{limits.maxSlotDurationMinutes})</em>
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
            {t('officerDashboard.settings.queueLimit')} <em className="text-muted">({limits.minCapacityPerSlot}-{limits.maxCapacityPerSlot})</em>
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
        <label className="field-label">{t('centreSchedules.workingDays')}</label>
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
              {t(DAY_KEYS[d])}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">{t('officerDashboard.settings.cropsHeading')}</label>
        <div className="space-y-2">
          {crops.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="field-input flex-1"
                placeholder={t('officerDashboard.settings.cropNamePlaceholder')}
                value={c.name}
                onChange={(e) => updateCropRow(i, 'name', e.target.value)}
              />
              <input
                type="number"
                className="field-input w-32"
                placeholder={t('officerDashboard.settings.maxQtyPlaceholder')}
                value={c.maxQuantity ?? ''}
                onChange={(e) => updateCropRow(i, 'maxQuantity', e.target.value)}
              />
              <button type="button" onClick={() => removeCropRow(i)} className="btn-outline px-3 text-danger">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCropRow} className="mt-2 text-p2 text-primary underline">+ {t('officerDashboard.settings.addCrop')}</button>
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? t('common.saving') : t('officerDashboard.settings.save')}
      </button>
    </form>
  );
}

function ChangeOfficerPasswordPanel({ centreId, t }) {
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
      setError(t('officerDashboard.password.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.put(`/centres/${centreId}/password`, { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || t('officerDashboard.password.changeFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <MotionForm onSubmit={handleSubmit} className="card mt-5 space-y-3" {...sectionMotion}>
      <h2 className="text-p2 font-semibold text-muted">{t('officerDashboard.password.heading')}</h2>
      {error && <p className="text-p2 text-danger">{error}</p>}
      {success && <p className="text-p2 text-primary">{t('officerDashboard.password.updated')}</p>}
      <input type="password" required placeholder={t('officerDashboard.password.current')} className="field-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <input type="password" required minLength={6} placeholder={t('officerDashboard.password.new')} className="field-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <input type="password" required placeholder={t('officerDashboard.password.confirmNew')} className="field-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <button type="submit" disabled={saving} className="btn-outline w-full">{saving ? t('common.saving') : t('officerDashboard.password.change')}</button>
    </MotionForm>
  );
}

export default function OfficerDashboard() {
  const { session } = useAuth();
  const { socket } = useSocket();
  const { t } = useLanguage();
  const [date, setDate] = useState(todayISO());
  const [queueData, setQueueData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('queue'); // queue | settings

  const load = useCallback(() => {
    api
      .get(`/queue/centre/${session.profile.centre}/date/${date}`)
      .then(({ data }) => setQueueData(data))
      .catch((err) => setError(err.response?.data?.message || t('officerDashboard.error.loadQueueFailed')));
  }, [session.profile.centre, date, t]);

  useEffect(() => {
    if (tab === 'queue') load();
  }, [load, tab]);

  // The backend already broadcasts 'queue:update' to this centre's room on
  // every check-in/call-next/mark-absent/cancel, but until now nothing on
  // the frontend ever listened for it - each officer's dashboard only ever
  // refreshed itself right after ITS OWN button click. A second officer or
  // an admin looking at the same centre's queue in another tab would never
  // see it move without manually reloading. Subscribing here makes the
  // queue genuinely live across every open dashboard for this centre.
  useEffect(() => {
    if (!socket || tab !== 'queue') return;
    const onQueueUpdate = () => load();
    socket.on('queue:update', onQueueUpdate);
    return () => socket.off('queue:update', onQueueUpdate);
  }, [socket, tab, load]);

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
          {t('officerDashboard.mustChangePasswordNotice')}
        </p>
      )}

      <div className="mt-4 flex gap-2 border-b border-border">
        {['queue', 'settings', 'notifications'].map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-3 py-2 text-p2 capitalize ${tab === tabKey ? 'border-b-2 border-primary font-semibold text-primary' : 'text-muted'}`}
          >
            {tabKey === 'queue' && t('officerDashboard.tab.queue')}
            {tabKey === 'settings' && t('officerDashboard.tab.settings')}
            {tabKey === 'notifications' && t('officerDashboard.tab.notifications')}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-p2 text-danger">{error}</p>}

      {tab === 'queue' && (
        <>
          {queueData && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(queueData.summary).map(([key, value], i) => (
                <MotionDiv key={key} className="card text-center" {...cardMotion} transition={{ ...cardMotion.transition, delay: i * 0.05 }}>
                  <p className="text-h1 text-primary">{value}</p>
                  <p className="text-small capitalize text-muted">{SUMMARY_KEYS[key] ? t(SUMMARY_KEYS[key]) : key.replace(/([A-Z])/g, ' $1')}</p>
                </MotionDiv>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {queueData?.bookings.length === 0 && (
              <p className="text-p2 text-muted">{t('officerDashboard.noBookings')}</p>
            )}
            {queueData?.bookings.map((b) => (
              <BookingRow key={b._id} booking={b} onRefresh={load} t={t} />
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <CentreSettingsPanel centreId={session.profile.centre} t={t} />
          <ChangeOfficerPasswordPanel centreId={session.profile.centre} t={t} />
        </>
      )}

      {tab === 'notifications' && (
        <div className="mt-6">
          <NotificationCentre
            fetchUrl={`/notifications/centre/${session.profile.centre}`}
            clearUrl={`/notifications/centre/${session.profile.centre}`}
            titleKey="officerDashboard.tab.notifications"
          />
        </div>
      )}
    </div>
  );
}

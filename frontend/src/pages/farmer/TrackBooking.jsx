import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import QRGatePass from '../../components/QRGatePass.jsx';

const PIPELINE = [
  'booked',
  'checked_in',
  'weighing',
  'quality_verification',
  'procurement_completed',
  'payment_processing',
  'payment_completed',
];

const STAGE_LABEL = {
  booked: 'Booked',
  checked_in: 'Checked in',
  weighing: 'Weighing',
  quality_verification: 'Quality verification',
  procurement_completed: 'Procurement completed',
  payment_processing: 'Payment processing',
  payment_completed: 'Payment completed',
};

export default function TrackBooking() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [betterSlot, setBetterSlot] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/bookings/token/${token}`)
      .then(({ data }) => setData(data))
      .catch(() => setError('Token not found'));
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // poll for queue movement
    return () => clearInterval(interval);
  }, [load]);

  // Look for a same-day, same-centre slot with a shorter queue than the
  // one currently booked, so the farmer can switch if it's worth it.
  useEffect(() => {
    if (!data || data.booking.queueStatus !== 'waiting' || data.booking.procurementStage !== 'booked') {
      setBetterSlot(null);
      return;
    }
    api
      .get('/slots', { params: { centreId: data.booking.centre._id, date: data.booking.date } })
      .then(({ data: slotData }) => {
        const current = slotData.slots.find((s) => s._id === data.booking.slot);
        const currentCount = current ? current.bookedCount : Infinity;
        const better = slotData.slots
          .filter((s) => s._id !== data.booking.slot && s.status === 'available' && s.bookedCount < currentCount)
          .sort((a, b) => a.bookedCount - b.bookedCount)[0];
        setBetterSlot(better || null);
      })
      .catch(() => setBetterSlot(null));
  }, [data]);

  async function handleReschedule() {
    if (!betterSlot) return;
    setRescheduling(true);
    try {
      await api.put(`/bookings/${data.booking._id}/reschedule`, { slotId: betterSlot._id });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change slot');
    } finally {
      setRescheduling(false);
    }
  }

  if (error) return <div className="mx-auto max-w-2xl px-5 py-10 text-danger">{error}</div>;
  if (!data) return <div className="mx-auto max-w-2xl px-5 py-10 text-muted">Loading...</div>;

  const { booking, queue, estimatedPaymentDate } = data;
  const stageIndex = PIPELINE.indexOf(booking.procurementStage);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link to="/farmer/bookings" className="text-p2 text-primary underline">← My bookings</Link>

      <div className="card mt-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-h1 text-primary">{booking.token}</h1>
          <StatusBadge status={booking.queueStatus} />
        </div>
        <p className="mt-1 text-p2 text-muted">
          {booking.centre?.name} · {booking.date} · {booking.startTime}–{booking.endTime}
        </p>

        {booking.queueStatus === 'waiting' && (
          <div className="mt-4 rounded bg-primary-light p-4">
            <p className="text-p2 text-primary-dark">
              {queue.aheadCount} farmer{queue.aheadCount === 1 ? '' : 's'} ahead of you
              {queue.currentlyProcessing && <> · currently processing {queue.currentlyProcessing}</>}
            </p>
            <p className="text-small text-primary-dark">Estimated wait: ~{queue.estimatedWaitMinutes} minutes</p>
          </div>
        )}

        {betterSlot && (
          <div className="mt-3 flex items-center justify-between rounded border border-accent bg-accent-light p-3">
            <p className="text-p2 text-accent-dark">
              Slot {betterSlot.startTime}–{betterSlot.endTime} has a shorter queue ({betterSlot.bookedCount} booked). Switch to it?
            </p>
            <button type="button" disabled={rescheduling} onClick={handleReschedule} className="btn-outline text-small">
              {rescheduling ? 'Switching...' : 'Switch'}
            </button>
          </div>
        )}
      </div>

      <div className="card mt-4">
        <h2 className="text-p2 font-semibold text-muted">Procurement progress</h2>
        <ol className="mt-3 space-y-2">
          {PIPELINE.map((stage, i) => (
            <li key={stage} className="flex items-center gap-3 text-p2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  i <= stageIndex ? 'bg-primary' : 'bg-border'
                }`}
              />
              <span className={i <= stageIndex ? 'text-ink' : 'text-muted'}>{STAGE_LABEL[stage]}</span>
            </li>
          ))}
        </ol>
      </div>

      {booking.crop && (
        <div className="card mt-4">
          <h2 className="text-p2 font-semibold text-muted">Procurement value (estimate)</h2>
          <p className="mt-1 text-p2">
            {booking.quantity ?? booking.plannedQuantity ?? '—'} {booking.unit || ''}{(booking.quantity ?? booking.plannedQuantity) === 1 ? '' : 's'} of {booking.crop} × ₹{booking.officialRatePerUnit ?? '—'}/{booking.unit || 'unit'}
          </p>
          <p className="mt-1 text-h3 text-primary">
            {booking.estimatedValue ? `₹${booking.estimatedValue}` : 'Pending quantity/quality check'}
          </p>
          <p className="mt-1 text-small text-muted">
            Final payment is subject to official procurement rules and quality assessment.
          </p>
        </div>
      )}

      <div className="card mt-4">
        <h2 className="text-p2 font-semibold text-muted">Payment status</h2>
        <div className="mt-2 flex items-center justify-between">
          <StatusBadge status={booking.paymentStatus} />
          {booking.paidAmount != null && <span className="font-semibold">₹{booking.paidAmount}</span>}
        </div>
        {booking.paymentStatus !== 'completed' && estimatedPaymentDate && (
          <p className="mt-1 text-small text-muted">Estimated payment date: {estimatedPaymentDate}</p>
        )}
      </div>

      <QRGatePass booking={booking} />
    </div>
  );
}

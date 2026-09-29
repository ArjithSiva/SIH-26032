import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import QRGatePass from '../../components/QRGatePass.jsx';
import { centreMapUrl } from '../../utils/centreMap.js';
import { MotionDiv, MotionLi, sectionMotion, cardMotionDelayed } from '../../components/motion.js';

const PIPELINE = [
  'booked',
  'checked_in',
  'weighing',
  'quality_verification',
  'procurement_completed',
  'payment_processing',
  'payment_completed',
];

const STAGE_KEYS = {
  booked: 'trackBooking.stage.booked',
  checked_in: 'trackBooking.stage.checkedIn',
  weighing: 'trackBooking.stage.weighing',
  quality_verification: 'trackBooking.stage.qualityVerification',
  procurement_completed: 'trackBooking.stage.procurementCompleted',
  payment_processing: 'trackBooking.stage.paymentProcessing',
  payment_completed: 'trackBooking.stage.paymentCompleted',
};

export default function TrackBooking() {
  const { token } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [betterSlot, setBetterSlot] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/bookings/token/${token}`)
      .then(({ data }) => setData(data))
      .catch(() => setError(t('trackBooking.error.notFound')));
  }, [token, t]);

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
      setError(err.response?.data?.message || t('trackBooking.error.rescheduleFailed'));
    } finally {
      setRescheduling(false);
    }
  }

  // Cancelling was a genuine gap: queueStatus already had a 'cancelled'
  // value in the schema, but no button or endpoint anywhere ever let a
  // farmer reach it. Only offered while still waiting and not yet checked
  // in, matching the backend's own guard.
  async function handleCancel() {
    if (!window.confirm(t('trackBooking.cancelConfirm'))) return;
    setCancelling(true);
    try {
      await api.delete(`/bookings/${data.booking._id}/cancel`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t('trackBooking.error.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  }

  if (error) return <div className="mx-auto max-w-2xl px-5 py-10 text-danger">{error}</div>;
  if (!data) return <div className="mx-auto max-w-2xl px-5 py-10 text-muted">{t('common.loading')}</div>;

  const { booking, queue, estimatedPaymentDate } = data;
  const stageIndex = PIPELINE.indexOf(booking.procurementStage);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link to="/farmer/bookings" className="text-p2 text-primary underline">← {t('trackBooking.backToBookings')}</Link>

      <MotionDiv className="card mt-4" {...sectionMotion}>
        <div className="flex items-baseline justify-between">
          <h1 className="text-h1 text-primary">{booking.token}</h1>
          <StatusBadge status={booking.queueStatus} />
        </div>
        <p className="mt-1 text-p2 text-muted">
          {booking.centre?.name} · {booking.date} · {booking.startTime}–{booking.endTime}
          {centreMapUrl(booking.centre) && (
            <>
              {' · '}
              <a href={centreMapUrl(booking.centre)} target="_blank" rel="noreferrer" className="font-bold text-primary underline">
                📍 {t('common.viewOnMap')}
              </a>
            </>
          )}
        </p>

        {booking.queueStatus === 'waiting' && (
          <div className="mt-4 rounded bg-primary-light p-4">
            <p className="text-p2 text-primary-dark">
              {queue.aheadCount} {queue.aheadCount === 1 ? t('trackBooking.farmerAhead') : t('trackBooking.farmersAhead')}
              {queue.currentlyProcessing && <> · {t('trackBooking.currentlyProcessing')} {queue.currentlyProcessing}</>}
            </p>
            <p className="text-small text-primary-dark">{t('trackBooking.estimatedWait')}: ~{queue.estimatedWaitMinutes} {t('common.minutes')}</p>
          </div>
        )}

        {betterSlot && (
          <div className="mt-3 flex items-center justify-between rounded border border-accent bg-accent-light p-3">
            <p className="text-p2 text-accent-dark">
              {t('trackBooking.betterSlotFound', { start: betterSlot.startTime, end: betterSlot.endTime, count: betterSlot.bookedCount })}
            </p>
            <button type="button" disabled={rescheduling} onClick={handleReschedule} className="btn-outline text-small">
              {rescheduling ? t('trackBooking.switching') : t('trackBooking.switch')}
            </button>
          </div>
        )}

        {booking.queueStatus === 'waiting' && booking.procurementStage === 'booked' && (
          <div className="mt-3 text-right">
            <button type="button" disabled={cancelling} onClick={handleCancel} className="text-small text-danger underline">
              {cancelling ? t('trackBooking.cancelling') : t('trackBooking.cancelBooking')}
            </button>
          </div>
        )}
      </MotionDiv>

      <MotionDiv className="card mt-4" {...cardMotionDelayed(1, 0.08)}>
        <h2 className="text-p2 font-semibold text-muted">{t('trackBooking.progressHeading')}</h2>
        <ol className="mt-3 space-y-2">
          {PIPELINE.map((stage, i) => (
            <MotionLi
              key={stage}
              className="flex items-center gap-3 text-p2"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  i <= stageIndex ? 'bg-primary' : 'bg-border'
                }`}
              />
              <span className={i <= stageIndex ? 'text-ink' : 'text-muted'}>{t(STAGE_KEYS[stage])}</span>
            </MotionLi>
          ))}
        </ol>
      </MotionDiv>

      {booking.crop && (
        <MotionDiv className="card mt-4" {...cardMotionDelayed(2, 0.08)}>
          <h2 className="text-p2 font-semibold text-muted">{t('trackBooking.valueHeading')}</h2>
          <p className="mt-1 text-p2">
            {booking.quantity ?? booking.plannedQuantity ?? '—'} {booking.unit || ''}{(booking.quantity ?? booking.plannedQuantity) === 1 ? '' : 's'} {t('common.of')} {booking.crop} × ₹{booking.officialRatePerUnit ?? '—'}/{booking.unit || t('qrGatePass.unitFallback')}
          </p>
          <p className="mt-1 text-h3 text-primary">
            {booking.estimatedValue ? `₹${booking.estimatedValue}` : t('trackBooking.pendingCheck')}
          </p>
          <p className="mt-1 text-small text-muted">{t('trackBooking.finalPaymentNote')}</p>
        </MotionDiv>
      )}

      <MotionDiv className="card mt-4" {...cardMotionDelayed(3, 0.08)}>
        <h2 className="text-p2 font-semibold text-muted">{t('trackBooking.paymentHeading')}</h2>
        <div className="mt-2 flex items-center justify-between">
          <StatusBadge status={booking.paymentStatus} />
          {booking.paidAmount != null && <span className="font-semibold">₹{booking.paidAmount}</span>}
        </div>
        {booking.paymentStatus !== 'completed' && estimatedPaymentDate && (
          <p className="mt-1 text-small text-muted">{t('paymentStatus.estimatedDate')}: {estimatedPaymentDate}</p>
        )}
      </MotionDiv>

      <QRGatePass booking={booking} />
    </div>
  );
}

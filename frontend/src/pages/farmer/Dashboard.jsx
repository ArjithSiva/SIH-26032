import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

const ACTIVE_STATUSES = ['waiting', 'processing'];

export default function MyBookings() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get(`/bookings/farmer/${session.profile._id}`).then(({ data }) => setBookings(data));
  }, [session.profile._id]);

  const { active, past } = useMemo(() => {
    const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.queueStatus));
    const past = bookings.filter((b) => !ACTIVE_STATUSES.includes(b.queueStatus));
    return { active, past };
  }, [bookings]);

  const completedCount = bookings.filter((b) => b.queueStatus === 'completed').length;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-h1">Booking Details / History</h1>
        <Link to="/farmer/book" className="btn-accent">Book a new slot</Link>
      </div>

      {bookings.length > 0 && (
        <p className="mt-2 text-p2 text-muted">
          {bookings.length} total booking{bookings.length === 1 ? '' : 's'} · {completedCount} completed
        </p>
      )}

      {bookings.length === 0 && (
        <p className="card mt-6 text-p2 text-muted">
          No bookings yet. Book a procurement slot to get your first token.
        </p>
      )}

      {active.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">Current</h2>
          <div className="space-y-3">
            {active.map((b) => <BookingCard key={b._id} booking={b} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">History</h2>
          <div className="space-y-3">
            {past.map((b) => <BookingCard key={b._id} booking={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking: b }) {
  return (
    <Link to={`/farmer/track/${b.token}`} className="card block hover:border-primary">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-primary">{b.token}</p>
          <p className="text-p2 text-muted">{b.centre?.name} · {b.date} · {b.startTime}–{b.endTime}</p>
          {b.crop && (
            <p className="text-small text-muted">
              {b.crop} · {b.quantity ?? b.plannedQuantity ?? '—'} {b.unit || ''}{(b.quantity ?? b.plannedQuantity) === 1 ? '' : 's'}
              {b.estimatedValue ? ` · ₹${b.estimatedValue}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={b.queueStatus} />
          <StatusBadge status={b.paymentStatus} />
        </div>
      </div>
    </Link>
  );
}

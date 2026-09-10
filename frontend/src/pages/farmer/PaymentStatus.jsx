import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function PaymentStatus() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get(`/bookings/farmer/${session.profile._id}`).then(({ data }) =>
      setBookings(data.filter((b) => b.paymentStatus && b.paymentStatus !== 'not_applicable'))
    );
  }, [session.profile._id]);

  const pending = bookings.filter((b) => b.paymentStatus !== 'completed');
  const completed = bookings.filter((b) => b.paymentStatus === 'completed');

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-h1">Payment Status</h1>
      <p className="mt-1 text-p2 text-muted">Payments are processed instantly in this demo; dates below are estimates.</p>

      {bookings.length === 0 && (
        <p className="card mt-6 text-p2 text-muted">No payments to show yet.</p>
      )}

      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">Pending / processing</h2>
          <div className="space-y-3">
            {pending.map((b) => (
              <Link key={b._id} to={`/farmer/track/${b.token}`} className="card block hover:border-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{b.token}</p>
                    <p className="text-p2 text-muted">{b.centre?.name} · {b.crop || '—'}</p>
                  </div>
                  <StatusBadge status={b.paymentStatus} />
                </div>
                {b.estimatedPaymentDate && (
                  <p className="mt-1 text-small text-muted">Estimated payment date: {b.estimatedPaymentDate}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">Payment history</h2>
          <div className="space-y-3">
            {completed.map((b) => (
              <Link key={b._id} to={`/farmer/track/${b.token}`} className="card block hover:border-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{b.token}</p>
                    <p className="text-p2 text-muted">{b.centre?.name} · {b.crop || '—'}</p>
                    {b.paidAt && <p className="text-small text-muted">Paid on {new Date(b.paidAt).toLocaleDateString()}</p>}
                  </div>
                  <span className="font-semibold text-primary">₹{b.paidAmount}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

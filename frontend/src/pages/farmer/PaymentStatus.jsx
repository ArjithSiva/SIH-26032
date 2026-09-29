import { useEffect, useState } from 'react';
import api from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { MotionP, MotionLink, cardMotion, cardMotionTap } from '../../components/motion.js';

export default function PaymentStatus() {
  const { session } = useAuth();
  const { t } = useLanguage();
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
      <h1 className="text-h1">{t('paymentStatus.title')}</h1>
      <p className="mt-1 text-p2 text-muted">{t('paymentStatus.subtitle')}</p>

      {bookings.length === 0 && (
        <MotionP className="card mt-6 text-p2 text-muted" {...cardMotion}>{t('paymentStatus.empty')}</MotionP>
      )}

      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">{t('paymentStatus.pendingHeading')}</h2>
          <div className="space-y-3">
            {pending.map((b, i) => (
              <MotionLink
                key={b._id}
                to={`/farmer/track/${b.token}`}
                className="card block hover:border-primary"
                {...cardMotionTap}
                transition={{ ...cardMotionTap.transition, delay: i * 0.06 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{b.token}</p>
                    <p className="text-p2 text-muted">{b.centre?.name} · {b.crop || '—'}</p>
                  </div>
                  <StatusBadge status={b.paymentStatus} />
                </div>
                {b.estimatedPaymentDate && (
                  <p className="mt-1 text-small text-muted">{t('paymentStatus.estimatedDate')}: {b.estimatedPaymentDate}</p>
                )}
              </MotionLink>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-p2 font-semibold text-muted">{t('paymentStatus.historyHeading')}</h2>
          <div className="space-y-3">
            {completed.map((b, i) => (
              <MotionLink
                key={b._id}
                to={`/farmer/track/${b.token}`}
                className="card block hover:border-primary"
                {...cardMotionTap}
                transition={{ ...cardMotionTap.transition, delay: i * 0.06 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{b.token}</p>
                    <p className="text-p2 text-muted">{b.centre?.name} · {b.crop || '—'}</p>
                    {b.paidAt && <p className="text-small text-muted">{t('paymentStatus.paidOn')} {new Date(b.paidAt).toLocaleDateString()}</p>}
                  </div>
                  <span className="font-semibold text-primary">₹{b.paidAmount}</span>
                </div>
              </MotionLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

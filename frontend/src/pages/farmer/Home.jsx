import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { MotionLink, cardMotionDelayed } from '../../components/motion.js';
import NotificationCentre from '../../components/NotificationCentre.jsx';

const LINKS = [
  { to: '/farmer/book', key: 'bookSlot', icon: '🗓️' },
  { to: '/farmer/bookings', key: 'bookingHistory', icon: '📋' },
  { to: '/farmer/payments', key: 'paymentStatus', icon: '💳' },
  { to: '/centres/schedules', key: 'centreSchedules', icon: '📍' },
  { to: '/farmer/complaint', key: 'reportComplaint', icon: '📣' },
];

export default function FarmerHome() {
  const { session } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-small font-bold tracking-wide text-primary">{t('farmerHome.subtitle')}</p>
      <h1 className="mt-1 text-h1">{t('farmerHome.welcome')}, {session?.profile?.name}</h1>

      <div className="mt-6 space-y-4">
        {LINKS.map((link, i) => (
          <MotionLink
            key={link.to}
            to={link.to}
            className="card flex items-start gap-4 hover:border-primary"
            {...cardMotionDelayed(i, 0.08, true)}
          >
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-lg">
              {link.icon}
            </span>
            <span>
              <p className="text-p1 font-semibold text-primary">{t(`farmerHome.link.${link.key}.title`)}</p>
              <p className="mt-1 text-p2 text-muted">{t(`farmerHome.link.${link.key}.description`)}</p>
            </span>
          </MotionLink>
        ))}
      </div>

      <div className="mt-8">
        <NotificationCentre fetchUrl={`/notifications/farmer/${session?.profile?._id}`} clearUrl={`/notifications/farmer/${session?.profile?._id}`} />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';

// Farmer-facing only, by design: procurement-centre and admin sign-in are
// intentionally not mentioned or linked here - they live at the unlinked
// /officer/login and /staff/login URLs (see App.jsx and Navbar.jsx).
const FEATURES = [
  { key: 'bookSlot', icon: '🗓️' },
  { key: 'queue', icon: '⏱️' },
  { key: 'payment', icon: '💳' },
  { key: 'report', icon: '📣' },
  { key: 'centres', icon: '📍' },
];

export default function Landing() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="max-w-2xl animate-fade-in">
        <h1 className="text-h1">Kalanjiyam</h1>
        <p className="mt-4 text-p1 text-muted">{t('home.tagline')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/farmer/register" className="btn-primary">{t('home.cta.register')}</Link>
          <Link to="/farmer/login" className="btn-outline">{t('home.cta.login')}</Link>
        </div>
        <Link to="/centres/schedules" className="mt-4 inline-block text-p2 text-primary underline">
          {t('nav.centres')} →
        </Link>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <div
            key={f.key}
            className="card animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span aria-hidden="true" className="text-2xl">{f.icon}</span>
            <h2 className="mt-2 text-h3">{t(`home.feature.${f.key}.title`)}</h2>
            <p className="mt-2 text-p2 text-muted">{t(`home.feature.${f.key}.body`)}</p>
          </div>
        ))}
      </div>

      <div className="card mt-10 animate-slide-up">
        <h2 className="text-h3">📞 Try the voice helpline (IVR) demo</h2>
        <p className="mt-2 text-p2 text-muted">
          A browser simulation of what a farmer hears and presses on a phone call - no app or login needed.
        </p>
        <Link to="/ivr" className="btn-outline mt-3 inline-block">Open IVR demo</Link>
      </div>

      {/* Procurement-centre and admin sign-in live only here on the homepage,
          not in the main nav (see Navbar.jsx) - each has its own separate
          login page. */}
      <div className="mt-10 flex flex-wrap gap-4 border-t border-border pt-8 text-p2">
        <Link to="/officer/login" className="text-muted underline hover:text-primary">
          Procurement centre staff login
        </Link>
        <Link to="/staff/login" className="text-muted underline hover:text-primary">
          State admin login
        </Link>
      </div>
    </div>
  );
}

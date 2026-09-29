import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import { MotionDiv, MotionLink, MotionLi, cardMotion, cardMotionDelayed, sectionMotion } from '../components/motion.js';

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

const QUICK_SERVICES = [
  { key: 'register', icon: '🌱', to: '/farmer/register' },
  { key: 'bookSlot', icon: '🗓️', to: '/farmer/book' },
  { key: 'myBookings', icon: '📋', to: '/farmer/bookings' },
  { key: 'queue', icon: '⏱️', to: '/farmer/bookings' },
  { key: 'payment', icon: '💳', to: '/farmer/payments' },
  { key: 'report', icon: '📣', to: '/farmer/complaint' },
  { key: 'centres', icon: '📍', to: '/centres/schedules' },
];

export default function Landing() {
  const { t } = useLanguage();

  return (
    <div>
      <div className="rounded-b-[10%] bg-gradient-to-br from-[#06494B] to-primary px-5 py-16 text-white">
        <div className="mx-auto max-w-5xl animate-fade-in">
          <p className="text-small font-bold tracking-wide text-[#A4ED8D]">{t('home.eyebrow')}</p>
          <h1 className="mt-2 text-h1 text-white">HarvQ</h1>
          <p className="mt-4 max-w-2xl text-p1 text-white/85">{t('home.tagline')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/farmer/register" className="rounded bg-[#A4ED8D] px-5 py-2.5 text-p2 font-bold text-[#074D43] transition-transform hover:scale-[1.03] hover:bg-[#D4FFC5] active:scale-95">
              {t('home.cta.register')}
            </Link>
            <Link to="/farmer/login" className="rounded border border-white/50 px-5 py-2.5 text-p2 font-bold text-white transition-colors hover:bg-white/10 active:scale-95">
              {t('home.cta.login')}
            </Link>
            {/* No app link yet - see home.cta.installApp.comingSoon. This
                is a placeholder for when a native/PWA build ships. */}
            <button
              type="button"
              onClick={() => window.alert(t('home.cta.installApp.comingSoon'))}
              className="rounded border border-white/50 px-5 py-2.5 text-p2 font-bold text-white transition-colors hover:bg-white/10 active:scale-95"
            >
              {t('home.cta.installApp.label')}
            </button>
          </div>
          <Link to="/centres/schedules" className="mt-4 inline-block text-p2 font-bold text-[#A4ED8D] underline">
            {t('nav.centres')} →
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-14">
        <MotionDiv className="grid gap-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm shadow-ink/5 md:grid-cols-2" {...sectionMotion}>
          <img
            src="https://images.pexels.com/photos/36436061/pexels-photo-36436061.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt="A farmer in a rice field in Tenkasi, Tamil Nadu"
            loading="lazy"
            className="h-56 w-full object-cover md:h-full"
            onError={(e) => { e.currentTarget.closest('.grid').style.display = 'none'; }}
          />
          <div className="flex flex-col justify-center p-6">
            <h2 className="text-h2">{t('home.photoBanner.heading')}</h2>
            <p className="mt-2 text-p2 text-muted">{t('home.tagline')}</p>
            <Link to="/farmer/register" className="btn-primary mt-4 inline-block w-fit">{t('home.cta.register')}</Link>
          </div>
        </MotionDiv>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <MotionDiv key={f.key} className="card" {...cardMotionDelayed(i)}>
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-xl">{f.icon}</span>
              <h2 className="mt-3 text-h3">{t(`home.feature.${f.key}.title`)}</h2>
              <p className="mt-2 text-p2 text-muted">{t(`home.feature.${f.key}.body`)}</p>
            </MotionDiv>
          ))}
        </div>

        <MotionDiv className="card mt-10" {...cardMotion}>
          <h2 className="text-h3">📞 {t('landing.ivr.title')}</h2>
          <p className="mt-2 text-p2 text-muted">{t('landing.ivr.body')}</p>
          <Link to="/ivr" className="btn-outline mt-3 inline-block">{t('landing.ivr.cta')}</Link>
        </MotionDiv>
      </div>

      {/* Quick services - a wider, action-oriented restatement of the
          feature grid above, each linking straight to the relevant page. */}
      <section className="bg-gradient-to-b from-[#F5FBFC] to-[#F0F8FB] px-5 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-small font-bold tracking-wide text-primary">{t('home.quickServices.eyebrow')}</p>
            <h2 className="mt-1 text-h2">{t('home.quickServices.heading')}</h2>
            <p className="mt-1 text-p2 text-muted">{t('home.quickServices.subtitle')}</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_SERVICES.map((s, i) => (
              <MotionLink key={s.key} to={s.to} className="card hover:border-primary" {...cardMotionDelayed(i, 0.06, true)}>
                <span aria-hidden="true" className="text-xl">{s.icon}</span>
                <h3 className="mt-2 text-h3">{t(`home.feature.${s.key}.title`)}</h3>
                <p className="mt-1 text-p2 text-muted">{t(`home.feature.${s.key}.body`)}</p>
                <span className="mt-2 inline-block text-small font-bold text-primary">{t('common.continue')} →</span>
              </MotionLink>
            ))}
          </div>
        </div>
      </section>

      {/* How HarvQ works - five-step preview of the real farmer flow. */}
      <section id="how-it-works" className="px-5 py-14">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-small font-bold tracking-wide text-primary">{t('home.process.eyebrow')}</p>
            <h2 className="mt-1 text-h2">{t('home.process.heading')}</h2>
            <p className="mt-1 text-p2 text-muted">{t('home.process.subtitle')}</p>
          </div>
          <ol className="mt-8 space-y-3">
            {[1, 2, 3, 4, 5].map((n, i) => (
              <MotionLi key={n} className="card flex items-center gap-4" {...cardMotionDelayed(i)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-p2 font-bold text-white">{n}</span>
                <span className="text-p1 font-semibold text-ink">{t(`home.process.step${n}`)}</span>
              </MotionLi>
            ))}
          </ol>
        </div>
      </section>

      {/* Why HarvQ - the case for the service, in plain terms. */}
      <section className="bg-[#F5FBFC] px-5 py-14">
        <div className="mx-auto max-w-3xl">
          <p className="text-small font-bold tracking-wide text-primary">{t('home.why.eyebrow')}</p>
          <h2 className="mt-1 text-h2">{t('home.why.heading')}</h2>
          <p className="mt-2 max-w-xl text-p2 text-muted">{t('home.why.body')}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n} className="flex items-start gap-2 text-p2 text-ink">
                <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white">✓</span>
                {t(`home.why.reason${n}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Need help? - real destinations only: an in-page anchor, the
          centre-schedules page, and the helpline number already shown in
          the footer. No FAQ/contact page is linked here since HarvQ
          doesn't have verified FAQ content yet - see chat for a note on
          this. */}
      <section id="need-help" className="px-5 py-14">
        <MotionDiv className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-6 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center" {...sectionMotion}>
          <div>
            <p className="text-small font-bold tracking-wide text-primary">{t('home.help.eyebrow')}</p>
            <h2 className="mt-1 text-h2">{t('home.help.heading')}</h2>
            <p className="mt-1 text-p2 text-muted">{t('home.help.body')}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 text-p2 font-bold">
            <a href="#how-it-works" className="text-primary underline">{t('home.help.howItWorks')} →</a>
            <Link to="/centres/schedules" className="text-primary underline">{t('home.help.centres')} →</Link>
            <a href="tel:1800XXXXXXX" className="text-primary underline">{t('home.help.contact')} →</a>
          </div>
        </MotionDiv>
      </section>

      {/* Procurement-centre and admin sign-in live only here on the homepage,
          not in the main nav (see Navbar.jsx) - each has its own separate
          login page. */}
      <div className="mx-auto max-w-5xl px-5 pb-10">
        <div className="flex flex-wrap gap-4 border-t border-border pt-8 text-p2">
          <Link to="/officer/login" className="text-muted underline hover:text-primary">
            {t('landing.officerLoginLink')}
          </Link>
          <Link to="/staff/login" className="text-muted underline hover:text-primary">
            {t('landing.staffLoginLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}

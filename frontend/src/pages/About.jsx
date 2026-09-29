import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import { MotionDiv, cardMotionDelayed } from '../components/motion.js';

// Capabilities grid below draws only on features that actually exist in
// this app (see Landing.jsx's FEATURES/QUICK_SERVICES) - deliberately not
// inventing anything HarvQ doesn't really do.
const CAPABILITIES = [
  { key: 'bookSlot', icon: '🗓️' },
  { key: 'queue', icon: '⏱️' },
  { key: 'payment', icon: '💳' },
  { key: 'report', icon: '📣' },
  { key: 'centres', icon: '📍' },
  { key: 'register', icon: '🌱' },
];

export default function About() {
  const { t } = useLanguage();

  return (
    <div>
      <div className="rounded-b-[10%] bg-gradient-to-br from-[#06494B] to-primary px-5 py-16 text-white">
        <div className="mx-auto max-w-3xl animate-fade-in">
          <p className="text-small font-bold tracking-wide text-[#A4ED8D]">{t('about.eyebrow')}</p>
          <h1 className="mt-2 text-h1 text-white">{t('about.hero.title')}</h1>
          <p className="mt-4 text-p1 text-white/85">{t('about.hero.body')}</p>
          <a href="#about-intro" className="mt-4 inline-block text-p2 font-bold text-[#A4ED8D] underline">
            {t('about.hero.cta')} ↓
          </a>
        </div>
      </div>

      <section id="about-intro" className="px-5 py-14">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 md:flex-row">
          <img
            src="https://images.pexels.com/photos/6129010/pexels-photo-6129010.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt="A golden rice field ready for harvest"
            loading="lazy"
            className="h-56 w-full shrink-0 rounded-lg object-cover md:h-64 md:w-64"
          />
          <div>
            <p className="text-small font-bold tracking-wide text-primary">{t('about.intro.eyebrow')}</p>
            <h2 className="mt-1 text-h2">{t('about.intro.heading')}</h2>
            <p className="mt-2 text-p2 text-muted">{t('about.intro.body1')}</p>
            <p className="mt-2 text-p2 text-muted">{t('about.intro.body2')}</p>
          </div>
        </div>
      </section>

      <section className="bg-[#F5FBFC] px-5 py-14">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
          <p className="text-small font-bold tracking-wide text-primary">{t('about.harvest.eyebrow')}</p>
          <h2 className="text-h2">{t('about.harvest.heading')}</h2>
          <p className="max-w-xl text-p2 text-muted">{t('about.harvest.body')}</p>
          <img
            src="https://images.pexels.com/photos/14882028/pexels-photo-14882028.jpeg?auto=compress&cs=tinysrgb&w=900"
            alt="A farmer working in a rice paddy field"
            loading="lazy"
            className="h-64 w-full max-w-xl rounded-lg object-cover"
          />
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-small font-bold tracking-wide text-primary">{t('about.workflow.eyebrow')}</p>
          <h2 className="mt-1 text-h2">{t('about.workflow.heading')}</h2>
          <p className="mt-1 text-p2 text-muted">{t('about.workflow.subtitle')}</p>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-3">
          {[1, 2, 3].map((n, i) => (
            <MotionDiv key={n} className="card text-center" {...cardMotionDelayed(i)}>
              <span className="text-h1 text-primary-light">0{n}</span>
              <h3 className="mt-1 text-h3">{t(`about.workflow.step${n}.title`)}</h3>
              <p className="mt-2 text-p2 text-muted">{t(`about.workflow.step${n}.body`)}</p>
            </MotionDiv>
          ))}
        </div>
      </section>

      <section className="bg-[#F5FBFC] px-5 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-small font-bold tracking-wide text-primary">{t('about.capabilities.eyebrow')}</p>
          <h2 className="mt-1 text-h2">{t('about.capabilities.heading')}</h2>
          <p className="mt-1 text-p2 text-muted">{t('about.capabilities.subtitle')}</p>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => (
            <MotionDiv key={c.key} className="card" {...cardMotionDelayed(i)}>
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-lg">{c.icon}</span>
              <h3 className="mt-2 text-h3">{t(`home.feature.${c.key}.title`)}</h3>
              <p className="mt-1 text-p2 text-muted">{t(`home.feature.${c.key}.body`)}</p>
            </MotionDiv>
          ))}
        </div>
      </section>

      <section className="px-5 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-small font-bold tracking-wide text-primary">{t('about.vision.eyebrow')}</p>
          <h2 className="mt-1 text-h2">{t('about.vision.heading')}</h2>
          <p className="mt-2 text-p2 text-muted">{t('about.vision.body')}</p>
          <Link to="/" className="btn-primary mt-5 inline-block">{t('about.vision.cta')}</Link>
        </div>
      </section>
    </div>
  );
}

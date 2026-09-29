import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';

// Content here is placeholder text in the shape GIGW expects (content
// ownership, last-updated date, contact point, accessibility statement) -
// replace with the real department name/contact/URL before any live
// deployment. Marked data-voiceover-skip so the read-aloud button doesn't
// repeat this on every page.
// Not every Bhashini language code (e.g. "sat", "brx", "mni") is a locale
// tag the browser's Intl/toLocaleDateString actually recognises, and an
// unrecognised one throws a RangeError rather than just falling back -
// this keeps the date formatting safe for those without needing a
// hardcoded list of which codes are/aren't valid BCP-47 tags.
function formatDateSafely(date, lang) {
  try {
    return date.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

export default function Footer() {
  const { t, lang } = useLanguage();
  return (
    <footer data-voiceover-skip className="mt-16 border-t border-border bg-[#EAF4FA]">
      <div className="mx-auto max-w-6xl px-5 py-8 text-small text-muted">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-p2-strong text-primary">HarvQ</p>
            <p className="mt-1">{t('footer.tagline')}</p>
            <Link to="/about" className="mt-1 inline-block underline">{t('nav.about')}</Link>
            <p>{t('footer.department')}</p>
          </div>
          <div>
            <p className="text-p2-medium text-ink">{t('footer.contactHeading')}</p>
            <p className="mt-1">{t('footer.helpline')}: 1800-XXX-XXXX</p>
            <p>{t('footer.email')}: support@example.gov.in</p>
          </div>
          <div>
            <p className="text-p2-medium text-ink">{t('footer.policiesHeading')}</p>
            <p className="mt-1">{t('footer.contentOwner')}</p>
            <p>{t('footer.lastUpdated')}: {formatDateSafely(new Date(), lang === 'en' ? 'en-IN' : lang)}</p>
          </div>
        </div>
        <p className="mt-6 border-t border-border/60 pt-4">{t('footer.gigwNote')}</p>
      </div>
    </footer>
  );
}

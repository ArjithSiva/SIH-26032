import { useLanguage, SUPPORTED_LANGS } from '../context/LanguageContext.jsx';

// GIGW guidelines (https://guidelines.india.gov.in/guidelines/) call for a
// clear government identity strip ahead of a site's own navigation. This is
// a placeholder for the real department name/emblem/contact - see
// CHANGES.md for what still needs real department details before go-live.
export default function GovHeader() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="border-b border-border bg-primary-dark text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-1.5 text-small">
        <span>Department of Food, Civil Supplies & Consumer Protection, Govt. of Tamil Nadu</span>
        <label className="flex items-center gap-1">
          <span className="sr-only">{t('common.language')}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded bg-primary-dark/40 px-1.5 py-0.5 text-white"
          >
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code} className="text-ink">
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

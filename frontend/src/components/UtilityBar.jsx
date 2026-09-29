import { useLanguage, SUPPORTED_LANGS } from '../context/LanguageContext.jsx';

// Thin utility strip above the main header, holding just the language
// switcher - matches the HarvQ visual identity's utility-bar pattern.
// (Previously this slot held a GIGW-style government identity strip with a
// department-name placeholder; that's been dropped in favour of the new
// design direction. See CHANGES.md.)
export default function UtilityBar() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="border-b border-border bg-white text-small text-muted">
      <div className="mx-auto flex max-w-6xl items-center justify-end gap-1.5 px-5 py-1">
        <label className="flex items-center gap-1.5">
          <span className="font-bold">{t('common.language')}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="min-w-[92px] rounded-sm border border-border bg-white px-1.5 py-0.5 text-ink"
          >
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

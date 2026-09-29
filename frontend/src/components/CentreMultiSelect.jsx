import { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { centreMapUrl } from '../utils/centreMap.js';

/**
 * `centres` - full list of candidate centres ({_id, name, district, taluk, village}).
 * `selectedIds` - array of centre _ids currently chosen.
 * `onChange(nextIds)` - called with the updated array whenever a centre is added/removed.
 */
export default function CentreMultiSelect({ centres, selectedIds, onChange }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCentres = useMemo(
    () => selectedIds.map((id) => centres.find((c) => c._id === id)).filter(Boolean),
    [selectedIds, centres]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = centres.filter((c) => !selectedSet.has(c._id));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.village?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [centres, selectedSet, query]);

  function add(centre) {
    onChange([...selectedIds, centre._id]);
    setQuery('');
  }

  function remove(id) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div>
      {selectedCentres.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedCentres.map((c) => (
            <span
              key={c._id}
              className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-p2 text-primary-dark"
            >
              {c.name}
              <button
                type="button"
                onClick={() => remove(c._id)}
                aria-label={`${t('common.centreMultiSelect.remove')} ${c.name}`}
                className="text-primary-dark hover:text-danger"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        className="field-input"
        placeholder={t('common.centreMultiSelect.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {(query || results.length > 0) && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded border border-border">
          {results.length === 0 && <li className="px-3 py-2 text-p2 text-muted">{t('common.centreMultiSelect.noMatches')}</li>}
          {results.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-2 hover:bg-primary-light">
              <button
                type="button"
                onClick={() => add(c)}
                className="flex-1 px-3 py-2 text-left text-p2"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted"> · {c.village}, {c.taluk}, {c.district}</span>
              </button>
              {centreMapUrl(c) && (
                <a
                  href={centreMapUrl(c)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 whitespace-nowrap pr-3 text-small text-primary underline"
                >
                  📍 {t('common.viewOnMap')}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedCentres.length === 0 && (
        <p className="mt-2 text-small text-danger">{t('common.centreMultiSelect.chooseAtLeastOne')}</p>
      )}
    </div>
  );
}

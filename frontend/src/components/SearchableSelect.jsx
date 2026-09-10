import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * A text-input-driven dropdown: typing filters the option list, clicking (or
 * Enter on a highlighted match) selects it. Used anywhere a plain <select>
 * would be unusable because the option list is long (districts, taluks,
 * villages, centres) - scrolling a native dropdown with hundreds of entries
 * is painful, searching it is not.
 *
 * `options` is an array of strings, or {value, label} objects if the
 * label shown to the user should differ from the stored value.
 */
export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Type to search...',
  disabled = false,
  emptyMessage = 'No matches',
  // When true, a typed value that doesn't match any option is accepted as
  // the value as-is (on blur or Enter) instead of being cleared - used for
  // fields like Taluk/Village where the real-world list is a helpful
  // starting point but shouldn't block someone whose exact village isn't
  // in it yet.
  allowCustom = false,
  customHint = 'Not listed? Just type your own and continue.',
}) {
  const normalized = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );
  const selected = normalized.find((o) => o.value === value) || null;
  // For a creatable field, a value that isn't in the known options is still
  // shown (it's what the person typed) rather than looking "unselected".
  const displayLabel = selected?.label ?? (allowCustom && value ? value : '');

  const [query, setQuery] = useState(displayLabel);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);

  // Keep the visible text in sync when the value changes from outside
  // (e.g. a parent resetting it after a higher-level field changes), or
  // when the option list itself arrives after the value was already set
  // (e.g. a pre-filled preferred district before its options have loaded).
  useEffect(() => {
    setQuery(displayLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, normalized]);

  function commitOrReset() {
    const trimmed = query.trim();
    if (allowCustom && trimmed && trimmed !== displayLabel) {
      onChange(trimmed);
    } else {
      setQuery(displayLabel);
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        commitOrReset();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, query, allowCustom]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  function select(option) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) {
        select(filtered[highlight]);
      } else if (allowCustom && query.trim()) {
        onChange(query.trim());
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(displayLabel);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="field-label">{label}</label>}
      <input
        type="text"
        className="field-input"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          if (value) onChange(''); // typing over a selection clears it until a new pick is made
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && !disabled && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-white shadow-lg">
          {filtered.length === 0 && !allowCustom && <li className="px-3 py-2 text-p2 text-muted">{emptyMessage}</li>}
          {filtered.length === 0 && allowCustom && (
            <li className="px-3 py-2 text-small text-muted">{customHint}</li>
          )}
          {allowCustom && query.trim() && !filtered.some((o) => o.label.toLowerCase() === query.trim().toLowerCase()) && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(query.trim()); setQuery(query.trim()); setOpen(false); }}
                className="block w-full border-b border-border px-3 py-2 text-left text-p2 text-primary hover:bg-primary-light"
              >
                Use "{query.trim()}"
              </button>
            </li>
          )}
          {filtered.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur-close doesn't fire first
                onClick={() => select(o)}
                className={`block w-full px-3 py-2 text-left text-p1 ${
                  i === highlight ? 'bg-primary-light' : 'hover:bg-primary-light'
                } ${o.value === value ? 'font-semibold text-primary' : ''}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

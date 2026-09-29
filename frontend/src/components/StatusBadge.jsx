import { useLanguage } from '../context/LanguageContext.jsx';

const STYLES = {
  waiting: 'bg-accent-light text-accent-dark',
  processing: 'bg-primary-light text-primary-dark',
  completed: 'bg-primary-light text-primary-dark',
  absent: 'bg-danger/10 text-danger',
  cancelled: 'bg-danger/10 text-danger',
  available: 'bg-primary-light text-primary-dark',
  full: 'bg-danger/10 text-danger',
  closed: 'bg-border text-muted',
  pending: 'bg-accent-light text-accent-dark',
  requested: 'bg-accent-light text-accent-dark',
  not_applicable: 'bg-border text-muted',
};

// Falls back to an auto-capitalized version of the raw value for any
// status this dictionary doesn't know about yet, so a new backend status
// value never breaks the badge - it just won't be translated until a key
// is added here.
const STATUS_KEYS = {
  waiting: 'status.waiting',
  processing: 'status.processing',
  completed: 'status.completed',
  absent: 'status.absent',
  cancelled: 'status.cancelled',
  available: 'status.available',
  full: 'status.full',
  closed: 'status.closed',
  pending: 'status.pending',
  requested: 'status.requested',
  not_applicable: 'status.notApplicable',
};

function fallbackLabel(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  const style = STYLES[status] || 'bg-border text-muted';
  const key = STATUS_KEYS[status];
  const label = key ? t(key) : fallbackLabel(status);
  return <span className={`badge ${style}`}>{label}</span>;
}

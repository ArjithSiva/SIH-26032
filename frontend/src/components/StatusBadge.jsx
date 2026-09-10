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
  not_applicable: 'bg-border text-muted',
};

function labelFor(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'bg-border text-muted';
  return <span className={`badge ${style}`}>{labelFor(status)}</span>;
}

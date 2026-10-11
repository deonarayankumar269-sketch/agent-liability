// status is carried by shape, not hue: solid, outline, vermilion, struck through
const styles = {
  solid: 'border border-ink bg-ink text-paper',
  outline: 'border border-ink text-ink',
  alert: 'border border-vermilion bg-vermilion text-paper',
  muted: 'border border-ink/30 text-ink/50 line-through',
};

const byStatus = {
  active: 'solid', captured: 'solid', RESOLVED: 'solid',
  authorized: 'outline', pending_approval: 'outline', UNDER_REVIEW: 'outline', OPEN: 'outline',
  blocked: 'alert', revoked: 'alert', failed: 'alert', NEEDS_REVIEW: 'alert',
  expired: 'muted', voided: 'muted',
};

export default function Badge({ status, children }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-1.5 py-0.5 font-mono text-12 ${styles[byStatus[status] || 'muted']}`}>
      {children || String(status).replace(/_/g, ' ')}
    </span>
  );
}

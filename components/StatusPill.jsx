const LABELS = { draft: 'Draft', sent: 'Sent', viewed: 'Opened', overdue: 'Overdue', paid: 'Paid' };
export default function StatusPill({ status }) {
  return <span className={`pill pill--${status}`}>{LABELS[status] || status}</span>;
}

const STATUS_MAP = {
  Operational: 'badge-success',
  Completed: 'badge-success',
  Resolved: 'badge-success',
  Low: 'badge-neutral',

  'Under Maintenance': 'badge-warning',
  'In Progress': 'badge-warning',
  'Due Soon': 'badge-warning',
  'Pending Parts': 'badge-warning',
  Medium: 'badge-warning',
  Major: 'badge-warning',
  Moderate: 'badge-warning',

  'Out of Service': 'badge-danger',
  Overdue: 'badge-danger',
  Critical: 'badge-danger',
  High: 'badge-danger',
  Ongoing: 'badge-danger',

  'Calibration Due': 'badge-info',
  Scheduled: 'badge-info',
  'Escalated to Vendor': 'badge-info',
  Minor: 'badge-info',
  Cancelled: 'badge-neutral',
};

export function StatusBadge({ value }) {
  const cls = STATUS_MAP[value] || 'badge-neutral';
  return <span className={`badge ${cls}`}>{value}</span>;
}

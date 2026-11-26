import {
  AlertCircle,
  BellRing,
  CheckCircle,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'all', label: 'All Schedules' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'due_soon', label: 'Due Soon (Reminders)' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export function MaintenancePage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('all');
  const [schedules, setSchedules] = useState([]);
  const [alerts, setAlerts] = useState({ overdue_count: 0, due_soon_count: 0 });
  const [devices, setDevices] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    device_id: '',
    title: '',
    maintenance_type: 'Preventive Maintenance',
    scheduled_date: new Date().toISOString().slice(0, 10),
    frequency_days: 90,
    reminder_days_before: 7,
    priority: 'Medium',
    assigned_engineer_id: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, alertData] = await Promise.all([
        api.getMaintenance({ filter_mode: tab }),
        api.getMaintenanceAlerts(),
      ]);
      setSchedules(list);
      setAlerts(alertData);
    } catch (err) {
      setError(err.message || 'Failed to load maintenance schedules');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    Promise.all([api.getDevices(), api.getEngineers()])
      .then(([devs, engs]) => {
        setDevices(devs);
        setEngineers(engs);
      })
      .catch(() => {});
  }, []);

  const openScheduleModal = () => {
    setForm({
      device_id: devices[0]?.id || '',
      title: '',
      maintenance_type: 'Preventive Maintenance',
      scheduled_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      frequency_days: 90,
      reminder_days_before: 7,
      priority: 'Medium',
      assigned_engineer_id: engineers[0]?.id || '',
      notes: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.createMaintenance({
        ...form,
        device_id: Number(form.device_id),
        frequency_days: Number(form.frequency_days),
        reminder_days_before: Number(form.reminder_days_before),
        assigned_engineer_id: form.assigned_engineer_id ? Number(form.assigned_engineer_id) : null,
      });
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to schedule maintenance');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      await api.updateMaintenance(item.id, {
        status: newStatus,
        auto_schedule_next: newStatus === 'Completed' && item.frequency_days > 0,
        set_device_operational: newStatus === 'Completed',
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this maintenance schedule?')) return;
    try {
      await api.deleteMaintenance(id);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete schedule');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preventive Maintenance & Reminders</h1>
          <p className="page-subtitle">
            Schedule PM cycles, track overdue calibrations, and automate recurring compliance tasks
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={openScheduleModal}>
            <Plus size={17} /> Schedule Maintenance
          </button>
        </div>
      </div>

      {(alerts.overdue_count > 0 || alerts.due_soon_count > 0) && (
        <div className="alert alert-warning" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BellRing size={19} />
            <span>
              <strong>Active Maintenance Reminders:</strong> {alerts.overdue_count} overdue task(s) and{' '}
              {alerts.due_soon_count} task(s) due within their reminder window.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('overdue')}>
              View Overdue
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('due_soon')}>
              View Due Soon
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading maintenance schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="empty-state">No maintenance tasks found for this filter.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Maintenance Task</th>
                  <th>Scheduled Date</th>
                  <th>Recurrence</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Engineer</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="code-pill">{item.device_code}</span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, marginTop: 3 }}>{item.device_name}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.maintenance_type}</div>
                    </td>
                    <td className="tabular">
                      <div style={{ fontWeight: 600 }}>{item.scheduled_date}</div>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: item.is_overdue ? '#be123c' : item.is_due_soon ? '#b45309' : 'var(--text-muted)',
                        }}
                      >
                        {item.status === 'Completed'
                          ? 'Completed'
                          : item.is_overdue
                          ? `${Math.abs(item.days_until_due)} days overdue`
                          : item.days_until_due === 0
                          ? 'Due today'
                          : `In ${item.days_until_due} days (Reminder ${item.reminder_days_before}d)`}
                      </div>
                    </td>
                    <td>{item.frequency_days > 0 ? `Every ${item.frequency_days}d` : 'One-time'}</td>
                    <td>
                      <StatusBadge value={item.priority} />
                    </td>
                    <td>
                      <StatusBadge value={item.effective_status} />
                    </td>
                    <td>{item.assigned_engineer_name || 'Unassigned'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {item.status === 'Scheduled' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStatusChange(item, 'In Progress')}
                          >
                            <Play size={13} /> Start
                          </button>
                        )}
                        {(item.status === 'Scheduled' || item.status === 'In Progress' || item.status === 'Overdue') && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handleStatusChange(item, 'Completed')}
                          >
                            <CheckCircle size={13} /> Complete
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-icon danger"
                            title="Delete schedule (Admin)"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule Preventive Maintenance">
        {formError && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
        <form id="pm-form" onSubmit={handleCreate} className="form-grid">
          <div className="form-group full">
            <label>Medical Device *</label>
            <select
              required
              value={form.device_id}
              onChange={(e) => setForm({ ...form, device_id: e.target.value })}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.device_code} — {d.name} ({d.location})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group full">
            <label>Maintenance Title *</label>
            <input
              required
              placeholder="e.g. Quarterly Flow Sensor Calibration"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Maintenance Type *</label>
            <select
              value={form.maintenance_type}
              onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
            >
              <option value="Preventive Maintenance">Preventive Maintenance</option>
              <option value="Calibration">Calibration</option>
              <option value="Safety Inspection">Safety Inspection</option>
              <option value="Firmware Update">Firmware Update</option>
            </select>
          </div>
          <div className="form-group">
            <label>Scheduled Date *</label>
            <input
              type="date"
              required
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Recurrence Interval</label>
            <select
              value={form.frequency_days}
              onChange={(e) => setForm({ ...form, frequency_days: Number(e.target.value) })}
            >
              <option value={0}>One-time</option>
              <option value={30}>Monthly (30 days)</option>
              <option value={90}>Quarterly (90 days)</option>
              <option value={180}>Semi-Annual (180 days)</option>
              <option value={365}>Annual (365 days)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Reminder Lead Time (Days)</label>
            <input
              type="number"
              min={0}
              max={90}
              value={form.reminder_days_before}
              onChange={(e) => setForm({ ...form, reminder_days_before: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Priority *</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label>Assigned Engineer</label>
            <select
              value={form.assigned_engineer_id}
              onChange={(e) => setForm({ ...form, assigned_engineer_id: e.target.value })}
            >
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group full">
            <label>Checklist / Notes</label>
            <textarea
              rows={2}
              placeholder="Inspection checklist or OEM procedure reference..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" form="pm-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Scheduling...' : 'Create Schedule'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

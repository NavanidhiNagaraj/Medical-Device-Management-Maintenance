import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

function formatDuration(minutes) {
  const m = Number(minutes || 0);
  const days = Math.floor(m / 1440);
  const hrs = Math.floor((m % 1440) / 60);
  const rem = m % 60;
  if (days > 0) return `${days}d ${hrs}h ${rem}m`;
  if (hrs > 0) return `${hrs}h ${rem}m`;
  return `${rem}m`;
}

function toLocalDateTimeInput(dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(
    dateObj.getHours()
  )}:${pad(dateObj.getMinutes())}`;
}

export function DowntimePage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [frequent, setFrequent] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ongoingOnly, setOngoingOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    device_id: '',
    unavailable_at: toLocalDateTimeInput(new Date(Date.now() - 3600000)),
    recovery_at: '',
    reason: '',
    impact_level: 'High',
    notes: '',
    update_device_status: true,
  });

  const [recoverModal, setRecoverModal] = useState(null);
  const [recoveryInput, setRecoveryInput] = useState(toLocalDateTimeInput());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [logList, freqList] = await Promise.all([
        api.getDowntimeLogs({ ongoing_only: ongoingOnly }),
        api.getFrequentMalfunctions(),
      ]);
      setLogs(logList);
      setFrequent(freqList);
    } catch (err) {
      setError(err.message || 'Failed to load downtime data');
    } finally {
      setLoading(false);
    }
  }, [ongoingOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    api
      .getDevices()
      .then(setDevices)
      .catch(() => {});
  }, []);

  const openModal = () => {
    setForm({
      device_id: devices[0]?.id || '',
      unavailable_at: toLocalDateTimeInput(new Date(Date.now() - 3600000)),
      recovery_at: '',
      reason: '',
      impact_level: 'High',
      notes: '',
      update_device_status: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (form.recovery_at && new Date(form.recovery_at) <= new Date(form.unavailable_at)) {
      setFormError('Recovery time must be strictly after unavailable time.');
      return;
    }
    setSaving(true);
    try {
      await api.createDowntimeLog({
        device_id: Number(form.device_id),
        unavailable_at: form.unavailable_at,
        recovery_at: form.recovery_at || null,
        reason: form.reason,
        impact_level: form.impact_level,
        notes: form.notes || null,
        update_device_status: form.update_device_status,
      });
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to record downtime');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRecovered = async (e) => {
    e.preventDefault();
    if (!recoverModal) return;
    setError('');
    try {
      await api.updateDowntimeLog(recoverModal.id, {
        recovery_at: recoveryInput,
        restore_device_operational: true,
      });
      setRecoverModal(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to record recovery time');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this downtime log?')) return;
    try {
      await api.deleteDowntimeLog(id);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete downtime record');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Downtime & Reliability Tracking</h1>
          <p className="page-subtitle">
            Monitor active device outages, recovery durations (MTTR), and frequently malfunctioning assets
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`btn ${ongoingOnly ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setOngoingOnly(!ongoingOnly)}
          >
            <Clock size={16} /> {ongoingOnly ? 'Showing Ongoing Only' : 'Filter Ongoing Outages'}
          </button>
          <button type="button" className="btn btn-primary" onClick={openModal}>
            <Plus size={17} /> Log Outage / Downtime
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Frequently Malfunctioning Devices Leaderboard */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#e11d48" />
            <h3 className="card-title">Frequently Malfunctioning Devices (Reliability Watchlist)</h3>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Ranked by fault frequency & cumulative downtime
          </span>
        </div>
        <div className="table-wrap">
          {frequent.length === 0 ? (
            <div className="empty-state">No recurring malfunctions recorded yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Location</th>
                  <th>Current Status</th>
                  <th>Faults</th>
                  <th>Outages</th>
                  <th>Total Downtime</th>
                  <th>Avg Recovery (MTTR)</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {frequent.map((item) => (
                  <tr key={item.device_id}>
                    <td>
                      <span className="code-pill">{item.device_code}</span>
                      <div style={{ fontWeight: 600, marginTop: 3 }}>{item.device_name}</div>
                    </td>
                    <td>{item.location}</td>
                    <td>
                      <StatusBadge value={item.operational_status} />
                    </td>
                    <td className="tabular" style={{ fontWeight: 700 }}>
                      {item.fault_count}
                    </td>
                    <td className="tabular">{item.outage_count}</td>
                    <td className="tabular" style={{ fontWeight: 600 }}>
                      {item.total_downtime_hours} hrs ({formatDuration(item.total_downtime_minutes)})
                    </td>
                    <td className="tabular">{formatDuration(Math.round(item.avg_recovery_minutes))}</td>
                    <td>
                      <StatusBadge value={item.risk_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Downtime Logs Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Device Outage & Recovery Log</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{logs.length} record(s)</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading downtime records...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">No downtime records found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Unavailable At</th>
                  <th>Recovery At</th>
                  <th>Calculated Downtime</th>
                  <th>Impact</th>
                  <th>Reason & Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="code-pill">{log.device_code}</span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, marginTop: 3 }}>{log.device_name}</div>
                    </td>
                    <td className="tabular" style={{ fontSize: '0.82rem' }}>
                      {log.unavailable_at.replace('T', ' ').slice(0, 16)}
                    </td>
                    <td className="tabular" style={{ fontSize: '0.82rem' }}>
                      {log.recovery_at ? (
                        log.recovery_at.replace('T', ' ').slice(0, 16)
                      ) : (
                        <StatusBadge value="Ongoing" />
                      )}
                    </td>
                    <td className="tabular" style={{ fontWeight: 700, color: log.is_ongoing ? '#be123c' : '#0f172a' }}>
                      {formatDuration(log.downtime_minutes)}
                    </td>
                    <td>
                      <StatusBadge value={log.impact_level} />
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 500 }}>{log.reason}</div>
                      {log.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{log.notes}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {log.is_ongoing && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => {
                              setRecoverModal(log);
                              setRecoveryInput(toLocalDateTimeInput());
                            }}
                          >
                            <CheckCircle2 size={14} /> Mark Recovered
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-icon danger"
                            title="Delete downtime record (Admin)"
                            onClick={() => handleDelete(log.id)}
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

      {/* Log Outage Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Device Unavailable / Downtime">
        {formError && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
        <form id="downtime-form" onSubmit={handleCreate} className="form-grid">
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
          <div className="form-group">
            <label>Unavailable Timestamp *</label>
            <input
              type="datetime-local"
              required
              value={form.unavailable_at}
              onChange={(e) => setForm({ ...form, unavailable_at: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Recovery Timestamp (leave blank if ongoing)</label>
            <input
              type="datetime-local"
              value={form.recovery_at}
              onChange={(e) => setForm({ ...form, recovery_at: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Clinical Impact Level *</label>
            <select
              value={form.impact_level}
              onChange={(e) => setForm({ ...form, impact_level: e.target.value })}
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 18 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={form.update_device_status}
                onChange={(e) => setForm({ ...form, update_device_status: e.target.checked })}
              />
              Auto-update device status
            </label>
          </div>
          <div className="form-group full">
            <label>Outage Reason *</label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Unplanned power fault during ICU monitoring..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label>Backup Unit / Mitigation Notes</label>
            <input
              placeholder="e.g. Loaner unit deployed to ICU Bay 04"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" form="downtime-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Downtime Log'}
          </button>
        </div>
      </Modal>

      {/* Mark Recovered Modal */}
      <Modal
        open={Boolean(recoverModal)}
        onClose={() => setRecoverModal(null)}
        title={recoverModal ? `Record Recovery — ${recoverModal.device_code}` : ''}
      >
        {recoverModal && (
          <form onSubmit={handleMarkRecovered} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Unavailable since: <strong>{recoverModal.unavailable_at.replace('T', ' ').slice(0, 16)}</strong>
            </div>
            <div className="form-group">
              <label>Recovery Timestamp *</label>
              <input
                type="datetime-local"
                required
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRecoverModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success">
                Confirm Recovery & Restore Operational Status
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

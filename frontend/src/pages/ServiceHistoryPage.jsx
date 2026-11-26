import { AlertCircle, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function ServiceHistoryPage() {
  const { isAdmin, user } = useAuth();
  const [records, setRecords] = useState([]);
  const [devices, setDevices] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    device_id: '',
    service_type: 'Corrective Repair',
    service_date: new Date().toISOString().slice(0, 10),
    fault_description: '',
    repair_details: '',
    severity: 'Major',
    outcome: 'Resolved',
    cost: '0',
    engineer_id: '',
    parts_replaced: '',
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.getServiceHistory({
        search,
        service_type: typeFilter,
        severity: severityFilter,
      });
      setRecords(list);
    } catch (err) {
      setError(err.message || 'Failed to load service history');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, severityFilter]);

  useEffect(() => {
    const t = setTimeout(loadRecords, 180);
    return () => clearTimeout(t);
  }, [loadRecords]);

  useEffect(() => {
    Promise.all([api.getDevices(), api.getEngineers()])
      .then(([devs, engs]) => {
        setDevices(devs);
        setEngineers(engs);
      })
      .catch(() => {});
  }, []);

  const openModal = () => {
    setForm({
      device_id: devices[0]?.id || '',
      service_type: 'Corrective Repair',
      service_date: new Date().toISOString().slice(0, 10),
      fault_description: '',
      repair_details: '',
      severity: 'Major',
      outcome: 'Resolved',
      cost: '0',
      engineer_id: user?.id || engineers[0]?.id || '',
      parts_replaced: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.createServiceRecord({
        ...form,
        device_id: Number(form.device_id),
        cost: Number(form.cost || 0),
        engineer_id: form.engineer_id ? Number(form.engineer_id) : null,
        parts_replaced: form.parts_replaced || null,
      });
      setModalOpen(false);
      loadRecords();
    } catch (err) {
      setFormError(err.message || 'Failed to log service record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this service record?')) return;
    try {
      await api.deleteServiceRecord(id);
      loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to delete service record');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service & Fault History</h1>
          <p className="page-subtitle">
            Log device faults, corrective repairs, replaced components, and certifying biomedical engineers
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={openModal}>
            <Plus size={17} /> Log Service / Fault
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search fault description, repair details, parts, device, or engineer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select style={{ width: 200 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="All">All Service Types</option>
            <option value="Corrective Repair">Corrective Repair</option>
            <option value="Emergency Fault">Emergency Fault</option>
            <option value="Parts Replacement">Parts Replacement</option>
            <option value="Preventive Service">Preventive Service</option>
            <option value="Calibration">Calibration</option>
          </select>
          <select style={{ width: 160 }} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="All">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="Major">Major</option>
            <option value="Minor">Minor</option>
          </select>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading service logs...</div>
          ) : records.length === 0 ? (
            <div className="empty-state">No service history records found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Device</th>
                  <th>Type & Severity</th>
                  <th>Fault & Repair Details</th>
                  <th>Engineer</th>
                  <th>Outcome / Cost</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="tabular" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {rec.service_date}
                    </td>
                    <td>
                      <span className="code-pill">{rec.device_code}</span>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, marginTop: 3 }}>{rec.device_name}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{rec.service_type}</div>
                      <StatusBadge value={rec.severity} />
                    </td>
                    <td style={{ maxWidth: 380 }}>
                      <div style={{ fontWeight: 600, marginBottom: 3 }}>Fault: {rec.fault_description}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Repair: {rec.repair_details}
                      </div>
                      {rec.parts_replaced && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--brand-teal)', marginTop: 3 }}>
                          Parts: {rec.parts_replaced}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.84rem' }}>{rec.engineer_name}</td>
                    <td>
                      <StatusBadge value={rec.outcome} />
                      <div className="tabular" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        ${Number(rec.cost || 0).toFixed(2)}
                      </div>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon danger"
                          title="Delete service record (Admin)"
                          onClick={() => handleDelete(rec.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Fault & Service Repair">
        {formError && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
        <form id="service-form" onSubmit={handleSubmit} className="form-grid">
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
            <label>Service Type *</label>
            <select
              value={form.service_type}
              onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            >
              <option value="Corrective Repair">Corrective Repair</option>
              <option value="Emergency Fault">Emergency Fault</option>
              <option value="Parts Replacement">Parts Replacement</option>
              <option value="Preventive Service">Preventive Service</option>
              <option value="Calibration">Calibration</option>
            </select>
          </div>
          <div className="form-group">
            <label>Service Date *</label>
            <input
              type="date"
              required
              value={form.service_date}
              onChange={(e) => setForm({ ...form, service_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Severity *</label>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Outcome *</label>
            <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
              <option value="Resolved">Resolved</option>
              <option value="Pending Parts">Pending Parts</option>
              <option value="Escalated to Vendor">Escalated to Vendor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Biomedical Engineer *</label>
            <select
              value={form.engineer_id}
              onChange={(e) => setForm({ ...form, engineer_id: e.target.value })}
            >
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Repair / Parts Cost ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label>Fault Description *</label>
            <textarea
              required
              rows={2}
              placeholder="Describe alarm codes, reported malfunction, or failure symptoms..."
              value={form.fault_description}
              onChange={(e) => setForm({ ...form, fault_description: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label>Repair Details & Verification *</label>
            <textarea
              required
              rows={2}
              placeholder="Root cause, corrective actions performed, and post-repair safety test results..."
              value={form.repair_details}
              onChange={(e) => setForm({ ...form, repair_details: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label>Parts Replaced</label>
            <input
              placeholder="e.g. Galvanic O2 Sensor Cell, Silicone Gasket"
              value={form.parts_replaced}
              onChange={(e) => setForm({ ...form, parts_replaced: e.target.value })}
            />
          </div>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" form="service-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Service Record'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

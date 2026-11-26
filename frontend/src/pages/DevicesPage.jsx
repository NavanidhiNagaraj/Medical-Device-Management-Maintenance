import {
  AlertCircle,
  Edit2,
  Eye,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  'Life Support',
  'Patient Monitoring',
  'Diagnostic Imaging',
  'Infusion Therapy',
  'Surgical',
  'Laboratory',
];
const STATUSES = ['Operational', 'Under Maintenance', 'Out of Service', 'Calibration Due'];
const CRITICALITIES = ['High', 'Medium', 'Low'];

const EMPTY_FORM = {
  device_code: '',
  name: '',
  category: 'Patient Monitoring',
  model: '',
  manufacturer: '',
  serial_number: '',
  location: '',
  operational_status: 'Operational',
  criticality: 'Medium',
  purchase_date: '',
  warranty_expiry: '',
  notes: '',
};

function formatMins(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DevicesPage() {
  const { isAdmin } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailDevice, setDetailDevice] = useState(null);
  const [detailLogs, setDetailLogs] = useState({ maintenance: [], service: [], downtime: [] });
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.getDevices({
        search,
        operational_status: statusFilter,
        category: categoryFilter,
      });
      setDevices(list);
    } catch (err) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    const t = setTimeout(fetchDevices, 180);
    return () => clearTimeout(t);
  }, [fetchDevices]);

  const openCreateModal = () => {
    setEditingDevice(null);
    const nextCode = `MED-DEV-${String(devices.length + 1).padStart(3, '0')}`;
    setForm({ ...EMPTY_FORM, device_code: nextCode });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (dev) => {
    setEditingDevice(dev);
    setForm({
      device_code: dev.device_code,
      name: dev.name,
      category: dev.category,
      model: dev.model,
      manufacturer: dev.manufacturer,
      serial_number: dev.serial_number,
      location: dev.location,
      operational_status: dev.operational_status,
      criticality: dev.criticality,
      purchase_date: dev.purchase_date || '',
      warranty_expiry: dev.warranty_expiry || '',
      notes: dev.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const openDetailModal = async (dev) => {
    setDetailDevice(dev);
    setDetailLoading(true);
    try {
      const [m, s, d] = await Promise.all([
        api.getMaintenance({ device_id: dev.id }),
        api.getServiceHistory({ device_id: dev.id }),
        api.getDowntimeLogs({ device_id: dev.id }),
      ]);
      setDetailLogs({ maintenance: m, service: s, downtime: d });
    } catch {
      setDetailLogs({ maintenance: [], service: [], downtime: [] });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = {
      ...form,
      purchase_date: form.purchase_date || null,
      warranty_expiry: form.warranty_expiry || null,
      notes: form.notes || null,
    };
    try {
      if (editingDevice) {
        await api.updateDevice(editingDevice.id, payload);
      } else {
        await api.createDevice(payload);
      }
      setModalOpen(false);
      fetchDevices();
    } catch (err) {
      setFormError(err.message || 'Failed to save device');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dev) => {
    if (!window.confirm(`Permanently delete device ${dev.device_code} (${dev.name}) and all its logs?`)) {
      return;
    }
    try {
      await api.deleteDevice(dev.id);
      fetchDevices();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Medical Device Inventory</h1>
          <p className="page-subtitle">
            Track hospital clinical assets, serial numbers, ward locations, and operational readiness
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={17} /> Add Device
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
              placeholder="Search by Device ID, name, model, manufacturer, serial #, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select style={{ width: 190 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select style={{ width: 190 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading medical devices...</div>
          ) : devices.length === 0 ? (
            <div className="empty-state">No devices match your current search or filters.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Device & Model</th>
                  <th>Manufacturer / Serial</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Criticality</th>
                  <th>Faults / Downtime</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => (
                  <tr key={dev.id}>
                    <td>
                      <span className="code-pill">{dev.device_code}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{dev.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {dev.category} &bull; {dev.model}
                      </div>
                    </td>
                    <td>
                      <div>{dev.manufacturer}</div>
                      <div className="tabular" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        S/N: {dev.serial_number}
                      </div>
                    </td>
                    <td>{dev.location}</td>
                    <td>
                      <StatusBadge value={dev.operational_status} />
                    </td>
                    <td>
                      <StatusBadge value={dev.criticality} />
                    </td>
                    <td className="tabular">
                      <div style={{ fontWeight: 600 }}>{dev.fault_count} service logs</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Downtime: {formatMins(dev.total_downtime_minutes)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Inspect device 360° logs"
                          onClick={() => openDetailModal(dev)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit device"
                          onClick={() => openEditModal(dev)}
                        >
                          <Edit2 size={15} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-icon danger"
                            title="Delete device (Admin)"
                            onClick={() => handleDelete(dev)}
                          >
                            <Trash2 size={15} />
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

      {/* Add / Edit Device Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDevice ? `Edit Device — ${editingDevice.device_code}` : 'Register New Medical Device'}
      >
        {formError && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
        <form id="device-form" onSubmit={handleSave} className="form-grid">
          <div className="form-group">
            <label>Unique Device ID *</label>
            <input
              required
              placeholder="MED-ICU-012"
              value={form.device_code}
              onChange={(e) => setForm({ ...form, device_code: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Serial Number *</label>
            <input
              required
              placeholder="SN-GE-90211"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label>Device Name *</label>
            <input
              required
              placeholder="e.g. Servo-U Mechanical Ventilator"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Manufacturer *</label>
            <input
              required
              placeholder="e.g. Philips Healthcare"
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Model *</label>
            <input
              required
              placeholder="e.g. MX800"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Hospital Location *</label>
            <input
              required
              placeholder="e.g. ICU - Bay 04"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Operational Status *</label>
            <select
              value={form.operational_status}
              onChange={(e) => setForm({ ...form, operational_status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Clinical Criticality *</label>
            <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
              {CRITICALITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Purchase Date</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Warranty Expiry</label>
            <input
              type="date"
              value={form.warranty_expiry}
              onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value })}
            />
          </div>
          <div className="form-group full">
            <label>Biomedical Notes</label>
            <textarea
              rows={2}
              placeholder="Configuration notes, accessories, or special handling instructions..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" form="device-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : editingDevice ? 'Save Changes' : 'Register Device'}
          </button>
        </div>
      </Modal>

      {/* Device 360° Inspection Modal */}
      <Modal
        open={Boolean(detailDevice)}
        onClose={() => setDetailDevice(null)}
        title={detailDevice ? `${detailDevice.device_code} — ${detailDevice.name}` : ''}
        wide
      >
        {detailDevice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12,
                background: '#f8fafc',
                padding: 14,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MANUFACTURER / MODEL</div>
                <div style={{ fontWeight: 600 }}>
                  {detailDevice.manufacturer} {detailDevice.model}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SERIAL NUMBER</div>
                <div style={{ fontWeight: 600 }}>{detailDevice.serial_number}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>LOCATION</div>
                <div style={{ fontWeight: 600 }}>{detailDevice.location}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>STATUS</div>
                <div style={{ marginTop: 2 }}>
                  <StatusBadge value={detailDevice.operational_status} />
                </div>
              </div>
            </div>

            {detailLoading ? (
              <div className="empty-state">Loading device logs...</div>
            ) : (
              <>
                <div>
                  <h4 style={{ marginBottom: 8 }}>Maintenance Schedules ({detailLogs.maintenance.length})</h4>
                  {detailLogs.maintenance.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No scheduled maintenance.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detailLogs.maintenance.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            fontSize: '0.84rem',
                          }}
                        >
                          <span>
                            <strong>{m.title}</strong> ({m.scheduled_date})
                          </span>
                          <StatusBadge value={m.effective_status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ marginBottom: 8 }}>Service & Fault History ({detailLogs.service.length})</h4>
                  {detailLogs.service.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No service records logged.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detailLogs.service.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            fontSize: '0.84rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <strong>
                              {s.service_date} &bull; {s.service_type}
                            </strong>
                            <StatusBadge value={s.severity} />
                          </div>
                          <div>Fault: {s.fault_description}</div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                            Repair: {s.repair_details} (Eng: {s.engineer_name})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ marginBottom: 8 }}>Downtime Logs ({detailLogs.downtime.length})</h4>
                  {detailLogs.downtime.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No downtime events recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detailLogs.downtime.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            fontSize: '0.84rem',
                          }}
                        >
                          <span>{d.reason}</span>
                          <span className="tabular" style={{ fontWeight: 600 }}>
                            {formatMins(d.downtime_minutes)} {d.is_ongoing ? '(Ongoing)' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

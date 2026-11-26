import { Activity, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'biomedical_engineer',
    department: 'Biomedical Engineering',
    phone: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        department: form.department,
        phone: form.phone || null,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand-icon">
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>MedWave CMMS</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Biomedical Staff Onboarding</div>
          </div>
        </div>
        <div style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1.2, marginBottom: 14 }}>
            Join your clinical engineering team.
          </h1>
          <p style={{ color: '#cbd5e1', lineHeight: 1.65 }}>
            Register as a Biomedical Engineer to manage hospital equipment, execute preventive maintenance, and log
            repairs, or as an Administrator to oversee users and asset compliance.
          </p>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Role-Based Access Control (RBAC) Enabled</div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card" style={{ maxWidth: 500 }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Create Account</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem', marginTop: 4, marginBottom: 18 }}>
            Register your MedWave hospital credentials
          </p>

          {error && (
            <div className="alert alert-danger">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group full">
              <label>Full Name *</label>
              <input
                required
                placeholder="e.g. Alex Rivera, CBET"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>

            <div className="form-group full">
              <label>Work Email *</label>
              <input
                type="email"
                required
                placeholder="alex.rivera@hospital.org"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Role *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="biomedical_engineer">Biomedical Engineer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="form-group">
              <label>Department</label>
              <input
                placeholder="Biomedical Engineering"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Re-enter password"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              />
            </div>

            <div className="form-group full" style={{ marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <p style={{ marginTop: 18, fontSize: '0.86rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand-teal)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

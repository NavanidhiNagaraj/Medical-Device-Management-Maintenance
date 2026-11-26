import { Activity, AlertCircle, Lock, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = async (demoEmail, demoPassword) => {
    setError('');
    setEmail(demoEmail);
    setPassword(demoPassword);
    setSubmitting(true);
    try {
      await login(demoEmail, demoPassword);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed');
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
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Clinical Asset & Maintenance Intelligence</div>
          </div>
        </div>

        <div style={{ maxWidth: 460 }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.18, marginBottom: 16 }}>
            Keep every life-critical medical device mission-ready.
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.65 }}>
            Centralize hospital device inventory, preventive maintenance schedules, repair histories, and real-time
            downtime reliability analytics in one clinical engineering workspace.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 28 }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#5eead4' }}>PM & Calibration</div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 4 }}>
                Automated overdue alerts, due-soon reminders & recurring schedules.
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#7dd3fc' }}>Downtime Analytics</div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 4 }}>
                MTTR tracking, outage logs & frequent-malfunction detection.
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          MedWave Biomedical Engineering Platform &bull; Joint Commission & ISO 13485 Workflow Ready
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Sign in to MedWave</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4, marginBottom: 20 }}>
            Access your hospital biomedical engineering dashboard
          </p>

          {error && (
            <div className="alert alert-danger">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label htmlFor="login-email">Work Email</label>
              <div className="search-box">
                <Mail size={16} />
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="engineer@medwave.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="search-box">
                <Lock size={16} />
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 4 }}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
              QUICK DEMO ACCESS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={submitting}
                onClick={() => quickLogin('admin@medwave.org', 'Admin@123')}
              >
                <ShieldCheck size={15} color="#6d28d9" /> Admin Demo
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={submitting}
                onClick={() => quickLogin('engineer@medwave.org', 'Engineer@123')}
              >
                <Wrench size={15} color="#0d9488" /> Engineer Demo
              </button>
            </div>
          </div>

          <p style={{ marginTop: 20, fontSize: '0.86rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            New biomedical staff?{' '}
            <Link to="/register" style={{ color: 'var(--brand-teal)', fontWeight: 600, textDecoration: 'none' }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

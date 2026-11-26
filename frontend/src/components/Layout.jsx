import {
  Activity,
  BarChart3,
  Bell,
  CalendarClock,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  TimerOff,
  UserCircle,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadAlerts = () => {
      api
        .getMaintenanceAlerts()
        .then((res) => {
          if (active) setAlertCount(res.total_alerts || 0);
        })
        .catch(() => {});
    };
    loadAlerts();
    const timer = setInterval(loadAlerts, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const initials = (user?.full_name || 'BM')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Activity size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="brand-title">MedWave</div>
            <div className="brand-subtitle">Clinical CMMS</div>
          </div>
          {sidebarOpen && (
            <button
              type="button"
              className="btn-icon"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => setSidebarOpen(false)}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav" onClick={() => setSidebarOpen(false)}>
          <div className="nav-section-label">Operations</div>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              <LayoutDashboard size={18} /> Dashboard
            </span>
          </NavLink>
          <NavLink to="/devices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              <Cpu size={18} /> Device Inventory
            </span>
          </NavLink>
          <NavLink to="/maintenance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              <CalendarClock size={18} /> Maintenance
            </span>
            {alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
          </NavLink>
          <NavLink to="/service-history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              <Wrench size={18} /> Service History
            </span>
          </NavLink>
          <NavLink to="/downtime" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              <TimerOff size={18} /> Downtime Tracking
            </span>
          </NavLink>

          <div className="nav-section-label">Analytics & Account</div>
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              <BarChart3 size={18} /> Reports & Export
            </span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-link-left">
              {isAdmin ? <ShieldCheck size={18} /> : <UserCircle size={18} />} Profile & Access
            </span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar-circle">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.full_name}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {isAdmin ? 'Administrator' : 'Biomedical Engineer'}
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            title="Sign out"
            onClick={handleLogout}
            style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.14)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Hospital Biomedical Engineering Operations
            </div>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/maintenance')}
              title="View maintenance alerts"
            >
              <Bell size={15} color={alertCount > 0 ? '#e11d48' : '#64748b'} />
              <span>{alertCount} Alerts</span>
            </button>
            <span className={`role-pill ${isAdmin ? 'admin' : ''}`}>
              {isAdmin ? 'Admin' : 'Biomedical Engineer'}
            </span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  TimerOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDashboardOverview();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (loading) {
    return <div className="empty-state">Loading hospital biomedical telemetry...</div>;
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const { kpis, charts, alerts } = data;

  const statusChartData = {
    labels: ['Operational', 'Under Maintenance', 'Out of Service', 'Calibration Due'],
    datasets: [
      {
        data: [
          charts.operational_status['Operational'] || 0,
          charts.operational_status['Under Maintenance'] || 0,
          charts.operational_status['Out of Service'] || 0,
          charts.operational_status['Calibration Due'] || 0,
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#f43f5e', '#3b82f6'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const trendChartData = {
    labels: charts.monthly_trend.map((m) => m.label),
    datasets: [
      {
        label: 'Downtime (Hours)',
        data: charts.monthly_trend.map((m) => m.downtime_hours),
        borderColor: '#0284c7',
        backgroundColor: 'rgba(2, 132, 199, 0.14)',
        fill: true,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        label: 'Fault Incidents',
        data: charts.monthly_trend.map((m) => m.fault_count),
        borderColor: '#e11d48',
        backgroundColor: '#e11d48',
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  };

  const downtimeChartData = {
    labels: charts.top_downtime_devices.map((d) => d.device_code),
    datasets: [
      {
        label: 'Total Downtime (Hours)',
        data: charts.top_downtime_devices.map((d) => d.hours),
        backgroundColor: '#0d9488',
        borderRadius: 6,
      },
    ],
  };

  const faultChartData = {
    labels: charts.top_fault_devices.map((d) => d.device_code),
    datasets: [
      {
        label: 'Fault / Repair Incidents',
        data: charts.top_fault_devices.map((d) => d.faults),
        backgroundColor: '#f43f5e',
        borderRadius: 6,
      },
    ],
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinical Engineering Overview</h1>
          <p className="page-subtitle">
            Real-time fleet readiness, preventive maintenance alerts, and reliability analytics
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/reports')}>
            Export Reports
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/devices')}>
            Manage Inventory <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <StatCard
          title="Total Medical Devices"
          value={kpis.total_devices}
          meta={`${kpis.operational_devices} Operational • ${kpis.under_maintenance} In Maint.`}
          icon={Cpu}
          iconBg="#eff6ff"
          iconColor="#0284c7"
        />
        <StatCard
          title="Fleet Operational Rate"
          value={`${kpis.operational_rate}%`}
          meta={`${kpis.out_of_service} Out of Service • ${kpis.calibration_due} Calib. Due`}
          icon={Activity}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
        <StatCard
          title="Maintenance Alerts"
          value={kpis.overdue_maintenance + kpis.due_soon_maintenance}
          meta={`${kpis.overdue_maintenance} Overdue • ${kpis.due_soon_maintenance} Due Soon`}
          icon={CalendarClock}
          iconBg="#fffbeb"
          iconColor="#d97706"
        />
        <StatCard
          title="Cumulative Downtime"
          value={`${kpis.total_downtime_hours} hrs`}
          meta={`${kpis.active_outages} Active Outage${kpis.active_outages === 1 ? '' : 's'} Right Now`}
          icon={TimerOff}
          iconBg="#fff1f2"
          iconColor="#e11d48"
        />
        <StatCard
          title="Frequent Fault Assets"
          value={kpis.high_risk_devices}
          meta={`${kpis.total_service_records} Service Records ($${kpis.total_service_cost.toLocaleString()})`}
          icon={ShieldAlert}
          iconBg="#f5f3ff"
          iconColor="#6d28d9"
        />
      </div>

      <div className="charts-grid">
        <div className="card col-4">
          <div className="card-header">
            <h3 className="card-title">Operational Status</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fleet distribution</span>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <Doughnut
                data={statusChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '64%',
                  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } },
                }}
              />
            </div>
          </div>
        </div>

        <div className="card col-8">
          <div className="card-header">
            <h3 className="card-title">Downtime & Fault Trend (6 Months)</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hours vs Incident Count</span>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <Line
                data={trendChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: { legend: { position: 'bottom' } },
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Hours' } },
                    y1: {
                      beginAtZero: true,
                      position: 'right',
                      grid: { drawOnChartArea: false },
                      ticks: { stepSize: 1 },
                      title: { display: true, text: 'Faults' },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="card col-6">
          <div className="card-header">
            <h3 className="card-title">Downtime Analytics by Device</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Top devices (Hours)</span>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <Bar
                data={downtimeChartData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { x: { beginAtZero: true } },
                }}
              />
            </div>
          </div>
        </div>

        <div className="card col-6">
          <div className="card-header">
            <h3 className="card-title">Fault Frequency by Device</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Corrective & Emergency Faults</span>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <Bar
                data={faultChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Alerts Panel */}
      <div className="charts-grid">
        <div className="card col-6">
          <div className="card-header">
            <h3 className="card-title" style={{ color: '#be123c' }}>
              Overdue Maintenance ({alerts.overdue.length})
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/maintenance')}>
              View All
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {alerts.overdue.length === 0 ? (
              <div className="empty-state" style={{ padding: 28 }}>
                <CheckCircle2 size={24} color="#059669" />
                <div style={{ marginTop: 6 }}>No overdue maintenance tasks.</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Task</th>
                    <th>Due Date</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.overdue.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="code-pill">{item.device_code}</span>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.device_location}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{item.title}</td>
                      <td className="tabular" style={{ color: '#be123c', fontWeight: 600 }}>
                        {item.scheduled_date} ({Math.abs(item.days_until_due)}d late)
                      </td>
                      <td>
                        <StatusBadge value={item.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card col-6">
          <div className="card-header">
            <h3 className="card-title" style={{ color: '#b45309' }}>
              Upcoming Reminders ({alerts.due_soon.length})
            </h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/maintenance')}>
              Schedule PM
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {alerts.due_soon.length === 0 ? (
              <div className="empty-state" style={{ padding: 28 }}>No maintenance tasks due within reminder window.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Task</th>
                    <th>Due In</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.due_soon.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="code-pill">{item.device_code}</span>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.device_name}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{item.title}</td>
                      <td className="tabular" style={{ fontWeight: 600, color: '#b45309' }}>
                        {item.days_until_due === 0 ? 'Today' : `${item.days_until_due}d`} ({item.scheduled_date})
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {item.assigned_engineer_name || 'Unassigned'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

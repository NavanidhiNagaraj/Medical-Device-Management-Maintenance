import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { api } from '../api/client';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export function ReportsPage() {
  const [overview, setOverview] = useState(null);
  const [frequent, setFrequent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboardOverview(), api.getFrequentMalfunctions()])
      .then(([ov, freq]) => {
        setOverview(ov);
        setFrequent(freq);
      })
      .finally(() => setLoading(false));
  }, []);

  const downloadCsv = async (type, filename) => {
    const csv = await api.exportCsvReport(type);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !overview) {
    return <div className="empty-state">Generating analytics and compliance reports...</div>;
  }

  const { kpis, charts } = overview;

  const categoryData = {
    labels: Object.keys(charts.category_distribution),
    datasets: [
      {
        label: 'Devices',
        data: Object.values(charts.category_distribution),
        backgroundColor: ['#0d9488', '#0284c7', '#4f46e5', '#f59e0b', '#10b981', '#ec4899'],
        borderRadius: 6,
      },
    ],
  };

  const severityData = {
    labels: ['Critical', 'Major', 'Minor'],
    datasets: [
      {
        data: [
          charts.severity_distribution.Critical || 0,
          charts.severity_distribution.Major || 0,
          charts.severity_distribution.Minor || 0,
        ],
        backgroundColor: ['#e11d48', '#f59e0b', '#3b82f6'],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hospital Biomedical Reports & Analytics</h1>
          <p className="page-subtitle">
            Export CSV compliance datasets, print audit summaries, and inspect fleet-wide reliability charts
          </p>
        </div>
        <div className="header-actions no-print">
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print Report
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadCsv('devices', 'medwave_devices.csv')}
          >
            <Download size={16} /> Export Inventory CSV
          </button>
        </div>
      </div>

      {/* Export Cards */}
      <div className="kpi-grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="kpi-card">
          <div className="kpi-label">Device Inventory</div>
          <div className="kpi-meta">{kpis.total_devices} registered clinical assets</div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv('devices', 'medwave_device_inventory.csv')}
          >
            <Download size={14} /> Download Devices CSV
          </button>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Maintenance Schedule</div>
          <div className="kpi-meta">
            {kpis.overdue_maintenance} overdue &bull; {kpis.completed_maintenance} completed
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv('maintenance', 'medwave_maintenance.csv')}
          >
            <Download size={14} /> Download Maintenance CSV
          </button>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Service & Repair Log</div>
          <div className="kpi-meta">
            {kpis.total_service_records} service logs (${kpis.total_service_cost.toLocaleString()})
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv('service', 'medwave_service_history.csv')}
          >
            <Download size={14} /> Download Service CSV
          </button>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Downtime & Outages</div>
          <div className="kpi-meta">{kpis.total_downtime_hours} cumulative downtime hours</div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv('downtime', 'medwave_downtime.csv')}
          >
            <Download size={14} /> Download Downtime CSV
          </button>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card col-7">
          <div className="card-header">
            <h3 className="card-title">Fleet Distribution by Clinical Category</h3>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <Bar
                data={categoryData}
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

        <div className="card col-5">
          <div className="card-header">
            <h3 className="card-title">Service Incident Severity Breakdown</h3>
          </div>
          <div className="card-body">
            <div className="chart-box">
              <Pie
                data={severityData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Executive Reliability Summary</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Faults</th>
                <th>Outages</th>
                <th>Total Downtime (Hrs)</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {frequent.map((f) => (
                <tr key={f.device_id}>
                  <td>
                    <span className="code-pill">{f.device_code}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{f.device_name}</td>
                  <td>{f.location}</td>
                  <td className="tabular">{f.fault_count}</td>
                  <td className="tabular">{f.outage_count}</td>
                  <td className="tabular">{f.total_downtime_hours}</td>
                  <td>{f.risk_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

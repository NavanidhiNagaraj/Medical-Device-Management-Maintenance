import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { DashboardPage } from '../pages/DashboardPage';
import { DevicesPage } from '../pages/DevicesPage';
import { DowntimePage } from '../pages/DowntimePage';
import { LoginPage } from '../pages/LoginPage';
import { MaintenancePage } from '../pages/MaintenancePage';
import { RegisterPage } from '../pages/RegisterPage';

const mockNavigate = vi.fn();
let mockAuthState = {
  user: {
    id: 1,
    full_name: 'Dr. Elena Vance',
    email: 'admin@medwave.org',
    role: 'admin',
    department: 'Clinical Engineering',
  },
  isAdmin: true,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }) => <div data-testid="chart-doughnut">{JSON.stringify(data.labels)}</div>,
  Line: ({ data }) => <div data-testid="chart-line">{JSON.stringify(data.labels)}</div>,
  Bar: ({ data }) => <div data-testid="chart-bar">{JSON.stringify(data.labels)}</div>,
  Pie: ({ data }) => <div data-testid="chart-pie">{JSON.stringify(data.labels)}</div>,
}));

const mockApi = vi.hoisted(() => ({
  getDashboardOverview: vi.fn(),
  getDevices: vi.fn(),
  createDevice: vi.fn(),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
  getMaintenance: vi.fn(),
  getMaintenanceAlerts: vi.fn(),
  createMaintenance: vi.fn(),
  updateMaintenance: vi.fn(),
  getEngineers: vi.fn(),
  getServiceHistory: vi.fn(),
  getDowntimeLogs: vi.fn(),
  getFrequentMalfunctions: vi.fn(),
  createDowntimeLog: vi.fn(),
  updateDowntimeLog: vi.fn(),
}));

vi.mock('../api/client', () => ({
  api: mockApi,
}));

describe('MedWave Frontend Components & Modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: {
        id: 1,
        full_name: 'Dr. Elena Vance',
        email: 'admin@medwave.org',
        role: 'admin',
        department: 'Clinical Engineering',
      },
      isAdmin: true,
      login: vi.fn().mockResolvedValue({ id: 1, role: 'admin' }),
      register: vi.fn().mockResolvedValue({ id: 2, role: 'biomedical_engineer' }),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    };
  });

  it('renders StatusBadge and StatCard with clinical styling', () => {
    render(
      <div>
        <StatusBadge value="Operational" />
        <StatusBadge value="Overdue" />
        <StatCard title="Total Devices" value={10} meta="9 Operational" />
      </div>
    );
    expect(screen.getByText('Operational')).toHaveClass('badge-success');
    expect(screen.getByText('Overdue')).toHaveClass('badge-danger');
    expect(screen.getByText('Total Devices')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('submits LoginPage credentials and supports demo login', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Work Email/i), {
      target: { value: 'admin@medwave.org' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Admin@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockAuthState.login).toHaveBeenCalledWith('admin@medwave.org', 'Admin@123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('validates password confirmation on RegisterPage', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Alex Rivera/i), {
      target: { value: 'Alex Rivera' },
    });
    fireEvent.change(screen.getByPlaceholderText(/alex\.rivera@hospital\.org/i), {
      target: { value: 'alex@hospital.org' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Min\. 6 characters/i), {
      target: { value: 'Secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Re-enter password/i), {
      target: { value: 'Mismatch999' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockAuthState.register).not.toHaveBeenCalled();
  });

  it('renders DashboardPage KPIs, Chart.js panels, and maintenance alerts', async () => {
    mockApi.getDashboardOverview.mockResolvedValue({
      kpis: {
        total_devices: 10,
        operational_devices: 7,
        operational_rate: 70.0,
        under_maintenance: 1,
        out_of_service: 1,
        calibration_due: 1,
        overdue_maintenance: 2,
        due_soon_maintenance: 2,
        upcoming_maintenance: 5,
        completed_maintenance: 1,
        total_downtime_hours: 29.3,
        active_outages: 2,
        total_service_records: 10,
        total_service_cost: 3125,
        high_risk_devices: 3,
      },
      charts: {
        operational_status: { Operational: 7, 'Under Maintenance': 1, 'Out of Service': 1, 'Calibration Due': 1 },
        category_distribution: { 'Life Support': 4 },
        severity_distribution: { Critical: 3, Major: 4, Minor: 3 },
        top_downtime_devices: [{ device_code: 'MED-NICU-005', hours: 44 }],
        top_fault_devices: [{ device_code: 'MED-DIAL-009', faults: 3 }],
        monthly_trend: [{ label: 'Nov 2026', downtime_hours: 12, fault_count: 2 }],
      },
      alerts: {
        overdue: [
          {
            id: 1,
            device_code: 'MED-RAD-004',
            device_location: 'Radiology',
            title: 'Annual X-Ray Calibration',
            scheduled_date: '2026-11-20',
            days_until_due: -6,
            priority: 'Critical',
          },
        ],
        due_soon: [],
      },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Clinical Engineering Overview')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('MED-RAD-004')).toBeInTheDocument();
    expect(screen.getByTestId('chart-doughnut')).toBeInTheDocument();
    expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-bar')).toHaveLength(2);
  });

  it('enforces RBAC delete visibility and creates devices in DevicesPage', async () => {
    mockApi.getDevices.mockResolvedValue([
      {
        id: 1,
        device_code: 'MED-ICU-001',
        name: 'Servo-U Ventilator',
        category: 'Life Support',
        model: 'Servo-U',
        manufacturer: 'Getinge',
        serial_number: 'SN-1001',
        location: 'ICU - Bay 01',
        operational_status: 'Operational',
        criticality: 'High',
        fault_count: 1,
        total_downtime_minutes: 45,
      },
    ]);
    mockApi.createDevice.mockResolvedValue({ id: 2, device_code: 'MED-DEV-002' });

    const { rerender } = render(
      <MemoryRouter>
        <DevicesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('MED-ICU-001')).toBeInTheDocument();
    expect(screen.getByTitle('Delete device (Admin)')).toBeInTheDocument();

    // Verify biomedical_engineer does not see permanent delete button
    mockAuthState = { ...mockAuthState, isAdmin: false };
    rerender(
      <MemoryRouter>
        <DevicesPage />
      </MemoryRouter>
    );
    expect(screen.queryByTitle('Delete device (Admin)')).not.toBeInTheDocument();

    // Open Add Device modal and submit
    fireEvent.click(screen.getByRole('button', { name: /Add Device/i }));
    fireEvent.change(screen.getByPlaceholderText(/SN-GE-90211/i), { target: { value: 'SN-NEW-77' } });
    fireEvent.change(screen.getByPlaceholderText(/Servo-U Mechanical Ventilator/i), {
      target: { value: 'Infusion Pump X2' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Philips Healthcare/i), { target: { value: 'BD' } });
    fireEvent.change(screen.getByPlaceholderText(/MX800/i), { target: { value: 'Alaris' } });
    fireEvent.change(screen.getByPlaceholderText(/ICU - Bay 04/i), { target: { value: 'ER Bay 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register Device' }));

    await waitFor(() => {
      expect(mockApi.createDevice).toHaveBeenCalledTimes(1);
    });
  });

  it('displays reminders and completes maintenance tasks in MaintenancePage', async () => {
    mockApi.getDevices.mockResolvedValue([{ id: 1, device_code: 'MED-ICU-001', name: 'Ventilator', location: 'ICU' }]);
    mockApi.getEngineers.mockResolvedValue([{ id: 2, full_name: 'Marcus Chen' }]);
    mockApi.getMaintenanceAlerts.mockResolvedValue({ overdue_count: 1, due_soon_count: 1 });
    mockApi.getMaintenance.mockResolvedValue([
      {
        id: 10,
        device_id: 1,
        device_code: 'MED-ICU-001',
        device_name: 'Ventilator',
        title: 'Quarterly Flow Calibration',
        maintenance_type: 'Calibration',
        scheduled_date: '2026-11-28',
        frequency_days: 90,
        reminder_days_before: 7,
        priority: 'High',
        status: 'Scheduled',
        effective_status: 'Scheduled',
        is_overdue: false,
        is_due_soon: true,
        days_until_due: 2,
        assigned_engineer_name: 'Marcus Chen',
      },
    ]);
    mockApi.updateMaintenance.mockResolvedValue({ id: 10, status: 'Completed' });

    render(
      <MemoryRouter>
        <MaintenancePage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Quarterly Flow Calibration')).toBeInTheDocument();
    expect(screen.getByText(/Active Maintenance Reminders/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Complete$/i }));
    await waitFor(() => {
      expect(mockApi.updateMaintenance).toHaveBeenCalledWith(10, {
        status: 'Completed',
        auto_schedule_next: true,
        set_device_operational: true,
      });
    });
  });

  it('validates downtime recovery timestamps and shows frequent malfunctions in DowntimePage', async () => {
    mockApi.getDevices.mockResolvedValue([{ id: 5, device_code: 'MED-NICU-005', name: 'OmniBed', location: 'NICU' }]);
    mockApi.getDowntimeLogs.mockResolvedValue([]);
    mockApi.getFrequentMalfunctions.mockResolvedValue([
      {
        device_id: 5,
        device_code: 'MED-NICU-005',
        device_name: 'Giraffe OmniBed',
        location: 'NICU - Pod A3',
        operational_status: 'Out of Service',
        fault_count: 3,
        outage_count: 2,
        total_downtime_minutes: 2640,
        total_downtime_hours: 44,
        avg_recovery_minutes: 1320,
        risk_level: 'Critical',
      },
    ]);

    render(
      <MemoryRouter>
        <DowntimePage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Giraffe OmniBed')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toHaveClass('badge-danger');

    // Open Log Outage modal and enter invalid recovery time before unavailable time
    fireEvent.click(screen.getByRole('button', { name: /Log Outage/i }));
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-11-26T10:00' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-11-26T08:00' } });
    fireEvent.change(screen.getByPlaceholderText(/Unplanned power fault/i), {
      target: { value: 'Sensor failure' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Downtime Log' }));

    expect(await screen.findByText('Recovery time must be strictly after unavailable time.')).toBeInTheDocument();
    expect(mockApi.createDowntimeLog).not.toHaveBeenCalled();
  });
});

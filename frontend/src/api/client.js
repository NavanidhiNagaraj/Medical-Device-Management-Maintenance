const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('medwave_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('medwave_token');
    localStorage.removeItem('medwave_user');
    if (!path.includes('/auth/login') && !path.includes('/auth/register')) {
      window.dispatchEvent(new Event('medwave:unauthorized'));
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!response.ok) {
      throw new Error('Failed to export report');
    }
    return response.text();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
        ? data.detail.map((e) => `${e.loc?.slice(-1)[0] || 'field'}: ${e.msg}`).join('; ')
        : data.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  // Auth & Profile
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  getProfile: () => request('/api/auth/me'),
  updateProfile: (payload) => request('/api/auth/me', { method: 'PUT', body: JSON.stringify(payload) }),
  changePassword: (payload) => request('/api/auth/change-password', { method: 'PUT', body: JSON.stringify(payload) }),
  getEngineers: () => request('/api/auth/engineers'),
  getUsers: () => request('/api/auth/users'),
  updateUserRole: (userId, payload) =>
    request(`/api/auth/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Devices
  getDevices: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'All')
    ).toString();
    return request(`/api/devices${qs ? `?${qs}` : ''}`);
  },
  getDevice: (id) => request(`/api/devices/${id}`),
  createDevice: (payload) => request('/api/devices', { method: 'POST', body: JSON.stringify(payload) }),
  updateDevice: (id, payload) => request(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDevice: (id) => request(`/api/devices/${id}`, { method: 'DELETE' }),

  // Maintenance
  getMaintenance: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'All')
    ).toString();
    return request(`/api/maintenance${qs ? `?${qs}` : ''}`);
  },
  getMaintenanceAlerts: () => request('/api/maintenance/alerts'),
  createMaintenance: (payload) => request('/api/maintenance', { method: 'POST', body: JSON.stringify(payload) }),
  updateMaintenance: (id, payload) =>
    request(`/api/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteMaintenance: (id) => request(`/api/maintenance/${id}`, { method: 'DELETE' }),

  // Service History
  getServiceHistory: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'All')
    ).toString();
    return request(`/api/service-history${qs ? `?${qs}` : ''}`);
  },
  createServiceRecord: (payload) => request('/api/service-history', { method: 'POST', body: JSON.stringify(payload) }),
  updateServiceRecord: (id, payload) =>
    request(`/api/service-history/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteServiceRecord: (id) => request(`/api/service-history/${id}`, { method: 'DELETE' }),

  // Downtime
  getDowntimeLogs: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'All' && v !== false)
    ).toString();
    return request(`/api/downtime${qs ? `?${qs}` : ''}`);
  },
  getFrequentMalfunctions: () => request('/api/downtime/frequent-malfunctions'),
  createDowntimeLog: (payload) => request('/api/downtime', { method: 'POST', body: JSON.stringify(payload) }),
  updateDowntimeLog: (id, payload) => request(`/api/downtime/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDowntimeLog: (id) => request(`/api/downtime/${id}`, { method: 'DELETE' }),

  // Dashboard & Reports
  getDashboardOverview: () => request('/api/dashboard/overview'),
  exportCsvReport: (reportType) => request(`/api/dashboard/export-report?report_type=${reportType}`),
};

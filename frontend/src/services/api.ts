const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('lifelink_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('lifelink_token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('lifelink_token');
  localStorage.removeItem('lifelink_user');
};

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiFetch = async <T = any>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<{ success: boolean; [key: string]: any }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...getHeaders(options.body !== undefined),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Safely extract text before JSON parsing to handle empty/HTML responses
    const rawText = await res.text();

    if (!rawText || rawText.trim() === '') {
      if (res.ok) {
        return { success: true };
      }
      return { 
        success: false, 
        error: `Server returned empty response with status HTTP ${res.status}.` 
      };
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(rawText);
    } catch (parseError) {
      // If server returned non-JSON (like HTML 502/504 error page from reverse proxy)
      return { 
        success: false, 
        error: `Authentication server returned a non-JSON response (HTTP ${res.status}). Please verify the backend API server is operational.` 
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: parsedData?.error || parsedData?.message || `Request failed with status ${res.status}`,
        ...parsedData
      };
    }

    return parsedData;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Network request timed out. Please check your connection and try again.'
      };
    }
    console.warn(`API fetch error on ${endpoint}:`, err);
    return { 
      success: false, 
      error: 'Unable to connect to LifeLink backend server. Please verify the backend server is running on port 5001.' 
    };
  }
};

// Donor API Endpoints
export const donorApi = {
  getProfile: () => apiFetch('/donors/profile'),
  updateProfile: (data: any) => apiFetch('/donors/profile', { method: 'PUT', body: JSON.stringify(data) }),
  verifyBloodGroup: (data: { documentType: string; documentNumber?: string; fileUrl: string }) => 
    apiFetch('/donors/verify-blood-group', { method: 'POST', body: JSON.stringify(data) }),
  uploadProofDocument: (data: { fileName: string; fileType: string; fileSize?: number; fileData: string }) =>
    apiFetch('/donors/upload-proof', { method: 'POST', body: JSON.stringify(data) }),
  getProofDocument: (docId: string) => apiFetch(`/donors/document/${docId}`),
  
  getEligibility: () => apiFetch('/donors/eligibility'),
  savePrescreening: (data: any) => apiFetch('/donors/prescreening', { method: 'POST', body: JSON.stringify(data) }),
  getDigitalPass: () => apiFetch('/donors/digital-pass'),
  getHistory: () => apiFetch('/donors/history'),
  getCertificate: (donationId: string) => apiFetch(`/donors/certificates/${donationId}`),

  getEmergencyAlerts: () => apiFetch('/donors/emergency-alerts'),
  respondEmergencyAlert: (alertId: string) => apiFetch('/donors/emergency-alerts/respond', { method: 'POST', body: JSON.stringify({ alertId }) }),
  cancelEmergencyResponse: (alertId: string) => apiFetch('/donors/emergency-alerts/cancel-response', { method: 'POST', body: JSON.stringify({ alertId }) }),

  // Camps & Registrations
  getPublicCamps: (city?: string, search?: string) => {
    const params = new URLSearchParams();
    if (city && city !== 'all') params.append('city', city);
    if (search) params.append('search', search);
    return apiFetch(`/public/camps?${params.toString()}`);
  },
  getPublicLocations: () => apiFetch('/public/locations'),
  registerForCamp: (campId: string) => apiFetch(`/donors/camps/${campId}/register`, { method: 'POST' }),
  cancelCampRegistration: (campId: string) => apiFetch(`/donors/camps/${campId}/cancel-registration`, { method: 'POST' }),
  getMyCampRegistrations: () => apiFetch('/donors/camps/my-registrations'),

  // Org Camp Requests
  createCampRequest: (data: any) => apiFetch('/donors/camp-requests', { method: 'POST', body: JSON.stringify(data) }),
  getCampRequests: () => apiFetch('/donors/camp-requests'),
  cancelCampRequest: (id: string) => apiFetch(`/donors/camp-requests/${id}/cancel`, { method: 'PATCH' }),

  // Notifications
  getNotifications: () => apiFetch('/donors/notifications'),
  markNotificationRead: (id: string) => apiFetch(`/donors/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiFetch('/donors/notifications/read-all', { method: 'PATCH' }),

  // Location Search
  searchLocations: (q: string) => apiFetch(`/donors/location-search?q=${encodeURIComponent(q)}`),

  // Nearby Hospital Discovery (Phase 6)
  getNearbyHospitals: (params?: { lat?: number; lng?: number; radius?: number | string }) => {
    const q = new URLSearchParams();
    if (params?.lat !== undefined && params?.lat !== null) q.set('lat', String(params.lat));
    if (params?.lng !== undefined && params?.lng !== null) q.set('lng', String(params.lng));
    if (params?.radius !== undefined && params?.radius !== null) q.set('radius', String(params.radius));
    return apiFetch(`/donors/nearby-hospitals${q.toString() ? `?${q.toString()}` : ''}`);
  }
};

// Hospital API Endpoints
export const hospitalApi = {
  getProfile: () => apiFetch('/hospitals/profile'),
  updateProfile: (data: any) => apiFetch('/hospitals/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getDashboard: () => apiFetch('/hospitals/dashboard'),
  searchBlood: (params: { bloodGroup?: string; component?: string; urgency?: string }) => {
    const query = new URLSearchParams();
    if (params.bloodGroup && params.bloodGroup !== 'all') query.set('bloodGroup', params.bloodGroup);
    if (params.component && params.component !== 'all') query.set('component', params.component);
    if (params.urgency) query.set('urgency', params.urgency);
    return apiFetch(`/hospitals/search-blood?${query.toString()}`);
  },
  getRequests: () => apiFetch('/hospitals/requests'),
  createRequest: (data: any) => apiFetch('/hospitals/requests', { method: 'POST', body: JSON.stringify(data) }),
  cancelRequest: (requestId: string, reason?: string) => 
    apiFetch(`/hospitals/requests/${requestId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getSamples: () => apiFetch('/hospitals/samples'),
  submitSample: (data: any) => apiFetch('/hospitals/samples', { method: 'POST', body: JSON.stringify(data) }),
  getMessages: (requestId: string) => apiFetch(`/hospitals/requests/${requestId}/messages`),
  sendMessage: (requestId: string, message: string) => 
    apiFetch(`/hospitals/requests/${requestId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  getLogistics: () => apiFetch('/hospitals/logistics'),
  getStorageLedger: () => apiFetch('/hospitals/storage-ledger'),
  createStorageEntry: (data: any) => apiFetch('/hospitals/storage-ledger', { method: 'POST', body: JSON.stringify(data) }),
  updateStorageEntry: (entryId: string, data: any) => apiFetch(`/hospitals/storage-ledger/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStorageEntry: (entryId: string) => apiFetch(`/hospitals/storage-ledger/${entryId}`, { method: 'DELETE' }),

  // Phase 5D: Hospital Receipt & Discrepancy Reporting
  confirmReceipt: (id: string, data?: { notes?: string }) => 
    apiFetch(`/hospitals/requests/${id}/confirm-receipt`, { method: 'POST', body: JSON.stringify(data || {}) }),
  reportDiscrepancy: (id: string, data: { discrepancyType?: string; reason: string; notes?: string }) => 
    apiFetch(`/hospitals/requests/${id}/report-discrepancy`, { method: 'POST', body: JSON.stringify(data) }),
  getRequestDispatch: (id: string) => 
    apiFetch(`/hospitals/requests/${id}/dispatch`)
};

// Blood Bank API Endpoints (Phase 5C Cold Storage & Phase 5D Fulfillment)
export const bloodBankApi = {
  // Cold Storage
  getColdStorageEquipment: () => apiFetch('/blood-bank/cold-storage/equipment'),
  getColdStorageEquipmentById: (id: string) => apiFetch(`/blood-bank/cold-storage/equipment/${id}`),
  registerColdStorageEquipment: (data: any) => 
    apiFetch('/blood-bank/cold-storage/equipment', { method: 'POST', body: JSON.stringify(data) }),
  recordTemperatureReading: (data: any) => 
    apiFetch('/blood-bank/cold-storage/readings', { method: 'POST', body: JSON.stringify(data) }),
  getTemperatureReadings: (params?: { equipmentId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.equipmentId) q.set('equipmentId', params.equipmentId);
    if (params?.limit) q.set('limit', params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return apiFetch(`/blood-bank/cold-storage/readings${queryStr}`);
  },
  getColdStorageAlarms: (params?: { status?: string; equipmentId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.equipmentId) q.set('equipmentId', params.equipmentId);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return apiFetch(`/blood-bank/cold-storage/alarms${queryStr}`);
  },
  acknowledgeColdStorageAlarm: (alarmId: string, data: { notes: string }) => 
    apiFetch(`/blood-bank/cold-storage/alarms/${alarmId}/acknowledge`, { method: 'POST', body: JSON.stringify(data) }),
  resolveColdStorageAlarm: (alarmId: string, data: { correctiveAction: string; notes?: string }) => 
    apiFetch(`/blood-bank/cold-storage/alarms/${alarmId}/resolve`, { method: 'POST', body: JSON.stringify(data) }),
  getExposedInventory: (equipmentId: string) => 
    apiFetch(`/blood-bank/cold-storage/equipment/${equipmentId}/exposed-inventory`),

  // Phase 5D: Hospital Fulfillment, Barcode Assignment & Dispatch
  getRequests: (params?: { 
    tab?: string; 
    status?: string; 
    urgency?: string; 
    hospitalId?: string; 
    component?: string; 
    bloodGroup?: string; 
    search?: string 
  }) => {
    const q = new URLSearchParams();
    if (params?.tab) q.set('tab', params.tab);
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    if (params?.urgency && params.urgency !== 'all') q.set('urgency', params.urgency);
    if (params?.hospitalId && params.hospitalId !== 'all') q.set('hospitalId', params.hospitalId);
    if (params?.component && params.component !== 'all') q.set('component', params.component);
    if (params?.bloodGroup && params.bloodGroup !== 'all') q.set('bloodGroup', params.bloodGroup);
    if (params?.search) q.set('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return apiFetch(`/blood-bank/requests${queryStr}`);
  },
  getRequestById: (id: string) => apiFetch(`/blood-bank/requests/${id}`),
  getEligibleUnits: (id: string) => apiFetch(`/blood-bank/requests/${id}/eligible-units`),
  allocateUnits: (id: string, data: { unitIds: string[]; notes?: string }) => 
    apiFetch(`/blood-bank/requests/${id}/allocate`, { method: 'POST', body: JSON.stringify(data) }),
  releaseAllocation: (id: string, reason?: string) => 
    apiFetch(`/blood-bank/requests/${id}/release-allocation`, { method: 'POST', body: JSON.stringify({ reason }) }),
  prepareDispatch: (id: string, data: any) => 
    apiFetch(`/blood-bank/requests/${id}/prepare-dispatch`, { method: 'POST', body: JSON.stringify(data) }),
  confirmDispatch: (id: string, data?: { courierReference?: string; notes?: string }) => 
    apiFetch(`/blood-bank/requests/${id}/confirm-dispatch`, { method: 'POST', body: JSON.stringify(data || {}) }),
  getDispatchSlip: (id: string) => apiFetch(`/blood-bank/dispatches/${id}/slip`),
  getAllocationMatrix: () => apiFetch('/blood-bank/allocation-matrix')
};

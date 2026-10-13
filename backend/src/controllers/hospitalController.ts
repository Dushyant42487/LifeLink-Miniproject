import { safeSupabaseSync } from '../models/db';
import { Response } from 'express';
import { db } from '../models/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { BloodRequest, PatientSample, RequestMessage, BloodGroup, BloodComponent, HospitalStorageEntry, StorageEntryStatus } from '../models/types';

// Authoritative calculation of reserved units strictly scoped to active hospital requisitions
export function calculateReservedUnits(
  hospitalRequests: BloodRequest[],
  allBloodUnits: any[] = []
): number {
  const activeRequests = hospitalRequests.filter(r => 
    r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
  );

  const activeRequestIds = new Set(activeRequests.map(r => r.id));
  const uniqueReservedUnitIds = new Set<string>();

  // 1. Unique units reserved in blood bank inventory explicitly for active hospital requisitions
  allBloodUnits.forEach(u => {
    if (u.availability === 'Reserved' && u.reservedForRequestId && activeRequestIds.has(u.reservedForRequestId)) {
      uniqueReservedUnitIds.add(u.id);
    }
  });

  // 2. Units tracked directly in assignedUnitIds on active hospital requisitions (deduplicating against unit records)
  activeRequests.forEach(r => {
    if (Array.isArray(r.assignedUnitIds) && r.assignedUnitIds.length > 0) {
      r.assignedUnitIds.forEach(uId => {
        const unit = allBloodUnits.find(u => u.id === uId);
        if (!unit || unit.availability === 'Reserved' || r.status === 'Reserved') {
          uniqueReservedUnitIds.add(uId);
        }
      });
    }
  });

  // 3. For requests marked with status === 'Reserved' or explicit reservedCount without separate unit records,
  // sum valid reserved quantities (never counting an entire multi-unit request as 1 unit merely because status is Reserved)
  let additionalVirtualReserved = 0;
  activeRequests.forEach(r => {
    const explicitReserved = typeof (r as any).reservedCount === 'number' && !isNaN((r as any).reservedCount)
      ? Math.max(0, (r as any).reservedCount)
      : null;

    const matchedUnitRecords = [...uniqueReservedUnitIds].filter(uId => {
      const u = allBloodUnits.find(unit => unit.id === uId);
      return (u && u.reservedForRequestId === r.id) || (r.assignedUnitIds && r.assignedUnitIds.includes(uId));
    });

    if (explicitReserved !== null) {
      if (matchedUnitRecords.length === 0) {
        additionalVirtualReserved += explicitReserved;
      }
    } else if (r.status === 'Reserved' && matchedUnitRecords.length === 0) {
      const validQty = typeof r.quantityUnits === 'number' && !isNaN(r.quantityUnits) && r.quantityUnits > 0
        ? r.quantityUnits
        : 0;
      additionalVirtualReserved += validQty;
    }
  });

  return uniqueReservedUnitIds.size + additionalVirtualReserved;
}

export const getHospitalDashboard = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const hosp = db.hospitals.find(h => h.id === hospitalId) || {
    id: hospitalId,
    hospitalName: req.user?.name || 'Verified Hospital',
    licenseId: 'HOSP-VERIFIED',
    verificationStatus: 'Verified',
    city: 'Metro City'
  };

  // Authoritative collection of requests strictly scoped to authenticated hospital
  const myRequests = db.bloodRequests.filter(r => r.hospitalId === hospitalId);

  // Authoritative counting rules:
  // Active: Requisitions currently in the pipeline (neither completed nor terminal cancelled/rejected)
  const activeRequests = myRequests.filter(r => 
    r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
  );
  // Emergency: Active high-priority trauma/critical requisitions
  const emergencyRequests = activeRequests.filter(r => r.urgency === 'Emergency');
  // Reserved Units: Authoritatively derived from regional reservations and allocated units
  const reservedUnitsCount = calculateReservedUnits(myRequests, db.bloodUnits);
  // Fulfilled: Requisitions successfully completed
  const fulfilledRequestsCount = myRequests.filter(r => r.status === 'Fulfilled').length;
  // Pending Samples: Unverified cross-match samples submitted by this hospital
  const pendingSamplesCount = db.patientSamples.filter(
    s => s.hospitalId === hospitalId && (s.status === 'Received' || s.status === 'In Verification')
  ).length;

  const hospName = (hosp as any).hospitalName || (hosp as any).name || 'Verified Hospital';
  const hospLicense = (hosp as any).licenseId || 'HOSP-VERIFIED';
  const hospStatus = (hosp as any).verificationStatus || 'Verified';
  const hospCity = (hosp as any).city || 'Metro City';

  res.json({
    success: true,
    facility: {
      id: hosp.id,
      hospitalName: hospName,
      licenseId: hospLicense,
      verificationStatus: hospStatus,
      city: hospCity,
      address: (hosp as any).address || '100 Hospital Plaza, Midtown',
      latitude: (hosp as any).latitude || 40.7484,
      longitude: (hosp as any).longitude || -73.9857
    },
    parLevelMonitoring: {
      configured: false,
      reason: 'On-premise refrigerator telematics and OT par-level thresholds are not configured in facility data model.',
      supportedLocations: []
    },
    metrics: {
      activeRequests: activeRequests.length,
      emergencyRequests: emergencyRequests.length,
      reservedUnitsCount,
      fulfilledRequestsCount,
      pendingSamplesCount
    },
    recentRequests: myRequests.slice(0, 10),
    inventoryMatrix: db.getAvailableInventoryByGroup()
  });
};

export const searchBloodAvailability = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { bloodGroup, component, urgency } = req.query;

  const normalizeBg = (bg?: any): string | undefined => {
    if (!bg || bg === 'all') return undefined;
    let str = String(bg).trim();
    if (str.endsWith(' ')) str = str.trim() + '+';
    if (str.includes(' ')) str = str.replace(' ', '+');
    return str;
  };

  const normalizedGroup = normalizeBg(bloodGroup);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let availableUnits = db.bloodUnits.filter(u => {
    if (u.availability !== 'Available' || u.testingStatus !== 'Passed') return false;
    const exp = new Date(u.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp.getTime() >= now.getTime();
  });

  if (normalizedGroup) {
    availableUnits = availableUnits.filter(u => u.bloodGroup === normalizedGroup);
  }
  if (component && component !== 'all') {
    availableUnits = availableUnits.filter(u => u.component === component);
  }

  // FEFO Sorting: Earliest Expiry Date First
  availableUnits.sort((a, b) => {
    const diff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    return diff !== 0 ? diff : new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime();
  });

  // Fixed simulated distances per blood bank for deterministic UI presentation
  const bankDistances: Record<string, number> = {
    'bb-1': 2.4,
    'bb-2': 5.8
  };

  // Aggregate by Blood Bank
  const resultsByBank: Record<string, any> = {};

  db.bloodBanks.forEach(bb => {
    resultsByBank[bb.id] = {
      bloodBankId: bb.id,
      bloodBankName: bb.bloodBankName,
      address: `${bb.address}, ${bb.city}`,
      emergencyPhone: bb.emergencyPhone,
      latitude: bb.latitude,
      longitude: bb.longitude,
      distanceKm: bankDistances[bb.id] || 3.5,
      lastUpdated: 'Live Regional Link',
      units: []
    };
  });

  availableUnits.forEach(u => {
    if (resultsByBank[u.bloodBankId]) {
      resultsByBank[u.bloodBankId].units.push(u);
    }
  });

  const formattedResults = Object.values(resultsByBank).map((bank: any) => ({
    ...bank,
    units: bank.units.sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()),
    availableUnitsCount: bank.units.length,
    rbcCount: bank.units.filter((u: any) => u.component === 'RBC').length,
    plasmaCount: bank.units.filter((u: any) => u.component === 'Plasma').length,
    plateletsCount: bank.units.filter((u: any) => u.component === 'Platelets').length,
  }));

  res.json({
    success: true,
    query: { bloodGroup: normalizedGroup || 'all', component: component || 'all', urgency: urgency || 'Routine' },
    totalAvailableUnits: availableUnits.length,
    units: availableUnits,
    bloodBanks: formattedResults
  });
};

export const createBloodRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { bloodGroup, component, quantityUnits, urgency, requiredByDate, patientReferenceId, department, notes, bloodBankId, targetUnitId } = req.body;

  if (!bloodGroup || !component || quantityUnits === undefined || quantityUnits === null) {
    return res.status(400).json({ success: false, error: 'Blood group, component, and quantity are required' });
  }

  const validGroups = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  if (!validGroups.includes(bloodGroup)) {
    return res.status(400).json({ success: false, error: `Invalid blood group: ${bloodGroup}` });
  }

  const validComponents = ['RBC', 'Plasma', 'Platelets', 'PRBC', 'Cryo', 'Whole Blood'];
  if (!validComponents.includes(component)) {
    return res.status(400).json({ success: false, error: `Invalid blood component: ${component}` });
  }

  const qty = Number(quantityUnits);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
    return res.status(400).json({ success: false, error: 'Quantity must be an integer between 1 and 20 units.' });
  }

  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const hosp = db.hospitals.find(h => h.id === hospitalId) || {
    id: hospitalId,
    hospitalName: req.user?.name || 'Verified Hospital'
  };
  const bb = db.bloodBanks.find(b => b.id === bloodBankId) || db.bloodBanks[0];

  // Check Idempotency-Key support for network retries and timeout recovery
  const rawIdempotencyKey = (req.headers['idempotency-key'] || req.body.idempotencyKey) as string | undefined;
  const idempotencyKey = rawIdempotencyKey ? String(rawIdempotencyKey).trim() : undefined;
  if (idempotencyKey) {
    const existingWithKey = db.bloodRequests.find(r =>
      r.hospitalId === hosp.id && (r as any).idempotencyKey === idempotencyKey
    );
    if (existingWithKey) {
      return res.status(200).json({
        success: true,
        message: 'Requisition already processed (idempotent replay).',
        request: existingWithKey,
        isIdempotentReplay: true
      });
    }
  }

  const reqId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;

  // Server-side validation and atomic reservation of target unit if requisitioning a specific unit
  let assignedUnits: string[] | undefined = undefined;
  let targetUnit: any = undefined;
  if (targetUnitId) {
    targetUnit = db.bloodUnits.find(u => u.id === targetUnitId);
    if (!targetUnit) {
      return res.status(409).json({
        success: false,
        error: `Requested unit ${targetUnitId} is not in regional stock. Please refresh availability.`
      });
    }
    const isExpired = new Date(targetUnit.expiryDate).getTime() < Date.now();
    if (targetUnit.availability !== 'Available' || isExpired || targetUnit.testingStatus !== 'Passed') {
      return res.status(409).json({
        success: false,
        error: `Unit ${targetUnitId} is no longer available in regional stock (${targetUnit.availability}, Testing: ${targetUnit.testingStatus}). Please refresh and select another unit.`
      });
    }
    // Atomic state transition prevents competing concurrent requests from reserving the same unit
    targetUnit.availability = 'Reserved';
    targetUnit.reservedForRequestId = reqId;
    assignedUnits = [targetUnit.id];
  }

  // Validate patientReferenceId if provided
  let normalizedPatientRef = '';
  if (patientReferenceId !== undefined && patientReferenceId !== null && String(patientReferenceId).trim() !== '') {
    normalizedPatientRef = String(patientReferenceId).trim();
    if (normalizedPatientRef.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Patient reference ID must be at least 3 characters (e.g., PAT-4402 or PAT-4402 (OR-2))'
      });
    }
  } else {
    normalizedPatientRef = `PAT-${Math.floor(8000 + Math.random() * 2000)}`;
  }

  // Prevent accidental rapid duplicate submissions within 5 seconds for same hospital, patient, bloodGroup, component, and quantity
  const nowMs = Date.now();
  const recentDuplicate = db.bloodRequests.find(r =>
    r.hospitalId === hosp.id &&
    r.patientReferenceId.trim().toLowerCase() === normalizedPatientRef.trim().toLowerCase() &&
    r.bloodGroup === bloodGroup &&
    r.component === component &&
    r.quantityUnits === qty &&
    (nowMs - new Date(r.createdAt).getTime()) < 5000
  );

  if (recentDuplicate) {
    // If unit was tentatively locked, roll it back
    if (targetUnit && targetUnit.reservedForRequestId === reqId) {
      targetUnit.availability = 'Available';
      targetUnit.reservedForRequestId = undefined;
    }
    return res.status(409).json({
      success: false,
      error: `Duplicate requisition detected: A request for ${qty} unit(s) of ${bloodGroup} ${component} for patient ${normalizedPatientRef} was already submitted (${recentDuplicate.id}). Please wait before retrying.`,
      duplicateRequestId: recentDuplicate.id
    });
  }

  const now = new Date().toISOString();
  const hospName = (hosp as any).hospitalName || (hosp as any).name || 'Verified Hospital';

  const newRequest: BloodRequest = {
    id: reqId,
    hospitalId: hosp.id,
    hospitalName: hospName,
    bloodBankId: bb.id,
    bloodBankName: bb.bloodBankName,
    bloodGroup,
    component,
    quantityUnits: Number(quantityUnits),
    fulfilledUnits: 0,
    urgency: urgency || 'Routine',
    patientReferenceId: normalizedPatientRef,
    department: department || 'General Ward',
    requiredByDate: requiredByDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: targetUnit ? 'Reserved' : 'Pending',
    assignedUnitIds: assignedUnits,
    notes,
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        status: 'Pending',
        updatedAt: now,
        note: targetUnitId
          ? `Requisition for unit ${targetUnitId} (${bloodGroup} ${component}) submitted by ${hospName} to ${bb.bloodBankName}`
          : `Blood request for ${quantityUnits} unit(s) of ${bloodGroup} ${component} submitted by ${hospName}`,
        actor: hospName
      }
    ]
  };

  if (idempotencyKey) {
    (newRequest as any).idempotencyKey = idempotencyKey;
  }

  db.bloodRequests.unshift(newRequest);

  // If Emergency, create emergency notification for blood bank
  if (urgency === 'Emergency') {
    db.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      userId: bb.id,
      title: `EMERGENCY BLOOD REQUEST: ${bloodGroup} ${component}`,
      message: `${hospName} created an Emergency request for ${quantityUnits} units of ${bloodGroup} ${component}.`,
      type: 'emergency',
      priority: 'urgent',
      read: false,
      createdAt: now,
      link: '/blood-bank/hospital-requests'
    });
  }

  res.status(201).json({
    success: true,
    message: 'Blood request submitted successfully',
    request: newRequest
  });
};

export const cancelHospitalRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { id } = req.params;
  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.hospitalId !== hospitalId) {
    return res.status(403).json({ success: false, error: 'Access denied: Cannot cancel requisition belonging to another facility' });
  }

  if (request.status === 'Cancelled') {
    return res.status(400).json({ success: false, error: 'Requisition is already cancelled. Duplicate cancellation prevented.' });
  }

  if (request.status === 'Fulfilled' || request.status === 'Issued') {
    return res.status(400).json({ success: false, error: `Cannot cancel requisition that has already been ${request.status.toLowerCase()}.` });
  }

  const { reason } = req.body;

  // Release any reserved units back to Available in regional stock
  if (Array.isArray(request.assignedUnitIds)) {
    request.assignedUnitIds.forEach(uId => {
      const u = db.bloodUnits.find(unit => unit.id === uId);
      if (u && u.availability === 'Reserved' && u.reservedForRequestId === request.id) {
        u.availability = 'Available';
        u.reservedForRequestId = undefined;
      }
    });
    request.assignedUnitIds = [];
  }

  const now = new Date().toISOString();
  request.status = 'Cancelled';
  request.updatedAt = now;
  request.timeline.push({
    status: 'Cancelled',
    updatedAt: now,
    note: reason ? `Requisition cancelled by hospital: ${reason}` : 'Requisition cancelled by hospital facility. Reserved units released.',
    actor: req.user?.name || 'Hospital Clinical Staff'
  });

  res.json({
    success: true,
    message: 'Requisition successfully cancelled and reservations released.',
    request
  });
};

export const getHospitalRequests = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  let requests: BloodRequest[] = [];

  if (user.role === 'hospital') {
    // Strictly scoped to the authenticated hospital
    requests = db.bloodRequests.filter(r => r.hospitalId === user.id);
  } else if (user.role === 'blood_bank') {
    // Scoped to requests assigned to this blood bank
    requests = db.bloodRequests.filter(r => r.bloodBankId === user.id);
  } else {
    // Admin role
    requests = db.bloodRequests;
  }

  res.json({ success: true, count: requests.length, requests });
};

export const getPatientSamples = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const samples = user.role === 'hospital'
    ? db.patientSamples.filter(s => s.hospitalId === user.id)
    : db.patientSamples;

  res.json({ success: true, count: samples.length, samples });
};

export const submitPatientSample = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { requestId, patientReferenceId, sampleType, notes } = req.body;

  const request = db.bloodRequests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ success: false, error: 'Associated blood request not found' });

  // Hospital authorization verification
  if (req.user?.role === 'hospital' && request.hospitalId !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another hospital facility' });
  }

  // Reject samples for terminal or completed requisitions
  if (request.status === 'Cancelled' || request.status === 'Rejected' || request.status === 'Fulfilled') {
    return res.status(400).json({
      success: false,
      error: `Cannot submit a patient sample for a requisition with terminal status '${request.status}'.`
    });
  }

  // Patient Reference ID validation
  let samplePatientRef = (patientReferenceId !== undefined && patientReferenceId !== null && String(patientReferenceId).trim() !== '')
    ? String(patientReferenceId).trim()
    : request.patientReferenceId;

  if (!samplePatientRef || samplePatientRef.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Patient reference ID must be at least 3 characters (e.g., PAT-4402 or PAT-4402 (OR-2))'
    });
  }

  // Duplicate submission throttle: check if an identical sample was submitted in the last 10 seconds
  const nowMs = Date.now();
  const effectiveSampleType = sampleType || 'Cross-Match Sample';
  const recentDuplicate = db.patientSamples.find(s => 
    s.requestId === requestId && 
    s.sampleType === effectiveSampleType &&
    (nowMs - new Date(s.submittedAt).getTime()) < 10000
  );

  if (recentDuplicate) {
    return res.status(409).json({
      success: false,
      error: `A ${effectiveSampleType} was already logged for requisition ${requestId} (${recentDuplicate.id}). Please wait before submitting another duplicate sample.`,
      duplicateSampleId: recentDuplicate.id
    });
  }

  const sampleId = `SMP-${Math.floor(500 + Math.random() * 500)}`;
  const now = new Date().toISOString();

  const newSample: PatientSample = {
    id: sampleId,
    requestId,
    hospitalId: request.hospitalId,
    patientReferenceId: samplePatientRef,
    sampleType: effectiveSampleType as any,
    submittedAt: now,
    status: 'Received',
    verificationNotes: notes || 'Sample logged by hospital courier.'
  };

  db.patientSamples.unshift(newSample);

  // Update request timeline
  request.status = 'Sample Submitted';
  request.updatedAt = now;
  request.timeline.push({
    status: 'Sample Submitted',
    updatedAt: now,
    note: `Patient sample ${sampleId} submitted to blood bank laboratory for compatibility testing.`,
    actor: req.user?.name || 'Hospital Staff'
  });

  res.status(201).json({
    success: true,
    message: 'Patient cross-match sample submitted successfully',
    sample: newSample
  });
};

export const getRequestMessages = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { requestId } = req.params;
  const request = db.bloodRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  // Check permission: either owning hospital or target blood bank or admin
  if (req.user?.role === 'hospital' && request.hospitalId !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Access denied to this requisition conversation' });
  }

  const messages = db.requestMessages.filter(m => m.requestId === requestId);
  res.json({ success: true, messages });
};

export const sendRequestMessage = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { requestId } = req.params;
  const { message } = req.body;

  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) return res.status(400).json({ success: false, error: 'Message content cannot be empty' });

  const request = db.bloodRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (req.user?.role === 'hospital' && request.hospitalId !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Access denied: Cannot send message on another hospital requisition' });
  }

  // Prevent duplicate messages sent twice within 2 seconds
  const nowMs = Date.now();
  const recentDuplicate = db.requestMessages.find(m =>
    m.requestId === requestId &&
    m.senderRole === (req.user?.role || 'hospital') &&
    m.message.trim() === trimmed &&
    (nowMs - new Date(m.timestamp).getTime()) < 2000
  );

  if (recentDuplicate) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate message detected. Please wait before resending identical message.'
    });
  }

  const newMessage: RequestMessage = {
    id: `MSG-${Date.now()}`,
    requestId,
    senderRole: req.user?.role || 'hospital',
    senderName: req.user?.name || 'Medical Staff',
    message: trimmed,
    timestamp: new Date().toISOString()
  };

  db.requestMessages.push(newMessage);

  res.status(201).json({ success: true, message: newMessage });
};

export const getHospitalLogistics = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const hosp = db.hospitals.find(h => h.id === hospitalId) || {
    id: hospitalId,
    hospitalName: req.user?.name || 'Verified Hospital',
    address: '100 Hospital Plaza, Midtown',
    city: 'Metro City',
    latitude: 40.7484,
    longitude: -73.9857
  };

  const hospLat = (hosp as any).latitude || 40.7484;
  const hospLng = (hosp as any).longitude || -73.9857;

  // Haversine formula calculation strictly from verified facility coordinates
  const calcHaversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Connected blood banks with verified coordinates and live inventory summary
  const bloodBanks = db.bloodBanks.map(bb => {
    const availableUnits = db.bloodUnits.filter(u => 
      u.bloodBankId === bb.id && 
      u.availability === 'Available' && 
      u.testingStatus === 'Passed'
    );
    const distanceKm = bb.latitude && bb.longitude
      ? calcHaversineKm(hospLat, hospLng, bb.latitude, bb.longitude)
      : 3.5;

    return {
      bloodBankId: bb.id,
      bloodBankName: bb.bloodBankName,
      address: `${bb.address}, ${bb.city}`,
      emergencyPhone: bb.emergencyPhone,
      latitude: bb.latitude,
      longitude: bb.longitude,
      distanceKm,
      inventorySummary: {
        totalAvailable: availableUnits.length,
        rbcCount: availableUnits.filter(u => u.component === 'RBC').length,
        plasmaCount: availableUnits.filter(u => u.component === 'Plasma').length,
        plateletsCount: availableUnits.filter(u => u.component === 'Platelets').length
      }
    };
  });

  // Active dispatches strictly scoped to authenticated hospital
  const myRequests = db.bloodRequests.filter(r => r.hospitalId === hospitalId);
  const activeDispatches = myRequests.filter(r => 
    r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
  ).map(r => {
    const bb = db.bloodBanks.find(b => b.id === r.bloodBankId) || db.bloodBanks[0];
    const latestEvent = r.timeline && r.timeline.length > 0 ? r.timeline[r.timeline.length - 1] : null;

    return {
      requestId: r.id,
      bloodGroup: r.bloodGroup,
      component: r.component,
      quantityUnits: r.quantityUnits,
      urgency: r.urgency,
      status: r.status,
      bloodBankId: r.bloodBankId,
      bloodBankName: r.bloodBankName || bb?.bloodBankName,
      originCoordinates: bb ? { lat: bb.latitude, lng: bb.longitude } : null,
      destinationCoordinates: { lat: hospLat, lng: hospLng },
      requiredByDate: r.requiredByDate,
      latestTimelineEvent: latestEvent,
      assignedUnitIds: r.assignedUnitIds || [],
      liveTrackingAvailable: false,
      trackingNote: 'Live courier vehicle GPS telemetry is not integrated. Dispatches follow scheduled courier transit and verified hospital hand-off procedures.'
    };
  });

  res.json({
    success: true,
    facility: {
      id: hosp.id,
      hospitalName: (hosp as any).hospitalName || (hosp as any).name || 'Verified Hospital',
      address: (hosp as any).address || '100 Hospital Plaza, Midtown',
      city: (hosp as any).city || 'Metro City',
      latitude: hospLat,
      longitude: hospLng
    },
    bloodBanks,
    activeDispatches,
    telematics: {
      liveCourierGpsIntegrated: false,
      message: 'Fleet telematics GPS provider is currently offline. Transit records derive from facility dispatch events.'
    }
  });
};

export const getHospitalStorageLedger = async (req: AuthenticatedRequest, res: Response) => {
  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const locations = db.hospitalStorageLocations.filter(l => l.hospitalId === hospitalId);
  const entries = db.hospitalStorageEntries.filter(e => e.hospitalId === hospitalId);

  const nowTime = Date.now();

  let totalOnHand = 0;
  let totalUsable = 0;
  let totalReserved = 0;
  let totalQuarantined = 0;
  let totalExpired = 0;

  const enrichedEntries = entries.map(entry => {
    const isExpired = entry.expiryDate ? new Date(entry.expiryDate).getTime() < nowTime : false;
    const computedStatus: StorageEntryStatus = isExpired ? 'Expired' : entry.status;
    
    totalOnHand += entry.quantityUnits;
    if (computedStatus === 'Usable') {
      totalUsable += entry.quantityUnits;
    } else if (computedStatus === 'Reserved') {
      totalReserved += entry.quantityUnits;
    } else if (computedStatus === 'Quarantined') {
      totalQuarantined += entry.quantityUnits;
    } else if (computedStatus === 'Expired') {
      totalExpired += entry.quantityUnits;
    }

    const shortage = entry.minThreshold != null
      ? Math.max(0, entry.minThreshold - (computedStatus === 'Usable' ? entry.quantityUnits : 0))
      : 0;

    return {
      ...entry,
      effectiveStatus: computedStatus,
      isExpired,
      shortage
    };
  });

  res.json({
    success: true,
    isBackendPersistent: true,
    facilityId: hospitalId,
    disclaimer: 'Hospital Internal Storage Ledger is maintained by authorized hospital personnel. Completely isolated from regional blood bank inventories.',
    locations,
    entries: enrichedEntries,
    summary: {
      totalOnHand,
      totalUsable,
      totalReserved,
      totalQuarantined,
      totalExpired
    }
  });
};

export const createHospitalStorageEntry = async (req: AuthenticatedRequest, res: Response) => {
  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const { storageLocation, bloodGroup, component, quantityUnits, status = 'Usable', expiryDate, minThreshold, notes } = req.body;

  if (!storageLocation || typeof storageLocation !== 'string' || !storageLocation.trim()) {
    return res.status(400).json({ success: false, error: 'Storage location is required (e.g., OT Refrigerator 1).' });
  }

  const validGroups = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  if (!bloodGroup || !validGroups.includes(bloodGroup)) {
    return res.status(400).json({ success: false, error: `Invalid blood group: ${bloodGroup}` });
  }

  const validComponents = ['RBC', 'Plasma', 'Platelets'];
  if (!component || !validComponents.includes(component)) {
    return res.status(400).json({ success: false, error: `Invalid component: ${component}` });
  }

  const qty = Number(quantityUnits);
  if (!Number.isInteger(qty) || qty < 0) {
    return res.status(400).json({ success: false, error: 'Quantity must be a non-negative integer.' });
  }

  if (expiryDate) {
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid expiry date format.' });
    }
  }

  // Prevent accidental rapid duplicate submissions within 5 seconds for same location, group, component
  const recentDuplicate = db.hospitalStorageEntries.find(e =>
    e.hospitalId === hospitalId &&
    e.storageLocation.trim().toLowerCase() === storageLocation.trim().toLowerCase() &&
    e.bloodGroup === bloodGroup &&
    e.component === component &&
    e.quantityUnits === qty &&
    (Date.now() - new Date(e.createdAt).getTime()) < 5000
  );

  if (recentDuplicate) {
    return res.status(409).json({ success: false, error: 'Duplicate entry detected. Entry was already recorded a few moments ago.' });
  }

  const newEntry: HospitalStorageEntry = {
    id: `HLE-${Date.now()}`,
    hospitalId,
    storageLocation: storageLocation.trim(),
    bloodGroup: bloodGroup as BloodGroup,
    component: component as BloodComponent,
    quantityUnits: qty,
    status: (status as StorageEntryStatus) || 'Usable',
    expiryDate: expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    minThreshold: minThreshold != null ? Math.max(0, Number(minThreshold)) : undefined,
    notes: notes ? String(notes).trim() : undefined,
    source: 'manual_hospital_entry',
    recordedBy: req.user?.name || 'Hospital Clinical Staff',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.hospitalStorageEntries.unshift(newEntry);

  res.status(201).json({
    success: true,
    message: 'Hospital storage entry successfully recorded.',
    entry: newEntry
  });
};

export const updateHospitalStorageEntry = async (req: AuthenticatedRequest, res: Response) => {
  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const { entryId } = req.params;
  const entry = db.hospitalStorageEntries.find(e => e.id === entryId && e.hospitalId === hospitalId);
  if (!entry) {
    return res.status(404).json({ success: false, error: 'Storage entry not found.' });
  }

  const { quantityUnits, status, minThreshold, notes, storageLocation } = req.body;

  if (quantityUnits !== undefined) {
    const qty = Number(quantityUnits);
    if (!Number.isInteger(qty) || qty < 0) {
      return res.status(400).json({ success: false, error: 'Quantity must be a non-negative integer.' });
    }
    entry.quantityUnits = qty;
  }

  if (status !== undefined) {
    const validStatuses: StorageEntryStatus[] = ['Usable', 'Reserved', 'Quarantined', 'Expired'];
    if (validStatuses.includes(status)) {
      entry.status = status;
    }
  }

  if (minThreshold !== undefined) {
    entry.minThreshold = Math.max(0, Number(minThreshold));
  }

  if (notes !== undefined) {
    entry.notes = String(notes).trim();
  }

  if (storageLocation && typeof storageLocation === 'string' && storageLocation.trim()) {
    entry.storageLocation = storageLocation.trim();
  }

  entry.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: 'Storage entry updated successfully.',
    entry
  });
};

export const deleteHospitalStorageEntry = async (req: AuthenticatedRequest, res: Response) => {
  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const { entryId } = req.params;
  const index = db.hospitalStorageEntries.findIndex(e => e.id === entryId && e.hospitalId === hospitalId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Storage entry not found.' });
  }

  db.hospitalStorageEntries.splice(index, 1);

  res.json({
    success: true,
    message: 'Storage entry removed.'
  });
};

/**
 * ============================================================================
 * Phase 5D: Hospital Receipt Confirmation & Discrepancy Reporting
 * ============================================================================
 */

/**
 * Confirm Hospital Delivery Receipt
 */
export const confirmHospitalReceipt = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const { id } = req.params;
  const { notes } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  // Multi-tenant isolation: Hospital can only confirm its own requisitions
  if (request.hospitalId !== hospitalId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Cannot confirm receipt for a requisition belonging to another hospital.'
    });
  }

  // Duplicate receipt prevention
  if (request.status === 'Fulfilled' || request.status === 'Received') {
    return res.status(400).json({
      success: false,
      error: 'Requisition has already been received and fulfilled. Duplicate receipt confirmation prevented.'
    });
  }

  // Must be in a dispatched or issued state
  const validDispatchedStates = ['Dispatched', 'Issued', 'Prepared for Dispatch'];
  if (!validDispatchedStates.includes(request.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot confirm receipt: Requisition is currently in '${request.status}' status (must be dispatched first).`
    });
  }

  const now = new Date().toISOString();

  request.status = 'Fulfilled';
  request.fulfilledUnits = request.quantityUnits;
  request.updatedAt = now;
  request.timeline.push({
    status: 'Fulfilled',
    updatedAt: now,
    note: notes || 'Hospital clinical staff confirmed receipt of shipment. Physical units, pack seals, and cold-chain temperature verified.',
    actor: req.user?.name || 'Hospital Clinical Receiving Staff'
  });

  // Update associated BloodDispatch record
  const dispatch = db.bloodDispatches.find(d => d.requestId === request.id || d.id === request.dispatchId);
  if (dispatch) {
    dispatch.status = 'Received';
    dispatch.receivedAt = now;
    dispatch.receivedBy = req.user?.name || 'Hospital Clinical Receiving Staff';
    dispatch.updatedAt = now;
    dispatch.auditHistory.push({
      action: 'Received',
      timestamp: now,
      operator: req.user?.name || 'Hospital Staff',
      notes: notes || 'Delivery received and accepted into hospital clinical care.'
    });
  }

  // Record received inventory in the Hospital's Local OT Storage Ledger (Phase 4A integration)
  if (Array.isArray(request.assignedUnitIds) && request.assignedUnitIds.length > 0) {
    const existingEntry = db.hospitalStorageEntries.find(e => 
      e.hospitalId === hospitalId && 
      e.bloodGroup === request.bloodGroup && 
      e.component === request.component &&
      e.status === 'Usable'
    );

    if (existingEntry) {
      existingEntry.quantityUnits += request.quantityUnits;
      existingEntry.updatedAt = now;
    } else {
      db.hospitalStorageEntries.push({
        id: `HSE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        hospitalId,
        bloodGroup: request.bloodGroup,
        component: request.component,
        quantityUnits: request.quantityUnits,
        storageLocation: 'Main Blood Refrigerator (Blood Bank Ward)',
        status: 'Usable',
        expiryDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        minThreshold: 2,
        notes: `Transferred from regional fulfillment center (Req ${request.id})`,
        source: 'manual_hospital_entry',
        createdAt: now,
        updatedAt: now
      });
    }
  }

  res.json({
    success: true,
    message: `Requisition ${request.id} confirmed received and fulfilled.`,
    request,
    dispatch: dispatch || null
  });
};

/**
 * Report Discrepancy or Failed Transport Handoff
 */
export const reportHospitalDiscrepancy = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const { id } = req.params;
  const { reason, notes, discrepancyType } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.hospitalId !== hospitalId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Cannot report discrepancy for a requisition belonging to another hospital.'
    });
  }

  const now = new Date().toISOString();
  const reportSummary = `${discrepancyType || 'Handoff Discrepancy'}: ${reason || ''} ${notes || ''}`.trim();

  const dispatch = db.bloodDispatches.find(d => d.requestId === request.id || d.id === request.dispatchId);
  if (dispatch) {
    dispatch.status = 'Discrepancy Reported';
    dispatch.discrepancyNotes = reportSummary;
    dispatch.discrepancyReportedAt = now;
    dispatch.discrepancyReportedBy = req.user?.name || 'Hospital Clinical Staff';
    dispatch.updatedAt = now;
    dispatch.auditHistory.push({
      action: 'Discrepancy Reported',
      timestamp: now,
      operator: req.user?.name || 'Hospital Clinical Staff',
      notes: reportSummary
    });
  }

  request.updatedAt = now;
  request.timeline.push({
    status: request.status,
    updatedAt: now,
    note: `EXCEPTION REPORTED: ${reportSummary}`,
    actor: req.user?.name || 'Hospital Clinical Staff'
  });

  // Create high-priority alert for the Blood Bank
  if (request.bloodBankId) {
    db.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      userId: request.bloodBankId,
      title: `DISCREPANCY ALERT: Requisition ${request.id}`,
      message: `${request.hospitalName} reported a handoff issue: ${reportSummary}`,
      type: 'emergency',
      priority: 'urgent',
      read: false,
      createdAt: now,
      link: `/blood-bank/hospital-requests?requestId=${request.id}`
    });
  }

  res.json({
    success: true,
    message: 'Discrepancy report recorded and regional blood bank alerted.',
    request,
    dispatch: dispatch || null
  });
};

/**
 * Get Hospital Requisition Dispatch Details & Slip
 */
export const getHospitalRequestDispatch = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const hospitalId = req.user?.id;
  if (!hospitalId) {
    return res.status(401).json({ success: false, error: 'Unauthorized facility' });
  }

  const { id } = req.params;
  const request = db.bloodRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.hospitalId !== hospitalId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Cannot view dispatch data for another hospital facility.'
    });
  }

  const dispatch = db.bloodDispatches.find(d => d.requestId === request.id || d.id === request.dispatchId);
  if (!dispatch) {
    return res.status(404).json({ success: false, error: 'No dispatch manifest found for this requisition.' });
  }

  res.json({
    success: true,
    dispatch,
    request
  });
};


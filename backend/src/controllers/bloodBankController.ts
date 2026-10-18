import { Response } from 'express';
import { db } from '../models/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  BloodUnit, 
  BloodGroup, 
  BloodComponent, 
  TestingStatus, 
  AvailabilityStatus,
  DonationCamp,
  BloodCollectionRecord,
  ComponentFractionationRecord,
  TestingRecord,
  ColdStorageEquipment,
  TemperatureReading,
  ColdStorageAlarm,
  AlarmAuditEntry,
  TemperatureReadingSource,
  AlarmSeverity,
  AlarmStatus,
  BloodRequest,
  BloodDispatch,
  DispatchUnitItem,
  DispatchStatus
} from '../models/types';

import { safeSupabaseSync, persistRecordDirect } from '../models/db';
import { syncDonorAuthoritativeEligibility } from '../services/donorEligibilityService';
import { notificationService } from '../services/notificationService';
import { smartRoutingService } from '../services/smartRoutingService';
import { isValidCoordinate, parseCoordinates, calcHaversineKm } from '../utils/geo';

/**
 * Calculates days remaining from today until expiry date
 */
const calculateDaysRemaining = (expiryDateStr: string): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);
  const diffMs = exp.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Resolves authenticated blood bank profile from JWT req.user
 */
const resolveBloodBank = (req: AuthenticatedRequest) => {
  const userId = req.user?.id;
  if (!userId) return null;
  return db.bloodBanks.find(b => b.id === userId || b.registrationId === userId) || null;
};

// Memory cache for rapid duplicate collection submission protection
const recentCollectionSubmissions = new Map<string, number>();

// Concurrency mutex to prevent duplicate concurrent fractionation on the same collection
const activeFractionationLocks = new Set<string>();

/**
 * Blood Bank Dashboard KPI & Chart Aggregations
 */
export const getBloodBankDashboard = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  // Authoritative units owned by authenticated blood bank
  const bankUnits = db.bloodUnits.filter(u => u.bloodBankId === bankId);

  // Auto-mark expired units based on date comparison
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  bankUnits.forEach(u => {
    const days = calculateDaysRemaining(u.expiryDate);
    if (days < 0 && u.availability !== 'Issued') {
      u.availability = 'Expired';
    }
  });

  const availableUnits = bankUnits.filter(u => u.availability === 'Available' && u.testingStatus === 'Passed');
  const totalUnits = availableUnits.length;

  const rbcAvailable = availableUnits.filter(u => u.component === 'RBC').length;
  const plasmaAvailable = availableUnits.filter(u => u.component === 'Plasma').length;
  const plateletsAvailable = availableUnits.filter(u => u.component === 'Platelets').length;

  const expiringSoon = availableUnits.filter(u => {
    const days = calculateDaysRemaining(u.expiryDate);
    return days >= 0 && days <= 3;
  }).length;

  const expiredUnits = bankUnits.filter(u => {
    const days = calculateDaysRemaining(u.expiryDate);
    return days < 0 || u.availability === 'Expired';
  }).length;

  const reservedUnits = bankUnits.filter(u => u.availability === 'Reserved').length;

  const pendingRequests = db.bloodRequests.filter(r => 
    r.bloodBankId === bankId && 
    (r.status === 'Pending' || r.status === 'Sample Submitted' || r.status === 'Under Review' || r.status === 'Verified')
  ).length;

  const pendingTesting = db.testingRecords.filter(t => 
    t.bloodBankId === bankId && (t.status === 'Pending' || t.status === 'In Testing')
  ).length;

  const emergencyRequests = db.bloodRequests.filter(r => 
    r.bloodBankId === bankId && r.urgency === 'Emergency' && r.status !== 'Fulfilled' && r.status !== 'Cancelled'
  ).length;

  // Group summary matrix strictly scoped to this bank
  const groupSummary = db.getAvailableInventoryByGroup(bankId);

  // Critical shortages
  const criticalGroups = Object.entries(groupSummary)
    .filter(([_, data]) => data.status === 'Critical')
    .map(([bg, _]) => bg as BloodGroup);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollectionsCount = db.bloodCollections.filter(c => c.bloodBankId === bankId && c.collectionDate === todayStr).length;

  res.json({
    success: true,
    bankProfile: bb ? {
      id: bb.id,
      name: bb.name,
      bloodBankName: bb.bloodBankName,
      registrationId: bb.registrationId,
      city: bb.city,
      address: bb.address
    } : null,
    metrics: {
      totalUnits,
      rbcAvailable,
      plasmaAvailable,
      plateletsAvailable,
      expiringSoon,
      expiredUnits,
      reservedUnits,
      pendingRequests,
      pendingTesting,
      emergencyRequests,
      criticalGroupsCount: criticalGroups.length,
      criticalGroups,
      todayCollectionsCount
    },
    inventorySummary: groupSummary,
    recentRequests: db.bloodRequests.filter(r => r.bloodBankId === bankId).slice(0, 5)
  });
};

/**
 * Authoritative Blood Unit Inventory with Search, Filter & FEFO Ordering
 */
export const getInventory = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { bloodGroup, component, testingStatus, availability, expiryFilter, sortBy, search } = req.query;

  // Strictly filter by authenticated blood bank ID
  let units = db.bloodUnits.filter(u => u.bloodBankId === bankId);

  // Auto-mark expired units based on date comparison
  units.forEach(u => {
    const days = calculateDaysRemaining(u.expiryDate);
    if (days < 0 && u.availability !== 'Issued') {
      u.availability = 'Expired';
    }
  });

  if (bloodGroup && bloodGroup !== 'all') {
    units = units.filter(u => u.bloodGroup === bloodGroup);
  }
  if (component && component !== 'all') {
    units = units.filter(u => u.component === component);
  }
  if (testingStatus && testingStatus !== 'all') {
    units = units.filter(u => u.testingStatus === testingStatus);
  }
  if (availability && availability !== 'all') {
    units = units.filter(u => u.availability === availability);
  }

  if (expiryFilter && expiryFilter !== 'all') {
    units = units.filter(u => {
      const days = calculateDaysRemaining(u.expiryDate);
      if (expiryFilter === 'expiring_3d') return days >= 0 && days <= 3 && u.availability === 'Available';
      if (expiryFilter === 'expiring_7d') return days >= 0 && days <= 7 && u.availability === 'Available';
      if (expiryFilter === 'expiring_30d') return days >= 0 && days <= 30 && u.availability === 'Available';
      if (expiryFilter === 'expired') return days < 0 || u.availability === 'Expired';
      return true;
    });
  }

  if (search) {
    const q = String(search).toLowerCase();
    units = units.filter(u => 
      u.id.toLowerCase().includes(q) || 
      u.bloodBankName.toLowerCase().includes(q) ||
      u.storageLocation.toLowerCase().includes(q) ||
      (u.donorCode && u.donorCode.toLowerCase().includes(q)) ||
      (u.reservedForRequestId && u.reservedForRequestId.toLowerCase().includes(q)) ||
      (u.sourceCollectionId && u.sourceCollectionId.toLowerCase().includes(q)) ||
      (u.fractionationBatchId && u.fractionationBatchId.toLowerCase().includes(q))
    );
  }

  // FEFO / Sorting Logic
  const sortMode = sortBy || 'earliest_expiry';

  units.sort((a, b) => {
    if (sortMode === 'earliest_expiry') {
      const diff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      return diff !== 0 ? diff : new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime();
    } else if (sortMode === 'latest_expiry') {
      return new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime();
    } else if (sortMode === 'collection_date') {
      return new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime();
    } else if (sortMode === 'blood_group') {
      return a.bloodGroup.localeCompare(b.bloodGroup);
    }
    return 0;
  });

  // Attach daysRemaining and contextual reservation / fractionation details
  const unitsWithDays = units.map(u => {
    const linkedRequest = u.reservedForRequestId 
      ? db.bloodRequests.find(r => r.id === u.reservedForRequestId) 
      : null;

    return {
      ...u,
      daysRemaining: calculateDaysRemaining(u.expiryDate),
      reservedForHospital: linkedRequest?.hospitalName || (u.availability === 'Reserved' ? 'Hospital Surgical Reservation' : undefined),
      reservedForRequest: u.reservedForRequestId || (u.availability === 'Reserved' ? 'Direct Cross-Match Lock' : undefined),
      patientReferenceId: linkedRequest?.patientReferenceId,
      department: linkedRequest?.department,
      requiredByDate: linkedRequest?.requiredByDate
    };
  });

  res.json({ 
    success: true, 
    count: unitsWithDays.length, 
    units: unitsWithDays,
    fefoApplied: sortMode === 'earliest_expiry'
  });
};

/**
 * FEFO Next Units Priority Panel API
 */
export const getFefoPriority = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { bloodGroup, component, limit } = req.query;

  let units = db.bloodUnits.filter(u => 
    u.bloodBankId === bankId &&
    u.availability === 'Available' && 
    u.testingStatus === 'Passed' &&
    calculateDaysRemaining(u.expiryDate) >= 0
  );

  if (bloodGroup && bloodGroup !== 'all') {
    units = units.filter(u => u.bloodGroup === bloodGroup);
  }
  if (component && component !== 'all') {
    units = units.filter(u => u.component === component);
  }

  // Sort FEFO: Earliest expiry date first
  units.sort((a, b) => {
    const diff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    return diff !== 0 ? diff : new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime();
  });

  const maxCount = limit ? Number(limit) : 5;
  const priorityUnits = units.slice(0, maxCount).map((u, idx) => ({
    ...u,
    daysRemaining: calculateDaysRemaining(u.expiryDate),
    priorityRank: idx + 1
  }));

  res.json({
    success: true,
    fefoRule: 'First Expiry -> First Out (FEFO) Priority Queue',
    count: priorityUnits.length,
    priorityUnits
  });
};

/**
 * Reserve Blood Unit with STRICT Double-Reservation Prevention
 */
export const reserveBloodUnit = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const { requestId, notes } = req.body;

  const unit = db.bloodUnits.find(u => u.id === id);
  if (!unit) {
    return res.status(404).json({ success: false, error: `Blood unit ${id} not found.` });
  }

  if (unit.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Blood unit belongs to another facility.' });
  }

  if (unit.availability !== 'Available') {
    return res.status(409).json({
      success: false,
      error: `Reservation Failed: Blood Unit ${id} is no longer available (Current Status: ${unit.availability}). Double reservation prevented.`,
      unitId: id,
      currentStatus: unit.availability
    });
  }

  if (unit.testingStatus !== 'Passed') {
    return res.status(400).json({
      success: false,
      error: `Reservation Failed: Unit ${id} has not passed lab screening (Status: ${unit.testingStatus}).`
    });
  }

  const days = calculateDaysRemaining(unit.expiryDate);
  if (days < 0) {
    unit.availability = 'Expired';
    return res.status(400).json({
      success: false,
      error: `Reservation Failed: Unit ${id} has expired on ${unit.expiryDate}.`
    });
  }

  unit.availability = 'Reserved';
  if (requestId) unit.reservedForRequestId = requestId;
  if (notes) unit.notes = notes;
  db.saveSnapshot();

  if (requestId) {
    const request = db.bloodRequests.find(r => r.id === requestId);
    if (request) {
      request.status = 'Reserved';
      if (!request.assignedUnitIds) request.assignedUnitIds = [];
      if (!request.assignedUnitIds.includes(unit.id)) {
        request.assignedUnitIds.push(unit.id);
      }
      request.updatedAt = new Date().toISOString();
      request.timeline.push({
        status: 'Reserved',
        updatedAt: new Date().toISOString(),
        note: `FEFO Unit ${unit.id} (${unit.bloodGroup} ${unit.component}, Exp: ${unit.expiryDate}) reserved for hospital.`,
        actor: req.user?.name || 'Blood Bank System'
      });
    }
  }

  res.json({
    success: true,
    message: `Blood Unit ${unit.id} reserved successfully under FEFO protocol.`,
    unit: {
      ...unit,
      daysRemaining: days
    }
  });
};

/**
 * Release reserved blood unit back to available inventory
 */
export const releaseBloodUnit = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const unit = db.bloodUnits.find(u => u.id === id);

  if (!unit) {
    return res.status(404).json({ success: false, error: `Blood unit ${id} not found.` });
  }

  if (unit.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Blood unit belongs to another facility.' });
  }

  if (unit.availability !== 'Reserved') {
    return res.status(400).json({ 
      success: false, 
      error: `Unit ${id} is not reserved (Current Status: ${unit.availability}).` 
    });
  }

  const linkedReqId = unit.reservedForRequestId;
  unit.availability = 'Available';
  unit.reservedForRequestId = undefined;

  if (linkedReqId) {
    const request = db.bloodRequests.find(r => r.id === linkedReqId);
    if (request && Array.isArray(request.assignedUnitIds)) {
      request.assignedUnitIds = request.assignedUnitIds.filter(uId => uId !== unit.id);
      request.updatedAt = new Date().toISOString();
      request.timeline.push({
        status: request.assignedUnitIds.length > 0 ? 'Reserved' : 'Pending',
        updatedAt: new Date().toISOString(),
        note: `Unit ${unit.id} released from reservation back to available regional stock.`,
        actor: req.user?.name || 'Blood Bank Manager'
      });
      if (request.assignedUnitIds.length === 0) {
        request.status = 'Pending';
      }
    }
  }

  res.json({
    success: true,
    message: `Unit ${unit.id} released from reservation and returned to available inventory.`,
    unit: {
      ...unit,
      daysRemaining: calculateDaysRemaining(unit.expiryDate)
    }
  });
};

/**
 * Issue Blood Unit directly from FEFO or Reserve list
 */
export const issueBloodUnit = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const { requestId, notes } = req.body;

  const unit = db.bloodUnits.find(u => u.id === id);
  if (!unit) {
    return res.status(404).json({ success: false, error: `Blood unit ${id} not found.` });
  }

  if (unit.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Blood unit belongs to another facility.' });
  }

  if (unit.availability === 'Issued') {
    return res.status(400).json({ success: false, error: `Unit ${id} has already been issued.` });
  }

  if (unit.availability === 'Expired') {
    return res.status(400).json({ success: false, error: `Unit ${id} is expired and cannot be issued for clinical use.` });
  }

  if (unit.testingStatus !== 'Passed') {
    return res.status(400).json({ success: false, error: `Unit ${id} must pass disease screening before issuance.` });
  }

  unit.availability = 'Issued';
  if (notes) unit.notes = notes;

  if (requestId || unit.reservedForRequestId) {
    const targetReqId = requestId || unit.reservedForRequestId;
    const request = db.bloodRequests.find(r => r.id === targetReqId);
    if (request) {
      request.fulfilledUnits = Math.min(request.quantityUnits, (request.fulfilledUnits || 0) + 1);
      if (request.fulfilledUnits >= request.quantityUnits) {
        request.status = 'Issued';
      }
      request.updatedAt = new Date().toISOString();
      request.timeline.push({
        status: 'Issued',
        updatedAt: new Date().toISOString(),
        note: `Unit ${unit.id} issued and handed over for transport.`,
        actor: req.user?.name || 'Blood Bank Dispatch'
      });
    }
  }

  res.json({
    success: true,
    message: `Unit ${unit.id} successfully issued under cold-chain dispatch protocol.`,
    unit: {
      ...unit,
      daysRemaining: calculateDaysRemaining(unit.expiryDate)
    }
  });
};

/**
 * Add / Record New Blood Unit directly (Legacy endpoint preserved for backwards compatibility)
 */
export const addBloodUnit = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { bloodGroup, component, volumeMl, collectionDate, storageLocation, donorId, donorCode, source, notes } = req.body;

  if (!bloodGroup || !component) {
    return res.status(400).json({ success: false, error: 'Blood group and component are required' });
  }

  let validatedDonorCode = donorCode;
  if (donorId) {
    const donor = db.donors.find(d => d.id === donorId);
    if (donor) {
      validatedDonorCode = `DON-${donor.id.replace('donor-', '')} (${donor.name})`;
    }
  }

  let unitId = `UNIT-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
  while (db.bloodUnits.some(u => u.id === unitId)) {
    unitId = `UNIT-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
  }
  const colDate = collectionDate || new Date().toISOString().split('T')[0];
  
  const colObj = new Date(colDate);
  let shelfDays = 42;
  if (component === 'Plasma') shelfDays = 365;
  if (component === 'Platelets') shelfDays = 5;

  const expObj = new Date(colObj.getTime() + shelfDays * 24 * 60 * 60 * 1000);
  const expiryDate = expObj.toISOString().split('T')[0];

  const newUnit: BloodUnit = {
    id: unitId,
    bloodBankId: bankId,
    bloodBankName: bb?.bloodBankName || bb?.name || 'Regional Blood Center',
    donorId,
    donorCode: validatedDonorCode || `DON-${Math.floor(1000 + Math.random() * 9000)}`,
    bloodGroup,
    component,
    volumeMl: Number(volumeMl) || (component === 'RBC' ? 350 : component === 'Plasma' ? 250 : 200),
    collectionDate: colDate,
    expiryDate,
    testingStatus: 'Pending',
    availability: 'Quarantined',
    storageLocation: storageLocation || `Quarantine Bay ${component}-1`,
    source: source || 'Voluntary Donation',
    notes,
    createdAt: new Date().toISOString()
  };

  db.bloodUnits.unshift(newUnit);

  const newTestingRecord: TestingRecord = {
    id: `TST-${Date.now()}`,
    unitId,
    bloodBankId: bankId,
    bloodGroup,
    hivTest: 'Pending',
    hbvTest: 'Pending',
    hcvTest: 'Pending',
    syphilisTest: 'Pending',
    malariaTest: 'Pending',
    status: 'Pending',
    testedBy: req.user?.name || 'Lab Staff',
    testingDate: colDate,
    notes: 'Unit collected. Mandatory infectious disease screening initiated.'
  };

  db.testingRecords.unshift(newTestingRecord);

  db.saveSnapshot();

  res.status(201).json({
    success: true,
    message: 'New blood unit recorded and sent to quarantine for infectious disease screening.',
    unit: {
      ...newUnit,
      daysRemaining: calculateDaysRemaining(newUnit.expiryDate)
    },
    testingRecord: newTestingRecord
  });
};

/**
 * Mandatory Infectious Disease Screening Records
 */
export const getTestingRecords = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  // Ensure all units belonging to this blood bank have matching testing records
  const bankUnits = db.bloodUnits.filter(u => u.bloodBankId === bankId);
  let newlySynthesized = false;

  for (const u of bankUnits) {
    const existingRec = db.testingRecords.find(t => t.unitId === u.id);
    if (!existingRec) {
      const isPassed = u.testingStatus === 'Passed';
      const isFailed = u.testingStatus === 'Failed';
      const initialMarker = isPassed ? 'Negative' : isFailed ? 'Positive' : 'Pending';
      const newRec: TestingRecord = {
        id: `TST-${u.id.replace('UNIT-2026-', '')}`,
        unitId: u.id,
        bloodBankId: bankId,
        bloodGroup: u.bloodGroup,
        hivTest: initialMarker,
        hbvTest: initialMarker,
        hcvTest: initialMarker,
        syphilisTest: initialMarker,
        malariaTest: initialMarker,
        status: u.testingStatus || 'Pending',
        testedBy: isPassed ? 'Lab Specialist' : 'Pending Assignment',
        testingDate: u.collectionDate || new Date().toISOString().split('T')[0],
        notes: isPassed ? 'Unit passed mandatory infectious disease screening.' : 'Unit in quarantine awaiting screening.'
      };
      db.testingRecords.push(newRec);
      newlySynthesized = true;
    }
  }

  if (newlySynthesized) {
    db.saveSnapshot();
  }

  const { status, filter, unitId } = req.query;

  let records = db.testingRecords.filter(t => t.bloodBankId === bankId);

  // If specific unitId requested, filter by unitId
  if (unitId) {
    const cleanUnitId = String(unitId).trim().toUpperCase();
    records = records.filter(t => t.unitId.toUpperCase() === cleanUnitId || t.id.toUpperCase() === cleanUnitId);
  }

  const statusFilter = (status || filter || 'pending').toString().toLowerCase();

  if (statusFilter === 'pending') {
    records = records.filter(t => 
      t.status === 'Pending' || 
      t.status === 'In Testing' || 
      (t.status === 'Quarantined' && (t.hivTest === 'Pending' || t.hbvTest === 'Pending' || t.hcvTest === 'Pending' || t.syphilisTest === 'Pending' || t.malariaTest === 'Pending'))
    );
  } else if (statusFilter === 'passed') {
    records = records.filter(t => t.status === 'Passed');
  } else if (statusFilter === 'failed') {
    records = records.filter(t => t.status === 'Failed' || (t.status === 'Quarantined' && (t.hivTest === 'Positive' || t.hbvTest === 'Positive' || t.hcvTest === 'Positive' || t.syphilisTest === 'Positive' || t.malariaTest === 'Positive')));
  } else if (statusFilter !== 'all') {
    records = records.filter(t => t.status.toLowerCase() === statusFilter);
  }

  const enriched = records.map(r => {
    const u = db.bloodUnits.find(unit => unit.id === r.unitId);
    return {
      ...r,
      component: u?.component,
      volumeMl: u?.volumeMl,
      donorCode: u?.donorCode,
      collectionDate: u?.collectionDate,
      storageLocation: u?.storageLocation,
      expiryDate: u?.expiryDate,
      unitAvailability: u?.availability,
      daysRemaining: u?.expiryDate ? calculateDaysRemaining(u.expiryDate) : null
    };
  });

  res.json({ success: true, count: enriched.length, records: enriched });
};

/**
 * Update Infectious Disease Screening Results with Strict Clinical Clearance
 */
export const updateTestingStatus = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { id } = req.params;
  const { status, hivTest, hbvTest, hcvTest, syphilisTest, malariaTest, notes, testedBy } = req.body;

  let record = db.testingRecords.find(r => (r.id === id || r.unitId === id) && r.bloodBankId === bankId);
  
  // If not found in records, check if unit exists in bloodUnits for this blood bank
  if (!record) {
    const unit = db.bloodUnits.find(u => u.id === id && u.bloodBankId === bankId);
    if (unit) {
      record = {
        id: `TST-${unit.id.replace('UNIT-2026-', '')}`,
        unitId: unit.id,
        bloodBankId: bankId,
        bloodGroup: unit.bloodGroup,
        hivTest: 'Pending',
        hbvTest: 'Pending',
        hcvTest: 'Pending',
        syphilisTest: 'Pending',
        malariaTest: 'Pending',
        status: 'Pending',
        testedBy: req.user?.name || 'Lab Staff',
        testingDate: unit.collectionDate || new Date().toISOString().split('T')[0],
        notes: 'Infectious disease screening record.'
      };
      db.testingRecords.push(record);
    }
  }

  if (!record) {
    return res.status(404).json({ success: false, error: 'Testing record not found or access denied.' });
  }

  const normalizeMarker = (val: any): 'Negative' | 'Positive' | 'Pending' | null => {
    if (val === undefined || val === null) return null;
    const s = String(val).trim().toLowerCase();
    if (s === 'negative' || s === 'non-reactive' || s === 'nonreactive' || s === 'clear') return 'Negative';
    if (s === 'positive' || s === 'reactive' || s.includes('reactive') || s.includes('positive')) return 'Positive';
    if (s === 'pending' || s === 'in progress' || s === 'invalid' || s === 'incomplete') return 'Pending';
    return null;
  };

  // Validate and assign marker updates (supporting both hivTest and hiv aliases)
  const rawHiv = hivTest !== undefined ? hivTest : req.body.hiv;
  if (rawHiv !== undefined) {
    const norm = normalizeMarker(rawHiv);
    if (!norm) return res.status(400).json({ success: false, error: `Invalid result value for HIV test: '${rawHiv}'. Allowed values: Negative, Positive, Pending.` });
    record.hivTest = norm;
  }

  const rawHbv = hbvTest !== undefined ? hbvTest : req.body.hbv;
  if (rawHbv !== undefined) {
    const norm = normalizeMarker(rawHbv);
    if (!norm) return res.status(400).json({ success: false, error: `Invalid result value for Hepatitis B test: '${rawHbv}'. Allowed values: Negative, Positive, Pending.` });
    record.hbvTest = norm;
  }

  const rawHcv = hcvTest !== undefined ? hcvTest : req.body.hcv;
  if (rawHcv !== undefined) {
    const norm = normalizeMarker(rawHcv);
    if (!norm) return res.status(400).json({ success: false, error: `Invalid result value for Hepatitis C test: '${rawHcv}'. Allowed values: Negative, Positive, Pending.` });
    record.hcvTest = norm;
  }

  const rawSyphilis = syphilisTest !== undefined ? syphilisTest : req.body.syphilis;
  if (rawSyphilis !== undefined) {
    const norm = normalizeMarker(rawSyphilis);
    if (!norm) return res.status(400).json({ success: false, error: `Invalid result value for Syphilis test: '${rawSyphilis}'. Allowed values: Negative, Positive, Pending.` });
    record.syphilisTest = norm;
  }

  const rawMalaria = malariaTest !== undefined ? malariaTest : req.body.malaria;
  if (rawMalaria !== undefined) {
    const norm = normalizeMarker(rawMalaria);
    if (!norm) return res.status(400).json({ success: false, error: `Invalid result value for Malaria test: '${rawMalaria}'. Allowed values: Negative, Positive, Pending.` });
    record.malariaTest = norm;
  }

  if (notes !== undefined) record.notes = notes;
  if (testedBy) record.testedBy = testedBy;
  else if (req.user?.name) record.testedBy = req.user.name;

  const unit = db.bloodUnits.find(u => u.id === record.unitId);

  // Check if any marker is Positive (Reactive)
  const isReactive = record.hivTest === 'Positive' || 
                     record.hbvTest === 'Positive' || 
                     record.hcvTest === 'Positive' || 
                     record.syphilisTest === 'Positive' || 
                     record.malariaTest === 'Positive';

  // Check if all 5 markers are confirmed Negative
  const allNegative = record.hivTest === 'Negative' && 
                      record.hbvTest === 'Negative' && 
                      record.hcvTest === 'Negative' && 
                      record.syphilisTest === 'Negative' && 
                      record.malariaTest === 'Negative';

  // If user requests to pass/clear the unit
  if (status === 'Passed') {
    if (isReactive) {
      const reactiveMarkers = [];
      if (record.hivTest === 'Positive') reactiveMarkers.push('HIV');
      if (record.hbvTest === 'Positive') reactiveMarkers.push('Hepatitis B');
      if (record.hcvTest === 'Positive') reactiveMarkers.push('Hepatitis C');
      if (record.syphilisTest === 'Positive') reactiveMarkers.push('Syphilis');
      if (record.malariaTest === 'Positive') reactiveMarkers.push('Malaria');

      return res.status(422).json({
        success: false,
        error: `Cannot clear unit ${record.unitId} for clinical use: Reactive result detected for [${reactiveMarkers.join(', ')}]. Unit must remain quarantined and scheduled for biohazard disposal.`,
        reactiveMarkers
      });
    }

    if (!allNegative) {
      const pendingMarkers = [];
      if (record.hivTest !== 'Negative') pendingMarkers.push('HIV');
      if (record.hbvTest !== 'Negative') pendingMarkers.push('Hepatitis B');
      if (record.hcvTest !== 'Negative') pendingMarkers.push('Hepatitis C');
      if (record.syphilisTest !== 'Negative') pendingMarkers.push('Syphilis');
      if (record.malariaTest !== 'Negative') pendingMarkers.push('Malaria');

      return res.status(422).json({
        success: false,
        error: `Cannot clear unit ${record.unitId} for clinical use: All 5 mandatory infectious disease markers must be tested and confirmed Negative. Missing or pending markers: [${pendingMarkers.join(', ')}].`,
        pendingMarkers
      });
    }

    // Fully cleared!
    record.status = 'Passed';
    record.notes = notes || `Authorized clinical clearance by ${req.user?.name || 'Lab Staff'}. All 5 viral markers confirmed Negative.`;
    (record as any).reviewedBy = req.user?.name || 'Lab Staff';
    (record as any).reviewedAt = new Date().toISOString();

    if (unit) {
      unit.testingStatus = 'Passed';
      unit.availability = 'Available';
      unit.storageLocation = `${unit.component} Main Storage Bay`;
    }
  } else if (status === 'Failed' || isReactive) {
    record.status = 'Failed';
    record.notes = notes || `REACTIVE SCREENING: Unit ${record.unitId} failed viral screening and is quarantined for biohazard disposal.`;
    (record as any).reviewedBy = req.user?.name || 'Lab Staff';
    (record as any).reviewedAt = new Date().toISOString();

    if (unit) {
      unit.testingStatus = 'Failed';
      unit.availability = 'Quarantined';
      unit.storageLocation = 'Biohazard Quarantine Discard Bay';
    }
  } else if (status === 'In Testing') {
    record.status = 'In Testing';
    if (unit) {
      unit.testingStatus = 'In Testing';
      unit.availability = 'Quarantined';
    }
  } else if (!status) {
    if (isReactive) {
      record.status = 'Failed';
      if (unit) {
        unit.testingStatus = 'Failed';
        unit.availability = 'Quarantined';
        unit.storageLocation = 'Biohazard Quarantine Discard Bay';
      }
    } else if (allNegative) {
      if (record.status !== 'Passed') {
        record.status = 'In Testing';
      }
    } else {
      const anyTested = record.hivTest !== 'Pending' || record.hbvTest !== 'Pending' || record.hcvTest !== 'Pending' || record.syphilisTest !== 'Pending' || record.malariaTest !== 'Pending';
      record.status = anyTested ? 'In Testing' : 'Pending';
      if (unit && unit.testingStatus !== 'Passed') {
        unit.testingStatus = record.status;
        unit.availability = 'Quarantined';
      }
    }
  } else {
    record.status = status;
    if (unit) {
      unit.testingStatus = status;
    }
  }

  db.saveSnapshot();

  res.json({
    success: true,
    message: record.status === 'Passed' 
      ? `Unit ${record.unitId} verified NEGATIVE on all 5 viral markers and released to available inventory.`
      : `Testing status updated to ${record.status}.`,
    record,
    unit: unit ? {
      ...unit,
      daysRemaining: calculateDaysRemaining(unit.expiryDate)
    } : null
  });
};

/**
 * Search Donors for Phlebotomy Collection Logger
 */
export const searchDonors = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const q = String(req.query.q || '').trim().toLowerCase();

  const donors = db.donors
    .filter(d => 
      !q || 
      d.name.toLowerCase().includes(q) || 
      d.id.toLowerCase().includes(q) || 
      d.email.toLowerCase().includes(q) ||
      d.bloodGroup.toLowerCase().includes(q) ||
      (d.phone && d.phone.toLowerCase().includes(q))
    )
    .slice(0, 15)
    .map(d => {
      const eligibility = syncDonorAuthoritativeEligibility(d);
      return {
        id: d.id,
        donorCode: `DON-${d.id.replace('donor-', '')}`,
        name: d.name,
        email: d.email,
        bloodGroup: d.bloodGroup,
        isEligible: eligibility.isEligible,
        isVerified: eligibility.isVerified,
        verificationStatus: eligibility.verificationStatus,
        bloodGroupVerificationStatus: eligibility.verificationStatus,
        deferralReason: eligibility.deferralReason,
        lastDonationDate: d.lastDonationDate,
        weightKg: d.weightKg,
        totalDonationsCount: d.totalDonationsCount,
        phone: d.phone
      };
    });

  res.json({ success: true, count: donors.length, donors });
};

/**
 * Get Verified Donor Details with Full Medical Eligibility
 */
export const getDonorDetails = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { id } = req.params;
  const donor = db.donors.find(d => 
    d.id === id || 
    d.id === `donor-${id.replace('DON-', '')}` || 
    d.id === `donor-${id}`
  );

  if (!donor) {
    return res.status(404).json({ success: false, error: `Donor ${id} not found.` });
  }

  const eligibility = syncDonorAuthoritativeEligibility(donor);

  res.json({
    success: true,
    donor: {
      id: donor.id,
      donorCode: `DON-${donor.id.replace('donor-', '')}`,
      name: donor.name,
      email: donor.email,
      phone: donor.phone,
      bloodGroup: donor.bloodGroup,
      isEligible: eligibility.isEligible,
      isVerified: eligibility.isVerified,
      verificationStatus: eligibility.verificationStatus,
      bloodGroupVerificationStatus: eligibility.verificationStatus,
      deferralReason: eligibility.deferralReason,
      lastDonationDate: donor.lastDonationDate,
      weightKg: donor.weightKg,
      totalDonationsCount: donor.totalDonationsCount,
      totalVolumeMl: donor.totalVolumeMl,
      proofDocument: (donor as any).proofDocument,
      proofDocumentType: (donor as any).proofDocumentType,
      proofDocumentNumber: (donor as any).proofDocumentNumber,
      bloodGroupProofDocUrl: donor.bloodGroupProofDocUrl,
      verifiedAt: donor.verifiedAt,
      verifiedByName: donor.verifiedByName
    },
    eligibility
  });
};

/**
 * Dedicated Donor Verification Queue for Authorized Blood Bank Staff
 * Returns pending and clarification-requested verification submissions assigned to this blood bank.
 */
export const getDonorVerificationQueue = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  // Find donors assigned to this blood bank or unassigned donors in the regional area
  const pendingDonors = db.donors
    .filter(d => {
      const status = d.verificationStatus || d.bloodGroupVerificationStatus || 'Unverified';
      const isPendingStatus = status === 'Pending Verification' || status === 'Needs More Info';

      if (!isPendingStatus) return false;

      // Ownership filter: assigned to this bank, or unassigned/legacy record routed here
      if (d.assignedBloodBankId) {
        return d.assignedBloodBankId === bankId;
      }
      if (d.preferredBloodBankId) {
        return d.preferredBloodBankId === bankId;
      }
      // If donor has no explicit assignment, check city or route default
      if (bb?.city && d.city && d.city.toLowerCase() === bb.city.toLowerCase()) {
        return true;
      }
      // If only one blood bank or default bank (bb-1)
      return bankId === 'bb-1' || db.bloodBanks.length <= 1;
    })
    .map(d => {
      const eligibility = syncDonorAuthoritativeEligibility(d);
      return {
        id: d.id,
        donorCode: `DON-${d.id.replace('donor-', '')}`,
        name: d.name,
        email: d.email,
        phone: d.phone,
        city: d.city,
        state: d.state,
        bloodGroup: d.bloodGroup,
        weightKg: d.weightKg,
        dob: d.dob,
        gender: d.gender,
        verificationStatus: d.verificationStatus || d.bloodGroupVerificationStatus || 'Pending Verification',
        bloodGroupVerificationStatus: d.bloodGroupVerificationStatus || d.verificationStatus || 'Pending Verification',
        assignedBloodBankId: d.assignedBloodBankId || bankId,
        assignedBloodBankName: d.assignedBloodBankName || bb?.bloodBankName || bb?.name || 'Blood Bank',
        verificationSubmittedAt: d.verificationSubmittedAt || d.createdAt,
        proofDocumentType: (d as any).proofDocumentType || 'Lab Blood Report',
        proofDocumentNumber: (d as any).proofDocumentNumber,
        bloodGroupProofDocUrl: d.bloodGroupProofDocUrl,
        proofDocument: (d as any).proofDocument,
        verificationNotes: d.verificationNotes,
        rejectionReason: d.rejectionReason,
        isEligible: eligibility.isEligible
      };
    });

  // Sort oldest pending submission first
  pendingDonors.sort((a, b) => new Date(a.verificationSubmittedAt).getTime() - new Date(b.verificationSubmittedAt).getTime());

  res.json({
    success: true,
    count: pendingDonors.length,
    queue: pendingDonors
  });
};

/**
 * Eligible Blood Bank Directory for Donor Verification Assignment
 * Returns genuine, active, verified blood bank organizations eligible to receive verification requests.
 * Uses Haversine formula to compute distance from donor coordinates and sorts nearest first.
 */
export const getEligibleBloodBankDirectory = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { lat, lng, radius, q } = req.query;

  // Filter genuine, active, verified blood banks
  let eligibleBanks = db.bloodBanks.filter(b => {
    if (!b.id || (!b.name && !b.bloodBankName)) return false;
    if (b.isActive === false) return false;
    return true;
  });

  if (q) {
    const term = String(q).trim().toLowerCase();
    eligibleBanks = eligibleBanks.filter(b => 
      (b.name && b.name.toLowerCase().includes(term)) ||
      (b.bloodBankName && b.bloodBankName.toLowerCase().includes(term)) ||
      (b.city && b.city.toLowerCase().includes(term)) ||
      (b.address && b.address.toLowerCase().includes(term))
    );
  }

  let donorLat: number | undefined;
  let donorLng: number | undefined;

  if (lat !== undefined && lng !== undefined && lat !== '' && lng !== '') {
    const parsed = parseCoordinates(lat, lng);
    if (!parsed.error && isValidCoordinate(parsed.lat, parsed.lng)) {
      donorLat = parsed.lat;
      donorLng = parsed.lng;
    }
  }

  // Calculate distance if coordinates are present
  let formatted = eligibleBanks.map(b => {
    let distanceKm: number | null = null;
    if (donorLat !== undefined && donorLng !== undefined && isValidCoordinate(b.latitude, b.longitude)) {
      distanceKm = calcHaversineKm(donorLat, donorLng, b.latitude!, b.longitude!);
    }

    return {
      id: b.id,
      name: b.name || b.bloodBankName,
      bloodBankName: b.bloodBankName || b.name,
      registrationId: b.registrationId,
      address: b.address,
      city: b.city,
      state: b.state,
      phone: b.phone,
      emergencyPhone: b.emergencyPhone,
      latitude: b.latitude,
      longitude: b.longitude,
      distanceKm,
      isAuthorizedForVerification: true,
      serviceArea: b.serviceArea || (b.city ? `${b.city} & Regional Area` : 'Regional Area')
    };
  });

  let maxRadiusKm: number | null = null;
  if (radius && radius !== 'all') {
    const num = Number(radius);
    if (Number.isFinite(num) && num > 0) {
      maxRadiusKm = num;
      if (donorLat !== undefined && donorLng !== undefined) {
        formatted = formatted.filter(b => b.distanceKm !== null && b.distanceKm <= num);
      }
    }
  }

  // Nearest first when distance is available, otherwise alphabetical
  if (donorLat !== undefined && donorLng !== undefined) {
    formatted.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  } else {
    formatted.sort((a, b) => a.name.localeCompare(b.name));
  }

  res.json({
    success: true,
    totalFound: formatted.length,
    radiusKm: maxRadiusKm,
    originProvided: donorLat !== undefined && donorLng !== undefined,
    origin: donorLat !== undefined && donorLng !== undefined ? { lat: donorLat, lng: donorLng } : null,
    bloodBanks: formatted
  });
};

/**
 * Authorize, Reject or Request Additional Information for Donor Blood Group & Identity Verification (Authorized Blood Bank Staff Only)
 */
export const verifyDonorEligibility = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { id } = req.params;
  const donor = db.donors.find(d => 
    d.id === id || 
    d.id === `donor-${id.replace('DON-', '')}` || 
    d.id === `donor-${id}`
  );

  if (!donor) {
    return res.status(404).json({ success: false, error: `Donor ${id} not found.` });
  }

  // Tenant authorization: Unrelated blood bank cannot review if explicitly assigned to another bank
  if (donor.assignedBloodBankId && donor.assignedBloodBankId !== bankId && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: `Access denied. Donor ${donor.name} is assigned to ${donor.assignedBloodBankName || donor.assignedBloodBankId} for verification.`
    });
  }

  const { status, bloodGroup, rejectionReason, notes } = req.body;

  if (!status || !['Verified', 'Rejected', 'Needs More Info'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: "Verification status must be 'Verified', 'Rejected', or 'Needs More Info'."
    });
  }

  const bankName = bb?.bloodBankName || bb?.name || 'Authorized Blood Center';

  if (status === 'Verified') {
    donor.bloodGroupVerificationStatus = 'Verified';
    donor.verificationStatus = 'Verified';
    donor.verifiedBy = bankId;
    donor.verifiedByName = bankName;
    donor.verifiedAt = new Date().toISOString();
    donor.verificationDecisionAt = donor.verifiedAt;
    donor.rejectionReason = undefined;
    donor.verificationNotes = notes;

    if (bloodGroup && ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].includes(bloodGroup)) {
      donor.bloodGroup = bloodGroup as BloodGroup;
    }

    const assessment = syncDonorAuthoritativeEligibility(donor);

    // Notify donor via real-time SSE & persistent notification
    await notificationService.dispatchNotification({
      userId: donor.id,
      title: 'Donor Verification Approved',
      message: `Your blood group (${donor.bloodGroup}) verification has been reviewed and approved by ${bankName}. You are now cleared to donate!`,
      type: 'verification',
      priority: 'high',
      link: '/donor/dashboard'
    });

    db.saveSnapshot();
    await persistRecordDirect('donors', donor);

    return res.json({
      success: true,
      verificationStatus: 'Verified',
      message: `Donor ${donor.name} successfully verified by ${bankName}.`,
      donor: {
        id: donor.id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        verificationStatus: donor.verificationStatus,
        bloodGroupVerificationStatus: donor.bloodGroupVerificationStatus,
        isEligible: donor.isEligible,
        deferralReason: donor.deferralReason,
        verifiedAt: donor.verifiedAt,
        verifiedByName: donor.verifiedByName
      },
      eligibility: assessment
    });
  } else if (status === 'Needs More Info') {
    donor.bloodGroupVerificationStatus = 'Needs More Info';
    donor.verificationStatus = 'Needs More Info';
    donor.verifiedBy = bankId;
    donor.verifiedByName = bankName;
    donor.verificationDecisionAt = new Date().toISOString();
    donor.verificationNotes = notes || rejectionReason || 'Please provide clearer documentation or additional identification.';
    donor.rejectionReason = undefined;

    const assessment = syncDonorAuthoritativeEligibility(donor);

    // Notify donor via real-time SSE & persistent notification
    await notificationService.dispatchNotification({
      userId: donor.id,
      title: 'Additional Information Requested',
      message: `${bankName} has requested additional details to verify your donor profile: ${donor.verificationNotes}`,
      type: 'verification',
      priority: 'high',
      link: '/donor/profile'
    });

    db.saveSnapshot();
    await persistRecordDirect('donors', donor);

    return res.json({
      success: true,
      verificationStatus: 'Needs More Info',
      message: `Requested additional information from donor ${donor.name}.`,
      donor: {
        id: donor.id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        verificationStatus: donor.verificationStatus,
        bloodGroupVerificationStatus: donor.bloodGroupVerificationStatus,
        isEligible: donor.isEligible,
        deferralReason: donor.deferralReason,
        verificationNotes: donor.verificationNotes,
        verificationDecisionAt: donor.verificationDecisionAt,
        verifiedByName: donor.verifiedByName
      },
      eligibility: assessment
    });
  } else {
    // Rejected
    donor.bloodGroupVerificationStatus = 'Rejected';
    donor.verificationStatus = 'Rejected';
    donor.verifiedBy = bankId;
    donor.verifiedByName = bankName;
    donor.verifiedAt = new Date().toISOString();
    donor.verificationDecisionAt = donor.verifiedAt;
    donor.rejectionReason = rejectionReason || notes || 'Submitted documentation was insufficient or illegible.';
    donor.verificationNotes = undefined;

    const assessment = syncDonorAuthoritativeEligibility(donor);

    // Notify donor via real-time SSE & persistent notification
    await notificationService.dispatchNotification({
      userId: donor.id,
      title: 'Verification Incomplete / Document Rejected',
      message: `Your blood group verification document was rejected by ${bankName}. Reason: ${donor.rejectionReason}`,
      type: 'verification',
      priority: 'high',
      link: '/donor/profile'
    });

    db.saveSnapshot();
    await persistRecordDirect('donors', donor);

    return res.json({
      success: true,
      verificationStatus: 'Rejected',
      message: `Donor verification marked as Rejected: ${donor.rejectionReason}`,
      donor: {
        id: donor.id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        verificationStatus: donor.verificationStatus,
        bloodGroupVerificationStatus: donor.bloodGroupVerificationStatus,
        isEligible: donor.isEligible,
        deferralReason: donor.deferralReason,
        rejectionReason: donor.rejectionReason,
        verifiedAt: donor.verifiedAt,
        verifiedByName: donor.verifiedByName
      },
      eligibility: assessment
    });
  }
};

/**
 * Record Phlebotomy Blood Collection (In-House or Mobile Camp)
 */
export const recordBloodCollection = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const {
    donorId,
    collectionType,
    volumeMl,
    collectionDate,
    collectionTime,
    locationType,
    campId,
    phlebotomistName,
    notes,
    idempotencyKey
  } = req.body;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const existing = db.bloodCollections.find(c => c.idempotencyKey === idempotencyKey && c.bloodBankId === bankId);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Replaying cached collection record from idempotency key.',
        collectionRecord: existing,
        collection: existing,
        replayed: true
      });
    }
  }

  // 2. Validate Donor
  if (!donorId) {
    return res.status(400).json({ success: false, error: 'Donor identifier is required' });
  }
  const donor = db.donors.find(d => d.id === donorId);
  if (!donor) {
    return res.status(404).json({ success: false, error: `Donor ${donorId} not found in database.` });
  }

  // Validate Collection Date
  const colDate = collectionDate || new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  if (colDate > todayStr) {
    return res.status(422).json({ success: false, error: 'Collection date cannot be in the future.' });
  }

  // Authoritative medical eligibility & verification validation
  const eligibility = syncDonorAuthoritativeEligibility(donor);
  if (!eligibility.isVerified) {
    return res.status(422).json({
      success: false,
      error: `Donor ${donor.name} (${donor.id}) is not verified for blood donation. Donor verification must be completed prior to collection.`
    });
  }
  if (!eligibility.isEligible) {
    return res.status(422).json({
      success: false,
      error: `Donor ${donor.name} (${donor.id}) is deferred from blood donation. Reason: ${eligibility.deferralReason || 'Clinical cool-off window active'}`
    });
  }

  // Duplicate Submission Prevention (Same donor, same date within 5s or existing collection today)
  const dupKey = `${bankId}:${donor.id}:${colDate}`;
  const lastSubmitTime = recentCollectionSubmissions.get(dupKey);
  const nowMs = Date.now();
  const alreadyCollectedToday = db.bloodCollections.some(c => c.donorId === donor.id && c.collectionDate === colDate);
  if ((alreadyCollectedToday || (lastSubmitTime && (nowMs - lastSubmitTime < 5000))) && !idempotencyKey) {
    return res.status(409).json({
      success: false,
      error: `Duplicate collection prevented: A donation for donor ${donor.name} on ${colDate} was recently submitted.`
    });
  }
  recentCollectionSubmissions.set(dupKey, nowMs);

  // 3. Validate Volume
  const vol = Number(volumeMl);
  if (isNaN(vol) || vol <= 0) {
    return res.status(422).json({ success: false, error: 'Volume must be a valid positive number in mL.' });
  }
  const collType = collectionType || 'Whole Blood';
  if ((collType === 'Whole Blood' || collType === 'In-House Phlebotomy' || collType === 'Mobile Camp') && (vol < 300 || vol > 550)) {
    return res.status(422).json({ success: false, error: 'Standard whole blood collection volume must be between 300 mL and 550 mL.' });
  }
  if (vol > 650) {
    return res.status(422).json({ success: false, error: 'Recorded collection volume exceeds maximum clinical safety threshold (650 mL).' });
  }

  // 5. Validate Camp if provided
  let validatedCamp: DonationCamp | undefined;
  if (campId) {
    validatedCamp = db.donationCamps.find(c => c.id === campId && c.bloodBankId === bankId);
    if (!validatedCamp) {
      return res.status(400).json({ success: false, error: `Donation camp ${campId} not found for this facility.` });
    }
    if (validatedCamp.status === 'Cancelled') {
      return res.status(400).json({ success: false, error: `Cannot link collections to cancelled camp ${campId}.` });
    }
  }

  // 7. Create Collection Record
  let colId = `COL-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
  while (db.bloodCollections.some(c => c.id === colId)) {
    colId = `COL-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
  }
  const donorCode = `DON-${donor.id.replace('donor-', '')}`;
  const nowIso = new Date().toISOString();

  const newCollection: BloodCollectionRecord = {
    id: colId,
    bloodBankId: bankId,
    bloodBankName: bb?.bloodBankName || bb?.name || 'Regional Blood Center',
    donorId: donor.id,
    donorCode,
    donorName: donor.name,
    bloodGroup: donor.bloodGroup,
    collectionType: collType,
    volumeMl: vol,
    collectionDate: colDate,
    collectionTime: collectionTime || new Date().toTimeString().slice(0, 5),
    locationType: validatedCamp ? 'Mobile Camp' : (locationType || 'In-House Phlebotomy'),
    campId: validatedCamp?.id,
    campTitle: validatedCamp?.title,
    phlebotomistName: phlebotomistName ? phlebotomistName.trim() : (req.user?.name || 'Staff Phlebotomist'),
    status: 'Collected',
    fractionationStatus: 'Pending',
    notes,

    idempotencyKey,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  db.bloodCollections.unshift(newCollection);

  // Update donor profile history
  donor.lastDonationDate = colDate;
  donor.totalDonationsCount = (donor.totalDonationsCount || 0) + 1;
  donor.totalVolumeMl = (donor.totalVolumeMl || 0) + vol;

  // If camp linked, update camp actual count
  if (validatedCamp) {
    validatedCamp.registeredCount = (validatedCamp.registeredCount || 0) + 1;
  }

  // Creates initial testing record for mandatory quarantine screening
  const newTestingRecord: TestingRecord = {
    id: `TST-${Date.now()}`,
    unitId: colId,
    bloodBankId: bankId,
    bloodGroup: donor.bloodGroup,
    hivTest: 'Pending',
    hbvTest: 'Pending',
    hcvTest: 'Pending',
    syphilisTest: 'Pending',
    malariaTest: 'Pending',
    status: 'Pending',
    testedBy: req.user?.name || 'Lab Staff',
    testingDate: colDate,
    notes: `Initial mandatory disease screening queued for collection ${colId}.`
  };
  db.testingRecords.unshift(newTestingRecord);
  db.saveSnapshot();

  res.status(201).json({
    success: true,
    message: `Blood collection ${colId} recorded successfully. Quarantined for testing and component processing.`,
    collectionRecord: newCollection,
    collection: newCollection
  });
};


/**
 * Get Collections for Authenticated Blood Bank
 */
export const getBloodCollections = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { campId, fractionationStatus, status } = req.query;
  let collections = db.bloodCollections.filter(c => c.bloodBankId === bankId);

  if (campId) collections = collections.filter(c => c.campId === campId);
  if (fractionationStatus) collections = collections.filter(c => c.fractionationStatus === fractionationStatus);
  if (status) collections = collections.filter(c => c.status === status);

  res.json({
    success: true,
    count: collections.length,
    collections
  });
};

/**
 * Get Collection Record by ID
 */
export const getBloodCollectionById = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const collection = db.bloodCollections.find(c => c.id === id && c.bloodBankId === bankId);
  if (!collection) {
    return res.status(404).json({ success: false, error: `Collection record ${id} not found.` });
  }

  res.json({ success: true, collectionRecord: collection, collection });
};


/**
 * Get Donation Drives & Camps for Authenticated Blood Bank
 */
export const getBloodBankCamps = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const camps = db.donationCamps
    .filter(c => c.bloodBankId === bankId)
    .map(c => {
      const linkedCollections = db.bloodCollections.filter(col => col.campId === c.id);
      return {
        ...c,
        actualCollectedUnits: linkedCollections.length,
        status: c.status || 'Planned'
      };
    });

  res.json({ success: true, count: camps.length, camps });
};

/**
 * Get Camp Details by ID
 */
export const getBloodBankCampById = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const camp = db.donationCamps.find(c => c.id === id);
  if (!camp) {
    return res.status(404).json({ success: false, error: `Camp ${id} not found.` });
  }
  if (camp.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Cannot access a donation drive registered to another blood bank facility.' });
  }

  const linkedCollections = db.bloodCollections.filter(col => col.campId === camp.id);
  res.json({
    success: true,
    camp: {
      ...camp,
      actualCollectedUnits: linkedCollections.length,
      status: camp.status || 'Planned'
    }
  });
};

/**
 * Create a New Mobile Donation Camp
 */
export const createBloodBankCamp = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const {
    title,
    location,
    city,
    address,
    startDate,
    endDate,
    timeSlot,
    targetUnits,
    contactPhone,
    organizer,
    targetBloodGroups,
    description,
    isUrgent
  } = req.body;

  if (!title || !location || !startDate || !targetUnits || !contactPhone) {
    return res.status(400).json({ 
      success: false, 
      error: 'Title, location, start date, target units, and contact phone are required.' 
    });
  }

  const target = Number(targetUnits);
  if (isNaN(target) || target <= 0) {
    return res.status(400).json({ success: false, error: 'Target collection count must be a positive integer.' });
  }

  if (endDate && endDate < startDate) {
    return res.status(400).json({ success: false, error: 'End date cannot precede start date.' });
  }

  const campId = `CAMP-${Date.now()}`;
  const campCity = city || bb?.city || '';
  const newCamp: DonationCamp = {
    id: campId,
    title,
    organizer: organizer || bb?.bloodBankName || bb?.name || '',
    bloodBankId: bankId,
    location,
    city: campCity,
    address: address || location,
    startDate,
    endDate: endDate || startDate,
    timeSlot: timeSlot || '',
    targetUnits: target,
    registeredCount: 0,
    targetBloodGroups,
    contactPhone,
    description: description || 'Community voluntary blood donation mobilization drive.',
    isUrgent: Boolean(isUrgent),
    status: 'Active',
    isDevFixture: false
  };

  db.donationCamps.push(newCamp);
  db.saveSnapshot();

  res.status(201).json({
    success: true,
    message: `Donation camp '${title}' created successfully.`,
    camp: { ...newCamp, actualCollectedUnits: 0 }
  });
};

/**
 * Update / Edit Mobile Donation Camp
 */
export const updateBloodBankCamp = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const camp = db.donationCamps.find(c => c.id === id);
  if (!camp) {
    return res.status(404).json({ success: false, error: `Camp ${id} not found.` });
  }
  if (camp.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Cannot modify a donation drive registered to another blood bank facility.' });
  }

  if (camp.status === 'Cancelled' || camp.status === 'Completed') {
    return res.status(400).json({ success: false, error: `Cannot modify a camp with status '${camp.status}'.` });
  }

  const { title, location, city, address, startDate, endDate, timeSlot, targetUnits, contactPhone, description, isUrgent, status } = req.body;

  if (targetUnits !== undefined) {
    const target = Number(targetUnits);
    if (isNaN(target) || target <= 0) {
      return res.status(400).json({ success: false, error: 'Target units must be a positive integer.' });
    }
    camp.targetUnits = target;
  }

  if (startDate && endDate && endDate < startDate) {
    return res.status(400).json({ success: false, error: 'End date cannot precede start date.' });
  }

  if (title) camp.title = title;
  if (location) camp.location = location;
  if (city) camp.city = city;
  if (address) camp.address = address;
  if (startDate) camp.startDate = startDate;
  if (endDate) camp.endDate = endDate;
  if (timeSlot) camp.timeSlot = timeSlot;
  if (contactPhone) camp.contactPhone = contactPhone;
  if (description !== undefined) camp.description = description;
  if (isUrgent !== undefined) camp.isUrgent = Boolean(isUrgent);
  if (status && ['Planned', 'Active', 'Completed', 'Cancelled'].includes(status)) {
    camp.status = status;
  }

  const linkedCollections = db.bloodCollections.filter(col => col.campId === camp.id);

  res.json({
    success: true,
    message: `Camp ${camp.id} updated successfully.`,
    camp: { ...camp, actualCollectedUnits: linkedCollections.length }
  });
};

/**
 * Cancel a Mobile Donation Camp
 */
export const cancelBloodBankCamp = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const camp = db.donationCamps.find(c => c.id === id);
  if (!camp) {
    return res.status(404).json({ success: false, error: `Camp ${id} not found.` });
  }
  if (camp.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Cannot cancel a donation drive registered to another blood bank facility.' });
  }

  if (camp.status === 'Cancelled') {
    return res.status(400).json({ success: false, error: 'Camp is already cancelled.' });
  }

  camp.status = 'Cancelled';
  res.json({
    success: true,
    message: `Camp '${camp.title}' cancelled.`,
    camp
  });
};

/**
 * Get All Collections Linked to a Specific Camp
 */
export const getCampCollections = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const camp = db.donationCamps.find(c => c.id === id);
  if (!camp) {
    return res.status(404).json({ success: false, error: `Camp ${id} not found.` });
  }
  if (camp.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Cannot view collections for a camp registered to another blood bank facility.' });
  }

  const collections = db.bloodCollections.filter(c => c.campId === camp.id && c.bloodBankId === bankId);
  res.json({
    success: true,
    campTitle: camp.title,
    targetUnits: camp.targetUnits,
    actualCollectedUnits: collections.length,
    collections
  });
};


/**
 * Get Component Fractionation Batches
 */
export const getFractionationRecords = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const records = db.fractionationRecords.filter(f => f.bloodBankId === bankId);
  res.json({ success: true, count: records.length, records });
};

/**
 * Get Collections Ready for Component Fractionation
 */
export const getPendingFractionationCollections = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const collections = db.bloodCollections.filter(c => 
    c.bloodBankId === bankId && 
    c.fractionationStatus === 'Pending' &&
    (c.status === 'Collected' || c.status === 'Testing Quarantine')
  );

  res.json({ success: true, count: collections.length, collections });
};

/**
 * Process Traceable Component Fractionation
 */
export const processFractionation = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const sourceCollectionId = req.body.sourceCollectionId || req.body.collectionId;
  const { operatorName, method, components, notes } = req.body;

  if (!sourceCollectionId) {
    return res.status(400).json({ success: false, error: 'Source collection ID is required.' });
  }

  // Concurrency guard
  if (activeFractionationLocks.has(sourceCollectionId)) {
    return res.status(409).json({ success: false, error: 'Fractionation already in progress for this collection.' });
  }

  try {
    activeFractionationLocks.add(sourceCollectionId);

    const collection = db.bloodCollections.find(c => c.id === sourceCollectionId && c.bloodBankId === bankId);
    if (!collection) {
      return res.status(404).json({ success: false, error: `Collection ${sourceCollectionId} not found.` });
    }

    // Double-processing prevention
    if (collection.fractionationStatus === 'Fractionated') {
      return res.status(409).json({
        success: false,
        error: `Double Fractionation Prevented: Collection ${sourceCollectionId} has already been fractionated under batch ${collection.fractionationBatchId}.`
      });
    }

    if (collection.status !== 'Collected' && collection.status !== 'Testing Quarantine') {
      return res.status(400).json({
        success: false,
        error: `Collection ${sourceCollectionId} cannot be fractionated with status '${collection.status}'.`
      });
    }

    // Validate components array
    if (!components || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one measured component specification must be provided.'
      });
    }

    const validComponents: BloodComponent[] = ['RBC', 'Plasma', 'Platelets'];
    let totalOutputVolume = 0;

    for (const comp of components) {
      if (!validComponents.includes(comp.component)) {
        return res.status(400).json({
          success: false,
          error: `Invalid component type '${comp.component}'. Must be RBC, Plasma, or Platelets.`
        });
      }
      const v = Number(comp.volumeMl);
      if (isNaN(v) || v <= 0) {
        return res.status(400).json({
          success: false,
          error: `Component volume for ${comp.component} must be a positive number.`
        });
      }
      totalOutputVolume += v;
    }

    // Sanity check on volume (output volume cannot exceed collection volume by more than 15% anticoagulant tolerance)
    if (totalOutputVolume > collection.volumeMl * 1.15) {
      return res.status(422).json({
        success: false,
        error: `Total separated volume (${totalOutputVolume} mL) exceeds source collection volume (${collection.volumeMl} mL) beyond allowable margin.`
      });
    }

    let batchId = `FRAC-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    while (db.fractionationRecords.some(f => f.id === batchId)) {
      batchId = `FRAC-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    }
    const nowIso = new Date().toISOString();

    const producedUnits: BloodUnit[] = [];
    const producedMeta: any[] = [];

    // Calculate shelf lives from collection date
    const colDate = collection.collectionDate;
    const colObj = new Date(colDate);

    for (const comp of components) {
      let unitId = `UNIT-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
      while (db.bloodUnits.some(u => u.id === unitId) || producedUnits.some(u => u.id === unitId)) {
        unitId = `UNIT-2026-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
      }
      let shelfDays = 42;
      if (comp.component === 'Plasma') shelfDays = 365;
      if (comp.component === 'Platelets') shelfDays = 5;

      const expObj = new Date(colObj.getTime() + shelfDays * 24 * 60 * 60 * 1000);
      const expiryDate = expObj.toISOString().split('T')[0];

      const newUnit: BloodUnit = {
        id: unitId,
        bloodBankId: bankId,
        bloodBankName: bb?.bloodBankName || bb?.name || 'Regional Blood Center',
        donorId: collection.donorId,
        donorCode: collection.donorCode,
        bloodGroup: collection.bloodGroup,
        component: comp.component,
        volumeMl: Number(comp.volumeMl),
        collectionDate: colDate,
        expiryDate,
        testingStatus: 'Quarantined',
        availability: 'Quarantined', // Always Quarantined until lab screening clears it!
        storageLocation: comp.storageLocation || `${comp.component} Quarantine Bay`,
        source: collection.locationType === 'Mobile Camp' ? 'Donation Camp' : 'Voluntary Donation',
        sourceCollectionId: collection.id,
        fractionationBatchId: batchId,
        notes: `Produced via ${method || 'Centrifugation'} from collection ${collection.id}`,
        createdAt: nowIso
      };

      producedUnits.push(newUnit);
      producedMeta.push({
        unitId,
        component: comp.component,
        volumeMl: Number(comp.volumeMl),
        storageLocation: newUnit.storageLocation,
        testingStatus: 'Quarantined',
        availability: 'Quarantined'
      });

      // Insert into inventory
      db.bloodUnits.unshift(newUnit);

      // Create matching disease testing record
      db.testingRecords.unshift({
        id: `TST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        unitId,
        bloodBankId: bankId,
        bloodGroup: collection.bloodGroup,
        hivTest: 'Pending',
        hbvTest: 'Pending',
        hcvTest: 'Pending',
        syphilisTest: 'Pending',
        malariaTest: 'Pending',
        status: 'Quarantined',
        testedBy: operatorName || req.user?.name || 'Lab Staff',
        testingDate: colDate,
        notes: `Fractionated component unit ${unitId} (${comp.component}) queued for mandatory screening.`
      });
    }


    // Create ComponentFractionationRecord
    const fracRecord: ComponentFractionationRecord = {
      id: batchId,
      sourceCollectionId: collection.id,
      bloodBankId: bankId,
      donorId: collection.donorId,
      bloodGroup: collection.bloodGroup,
      processedAt: nowIso,
      operatorName: operatorName || req.user?.name || 'Lab Technician',
      method: method || 'Centrifugation',
      inputVolumeMl: collection.volumeMl,
      producedComponents: producedMeta,
      notes,
      createdAt: nowIso
    };

    db.fractionationRecords.unshift(fracRecord);

    // Update source collection state
    collection.fractionationStatus = 'Fractionated';
    collection.fractionationBatchId = batchId;
    collection.status = 'Fractionated';
    collection.updatedAt = nowIso;
    db.saveSnapshot();

    res.status(201).json({
      success: true,
      message: `Collection ${collection.id} successfully fractionated into ${producedUnits.length} components under batch ${batchId}.`,
      fractionationRecord: fracRecord,
      batch: fracRecord,
      collection,
      createdUnits: producedUnits,
      units: producedUnits
    });

  } finally {
    activeFractionationLocks.delete(sourceCollectionId);
  }
};

/**
 * Expiry Risk Monitoring API
 */
export const getExpiryMonitoring = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const units = db.bloodUnits.filter(u => u.bloodBankId === bankId);

  const expiringToday: any[] = [];
  const expiringWithin3Days: any[] = [];
  const expiringWithin7Days: any[] = [];
  const expiringWithin30Days: any[] = [];
  const expiredUnits: any[] = [];

  units.forEach(u => {
    const days = calculateDaysRemaining(u.expiryDate);
    const unitWithDays = { ...u, daysRemaining: days };

    if (days < 0 || u.expiryDate < todayStr) {
      if (u.availability !== 'Issued') {
        u.availability = 'Expired';
        expiredUnits.push(unitWithDays);
      }
    } else if (days === 0) {
      if (u.availability === 'Available') expiringToday.push(unitWithDays);
    } else if (days <= 3) {
      if (u.availability === 'Available') expiringWithin3Days.push(unitWithDays);
    } else if (days <= 7) {
      if (u.availability === 'Available') expiringWithin7Days.push(unitWithDays);
    } else if (days <= 30) {
      if (u.availability === 'Available') expiringWithin30Days.push(unitWithDays);
    }
  });

  const recommendations = [
    {
      title: 'Prioritize Short-Shelf-Life Platelets (FEFO)',
      text: 'Platelet units have a 5-day maximum shelf life. Prioritize allocation to active hospital hematology-oncology requests using FEFO.'
    },
    {
      title: 'Consider Inter-Hospital Redistribution',
      text: 'Transfer units expiring within 3 days to high-volume trauma centers with immediate clinical utilization capacity.'
    },
    {
      title: 'Targeted Voluntary Campaign Adjustment',
      text: 'Schedule whole blood collection campaigns to maintain steady rolling reserves rather than single-day batch collections.'
    }
  ];

  res.json({
    success: true,
    summary: {
      expiringTodayCount: expiringToday.length,
      expiring3DaysCount: expiringWithin3Days.length,
      expiring7DaysCount: expiringWithin7Days.length,
      expiring30DaysCount: expiringWithin30Days.length,
      expiredCount: expiredUnits.length
    },
    expiringToday,
    expiringWithin3Days,
    expiringWithin7Days,
    expiringWithin30Days,
    expiredUnits,
    recommendations,
    disclaimer: 'LifeLink expiry recommendations support clinical decision-making. Redistribution and transfusion suitability require formal laboratory approval.'
  });
};

/**
 * Fulfill / Process Hospital Requisition Actions
 */
export const fulfillHospitalRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const { action, unitIds, notes } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  if (request.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center.' });
  }

  if (action === 'reserve') {
    if (unitIds && Array.isArray(unitIds)) {
      for (const uId of unitIds) {
        const u = db.bloodUnits.find(unit => unit.id === uId);
        if (!u) {
          return res.status(404).json({ success: false, error: `Blood unit ${uId} not found.` });
        }
        if (u.bloodBankId !== bankId) {
          return res.status(403).json({ success: false, error: `Unit ${uId} does not belong to your blood bank.` });
        }
        if (u.availability !== 'Available') {
          return res.status(409).json({
            success: false,
            error: `Double Reservation Prevented: Blood Unit ${uId} is no longer available (Current Status: ${u.availability}).`,
            unitId: uId,
            currentStatus: u.availability
          });
        }
      }

      unitIds.forEach(uId => {
        const u = db.bloodUnits.find(unit => unit.id === uId);
        if (u) {
          u.availability = 'Reserved';
          u.reservedForRequestId = request.id;
        }
      });
      request.assignedUnitIds = unitIds;
    } else {
      // FEFO Auto-Reserve
      const eligibleUnits = db.bloodUnits.filter(u => 
        u.bloodBankId === bankId &&
        u.bloodGroup === request.bloodGroup && 
        u.component === request.component && 
        u.availability === 'Available' && 
        u.testingStatus === 'Passed' &&
        calculateDaysRemaining(u.expiryDate) >= 0
      );

      eligibleUnits.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      const needed = request.quantityUnits - (request.fulfilledUnits || 0);
      const selected = eligibleUnits.slice(0, needed);

      if (selected.length === 0) {
        return res.status(400).json({
          success: false,
          error: `No eligible available FEFO units found for ${request.bloodGroup} ${request.component}.`
        });
      }

      const assigned = selected.map(u => {
        u.availability = 'Reserved';
        u.reservedForRequestId = request.id;
        return u.id;
      });

      request.assignedUnitIds = [...(request.assignedUnitIds || []), ...assigned];
    }

    request.status = 'Reserved';
    request.timeline.push({
      status: 'Reserved',
      updatedAt: new Date().toISOString(),
      note: notes || 'FEFO units reserved in blood bank inventory for patient cross-matching.',
      actor: req.user?.name || 'Blood Bank Manager'
    });
  } else if (action === 'issue') {
    if (request.assignedUnitIds && request.assignedUnitIds.length > 0) {
      request.assignedUnitIds.forEach(uId => {
        const u = db.bloodUnits.find(unit => unit.id === uId);
        if (u && u.bloodBankId === bankId) u.availability = 'Issued';
      });
    } else {
      const eligibleUnits = db.bloodUnits.filter(u => 
        u.bloodBankId === bankId &&
        u.bloodGroup === request.bloodGroup && 
        u.component === request.component && 
        (u.availability === 'Available' || u.availability === 'Reserved') && 
        u.testingStatus === 'Passed'
      );
      eligibleUnits.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      const selected = eligibleUnits.slice(0, request.quantityUnits);
      selected.forEach(u => u.availability = 'Issued');
      request.assignedUnitIds = selected.map(u => u.id);
    }

    request.status = 'Issued';
    request.fulfilledUnits = request.quantityUnits;
    request.timeline.push({
      status: 'Issued',
      updatedAt: new Date().toISOString(),
      note: notes || 'FEFO Units issued and handed over to hospital cold-chain transport.',
      actor: req.user?.name || 'Blood Bank Dispatch'
    });
  } else if (action === 'fulfill') {
    request.status = 'Fulfilled';
    request.fulfilledUnits = request.quantityUnits;
    request.timeline.push({
      status: 'Fulfilled',
      updatedAt: new Date().toISOString(),
      note: notes || 'Hospital confirmed receipt and successful transfusion handover.',
      actor: req.user?.name || 'Blood Bank System'
    });
  } else if (action === 'release' || action === 'cancel') {
    if (request.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Requisition is already cancelled. Duplicate release prevented.'
      });
    }
    if (request.status === 'Fulfilled' || request.status === 'Issued') {
      return res.status(400).json({
        success: false,
        error: `Cannot release reservation for a requisition with status '${request.status}'.`
      });
    }

    if (Array.isArray(request.assignedUnitIds)) {
      request.assignedUnitIds.forEach(uId => {
        const u = db.bloodUnits.find(unit => unit.id === uId);
        if (u && u.bloodBankId === bankId && u.availability === 'Reserved' && u.reservedForRequestId === request.id) {
          u.availability = 'Available';
          u.reservedForRequestId = undefined;
        }
      });
      request.assignedUnitIds = [];
    }

    request.status = 'Cancelled';
    request.timeline.push({
      status: 'Cancelled',
      updatedAt: new Date().toISOString(),
      note: notes || 'Reservation released and units returned to regional available inventory.',
      actor: req.user?.name || 'Blood Bank Manager'
    });
  }

  request.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: `Request status updated to ${request.status}`,
    request
  });
};

/**
 * ============================================================================
 * Phase 5D: Hospital Fulfillment, Barcode Assignment, Dispatch & Matrix
 * ============================================================================
 */

// Authoritative Clinical Compatibility Maps
const RBC_DONOR_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+']
};

const PLASMA_DONOR_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'AB-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A+', 'A-', 'O+', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B+', 'B-', 'O+', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O+', 'O-']
};

export const checkClinicalCompatibility = (
  donorBloodGroup: BloodGroup,
  recipientBloodGroup: BloodGroup,
  component: BloodComponent
): { isCompatible: boolean; message: string } => {
  const comp = (component || 'RBC').toUpperCase();
  if (comp === 'PLASMA' || comp === 'PLATELETS') {
    const allowed = PLASMA_DONOR_COMPATIBILITY[donorBloodGroup];
    const isMatch = allowed ? allowed.includes(recipientBloodGroup) : false;
    return {
      isCompatible: isMatch,
      message: isMatch
        ? `Compatible donor (${donorBloodGroup}) for patient (${recipientBloodGroup} ${component}).`
        : `Clinically INCOMPATIBLE: ${donorBloodGroup} ${component} cannot be given to ${recipientBloodGroup}.`
    };
  }

  const allowed = RBC_DONOR_COMPATIBILITY[donorBloodGroup];
  const isMatch = allowed ? allowed.includes(recipientBloodGroup) : false;
  return {
    isCompatible: isMatch,
    message: isMatch
      ? `Compatible red cells (${donorBloodGroup}) for patient (${recipientBloodGroup}).`
      : `Clinically INCOMPATIBLE: ${donorBloodGroup} red cells cannot be given to ${recipientBloodGroup}.`
  };
};

/**
 * 1. Get Blood Bank Hospital Requisitions Queue (Filterable & Searchable)
 */
export const getBloodBankRequests = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood center' });
  }

  const { status, urgency, hospitalId, component, bloodGroup, tab, search } = req.query;

  // Filter requests strictly assigned to this blood bank or routed to this blood bank via an offer (multi-tenant isolation)
  let requests = db.bloodRequests.filter(r => 
    r.bloodBankId === bankId || (r.routedBankOffers || []).some(o => o.bloodBankId === bankId)
  );

  // Tab filtering
  if (tab === 'offers' || tab === 'routed' || tab === 'incoming') {
    requests = requests.filter(r => (r.routedBankOffers || []).some(o => o.bloodBankId === bankId && o.status === 'Offered'));
  } else if (tab === 'active') {
    requests = requests.filter(r => r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected');
  } else if (tab === 'emergency') {
    requests = requests.filter(r => r.urgency === 'Emergency' && r.status !== 'Fulfilled' && r.status !== 'Cancelled');
  } else if (tab === 'reserved') {
    requests = requests.filter(r => r.status === 'Reserved' || r.status === 'Allocated');
  } else if (tab === 'prepared') {
    requests = requests.filter(r => r.status === 'Prepared for Dispatch');
  } else if (tab === 'dispatched') {
    requests = requests.filter(r => r.status === 'Dispatched' || r.status === 'Issued');
  } else if (tab === 'fulfilled') {
    requests = requests.filter(r => r.status === 'Fulfilled' || r.status === 'Received');
  }

  if (status && typeof status === 'string' && status !== 'all') {
    requests = requests.filter(r => r.status.toLowerCase() === status.toLowerCase());
  }

  if (urgency && typeof urgency === 'string' && urgency !== 'all') {
    requests = requests.filter(r => r.urgency.toLowerCase() === urgency.toLowerCase());
  }

  if (hospitalId && typeof hospitalId === 'string' && hospitalId !== 'all') {
    requests = requests.filter(r => r.hospitalId === hospitalId);
  }

  if (component && typeof component === 'string' && component !== 'all') {
    requests = requests.filter(r => r.component.toLowerCase() === component.toLowerCase());
  }

  if (bloodGroup && typeof bloodGroup === 'string' && bloodGroup !== 'all') {
    requests = requests.filter(r => r.bloodGroup === bloodGroup);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    requests = requests.filter(r => 
      r.id.toLowerCase().includes(q) ||
      r.hospitalName.toLowerCase().includes(q) ||
      r.patientReferenceId.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  }

  // Sort by urgency priority (Emergency -> Urgent -> Routine), then newest
  const urgencyWeight: Record<string, number> = { Emergency: 3, Urgent: 2, Routine: 1 };
  requests.sort((a, b) => {
    const wDiff = (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0);
    if (wDiff !== 0) return wDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const enriched = requests.map(r => {
    const remainingNeeded = Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0));
    const allocatedUnitsCount = r.assignedUnitIds?.length || 0;
    const linkedDispatch = db.bloodDispatches.find(d => d.requestId === r.id);
    const myOffer = (r.routedBankOffers || []).find(o => o.bloodBankId === bankId);
    return {
      ...r,
      remainingNeeded,
      allocatedUnitsCount,
      linkedDispatch: linkedDispatch || null,
      myOffer: myOffer || null
    };
  });

  res.json({
    success: true,
    count: enriched.length,
    requests: enriched
  });
};

/**
 * Get dedicated routed requests / offers queue for authenticated blood bank
 */
export const getBloodBankOffers = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood center' });
  }

  const { status, urgency } = req.query;

  // Find all requests with offers addressed to this bank
  const matchingOffers: any[] = [];
  const nowMs = Date.now();

  for (const r of db.bloodRequests) {
    const offer = (r.routedBankOffers || []).find(o => o.bloodBankId === bankId);
    if (!offer) continue;

    if (status && typeof status === 'string' && status !== 'all') {
      if (offer.status.toLowerCase() !== status.toLowerCase()) continue;
    }

    if (urgency && typeof urgency === 'string' && urgency !== 'all') {
      if (r.urgency.toLowerCase() !== urgency.toLowerCase()) continue;
    }

    // Auto-mark expired if past deadline and still 'Offered'
    if (offer.status === 'Offered' && new Date(offer.expiresAt).getTime() < nowMs) {
      offer.status = 'Expired';
      offer.respondedAt = new Date().toISOString();
    }

    // Live eligible units owned by this bank
    const eligibleUnits = smartRoutingService.getEligibleStockForBank(bankId, r.bloodGroup, r.component, r.id);

    const msRemaining = Math.max(0, new Date(offer.expiresAt).getTime() - nowMs);
    const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));

    matchingOffers.push({
      offerId: offer.id,
      requestId: r.id,
      status: offer.status,
      urgency: r.urgency,
      hospitalId: r.hospitalId,
      hospitalName: r.hospitalName,
      bloodGroup: r.bloodGroup,
      component: r.component,
      quantityRequested: r.quantityUnits,
      fulfilledUnits: r.fulfilledUnits || 0,
      remainingUnitsNeeded: r.remainingUnitsToFulfill ?? Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0)),
      offeredUnits: offer.offeredUnits,
      acceptedUnits: offer.acceptedUnits,
      distanceKm: offer.distanceKm,
      availableStockCount: eligibleUnits.length,
      eligibleUnits: eligibleUnits.map(u => ({
        id: u.id,
        bloodGroup: u.bloodGroup,
        component: u.component,
        expiryDate: u.expiryDate,
        storageLocation: u.storageLocation,
        testingStatus: u.testingStatus,
        availability: u.availability
      })),
      expiresAt: offer.expiresAt,
      minutesRemaining,
      respondedAt: offer.respondedAt,
      declineReason: offer.declineReason,
      notes: offer.notes,
      createdAt: offer.createdAt,
      requiredByDate: r.requiredByDate,
      department: r.department
    });
  }

  // Sort: Offered first, then by urgency (Emergency > Urgent > Routine), then closest expiry
  const urgencyWeight: Record<string, number> = { Emergency: 3, Urgent: 2, Routine: 1 };
  matchingOffers.sort((a, b) => {
    if (a.status === 'Offered' && b.status !== 'Offered') return -1;
    if (a.status !== 'Offered' && b.status === 'Offered') return 1;

    const wDiff = (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0);
    if (wDiff !== 0) return wDiff;

    return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
  });

  res.json({
    success: true,
    count: matchingOffers.length,
    offers: matchingOffers
  });
};

/**
 * Blood Bank responds to an offer: Accept, Decline, or Partial
 */
export const respondToBloodBankOffer = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood center' });
  }

  const { id } = req.params; // offerId or requestId
  const { action, quantityUnits, reason, notes } = req.body;

  if (!action || !['Accept', 'Decline', 'Partial'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: "Invalid action. Must be 'Accept', 'Decline', or 'Partial'."
    });
  }

  // Locate the requisition and offer
  let targetRequest: any = null;
  let targetOffer: any = null;

  for (const r of db.bloodRequests) {
    const found = (r.routedBankOffers || []).find(o => o.id === id || (r.id === id && o.bloodBankId === bankId));
    if (found) {
      targetRequest = r;
      targetOffer = found;
      break;
    }
  }

  if (!targetRequest || !targetOffer) {
    return res.status(404).json({ success: false, error: `Routing offer ${id} not found.` });
  }

  // Tenant Isolation: Only the target blood bank may respond
  if (targetOffer.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Unauthorized facility. This routing offer belongs to another blood center.' });
  }

  try {
    const actorName = req.user?.name || bb?.bloodBankName || 'Blood Bank Staff';
    const result = await smartRoutingService.handleOfferResponse(
      targetRequest.id,
      targetOffer.id,
      bankId,
      action as 'Accept' | 'Decline' | 'Partial',
      quantityUnits,
      reason,
      actorName
    );

    res.json({
      success: true,
      message: result.message,
      committedUnits: result.committedUnits,
      remainingUnits: result.remainingUnits,
      remainingNeeded: result.remainingUnits,
      offer: result.offer,
      request: result.request
    });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('already') || err.message.includes('fulfilled') ? 409 : 400;
    return res.status(status).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * 2. Get Single Blood Bank Requisition by ID (with enriched assigned units & dispatch)
 */
export const getBloodBankRequestById = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const request = db.bloodRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  const isAssigned = request.bloodBankId === bankId;
  const hasOffer = (request.routedBankOffers || []).some(o => o.bloodBankId === bankId);

  if (!isAssigned && !hasOffer) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  const assignedUnits = (request.assignedUnitIds || []).map(uId => {
    return db.bloodUnits.find(u => u.id === uId) || null;
  }).filter(Boolean);

  const linkedDispatch = db.bloodDispatches.find(d => d.requestId === request.id) || null;
  const remainingNeeded = Math.max(0, request.quantityUnits - (request.fulfilledUnits || 0));
  const myOffer = (request.routedBankOffers || []).find(o => o.bloodBankId === bankId) || null;

  res.json({
    success: true,
    request: {
      ...request,
      remainingNeeded,
      allocatedUnitsCount: assignedUnits.length,
      linkedDispatch,
      myOffer
    },
    assignedUnits,
    dispatch: linkedDispatch
  });
};

/**
 * 3. Get Authoritative Eligible Units for Requisition (FEFO + Clinical Compatibility)
 */
export const getEligibleUnitsForRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const request = db.bloodRequests.find(r => r.id === id);

  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  const isAssigned = request.bloodBankId === bankId;
  const hasOffer = (request.routedBankOffers || []).some(o => o.bloodBankId === bankId);

  if (!isAssigned && !hasOffer) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  const remainingNeeded = Math.max(0, request.quantityUnits - (request.fulfilledUnits || 0));

  // Find bank inventory that is:
  // - Belongs to this blood bank
  // - Matches component
  // - Testing Passed
  // - Unexpired
  // - Available OR already reserved for this exact request
  const eligibleUnits = db.bloodUnits
    .filter(u => 
      u.bloodBankId === bankId &&
      u.component === request.component &&
      u.testingStatus === 'Passed' &&
      calculateDaysRemaining(u.expiryDate) >= 0 &&
      (u.availability === 'Available' || (u.availability === 'Reserved' && u.reservedForRequestId === request.id))
    )
    .map(u => {
      const compat = checkClinicalCompatibility(u.bloodGroup, request.bloodGroup, request.component);
      const daysToExpiry = calculateDaysRemaining(u.expiryDate);
      return {
        ...u,
        isCompatible: compat.isCompatible,
        compatibilityReason: compat.message,
        daysToExpiry,
        isCurrentlyAssigned: (request.assignedUnitIds || []).includes(u.id)
      };
    })
    .filter(u => u.isCompatible);

  // Sort FEFO (earliest expiry first)
  eligibleUnits.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  // Comprehensive Inventory Breakdown for Diagnostic Reporting
  const bankComponentUnits = db.bloodUnits.filter(u => u.bloodBankId === bankId && u.component === request.component);
  const pendingTestingUnits = bankComponentUnits.filter(u => 
    (u.testingStatus === 'Pending' || u.testingStatus === 'In Testing' || u.availability === 'Quarantined') &&
    checkClinicalCompatibility(u.bloodGroup, request.bloodGroup, request.component).isCompatible &&
    calculateDaysRemaining(u.expiryDate) >= 0
  );
  const expiredUnits = bankComponentUnits.filter(u => 
    calculateDaysRemaining(u.expiryDate) < 0 &&
    checkClinicalCompatibility(u.bloodGroup, request.bloodGroup, request.component).isCompatible
  );
  const reservedOtherUnits = bankComponentUnits.filter(u => 
    u.availability === 'Reserved' && u.reservedForRequestId !== request.id &&
    checkClinicalCompatibility(u.bloodGroup, request.bloodGroup, request.component).isCompatible
  );
  const incompatibleUnits = bankComponentUnits.filter(u => 
    !checkClinicalCompatibility(u.bloodGroup, request.bloodGroup, request.component).isCompatible
  );

  let explanation: string;
  if (eligibleUnits.length > 0) {
    explanation = `${eligibleUnits.length} released FEFO unit(s) available for immediate allocation.`;
  } else if (pendingTestingUnits.length > 0) {
    explanation = `${pendingTestingUnits.length} unit(s) of ${request.bloodGroup} ${request.component} exist in stock but are in Laboratory Quarantine awaiting viral screening clearance. Complete testing to release units to inventory.`;
  } else if (reservedOtherUnits.length > 0) {
    explanation = `All matching units (${reservedOtherUnits.length}) are currently reserved for other hospital requisitions.`;
  } else if (expiredUnits.length > 0) {
    explanation = `${expiredUnits.length} matching unit(s) in inventory have expired.`;
  } else {
    explanation = `Zero stock available for ${request.bloodGroup} ${request.component} at this blood center.`;
  }

  res.json({
    success: true,
    request: {
      id: request.id,
      hospitalName: request.hospitalName,
      patientReferenceId: request.patientReferenceId,
      bloodGroup: request.bloodGroup,
      component: request.component,
      quantityUnits: request.quantityUnits,
      fulfilledUnits: request.fulfilledUnits || 0,
      remainingNeeded,
      status: request.status
    },
    count: eligibleUnits.length,
    units: eligibleUnits,
    diagnostics: {
      totalComponentInBank: bankComponentUnits.length,
      pendingTestingCount: pendingTestingUnits.length,
      pendingTestingUnits: pendingTestingUnits.map(u => ({
        id: u.id,
        bloodGroup: u.bloodGroup,
        testingStatus: u.testingStatus,
        availability: u.availability,
        collectionDate: u.collectionDate,
        expiryDate: u.expiryDate
      })),
      expiredCount: expiredUnits.length,
      reservedOtherCount: reservedOtherUnits.length,
      incompatibleCount: incompatibleUnits.length,
      explanation
    }
  });
};

/**
 * 4. Allocate Units / Barcode Assignment to Requisition (Atomic & Concurrency-Safe)
 */
export const allocateUnitsToRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const { unitIds, notes } = req.body;

  if (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one unit ID or barcode is required for allocation.' });
  }

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  // Prevent allocation to inactive / ineligible requests
  const ineligibleStatuses = ['Cancelled', 'Rejected', 'Fulfilled', 'Dispatched', 'Issued'];
  if (ineligibleStatuses.includes(request.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot allocate units to requisition in '${request.status}' status.`
    });
  }

  const unitsAllocatedByOtherBanks = (request.assignedUnitIds || []).filter(id => {
    if (unitIds.includes(id)) return false;
    const u = db.bloodUnits.find(unit => unit.id === id);
    return u && u.bloodBankId !== bankId;
  }).length;
  const availableToAllocate = Math.max(0, request.quantityUnits - unitsAllocatedByOtherBanks);
  if (unitIds.length > availableToAllocate) {
    return res.status(400).json({
      success: false,
      error: `Allocation quantity (${unitIds.length}) exceeds remaining available capacity (${availableToAllocate} unit(s)).`
    });
  }

  // Deduplicate submitted unitIds to avoid accidental duplicate inputs in same payload
  const uniqueUnitIds = [...new Set(unitIds)];
  if (uniqueUnitIds.length !== unitIds.length) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate barcode / unit ID submitted in the allocation payload.'
    });
  }

  // Server-side atomic validation of every requested unit
  for (const uId of uniqueUnitIds) {
    const u = db.bloodUnits.find(unit => unit.id === uId);
    if (!u) {
      return res.status(404).json({ success: false, error: `Blood unit ${uId} not found in regional registry.` });
    }

    if (u.bloodBankId !== bankId) {
      return res.status(403).json({ success: false, error: `Blood unit ${uId} does not belong to your blood center.` });
    }

    if (u.testingStatus !== 'Passed') {
      return res.status(400).json({
        success: false,
        error: `Blood unit ${uId} cannot be allocated: Testing status is '${u.testingStatus}', not 'Passed'.`,
        unitId: uId,
        testingStatus: u.testingStatus
      });
    }

    const daysRemaining = calculateDaysRemaining(u.expiryDate);
    if (daysRemaining < 0) {
      return res.status(400).json({
        success: false,
        error: `Blood unit ${uId} has expired on ${u.expiryDate} and cannot be released.`,
        unitId: uId,
        expiryDate: u.expiryDate
      });
    }

    // Component match check
    if (u.component !== request.component) {
      return res.status(400).json({
        success: false,
        error: `Component mismatch: Unit ${uId} is ${u.component}, but requisition requires ${request.component}.`,
        unitId: uId
      });
    }

    // Authoritative Clinical Compatibility check
    const compat = checkClinicalCompatibility(u.bloodGroup, request.bloodGroup, request.component);
    if (!compat.isCompatible) {
      return res.status(400).json({
        success: false,
        error: `Clinical Compatibility Violation: Unit ${uId} (${u.bloodGroup} ${u.component}) is incompatible with recipient (${request.bloodGroup} ${request.component}).`,
        unitId: uId,
        details: compat.message
      });
    }

    // Double reservation / Concurrency protection
    if (u.availability !== 'Available' && u.reservedForRequestId !== request.id) {
      return res.status(409).json({
        success: false,
        error: `Double Reservation Prevented: Blood Unit ${uId} is unavailable (Status: ${u.availability}${u.reservedForRequestId ? `, Reserved for ${u.reservedForRequestId}` : ''}).`,
        unitId: uId,
        currentStatus: u.availability,
        reservedForRequestId: u.reservedForRequestId
      });
    }
  }

  // Release any previously assigned units by this bank that were replaced
  (request.assignedUnitIds || []).forEach(prevId => {
    if (!uniqueUnitIds.includes(prevId)) {
      const prevUnit = db.bloodUnits.find(u => u.id === prevId);
      if (prevUnit && prevUnit.bloodBankId === bankId && prevUnit.reservedForRequestId === request.id) {
        prevUnit.availability = 'Available';
        prevUnit.reservedForRequestId = undefined;
      }
    }
  });

  // Atomic state commit
  uniqueUnitIds.forEach(uId => {
    const u = db.bloodUnits.find(unit => unit.id === uId);
    if (u) {
      u.availability = 'Reserved';
      u.reservedForRequestId = request.id;
    }
  });

  // Preserve other banks' assigned units in multi-bank scenarios
  const otherBanksUnits = (request.assignedUnitIds || []).filter(id => {
    const u = db.bloodUnits.find(unit => unit.id === id);
    return u && u.bloodBankId !== bankId;
  });
  const allAssignedUnits = [...otherBanksUnits, ...uniqueUnitIds];

  const now = new Date().toISOString();
  request.assignedUnitIds = allAssignedUnits;
  request.fulfilledUnits = allAssignedUnits.length;
  request.status = request.fulfilledUnits >= request.quantityUnits ? 'Reserved' : 'Partially Fulfilled';
  request.updatedAt = now;
  request.timeline.push({
    status: request.status,
    updatedAt: now,
    note: notes || `Allocated and reserved ${uniqueUnitIds.length} verified unit(s) (${uniqueUnitIds.join(', ')}) for requisition.`,
    actor: req.user?.name || 'Blood Bank Staff'
  });

  // Emit Authoritative In-App Notification to Requesting Hospital (normal update, non-alarm)
  await notificationService.dispatchNotification({
    userId: request.hospitalId,
    title: `Requisition ${request.id} Units Allocated`,
    message: `${uniqueUnitIds.length} unit(s) of ${request.bloodGroup} ${request.component} have been allocated and reserved by ${bb?.bloodBankName || bb?.name || 'Blood Bank'}.`,
    type: 'request_update',
    priority: 'medium',
    link: `/hospital/requests?requestId=${request.id}`,
    data: {
      requestId: request.id,
      urgency: request.urgency,
      bloodGroup: request.bloodGroup,
      component: request.component,
      allocatedCount: uniqueUnitIds.length,
      allocatedUnitIds: uniqueUnitIds
    }
  });

  res.json({
    success: true,
    message: `Successfully allocated ${uniqueUnitIds.length} unit(s) to requisition ${request.id}.`,
    request,
    allocatedUnitIds: uniqueUnitIds
  });
};

/**
 * 5. Release Allocated Units Back to Available Stock
 */
export const releaseAllocatedUnits = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const { reason } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  if (request.status === 'Dispatched' || request.status === 'Issued' || request.status === 'Fulfilled') {
    return res.status(400).json({
      success: false,
      error: `Cannot release allocation: Requisition has already been ${request.status.toLowerCase()}.`
    });
  }

  if (request.status === 'Cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Requisition is already cancelled. Duplicate release prevented.'
    });
  }

  const releasedUnits: string[] = [];
  if (Array.isArray(request.assignedUnitIds)) {
    request.assignedUnitIds.forEach(uId => {
      const u = db.bloodUnits.find(unit => unit.id === uId);
      if (u && u.bloodBankId === bankId && u.availability === 'Reserved' && u.reservedForRequestId === request.id) {
        u.availability = 'Available';
        u.reservedForRequestId = undefined;
        releasedUnits.push(u.id);
      }
    });
    request.assignedUnitIds = [];
  }

  // If a prepared dispatch exists, cancel it
  if (request.dispatchId) {
    const d = db.bloodDispatches.find(disp => disp.id === request.dispatchId);
    if (d && d.status === 'Prepared') {
      d.status = 'Cancelled';
      d.auditHistory.push({
        action: 'Cancelled',
        timestamp: new Date().toISOString(),
        operator: req.user?.name || 'Blood Bank Staff',
        notes: reason || 'Dispatch cancelled due to allocation release.'
      });
    }
  }

  const now = new Date().toISOString();
  request.fulfilledUnits = 0;
  request.status = 'Sample Submitted';
  request.updatedAt = now;
  request.timeline.push({
    status: 'Sample Submitted',
    updatedAt: now,
    note: reason ? `Allocation released: ${reason}` : `Released ${releasedUnits.length} unit(s) back to regional available stock.`,
    actor: req.user?.name || 'Blood Bank Staff'
  });

  // Emit Notification to Hospital
  await notificationService.dispatchNotification({
    userId: request.hospitalId,
    title: `Requisition ${request.id} Allocation Released`,
    message: `Allocated units for requisition ${request.id} (${request.bloodGroup} ${request.component}) were released back to stock. Reason: ${reason || 'Operational adjustment'}.`,
    type: 'request_update',
    priority: 'medium',
    link: '/hospital/requests'
  });

  res.json({
    success: true,
    message: `Allocation released successfully. ${releasedUnits.length} unit(s) returned to available stock.`,
    releasedUnits,
    request
  });
};

/**
 * 6. Prepare Dispatch & Generate Authoritative Packing Manifest
 */
export const prepareDispatch = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood center' });
  }

  const { id } = req.params;
  const { 
    courierType, 
    courierReference, 
    packagingType, 
    targetTransportTemp, 
    coldChainMonitoring, 
    specialHandlingInstructions,
    notes 
  } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  if (!request.assignedUnitIds || request.assignedUnitIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot prepare dispatch: No blood units have been allocated to this requisition.'
    });
  }

  if (request.status === 'Dispatched' || request.status === 'Fulfilled') {
    return res.status(400).json({
      success: false,
      error: `Cannot prepare dispatch: Requisition is already ${request.status.toLowerCase()}.`
    });
  }

  // Construct unit items snapshot with persisted metadata
  const unitItems: DispatchUnitItem[] = [];
  for (const uId of request.assignedUnitIds) {
    const u = db.bloodUnits.find(unit => unit.id === uId);
    if (!u) {
      return res.status(404).json({ success: false, error: `Allocated unit ${uId} not found in inventory.` });
    }
    unitItems.push({
      unitId: u.id,
      bloodGroup: u.bloodGroup,
      component: u.component,
      volumeMl: u.volumeMl || 450,
      collectionDate: u.collectionDate || new Date().toISOString().split('T')[0],
      expiryDate: u.expiryDate,
      storageLocation: u.storageLocation || 'Main Cold Storage',
      testingStatus: u.testingStatus
    });
  }

  // Authoritative default temperature & packaging per component standards
  let defaultPackaging: 'Standard Passive Thermal Container with Ice Gel Packs' | 'Validated Cold-Chain Shipper' | 'Platelet Transit Agitator Box' = 'Standard Passive Thermal Container with Ice Gel Packs';
  let defaultTemp = '2°C to 6°C (Chilled)';
  let defaultHandling = 'Maintain cold chain at 2°C to 6°C. Keep upright. Do not freeze.';

  if (request.component === 'Platelets') {
    defaultPackaging = 'Platelet Transit Agitator Box';
    defaultTemp = '20°C to 24°C (Ambient)';
    defaultHandling = 'Maintain ambient 20°C to 24°C with continuous agitation or validated transport box. Do not refrigerate or freeze.';
  } else if (request.component === 'Plasma') {
    defaultPackaging = 'Validated Cold-Chain Shipper';
    defaultTemp = '-18°C or lower (Frozen)';
    defaultHandling = 'Ship frozen with dry ice / eutectic ice packs. Do not thaw.';
  }

  const dispatchId = `DSP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newDispatch: BloodDispatch = {
    id: dispatchId,
    requestId: request.id,
    bloodBankId: bankId,
    bloodBankName: bb?.bloodBankName || bb?.name || 'Regional Blood Center',
    hospitalId: request.hospitalId,
    hospitalName: request.hospitalName,
    patientReferenceId: request.patientReferenceId,
    department: request.department,
    component: request.component,
    bloodGroup: request.bloodGroup,
    unitIds: [...request.assignedUnitIds],
    unitItems,
    quantityUnits: unitItems.length,
    status: 'Prepared',
    courierType: courierType || 'Dedicated Hospital Courier',
    courierReference: courierReference || undefined,
    packagingType: packagingType || defaultPackaging,
    targetTransportTemp: targetTransportTemp || defaultTemp,
    coldChainMonitoring: coldChainMonitoring || 'Passive Temp Strips',
    specialHandlingInstructions: specialHandlingInstructions || defaultHandling,
    preparedAt: now,
    preparedBy: req.user?.name || 'Blood Bank Dispatch Supervisor',
    auditHistory: [
      {
        action: 'Prepared',
        timestamp: now,
        operator: req.user?.name || 'Blood Bank Dispatch Supervisor',
        notes: notes || `Packed ${unitItems.length} unit(s) into ${packagingType || defaultPackaging}. Dispatch slip generated.`
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  db.bloodDispatches.unshift(newDispatch);

  request.dispatchId = dispatchId;
  request.dispatchStatus = 'Prepared';
  request.status = 'Prepared for Dispatch';
  request.updatedAt = now;
  request.timeline.push({
    status: 'Prepared for Dispatch',
    updatedAt: now,
    note: `Dispatch manifest ${dispatchId} generated with ${unitItems.length} verified unit(s). Packing slip ready for handoff.`,
    actor: req.user?.name || 'Blood Bank Dispatch'
  });

  db.saveSnapshot();

  res.json({
    success: true,
    message: `Dispatch ${dispatchId} prepared successfully.`,
    dispatch: newDispatch,
    request
  });
};

/**
 * 7. Confirm Courier Handoff / Dispatch Transit
 */
export const confirmDispatch = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;
  const { courierReference, notes } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  // Idempotency: if already dispatched, return cleanly
  if (request.status === 'Dispatched') {
    const existingDispatch = db.bloodDispatches.find(d => d.id === request.dispatchId);
    return res.json({
      success: true,
      message: 'Requisition is already dispatched and in transit.',
      request,
      dispatch: existingDispatch
    });
  }

  if (!request.dispatchId) {
    return res.status(400).json({
      success: false,
      error: 'Cannot confirm dispatch: Dispatch preparation has not been completed.'
    });
  }

  const dispatch = db.bloodDispatches.find(d => d.id === request.dispatchId);
  if (!dispatch) {
    return res.status(404).json({ success: false, error: 'Associated dispatch manifest record not found.' });
  }

  const now = new Date().toISOString();

  // Transition assigned units to 'Issued'
  (request.assignedUnitIds || []).forEach(uId => {
    const u = db.bloodUnits.find(unit => unit.id === uId);
    if (u && u.bloodBankId === bankId) {
      u.availability = 'Issued';
    }
  });

  dispatch.status = 'In Transit';
  dispatch.dispatchedAt = now;
  dispatch.dispatchedBy = req.user?.name || 'Blood Bank Dispatch Officer';
  if (courierReference) dispatch.courierReference = courierReference;
  dispatch.auditHistory.push({
    action: 'Dispatched',
    timestamp: now,
    operator: req.user?.name || 'Blood Bank Dispatch Officer',
    notes: notes || `Handoff complete to ${dispatch.courierType}${dispatch.courierReference ? ` (${dispatch.courierReference})` : ''}. Cold-chain transit active.`
  });
  dispatch.updatedAt = now;

  request.status = 'Dispatched';
  request.dispatchStatus = 'In Transit';
  request.updatedAt = now;
  request.timeline.push({
    status: 'Dispatched',
    updatedAt: now,
    note: notes || `Units handed off to courier ${dispatch.courierReference || dispatch.courierType}. En route to ${request.hospitalName}.`,
    actor: req.user?.name || 'Blood Bank Dispatch Officer'
  });

  db.saveSnapshot();

  res.json({
    success: true,
    message: `Requisition ${request.id} dispatched successfully to transport courier.`,
    dispatch,
    request
  });
};

/**
 * Direct Dispatch Requisition (Prepare and dispatch manifest in unified transition)
 */
export const dispatchRequisition = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood center' });
  }

  const { id } = req.params;
  const { 
    courierType, 
    courierReference, 
    packagingType, 
    targetTransportTemp, 
    coldChainMonitoring, 
    specialHandlingInstructions,
    specialInstructions,
    notes 
  } = req.body;

  const request = db.bloodRequests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Requisition not found' });
  }

  if (request.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Requisition belongs to another blood center' });
  }

  if (!request.assignedUnitIds || request.assignedUnitIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot dispatch: No blood units have been allocated to this requisition.'
    });
  }

  if (request.status === 'Dispatched' || request.status === 'Fulfilled') {
    const existingDispatch = db.bloodDispatches.find(d => d.id === request.dispatchId);
    return res.json({
      success: true,
      message: `Requisition is already ${request.status.toLowerCase()}.`,
      dispatch: existingDispatch,
      request
    });
  }

  // Construct unit items snapshot with persisted metadata
  const unitItems: DispatchUnitItem[] = [];
  for (const uId of request.assignedUnitIds) {
    const u = db.bloodUnits.find(unit => unit.id === uId);
    if (!u) {
      return res.status(404).json({ success: false, error: `Allocated unit ${uId} not found in inventory.` });
    }
    unitItems.push({
      unitId: u.id,
      bloodGroup: u.bloodGroup,
      component: u.component,
      volumeMl: u.volumeMl || 450,
      collectionDate: u.collectionDate || new Date().toISOString().split('T')[0],
      expiryDate: u.expiryDate,
      storageLocation: u.storageLocation || 'Main Cold Storage',
      testingStatus: u.testingStatus
    });
  }

  let defaultPackaging: 'Standard Passive Thermal Container with Ice Gel Packs' | 'Validated Cold-Chain Shipper' | 'Platelet Transit Agitator Box' = 'Standard Passive Thermal Container with Ice Gel Packs';
  let defaultTemp = '2°C to 6°C (Chilled)';
  let defaultHandling = 'Maintain cold chain at 2°C to 6°C. Keep upright. Do not freeze.';

  if (request.component === 'Platelets') {
    defaultPackaging = 'Platelet Transit Agitator Box';
    defaultTemp = '20°C to 24°C (Ambient)';
    defaultHandling = 'Maintain ambient 20°C to 24°C with continuous agitation or validated transport box. Do not refrigerate or freeze.';
  } else if (request.component === 'Plasma') {
    defaultPackaging = 'Validated Cold-Chain Shipper';
    defaultTemp = '-18°C or lower (Frozen)';
    defaultHandling = 'Ship frozen with dry ice / eutectic ice packs. Do not thaw.';
  }

  const dispatchId = request.dispatchId || `DSP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  let dispatch = db.bloodDispatches.find(d => d.id === dispatchId);
  if (!dispatch) {
    const newDispatch: BloodDispatch = {
      id: dispatchId,
      requestId: request.id,
      bloodBankId: bankId,
      bloodBankName: bb?.bloodBankName || bb?.name || 'Regional Blood Center',
      hospitalId: request.hospitalId,
      hospitalName: request.hospitalName,
      patientReferenceId: request.patientReferenceId,
      department: request.department,
      component: request.component,
      bloodGroup: request.bloodGroup,
      unitIds: [...request.assignedUnitIds],
      unitItems,
      quantityUnits: unitItems.length,
      status: 'In Transit',
      courierType: courierType || 'Dedicated Hospital Courier',
      courierReference: courierReference || undefined,
      packagingType: packagingType || defaultPackaging,
      targetTransportTemp: targetTransportTemp || defaultTemp,
      coldChainMonitoring: coldChainMonitoring || 'Passive Temp Strips',
      specialHandlingInstructions: specialInstructions || specialHandlingInstructions || defaultHandling,
      preparedAt: now,
      preparedBy: req.user?.name || 'Blood Bank Dispatch Supervisor',
      dispatchedAt: now,
      dispatchedBy: req.user?.name || 'Blood Bank Dispatch Officer',
      auditHistory: [
        {
          action: 'Dispatched',
          timestamp: now,
          operator: req.user?.name || 'Blood Bank Dispatch Officer',
          notes: notes || `Direct dispatch manifest generated and handed off to courier ${courierReference || courierType || 'Dedicated Courier'}.`
        }
      ],
      createdAt: now,
      updatedAt: now
    };
    db.bloodDispatches.unshift(newDispatch);
    dispatch = newDispatch;
  } else {
    dispatch.status = 'In Transit';
    dispatch.dispatchedAt = now;
    dispatch.dispatchedBy = req.user?.name || 'Blood Bank Dispatch Officer';
    if (courierReference) dispatch.courierReference = courierReference;
    dispatch.auditHistory.push({
      action: 'Dispatched',
      timestamp: now,
      operator: req.user?.name || 'Blood Bank Dispatch Officer',
      notes: notes || 'Courier handoff confirmed.'
    });
    dispatch.updatedAt = now;
  }

  // Transition assigned units to 'Issued'
  (request.assignedUnitIds || []).forEach(uId => {
    const u = db.bloodUnits.find(unit => unit.id === uId);
    if (u && u.bloodBankId === bankId) {
      u.availability = 'Issued';
    }
  });

  request.dispatchId = dispatchId;
  request.dispatchStatus = 'In Transit';
  request.status = 'Dispatched';
  request.updatedAt = now;
  request.timeline.push({
    status: 'Dispatched',
    updatedAt: now,
    note: notes || `Requisition dispatched with manifest ${dispatchId}. Handed off to courier ${courierReference || courierType || 'Dedicated Courier'}.`,
    actor: req.user?.name || 'Blood Bank Dispatch'
  });

  db.saveSnapshot();

  res.json({
    success: true,
    message: `Requisition ${request.id} dispatched successfully.`,
    dispatch,
    request
  });
};


/**
 * 8. Get Authoritative Printable Dispatch Slip / Packing Document Data
 */
export const getDispatchSlip = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  const { id } = req.params;

  // Search by dispatch ID or requisition ID
  const dispatch = db.bloodDispatches.find(d => d.id === id || d.requestId === id);
  if (!dispatch) {
    return res.status(404).json({ success: false, error: 'Dispatch record not found' });
  }

  if (dispatch.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Dispatch belongs to another blood center' });
  }

  const request = db.bloodRequests.find(r => r.id === dispatch.requestId);
  const bank = db.bloodBanks.find(b => b.id === dispatch.bloodBankId) || bb;

  const slipData = {
    documentId: `SLIP-${dispatch.id}`,
    generatedAt: new Date().toISOString(),
    dispatchId: dispatch.id,
    requestId: dispatch.requestId,
    bloodBank: {
      id: bank?.id || bankId,
      name: bank?.bloodBankName || bank?.name || 'Blood Center',
      registrationId: bank?.registrationId || '',
      phone: bank?.phone || '',
      address: bank?.address || '',
      city: bank?.city || '',
      state: bank?.state || ''
    },
    hospital: {
      id: dispatch.hospitalId,
      name: dispatch.hospitalName,
      department: dispatch.department || request?.department || '',
      patientReferenceId: dispatch.patientReferenceId
    },
    clinicalRequisition: {
      urgency: request?.urgency || 'Routine',
      component: dispatch.component,
      bloodGroup: dispatch.bloodGroup,
      quantityRequested: request?.quantityUnits || dispatch.quantityUnits,
      quantityDispatched: dispatch.quantityUnits,
      requiredByDate: request?.requiredByDate || null,
      notes: request?.notes || null
    },
    units: dispatch.unitItems,
    coldChainSpecifications: {
      packagingType: dispatch.packagingType,
      targetTransportTemp: dispatch.targetTransportTemp,
      coldChainMonitoring: dispatch.coldChainMonitoring,
      specialHandlingInstructions: dispatch.specialHandlingInstructions,
      gpsTrackingAvailable: false, // Authoritative: cold-chain GPS hardware is unintegrated
      telemetryNote: 'Transport monitored via verified physical packaging seals and passive cold-chain indicators. Real-time GPS unintegrated.'
    },
    courierHandoff: {
      courierType: dispatch.courierType,
      courierReference: dispatch.courierReference || 'Direct Hospital Custody',
      preparedAt: dispatch.preparedAt,
      preparedBy: dispatch.preparedBy,
      dispatchedAt: dispatch.dispatchedAt || null,
      dispatchedBy: dispatch.dispatchedBy || null,
      receivedAt: dispatch.receivedAt || null,
      receivedBy: dispatch.receivedBy || null,
      status: dispatch.status
    },
    auditHistory: dispatch.auditHistory
  };

  res.json({
    success: true,
    slip: slipData
  });
};

/**
 * 9. Emergency Stock Allocation Matrix (Released Stock vs Active Priority Demand)
 */
export const getEmergencyAllocationMatrix = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood center' });
  }

  const bloodGroups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
  const components: BloodComponent[] = ['RBC', 'Plasma', 'Platelets'];

  // 1. Released & Available units for this bank
  const releasedUnits = db.bloodUnits.filter(u => 
    u.bloodBankId === bankId &&
    u.availability === 'Available' &&
    u.testingStatus === 'Passed' &&
    calculateDaysRemaining(u.expiryDate) >= 0
  );

  // 2. Active demand from hospital requisitions assigned to this bank
  const activeRequests = db.bloodRequests.filter(r => 
    r.bloodBankId === bankId &&
    r.status !== 'Fulfilled' &&
    r.status !== 'Cancelled' &&
    r.status !== 'Rejected'
  );

  const matrix = components.map(comp => {
    const groupData = bloodGroups.map(bg => {
      const availableCount = releasedUnits.filter(u => u.component === comp && u.bloodGroup === bg).length;
      
      const matchingReqs = activeRequests.filter(r => r.component === comp && r.bloodGroup === bg);
      const totalDemand = matchingReqs.reduce((sum, r) => sum + Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0)), 0);
      const emergencyDemand = matchingReqs.filter(r => r.urgency === 'Emergency')
        .reduce((sum, r) => sum + Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0)), 0);
      const urgentDemand = matchingReqs.filter(r => r.urgency === 'Urgent')
        .reduce((sum, r) => sum + Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0)), 0);
      const routineDemand = matchingReqs.filter(r => r.urgency === 'Routine')
        .reduce((sum, r) => sum + Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0)), 0);

      const netBalance = availableCount - totalDemand;

      // Clinical compatibility notes
      let recommendation = 'Adequate stock buffer.';
      if (netBalance < 0) {
        if (bg === 'O-' && comp === 'RBC') {
          recommendation = 'CRITICAL DEFICIT: Universal donor O- RBC shortage. Authorize emergency mobile donation drive or prioritize non-O- exact matches for non-O- patients.';
        } else if ((bg === 'AB+' || bg === 'AB-') && comp === 'Plasma') {
          recommendation = 'Plasma deficit: AB is universal plasma donor. Utilize A or B plasma if recipient group is non-O.';
        } else {
          recommendation = `Deficit of ${Math.abs(netBalance)} units. Consider compatible donors or schedule hospital fulfillment dispatch.`;
        }
      } else if (emergencyDemand > 0 && availableCount < emergencyDemand) {
        recommendation = `CRITICAL: Insufficient stock to meet STAT Emergency demand (${emergencyDemand} units required).`;
      }

      return {
        bloodGroup: bg,
        component: comp,
        availableUnits: availableCount,
        totalDemandUnits: totalDemand,
        emergencyDemand,
        urgentDemand,
        routineDemand,
        netBalance,
        status: netBalance < 0 ? 'Deficit' : netBalance === 0 ? 'Balanced' : 'Surplus',
        recommendation
      };
    });

    return {
      component: comp,
      groups: groupData
    };
  });

  res.json({
    success: true,
    matrix,
    summary: {
      totalAvailableReleasedUnits: releasedUnits.length,
      totalActiveRequisitions: activeRequests.length,
      emergencyRequisitionsCount: activeRequests.filter(r => r.urgency === 'Emergency').length,
      urgentRequisitionsCount: activeRequests.filter(r => r.urgency === 'Urgent').length
    }
  });
};


/**
 * Blood Bank Monthly Reports & Fulfillment Analytics
 */
export const getReports = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const bankUnits = db.bloodUnits.filter(u => u.bloodBankId === bankId);
  const totalUnits = bankUnits.length;
  const available = bankUnits.filter(u => u.availability === 'Available').length;
  const issued = bankUnits.filter(u => u.availability === 'Issued').length;
  const expired = bankUnits.filter(u => u.availability === 'Expired').length;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const totalCollectionsThisMonth = db.bloodCollections.filter(c => c.bloodBankId === bankId && c.collectionDate >= startOfMonth).length;
  const bankRequests = db.bloodRequests.filter(r => r.bloodBankId === bankId);
  const totalRequestsThisMonth = bankRequests.filter(r => (r.createdAt || '').slice(0, 10) >= startOfMonth).length;
  const fulfilledRequests = bankRequests.filter(r => r.status === 'Fulfilled' || r.status === 'Partially Fulfilled');
  const fulfillmentRate = bankRequests.length > 0
    ? `${Math.round((fulfilledRequests.length / bankRequests.length) * 100)}%`
    : '100%';

  res.json({
    success: true,
    summary: {
      totalUnits,
      available,
      issued,
      expired,
      fulfillmentRate,
      totalCollectionsThisMonth,
      totalRequestsThisMonth
    },
    inventoryByGroup: db.getAvailableInventoryByGroup(bankId)
  });
};

// =========================================================
// PHASE 5C: COLD-STORAGE MONITORING, TEMPERATURE ALARMS & AUDIT TRAIL
// =========================================================

/**
 * Get Cold Storage Equipment Registry for Authenticated Blood Bank
 */
export const getColdStorageEquipment = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const nowMs = Date.now();
  const equipment = db.coldStorageEquipment
    .filter(e => e.bloodBankId === bankId)
    .map(e => {
      // Dynamic stale sensor evaluation
      let sensorConnectivity = e.sensorConnectivity;
      if (e.lastReadingTimestamp) {
        const elapsedMins = (nowMs - new Date(e.lastReadingTimestamp).getTime()) / (60 * 1000);
        if (elapsedMins > (e.staleThresholdMinutes || 30)) {
          sensorConnectivity = 'Stale';
        }
      }

      // Count active alarms
      const activeAlarmsCount = db.coldStorageAlarms.filter(
        a => a.equipmentId === e.id && a.bloodBankId === bankId && a.status !== 'Resolved'
      ).length;

      // Count mapped blood units in inventory
      const monitoredUnitsCount = db.bloodUnits.filter(
        u => u.bloodBankId === bankId &&
        e.mappedStorageLocations.some(loc => 
          u.storageLocation.toLowerCase().includes(loc.toLowerCase()) || 
          loc.toLowerCase().includes(u.storageLocation.toLowerCase())
        )
      ).length;

      return {
        ...e,
        sensorConnectivity,
        connectivityStatus: sensorConnectivity.toLowerCase(),
        activeAlarmsCount,
        monitoredUnitsCount
      };
    });

  return res.json({
    success: true,
    count: equipment.length,
    equipment
  });
};

/**
 * Get Specific Cold Storage Equipment by ID
 */
export const getColdStorageEquipmentById = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const equipment = db.coldStorageEquipment.find(e => e.id === id);
  if (!equipment) {
    return res.status(404).json({ success: false, error: `Cold storage equipment ${id} not found.` });
  }

  if (equipment.bloodBankId !== bankId) {
    return res.status(404).json({ success: false, error: `Cold storage equipment ${id} not found.` });
  }

  // Dynamic stale sensor evaluation
  const nowMs = Date.now();
  let sensorConnectivity = equipment.sensorConnectivity;
  if (equipment.lastReadingTimestamp) {
    const elapsedMins = (nowMs - new Date(equipment.lastReadingTimestamp).getTime()) / (60 * 1000);
    if (elapsedMins > (equipment.staleThresholdMinutes || 30)) {
      sensorConnectivity = 'Stale';
    }
  }

  // Active alarms
  const alarms = db.coldStorageAlarms.filter(
    a => a.equipmentId === id && a.bloodBankId === bankId && a.status !== 'Resolved'
  );

  // Mapped units
  const monitoredUnits = db.bloodUnits.filter(
    u => u.bloodBankId === bankId &&
    equipment.mappedStorageLocations.some(loc => 
      u.storageLocation.toLowerCase().includes(loc.toLowerCase()) || 
      loc.toLowerCase().includes(u.storageLocation.toLowerCase())
    )
  );

  return res.json({
    success: true,
    equipment: {
      ...equipment,
      sensorConnectivity,
      connectivityStatus: sensorConnectivity.toLowerCase(),
      activeAlarmsCount: alarms.length,
      monitoredUnitsCount: monitoredUnits.length,
      activeAlarms: alarms
    }
  });
};

/**
 * Register New Cold Storage Equipment
 */
export const registerColdStorageEquipment = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const {
    name,
    equipmentType,
    locationName,
    mappedStorageLocations,
    minTempCelsius,
    maxTempCelsius,
    targetTempCelsius,
    authoritativeStandard,
    requiresAgitation,
    sensorId,
    sensorConnectivity,
    staleThresholdMinutes
  } = req.body;

  if (!name || !equipmentType || !locationName || minTempCelsius === undefined || maxTempCelsius === undefined) {
    return res.status(400).json({ 
      success: false, 
      error: 'Name, equipment type, location name, minimum temperature, and maximum temperature are required.' 
    });
  }

  const minT = Number(minTempCelsius);
  const maxT = Number(maxTempCelsius);
  if (isNaN(minT) || isNaN(maxT) || minT >= maxT) {
    return res.status(422).json({
      success: false,
      error: 'Minimum temperature must be strictly less than maximum temperature, and both must be valid numbers.'
    });
  }

  let defaultStandard = authoritativeStandard;
  if (!defaultStandard) {
    if (equipmentType.includes('RBC')) defaultStandard = 'WHO / AABB Blood Storage Guidelines (2°C to 6°C)';
    else if (equipmentType.includes('Freezer')) defaultStandard = 'AABB Standards for Blood Banks (≤ -18°C)';
    else if (equipmentType.includes('Platelet')) defaultStandard = 'WHO TRS Guidelines (20°C to 24°C continuous agitation)';
    else defaultStandard = 'Blood Bank Operating Procedure Standard';
  }

  const prefix = equipmentType.includes('RBC') ? 'RBC' : equipmentType.includes('Freezer') ? 'FFP' : equipmentType.includes('Platelet') ? 'PLT' : 'EQ';
  const newId = `EQ-${prefix}-${Date.now().toString().slice(-4)}`;
  const isoNow = new Date().toISOString();

  const newEquipment: ColdStorageEquipment = {
    id: newId,
    bloodBankId: bankId,
    name: name.trim(),
    equipmentType,
    locationName: locationName.trim(),
    mappedStorageLocations: Array.isArray(mappedStorageLocations) && mappedStorageLocations.length > 0 
      ? mappedStorageLocations 
      : [locationName.trim()],
    minTempCelsius: minT,
    maxTempCelsius: maxT,
    targetTempCelsius: targetTempCelsius !== undefined ? Number(targetTempCelsius) : (minT + maxT) / 2,
    temperatureUnit: '°C',
    authoritativeStandard: defaultStandard,
    requiresAgitation: Boolean(requiresAgitation),
    agitationStatus: requiresAgitation ? 'Active' : 'Not Applicable',
    status: 'Operational',
    sensorId: sensorId ? sensorId.trim() : undefined,
    sensorConnectivity: sensorId ? 'Connected' : 'Manual Log Only',
    staleThresholdMinutes: Number(staleThresholdMinutes) || (sensorId ? 30 : 240),
    createdAt: isoNow,
    updatedAt: isoNow
  };

  db.coldStorageEquipment.push(newEquipment);

  return res.status(201).json({
    success: true,
    message: `Cold storage equipment '${newEquipment.name}' registered successfully.`,
    equipment: newEquipment
  });
};

/**
 * Record a Temperature Reading (Manual, Telemetry, or Simulated)
 */
export const recordTemperatureReading = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const {
    equipmentId,
    temperatureCelsius,
    readingSource,
    timestamp,
    notes,
    agitationOperational,
    operatorName,
    isSimulated
  } = req.body;

  if (!equipmentId) {
    return res.status(400).json({ success: false, error: 'Equipment ID is required.' });
  }

  const equipment = db.coldStorageEquipment.find(e => e.id === equipmentId);
  if (!equipment) {
    return res.status(404).json({ success: false, error: `Equipment ${equipmentId} not found.` });
  }

  if (equipment.bloodBankId !== bankId) {
    return res.status(404).json({ success: false, error: `Equipment ${equipmentId} not found.` });
  }

  // Validate temperature
  const tempVal = Number(temperatureCelsius);
  if (temperatureCelsius === undefined || temperatureCelsius === null || isNaN(tempVal)) {
    return res.status(400).json({ success: false, error: 'Temperature must be a valid numeric reading.' });
  }

  if (tempVal < -70.0 || tempVal > 60.0) {
    return res.status(422).json({ 
      success: false, 
      error: `Recorded temperature ${tempVal}°C is outside valid clinical sensor thresholds (-70°C to +60°C).` 
    });
  }

  // Validate reading source
  const validSources: TemperatureReadingSource[] = ['manual_log', 'sensor_telemetry', 'simulated_dev'];
  const src: TemperatureReadingSource = readingSource || (equipment.sensorId ? 'sensor_telemetry' : 'manual_log');
  if (!validSources.includes(src)) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid reading source '${src}'. Must be 'manual_log', 'sensor_telemetry', or 'simulated_dev'.` 
    });
  }

  // Validate timestamp
  const readingTime = timestamp ? new Date(timestamp) : new Date();
  if (isNaN(readingTime.getTime())) {
    return res.status(400).json({ success: false, error: 'Invalid timestamp format.' });
  }

  const nowMs = Date.now();
  if (readingTime.getTime() > nowMs + 60000) {
    return res.status(422).json({ success: false, error: 'Reading timestamp cannot be in the future.' });
  }

  const isoTimestamp = readingTime.toISOString();

  // Deduplication / idempotent replay
  const existingDup = db.temperatureReadings.find(
    r => r.equipmentId === equipmentId && 
         r.timestamp === isoTimestamp && 
         Math.abs(r.temperatureCelsius - tempVal) < 0.001
  );
  if (existingDup) {
    return res.status(200).json({
      success: true,
      message: 'Duplicate reading acknowledged idempotently.',
      reading: existingDup,
      isOutOfRange: existingDup.isOutOfRange,
      replayed: true,
      isDuplicate: true
    });
  }

  // Determine Out-of-Range Condition
  const isTempOutOfRange = tempVal < equipment.minTempCelsius || tempVal > equipment.maxTempCelsius;
  const isAgitationFault = equipment.requiresAgitation && agitationOperational === false;
  const isOutOfRange = isTempOutOfRange || isAgitationFault;

  const readingId = `TMP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
  const resolvedOperator = src === 'manual_log' 
    ? (operatorName || req.user?.name || 'Staff Technician')
    : (src === 'simulated_dev' ? 'Simulation Engine (Dev)' : (equipment.sensorId || 'IoT Gateway Sensor'));

  const newReading: TemperatureReading = {
    id: readingId,
    bloodBankId: bankId,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    temperatureCelsius: tempVal,
    temperatureUnit: '°C',
    readingSource: src,
    timestamp: isoTimestamp,
    isOutOfRange,
    minTempCelsius: equipment.minTempCelsius,
    maxTempCelsius: equipment.maxTempCelsius,
    agitationOperational: equipment.requiresAgitation ? (agitationOperational !== undefined ? Boolean(agitationOperational) : true) : undefined,
    operatorId: req.user?.id,
    operatorName: resolvedOperator,
    notes,
    isSimulated: src === 'simulated_dev' || Boolean(isSimulated),
    createdAt: new Date().toISOString()
  };

  db.temperatureReadings.unshift(newReading);

  // Update equipment latest state (only if reading is not out-of-order older than last verified reading)
  const isNewer = !equipment.lastReadingTimestamp || readingTime.getTime() >= new Date(equipment.lastReadingTimestamp).getTime();
  if (isNewer) {
    equipment.lastReadingTempCelsius = tempVal;
    equipment.lastReadingTimestamp = isoTimestamp;
    equipment.lastReadingSource = src;
    equipment.lastReadingRecordedBy = resolvedOperator;
    equipment.sensorConnectivity = src === 'manual_log' ? 'Manual Log Only' : 'Connected';
    equipment.updatedAt = new Date().toISOString();

    if (equipment.requiresAgitation) {
      equipment.agitationStatus = isAgitationFault ? 'Fault' : 'Active';
    }
  }

  // ==========================================
  // ALARM LIFECYCLE & DEDUPLICATION
  // ==========================================
  let activeAlarm: ColdStorageAlarm | undefined;

  if (isOutOfRange) {
    // Determine Severity
    let severity: AlarmSeverity = 'Warning';
    if (equipment.equipmentType.includes('Freezer') && tempVal > -15.0) {
      severity = 'Critical'; // Plasma defrosting risk!
    } else if (tempVal > equipment.maxTempCelsius + 2.0 || tempVal < equipment.minTempCelsius - 2.0) {
      severity = 'Critical'; // Severe excursion
    } else if (isAgitationFault) {
      severity = 'Critical'; // Platelet agglomeration risk
    }

    let thresholdViolated = '';
    if (tempVal > equipment.maxTempCelsius) {
      thresholdViolated = `Exceeded upper limit +${equipment.maxTempCelsius}°C (Recorded ${tempVal}°C)`;
    } else if (tempVal < equipment.minTempCelsius) {
      thresholdViolated = `Dropped below lower limit ${equipment.minTempCelsius}°C (Recorded ${tempVal}°C)`;
    } else if (isAgitationFault) {
      thresholdViolated = `Platelet continuous agitation halted on incubator`;
    }

    // Check for open existing alarm for this equipment
    const existingOpenAlarm = db.coldStorageAlarms.find(
      a => a.equipmentId === equipment.id && a.bloodBankId === bankId && a.status !== 'Resolved'
    );

    if (existingOpenAlarm) {
      // Deduplicate: Update existing alarm without creating parallel incident
      if (Math.abs(tempVal - equipment.targetTempCelsius) > Math.abs(existingOpenAlarm.peakTemperatureCelsius - equipment.targetTempCelsius)) {
        existingOpenAlarm.peakTemperatureCelsius = tempVal;
      }
      if (severity === 'Critical') {
        existingOpenAlarm.severity = 'Critical';
      }

      existingOpenAlarm.auditHistory.push({
        id: `AUD-${Date.now().toString().slice(-4)}`,
        action: 'Repeated Excursion',
        operatorName: resolvedOperator,
        timestamp: isoTimestamp,
        notes: `Out-of-range condition ongoing: ${tempVal}°C (${src})`
      });

      equipment.status = 'Alarm Excursion';
      activeAlarm = existingOpenAlarm;
    } else {
      // Create New Alarm Incident
      const affectedUnits = db.bloodUnits.filter(
        u => u.bloodBankId === bankId &&
        equipment.mappedStorageLocations.some(loc => 
          u.storageLocation.toLowerCase().includes(loc.toLowerCase()) || 
          loc.toLowerCase().includes(u.storageLocation.toLowerCase())
        )
      );

      const newAlarm: ColdStorageAlarm = {
        id: `ALM-2026-${Math.floor(100 + Math.random() * 900)}`,
        bloodBankId: bankId,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        severity,
        triggeringReadingCelsius: tempVal,
        thresholdViolated,
        triggeredAt: isoTimestamp,
        peakTemperatureCelsius: tempVal,
        status: 'Active',
        affectedInventoryCount: affectedUnits.length,
        auditHistory: [
          {
            id: `AUD-${Date.now().toString().slice(-4)}`,
            action: 'Triggered',
            operatorName: resolvedOperator,
            timestamp: isoTimestamp,
            notes: `${thresholdViolated} via ${src}`
          }
        ]
      };

      db.coldStorageAlarms.unshift(newAlarm);
      equipment.status = 'Alarm Excursion';
      activeAlarm = newAlarm;
    }
  } else {
    // Normal Reading:
    // CRITICAL CLINICAL SAFETY RULE:
    // A reading returning to normal range does NOT automatically resolve open alarms!
    // If open alarms exist, equipment status remains 'Warning' until operator explicitly resolves it.
    const openAlarms = db.coldStorageAlarms.filter(
      a => a.equipmentId === equipment.id && a.bloodBankId === bankId && a.status !== 'Resolved'
    );

    if (openAlarms.length > 0) {
      equipment.status = 'Warning';
    } else {
      equipment.status = 'Operational';
    }
  }

  db.saveSnapshot();

  return res.status(201).json({
    success: true,
    message: isOutOfRange 
      ? `Temperature excursion recorded: Alarm active for ${equipment.name}.`
      : `Temperature reading (${tempVal}°C) recorded within operational range.`,
    reading: newReading,
    isOutOfRange,
    isDuplicate: false,
    alarmTriggered: Boolean(activeAlarm),
    alarm: activeAlarm,
    equipment
  });
};

/**
 * Get Temperature Readings History
 */
export const getTemperatureReadings = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { equipmentId, limit } = req.query;

  let readings = db.temperatureReadings.filter(r => r.bloodBankId === bankId);

  if (equipmentId) {
    readings = readings.filter(r => r.equipmentId === equipmentId);
  }

  // Sort descending by timestamp
  readings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const maxRecords = Number(limit) || 100;
  readings = readings.slice(0, maxRecords);

  return res.json({
    success: true,
    count: readings.length,
    readings
  });
};

/**
 * Get Cold Storage Alarms (Filtered by Status or Equipment)
 */
export const getColdStorageAlarms = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;

  if (!bankId) {
    return res.status(401).json({ success: false, error: 'Unauthorized blood bank facility' });
  }

  const { status, equipmentId } = req.query;

  let alarms = db.coldStorageAlarms.filter(a => a.bloodBankId === bankId);

  if (status) {
    alarms = alarms.filter(a => a.status.toLowerCase() === String(status).toLowerCase());
  }

  if (equipmentId) {
    alarms = alarms.filter(a => a.equipmentId === equipmentId);
  }

  alarms.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  return res.json({
    success: true,
    count: alarms.length,
    alarms
  });
};

/**
 * Acknowledge an Active Cold Storage Alarm
 */
export const acknowledgeColdStorageAlarm = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const alarm = db.coldStorageAlarms.find(a => a.id === id);
  if (!alarm) {
    return res.status(404).json({ success: false, error: `Alarm ${id} not found.` });
  }

  if (alarm.bloodBankId !== bankId) {
    return res.status(404).json({ success: false, error: `Alarm ${id} not found.` });
  }

  if (alarm.status === 'Resolved') {
    return res.status(400).json({ success: false, error: 'Cannot acknowledge an already resolved alarm incident.' });
  }

  const { notes } = req.body;
  if (!notes || !notes.trim()) {
    return res.status(400).json({ success: false, error: 'Acknowledgement investigation notes are required.' });
  }

  const operator = req.user?.name || 'Authorized Supervisor';
  const isoNow = new Date().toISOString();

  alarm.status = 'Acknowledged';
  alarm.acknowledgedAt = isoNow;
  alarm.acknowledgedBy = operator;
  alarm.acknowledgementNotes = notes.trim();

  alarm.auditHistory.push({
    id: `AUD-${Date.now().toString().slice(-4)}`,
    action: 'Acknowledged',
    operatorId: req.user?.id,
    operatorName: operator,
    timestamp: isoNow,
    notes: notes.trim()
  });

  return res.json({
    success: true,
    message: `Alarm ${id} acknowledged by ${operator}. Investigation logged.`,
    alarm
  });
};

/**
 * Resolve a Cold Storage Alarm (Requires Corrective Action Documentation)
 */
export const resolveColdStorageAlarm = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const alarm = db.coldStorageAlarms.find(a => a.id === id);
  if (!alarm) {
    return res.status(404).json({ success: false, error: `Alarm ${id} not found.` });
  }

  if (alarm.bloodBankId !== bankId) {
    return res.status(404).json({ success: false, error: `Alarm ${id} not found.` });
  }

  if (alarm.status === 'Resolved') {
    return res.status(400).json({ success: false, error: 'Alarm incident has already been resolved.' });
  }

  const { correctiveAction, resolutionNotes, notes } = req.body;
  const combinedNotes = (resolutionNotes || notes || '').trim();
  if (!correctiveAction || !correctiveAction.trim()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Corrective action is required to resolve a temperature alarm.' 
    });
  }

  const operator = req.user?.name || 'Quality Assurance Officer';
  const isoNow = new Date().toISOString();

  alarm.status = 'Resolved';
  alarm.resolvedAt = isoNow;
  alarm.resolvedBy = operator;
  alarm.correctiveAction = correctiveAction.trim();
  alarm.resolutionNotes = combinedNotes || 'Corrective action verified.';

  alarm.auditHistory.push({
    id: `AUD-${Date.now().toString().slice(-4)}`,
    action: 'Resolved',
    operatorId: req.user?.id,
    operatorName: operator,
    timestamp: isoNow,
    notes: `Corrective Action: ${correctiveAction.trim()}${combinedNotes ? ' | Resolution: ' + combinedNotes : ''}`
  });

  // Check if equipment has any remaining open alarms
  const remainingOpen = db.coldStorageAlarms.filter(
    a => a.equipmentId === alarm.equipmentId && a.bloodBankId === bankId && a.status !== 'Resolved'
  );

  const equipment = db.coldStorageEquipment.find(e => e.id === alarm.equipmentId);
  if (equipment && remainingOpen.length === 0) {
    equipment.status = 'Operational';
  }

  return res.json({
    success: true,
    message: `Alarm ${id} resolved with documented corrective action by ${operator}.`,
    alarm,
    equipment
  });
};

/**
 * Get Potentially Exposed Blood Inventory Associated with Equipment
 */
export const getPotentiallyExposedInventory = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const { id } = req.params;

  const equipment = db.coldStorageEquipment.find(e => e.id === id);
  if (!equipment) {
    return res.status(404).json({ success: false, error: `Equipment ${id} not found.` });
  }

  if (equipment.bloodBankId !== bankId) {
    return res.status(403).json({ success: false, error: 'Access denied: Equipment belongs to another blood bank facility.' });
  }

  // Find units located in mapped storage bays
  const matchingUnits = db.bloodUnits.filter(
    u => u.bloodBankId === bankId &&
    equipment.mappedStorageLocations.some(loc => 
      u.storageLocation.toLowerCase().includes(loc.toLowerCase()) || 
      loc.toLowerCase().includes(u.storageLocation.toLowerCase())
    )
  );

  // Active alarms for this equipment
  const activeAlarms = db.coldStorageAlarms.filter(
    a => a.equipmentId === id && a.bloodBankId === bankId && a.status !== 'Resolved'
  );

  return res.json({
    success: true,
    equipment: {
      id: equipment.id,
      name: equipment.name,
      equipmentType: equipment.equipmentType,
      locationName: equipment.locationName,
      status: equipment.status,
      operatingRange: `${equipment.minTempCelsius}°C to ${equipment.maxTempCelsius}°C`,
      currentTemperature: equipment.lastReadingTempCelsius,
      authoritativeStandard: equipment.authoritativeStandard,
      activeAlarmsCount: activeAlarms.length
    },
    affectedCount: matchingUnits.length,
    units: matchingUnits,
    affectedUnits: matchingUnits,
    clinicalReviewNotice: 'Identified units are flagged for clinical QA integrity review. Blood units are NOT automatically discarded, released, or reclassified without authorized quality officer evaluation and laboratory sign-off.',
    reviewNotice: 'Safety Protocol Notice: Temperature excursion logged. In accordance with blood-bank quality assurance standards, these units are flagged for clinical QA review. Units are NOT automatically discarded or released; an authorized medical director or QA supervisor must complete formal quarantine review.'
  });
};

// =========================================================
// ORGANIZATIONAL CAMP REQUEST COORDINATION
// =========================================================

/**
 * Get Camp Requests for Blood Bank
 */
export const getBloodBankCampRequests = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();
  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const bankCity = (bb?.city || '').toLowerCase();

  // Requests directed to this blood bank OR open submitted requests in the same city/region
  const requests = db.campRequests.filter(r => 
    r.bloodBankId === bankId || 
    (!r.bloodBankId && (r.status === 'Submitted' || (bankCity && r.city.toLowerCase() === bankCity)))
  );

  res.json({
    success: true,
    count: requests.length,
    requests
  });
};

/**
 * Accept Camp Request and Schedule Donation Camp
 */
export const acceptCampRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();
  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const bankName = bb?.bloodBankName || bb?.name || 'Regional Blood Center';
  const { id } = req.params;
  const { scheduledDate, timeSlot, notes } = req.body;

  const campReq = db.campRequests.find(r => r.id === id);
  if (!campReq) {
    return res.status(404).json({ success: false, error: `Camp request ${id} not found.` });
  }

  if (campReq.status === 'Approved' || campReq.status === 'Scheduled') {
    return res.status(400).json({ success: false, error: 'Camp request is already approved/scheduled.' });
  }

  if (campReq.status === 'Cancelled' || campReq.status === 'Rejected') {
    return res.status(400).json({ success: false, error: `Cannot accept a ${campReq.status.toLowerCase()} camp request.` });
  }

  const campDate = scheduledDate || campReq.proposedDate;
  const campTime = timeSlot || campReq.preferredTimeSlot || '09:00 AM - 05:00 PM';

  // Create scheduled donation camp record
  const newCamp: DonationCamp = {
    id: `CAMP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    title: `${campReq.organizationName} Blood Donation Drive`,
    organizer: campReq.organizationName,
    bloodBankId: bankId || 'bb-1',
    location: campReq.venueAddress,
    city: campReq.city,
    address: campReq.venueAddress,
    startDate: campDate,
    endDate: campDate,
    timeSlot: campTime,
    targetUnits: campReq.expectedDonations || campReq.estimatedParticipants || 50,
    registeredCount: 0,
    contactPhone: campReq.organizerPhone,
    description: `Community donation drive organized in partnership with ${campReq.organizationName} (${campReq.organizerName}). Facilities: ${campReq.availableFacilities || 'Standard indoor venue'}.${notes ? ` Coordination note: ${notes}` : ''}`,
    status: 'Planned'
  };

  db.donationCamps.unshift(newCamp);

  // Update camp request status
  campReq.status = 'Approved';
  campReq.bloodBankId = bankId;
  campReq.bloodBankName = bankName;
  campReq.scheduledCampId = newCamp.id;
  campReq.statusNote = notes ? `Approved by ${bankName}. Note: ${notes}` : `Approved by ${bankName}. Scheduled for ${campDate}.`;
  campReq.updatedAt = new Date().toISOString();

  // Dispatch notification to requesting donor
  await notificationService.dispatchNotification({
    userId: campReq.donorId,
    title: 'Camp Request Approved! 🎉',
    message: `Your donation camp request for ${campReq.organizationName} on ${campDate} has been approved and scheduled by ${bankName}!`,
    type: 'camp',
    priority: 'medium',
    link: '/donor/camps'
  });

  res.json({
    success: true,
    message: 'Camp request approved and donation drive scheduled successfully!',
    campRequest: campReq,
    scheduledCamp: newCamp
  });
};

/**
 * Reject Camp Request
 */
export const rejectCampRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();
  const bb = resolveBloodBank(req);
  const bankId = bb?.id || req.user?.id;
  const bankName = bb?.bloodBankName || bb?.name || 'Regional Blood Center';
  const { id } = req.params;
  const { reason } = req.body;

  const campReq = db.campRequests.find(r => r.id === id);
  if (!campReq) {
    return res.status(404).json({ success: false, error: `Camp request ${id} not found.` });
  }

  campReq.status = 'Rejected';
  campReq.bloodBankId = bankId;
  campReq.bloodBankName = bankName;
  campReq.statusNote = reason || 'Declined by blood center due to scheduling or logistical capacity constraints.';
  campReq.updatedAt = new Date().toISOString();

  // Dispatch notification to requesting donor
  await notificationService.dispatchNotification({
    userId: campReq.donorId,
    title: 'Camp Request Update',
    message: `Your camp request for ${campReq.organizationName} could not be accommodated by ${bankName}. Reason: ${campReq.statusNote}`,
    type: 'camp',
    priority: 'medium',
    link: '/donor/camps'
  });

  res.json({
    success: true,
    message: 'Camp request declined.',
    campRequest: campReq
  });
};



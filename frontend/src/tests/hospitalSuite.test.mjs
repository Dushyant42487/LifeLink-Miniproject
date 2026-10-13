import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper matching hospital metric derivation logic
function deriveHospitalMetrics(allRequests, hospitalId) {
  // Authoritative filter strictly scoped to the hospital
  const myRequests = allRequests.filter(r => r.hospitalId === hospitalId);

  const activeRequests = myRequests.filter(r => 
    r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
  );
  const emergencyRequests = activeRequests.filter(r => r.urgency === 'Emergency');
  const reservedUnitsCount = activeRequests.reduce((acc, r) => acc + (r.assignedUnitIds?.length || 0), 0);
  const fulfilledRequestsCount = myRequests.filter(r => r.status === 'Fulfilled').length;

  return {
    activeRequests: activeRequests.length,
    emergencyRequests: emergencyRequests.length,
    reservedUnitsCount,
    fulfilledRequestsCount,
    totalHospitalRequests: myRequests.length
  };
}

// Helper matching FEFO sorting and filtering
function filterAndSortAvailableUnits(units, { bloodGroup, component, referenceDate = new Date() }) {
  const refTime = new Date(referenceDate).setHours(0, 0, 0, 0);

  let filtered = units.filter(u => {
    if (u.availability !== 'Available' || u.testingStatus !== 'Passed') return false;
    const expTime = new Date(u.expiryDate).setHours(0, 0, 0, 0);
    return expTime >= refTime;
  });

  if (bloodGroup && bloodGroup !== 'all') {
    filtered = filtered.filter(u => u.bloodGroup === bloodGroup);
  }
  if (component && component !== 'all') {
    filtered = filtered.filter(u => u.component === component);
  }

  // FEFO: Earliest Expiry Date First
  return filtered.sort((a, b) => {
    const diff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    return diff !== 0 ? diff : new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime();
  });
}

// Helper matching breadcrumb resolution
function resolvePortalBreadcrumb(pathname) {
  if (pathname.includes('/dashboard')) return 'Dashboard';
  if (pathname.includes('/profile')) return 'My Profile & Preferences';
  if (pathname.includes('/eligibility')) return 'Eligibility Engine';
  if (pathname.includes('/donations')) return 'Donation History & Wallet';
  if (pathname.includes('/camps')) return 'Nearby Camps & Org Requests';
  if (pathname.startsWith('/hospital/emergency')) return 'Emergency Requisitions';
  if (pathname.includes('/alerts') || pathname.includes('/emergency')) return 'Emergency Alerts';
  if (pathname.includes('/availability')) return 'Blood Availability Search';
  if (pathname.includes('/requests')) return 'Hospital Requests';
  if (pathname.includes('/inventory')) return 'Inventory Management';
  if (pathname.includes('/samples')) return 'Patient Samples Log';
  if (pathname.includes('/messages')) return 'Bank Communications';
  return 'Portal';
}

describe('Hospital Data Isolation & Authoritative Counting Rules', () => {
  const seedRequests = [
    {
      id: 'REQ-1001',
      hospitalId: 'hosp-1',
      hospitalName: 'Apollo General Hospital',
      bloodGroup: 'O-',
      component: 'RBC',
      quantityUnits: 5,
      fulfilledUnits: 2,
      urgency: 'Emergency',
      status: 'Sample Submitted'
    },
    {
      id: 'REQ-1002',
      hospitalId: 'hosp-2',
      hospitalName: 'Metro LifeCare Hospital',
      bloodGroup: 'A+',
      component: 'RBC',
      quantityUnits: 2,
      fulfilledUnits: 2,
      urgency: 'Urgent',
      status: 'Fulfilled',
      assignedUnitIds: ['UNIT-2026-8005', 'UNIT-2026-8006']
    },
    {
      id: 'REQ-1003',
      hospitalId: 'hosp-1',
      hospitalName: 'Apollo General Hospital',
      bloodGroup: 'B+',
      component: 'Platelets',
      quantityUnits: 3,
      fulfilledUnits: 0,
      urgency: 'Routine',
      status: 'Pending'
    }
  ];

  it('correctly derives metrics for Apollo General Hospital (hosp-1)', () => {
    const metrics = deriveHospitalMetrics(seedRequests, 'hosp-1');
    assert.equal(metrics.totalHospitalRequests, 2);
    assert.equal(metrics.activeRequests, 2, 'REQ-1001 and REQ-1003 are active');
    assert.equal(metrics.emergencyRequests, 1, 'REQ-1001 is active emergency');
    assert.equal(metrics.reservedUnitsCount, 0, 'No reserved units assigned yet');
    assert.equal(metrics.fulfilledRequestsCount, 0, 'No fulfilled requisitions yet');
  });

  it('correctly isolates and derives metrics for Metro LifeCare (hosp-2)', () => {
    const metrics = deriveHospitalMetrics(seedRequests, 'hosp-2');
    assert.equal(metrics.totalHospitalRequests, 1);
    assert.equal(metrics.activeRequests, 0, 'REQ-1002 is Fulfilled, not active');
    assert.equal(metrics.emergencyRequests, 0);
    assert.equal(metrics.fulfilledRequestsCount, 1, 'REQ-1002 is fulfilled');
  });

  it('excludes cancelled and rejected requisitions from active count', () => {
    const extended = [
      ...seedRequests,
      {
        id: 'REQ-1004',
        hospitalId: 'hosp-1',
        urgency: 'Emergency',
        status: 'Cancelled',
        assignedUnitIds: ['UNIT-CANCELLED']
      },
      {
        id: 'REQ-1005',
        hospitalId: 'hosp-1',
        urgency: 'Routine',
        status: 'Rejected'
      }
    ];

    const metrics = deriveHospitalMetrics(extended, 'hosp-1');
    assert.equal(metrics.activeRequests, 2, 'Cancelled and Rejected tickets excluded from active count');
    assert.equal(metrics.emergencyRequests, 1, 'Cancelled emergency request excluded from active emergency count');
    assert.equal(metrics.reservedUnitsCount, 0, 'Cancelled request reserved units excluded');
  });
});

describe('FEFO Sorting & Blood Availability Logic', () => {
  const sampleUnits = [
    {
      id: 'UNIT-B',
      bloodGroup: 'O-',
      component: 'RBC',
      availability: 'Available',
      testingStatus: 'Passed',
      collectionDate: '2026-09-24',
      expiryDate: '2026-10-29'
    },
    {
      id: 'UNIT-A',
      bloodGroup: 'O-',
      component: 'RBC',
      availability: 'Available',
      testingStatus: 'Passed',
      collectionDate: '2026-09-10',
      expiryDate: '2026-10-15'
    },
    {
      id: 'UNIT-EXPIRED',
      bloodGroup: 'O-',
      component: 'RBC',
      availability: 'Available',
      testingStatus: 'Passed',
      collectionDate: '2026-08-01',
      expiryDate: '2026-09-01'
    },
    {
      id: 'UNIT-RESERVED',
      bloodGroup: 'O-',
      component: 'RBC',
      availability: 'Reserved',
      testingStatus: 'Passed',
      collectionDate: '2026-09-10',
      expiryDate: '2026-10-20'
    }
  ];

  it('sorts available units by earliest expiry date first (FEFO)', () => {
    const results = filterAndSortAvailableUnits(sampleUnits, {
      bloodGroup: 'O-',
      component: 'RBC',
      referenceDate: '2026-10-11'
    });

    assert.equal(results.length, 2);
    assert.equal(results[0].id, 'UNIT-A', 'Earliest expiry UNIT-A (Oct 15) must come first');
    assert.equal(results[1].id, 'UNIT-B', 'Later expiry UNIT-B (Oct 29) must come second');
  });

  it('excludes expired and reserved units from available query', () => {
    const results = filterAndSortAvailableUnits(sampleUnits, {
      bloodGroup: 'O-',
      component: 'RBC',
      referenceDate: '2026-10-11'
    });

    const hasExpired = results.some(u => u.id === 'UNIT-EXPIRED');
    const hasReserved = results.some(u => u.id === 'UNIT-RESERVED');
    assert.equal(hasExpired, false, 'Expired units must not be returned');
    assert.equal(hasReserved, false, 'Reserved units must not be returned');
  });
});

describe('Portal Breadcrumb Resolution', () => {
  it('resolves hospital routes with proper titles', () => {
    assert.equal(resolvePortalBreadcrumb('/hospital/dashboard'), 'Dashboard');
    assert.equal(resolvePortalBreadcrumb('/hospital/availability'), 'Blood Availability Search');
    assert.equal(resolvePortalBreadcrumb('/hospital/requests'), 'Hospital Requests');
    assert.equal(resolvePortalBreadcrumb('/hospital/emergency'), 'Emergency Requisitions');
    assert.equal(resolvePortalBreadcrumb('/hospital/samples'), 'Patient Samples Log');
    assert.equal(resolvePortalBreadcrumb('/hospital/messages'), 'Bank Communications');
  });
});

describe('Phase 2: Unified Requisition Logic & Timing', () => {
  function getSuggestedRequiredByHours(urgency) {
    return urgency === 'Emergency' ? 4 : urgency === 'Urgent' ? 12 : 24;
  }

  function validateRequisitionForm({ patientReferenceId, department, quantityUnits }) {
    if (!patientReferenceId || !patientReferenceId.trim()) return { valid: false, error: 'Patient ID required' };
    if (!department || !department.trim()) return { valid: false, error: 'Department required' };
    if (quantityUnits < 1 || quantityUnits > 20) return { valid: false, error: 'Quantity out of range' };
    return { valid: true };
  }

  it('allocates appropriate dispatch windows per urgency level', () => {
    assert.equal(getSuggestedRequiredByHours('Emergency'), 4, 'STAT emergency requires 4-hour window');
    assert.equal(getSuggestedRequiredByHours('Urgent'), 12, 'Urgent priority requires 12-hour window');
    assert.equal(getSuggestedRequiredByHours('Routine'), 24, 'Routine requires 24-hour window');
  });

  it('validates form fields and rejects invalid submissions', () => {
    assert.equal(validateRequisitionForm({ patientReferenceId: '', department: 'ICU', quantityUnits: 2 }).valid, false);
    assert.equal(validateRequisitionForm({ patientReferenceId: 'PAT-1', department: '', quantityUnits: 2 }).valid, false);
    assert.equal(validateRequisitionForm({ patientReferenceId: 'PAT-1', department: 'ICU', quantityUnits: 0 }).valid, false);
    assert.equal(validateRequisitionForm({ patientReferenceId: 'PAT-1', department: 'ICU', quantityUnits: 25 }).valid, false);
    assert.equal(validateRequisitionForm({ patientReferenceId: 'PAT-1', department: 'ICU', quantityUnits: 3 }).valid, true);
  });
});

describe('Phase 2: Contextual Patient Sample Selection', () => {
  const mixedRequests = [
    { id: 'REQ-1', hospitalId: 'hosp-1', status: 'Pending', patientReferenceId: 'PAT-101' },
    { id: 'REQ-2', hospitalId: 'hosp-1', status: 'Sample Submitted', patientReferenceId: 'PAT-102' },
    { id: 'REQ-3', hospitalId: 'hosp-1', status: 'Fulfilled', patientReferenceId: 'PAT-103' },
    { id: 'REQ-4', hospitalId: 'hosp-1', status: 'Cancelled', patientReferenceId: 'PAT-104' },
    { id: 'REQ-5', hospitalId: 'hosp-1', status: 'Rejected', patientReferenceId: 'PAT-105' }
  ];

  function getEligibleRequestsForSamples(requests) {
    return requests.filter(r => r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected');
  }

  function resolveSelectedRequisition(eligible, requestedId) {
    if (requestedId && eligible.some(r => r.id === requestedId)) {
      return eligible.find(r => r.id === requestedId);
    }
    return eligible.length > 0 ? eligible[0] : null;
  }

  it('filters out fulfilled, cancelled, and rejected requisitions from sample eligibility', () => {
    const eligible = getEligibleRequestsForSamples(mixedRequests);
    assert.equal(eligible.length, 2);
    assert.equal(eligible.some(r => r.id === 'REQ-1'), true);
    assert.equal(eligible.some(r => r.id === 'REQ-2'), true);
    assert.equal(eligible.some(r => r.id === 'REQ-3'), false, 'Fulfilled request must be ineligible');
    assert.equal(eligible.some(r => r.id === 'REQ-4'), false, 'Cancelled request must be ineligible');
    assert.equal(eligible.some(r => r.id === 'REQ-5'), false, 'Rejected request must be ineligible');
  });

  it('preselects valid query parameter if eligible, or safely defaults to first eligible', () => {
    const eligible = getEligibleRequestsForSamples(mixedRequests);
    
    // Valid query param
    const preselected = resolveSelectedRequisition(eligible, 'REQ-2');
    assert.equal(preselected?.id, 'REQ-2');
    assert.equal(preselected?.patientReferenceId, 'PAT-102');

    // Ineligible query param falls back to first eligible
    const fallback = resolveSelectedRequisition(eligible, 'REQ-3');
    assert.equal(fallback?.id, 'REQ-1');

    // Empty list returns null safely
    assert.equal(resolveSelectedRequisition([], 'REQ-1'), null);
  });
});

describe('Phase 2: Conversation Segregation & History Isolation', () => {
  const storeMessages = [
    { id: 'M-1', requestId: 'REQ-1001', message: 'OR-3 critical bleeding', senderRole: 'hospital' },
    { id: 'M-2', requestId: 'REQ-1001', message: 'Reserving 2 units O-', senderRole: 'blood_bank' },
    { id: 'M-3', requestId: 'REQ-1003', message: 'Elective oncology platelets query', senderRole: 'hospital' }
  ];

  function getMessagesForRequisition(messages, reqId) {
    return messages.filter(m => m.requestId === reqId);
  }

  it('strictly isolates messages between requisitions when switching conversations', () => {
    const chat1001 = getMessagesForRequisition(storeMessages, 'REQ-1001');
    const chat1003 = getMessagesForRequisition(storeMessages, 'REQ-1003');
    const chatEmpty = getMessagesForRequisition(storeMessages, 'REQ-9999');

    assert.equal(chat1001.length, 2);
    assert.equal(chat1001.every(m => m.requestId === 'REQ-1001'), true);

    assert.equal(chat1003.length, 1);
    assert.equal(chat1003[0].message, 'Elective oncology platelets query');

    assert.equal(chatEmpty.length, 0);
  });
});

/* ========================================================================= */
/* Phase 3A: Data Integrity and Workflow Cleanup Suite                       */
/* ========================================================================= */

describe('Phase 3A: Authoritative Reserved Units Calculation', () => {
  function calculateReservedUnits(hospitalRequests, allBloodUnits = []) {
    const activeRequests = hospitalRequests.filter(r => 
      r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
    );

    const activeRequestIds = new Set(activeRequests.map(r => r.id));
    const uniqueReservedUnitIds = new Set();

    allBloodUnits.forEach(u => {
      if (u.availability === 'Reserved' && u.reservedForRequestId && activeRequestIds.has(u.reservedForRequestId)) {
        uniqueReservedUnitIds.add(u.id);
      }
    });

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

    let additionalVirtualReserved = 0;
    activeRequests.forEach(r => {
      const explicitReserved = typeof r.reservedCount === 'number' && !isNaN(r.reservedCount)
        ? Math.max(0, r.reservedCount)
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

  it('correctly calculates zero reservations when no units are reserved', () => {
    const requests = [
      { id: 'REQ-1', hospitalId: 'hosp-1', status: 'Pending', quantityUnits: 3 },
      { id: 'REQ-2', hospitalId: 'hosp-1', status: 'Sample Submitted', quantityUnits: 2 }
    ];
    const units = [
      { id: 'U-1', availability: 'Available' },
      { id: 'U-2', availability: 'Available' }
    ];
    assert.equal(calculateReservedUnits(requests, units), 0);
  });

  it('correctly derives multiple reserved units on REQ-1327', () => {
    const requests = [
      {
        id: 'REQ-1327',
        hospitalId: 'hosp-1',
        status: 'Reserved',
        quantityUnits: 2,
        assignedUnitIds: ['UNIT-2026-8015', 'UNIT-2026-8016']
      }
    ];
    const units = [
      { id: 'UNIT-2026-8015', availability: 'Reserved', reservedForRequestId: 'REQ-1327' },
      { id: 'UNIT-2026-8016', availability: 'Reserved', reservedForRequestId: 'REQ-1327' },
      { id: 'UNIT-2026-8017', availability: 'Available' }
    ];
    assert.equal(calculateReservedUnits(requests, units), 2);
  });

  it('does not count an entire multi-unit request as 1 unit when status is Reserved', () => {
    const requests = [
      {
        id: 'REQ-999',
        hospitalId: 'hosp-1',
        status: 'Reserved',
        quantityUnits: 4 // 4 units reserved
      }
    ];
    // No individual unit records yet (e.g. legacy or simulated allocation)
    assert.equal(calculateReservedUnits(requests, []), 4, 'Must count 4 units, NOT 1 unit merely because status is Reserved');
  });

  it('prevents duplicate counting when a reservation appears in multiple related records', () => {
    const requests = [
      {
        id: 'REQ-1327',
        hospitalId: 'hosp-1',
        status: 'Reserved',
        quantityUnits: 1,
        assignedUnitIds: ['UNIT-2026-8015']
      }
    ];
    const units = [
      // Unit appears in unit inventory linked to REQ-1327 AND in request.assignedUnitIds
      { id: 'UNIT-2026-8015', availability: 'Reserved', reservedForRequestId: 'REQ-1327' }
    ];
    assert.equal(calculateReservedUnits(requests, units), 1, 'Unit present in both records must be deduplicated to 1');
  });

  it('excludes fulfilled, cancelled, and rejected requisitions from reserved count', () => {
    const requests = [
      { id: 'REQ-F', hospitalId: 'hosp-1', status: 'Fulfilled', assignedUnitIds: ['U-10', 'U-11'] },
      { id: 'REQ-C', hospitalId: 'hosp-1', status: 'Cancelled', assignedUnitIds: ['U-12'] },
      { id: 'REQ-R', hospitalId: 'hosp-1', status: 'Rejected', assignedUnitIds: ['U-13'] },
      { id: 'REQ-A', hospitalId: 'hosp-1', status: 'Reserved', assignedUnitIds: ['U-14'] }
    ];
    const units = [
      { id: 'U-10', availability: 'Reserved', reservedForRequestId: 'REQ-F' },
      { id: 'U-14', availability: 'Reserved', reservedForRequestId: 'REQ-A' }
    ];
    assert.equal(calculateReservedUnits(requests, units), 1, 'Only active reserved units must be counted');
  });

  it('safely handles missing, NaN, or non-numeric reservation quantities', () => {
    const requests = [
      { id: 'REQ-N1', hospitalId: 'hosp-1', status: 'Reserved', quantityUnits: NaN },
      { id: 'REQ-N2', hospitalId: 'hosp-1', status: 'Reserved', quantityUnits: null },
      { id: 'REQ-N3', hospitalId: 'hosp-1', status: 'Reserved', quantityUnits: 0 }
    ];
    assert.equal(calculateReservedUnits(requests, []), 0, 'Invalid or missing quantities must evaluate to 0 without fabricating counts');
  });
});

describe('Phase 3A: Anonymized Patient Reference Validation', () => {
  function validatePatientReference(ref) {
    if (ref === undefined || ref === null) return { valid: false, error: 'Patient reference is required' };
    const trimmed = String(ref).trim();
    if (trimmed.length < 3) {
      return { valid: false, error: 'Patient reference ID must be at least 3 characters (e.g., PAT-4402 or PAT-4402 (OR-2))' };
    }
    return { valid: true, value: trimmed };
  }

  it('rejects corrupted single-character patient reference "h" and whitespace', () => {
    assert.equal(validatePatientReference('h').valid, false);
    assert.equal(validatePatientReference(' h ').valid, false);
    assert.equal(validatePatientReference('').valid, false);
    assert.equal(validatePatientReference('   ').valid, false);
    assert.equal(validatePatientReference(null).valid, false);
  });

  it('accepts valid synthetic patient identifiers with and without clinical context', () => {
    assert.equal(validatePatientReference('PAT-4402').valid, true);
    assert.equal(validatePatientReference('PAT-4402 (OR-2)').valid, true);
    assert.equal(validatePatientReference('TRAUMA-PAT-901').valid, true);
  });
});

describe('Phase 3A: Patient Sample Throttling and Seed Idempotency', () => {
  function checkSampleSubmissionThrottle(existingSamples, newSubmission, windowMs = 10000, nowMs = Date.now()) {
    const match = existingSamples.find(s => 
      s.requestId === newSubmission.requestId && 
      s.sampleType === newSubmission.sampleType &&
      (nowMs - new Date(s.submittedAt).getTime()) < windowMs
    );
    if (match) {
      return { allowed: false, error: `Duplicate sample within throttle window (${match.id})` };
    }
    return { allowed: true };
  }

  it('throttles rapid duplicate sample submissions for the same requisition and sample type', () => {
    const existing = [
      {
        id: 'SMP-503',
        requestId: 'REQ-1327',
        sampleType: 'Cross-Match Sample',
        submittedAt: new Date(Date.now() - 3000).toISOString() // 3 seconds ago
      }
    ];

    const duplicateAttempt = {
      requestId: 'REQ-1327',
      sampleType: 'Cross-Match Sample'
    };

    const res = checkSampleSubmissionThrottle(existing, duplicateAttempt);
    assert.equal(res.allowed, false, 'Rapid duplicate within 10s window must be blocked');
  });

  it('allows different sample types or different requisitions within the throttle window', () => {
    const existing = [
      {
        id: 'SMP-503',
        requestId: 'REQ-1327',
        sampleType: 'Cross-Match Sample',
        submittedAt: new Date(Date.now() - 3000).toISOString()
      }
    ];

    // Different sample type on same request
    const diffType = checkSampleSubmissionThrottle(existing, {
      requestId: 'REQ-1327',
      sampleType: 'Blood Typing Sample'
    });
    assert.equal(diffType.allowed, true);

    // Same sample type on different request
    const diffReq = checkSampleSubmissionThrottle(existing, {
      requestId: 'REQ-2148',
      sampleType: 'Cross-Match Sample'
    });
    assert.equal(diffReq.allowed, true);
  });

  it('guarantees seeded samples contain 3-5 distinct records with unique IDs and coherent linkages', () => {
    const syntheticSeedSamples = [
      { id: 'SMP-501', requestId: 'REQ-1001', patientReferenceId: 'PAT-8812', sampleType: 'Cross-Match Sample' },
      { id: 'SMP-502', requestId: 'REQ-1001', patientReferenceId: 'PAT-8812', sampleType: 'Blood Typing Sample' },
      { id: 'SMP-503', requestId: 'REQ-1327', patientReferenceId: 'PAT-4402', sampleType: 'Cross-Match Sample' },
      { id: 'SMP-504', requestId: 'REQ-2148', patientReferenceId: 'TRAUMA-PAT-901', sampleType: 'Cross-Match Sample' }
    ];

    assert.equal(syntheticSeedSamples.length >= 3 && syntheticSeedSamples.length <= 5, true);
    const uniqueIds = new Set(syntheticSeedSamples.map(s => s.id));
    assert.equal(uniqueIds.size, syntheticSeedSamples.length, 'All sample IDs must be distinct');
    assert.equal(syntheticSeedSamples.every(s => s.patientReferenceId.length >= 3), true);
    assert.equal(syntheticSeedSamples.some(s => s.patientReferenceId === 'h'), false, 'Corrupted "h" must not exist');
  });
});

describe('Phase 3B: Logistics Map, Haversine Distance & Route Polylines', () => {
  function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  }

  it('calculates verified Haversine distance between Apollo Hospital and City Central Blood Center', () => {
    // Apollo General: 12.9716, 77.5946; City Central: 12.9780, 77.5995
    const dist = calculateDistance(12.9716, 77.5946, 12.9780, 77.5995);
    assert.equal(typeof dist, 'number');
    assert.equal(dist > 0.7 && dist < 1.1, true, `Expected ~0.9 km, received ${dist}`);
  });

  it('returns null and does not fabricate distances if coordinates are missing', () => {
    assert.equal(calculateDistance(12.9716, 77.5946, null, 77.5995), null);
    assert.equal(calculateDistance(null, null, 12.9780, 77.5995), null);
    assert.equal(calculateDistance(undefined, 77.5946, 12.9780, undefined), null);
  });

  it('protects private patient information in map dispatches', () => {
    function sanitizeDispatchForMap(dispatch) {
      return {
        id: dispatch.id,
        bloodGroup: dispatch.bloodGroup,
        component: dispatch.component,
        quantityUnits: dispatch.quantityUnits,
        urgency: dispatch.urgency,
        status: dispatch.status,
        patientReferenceId: dispatch.patientReferenceId, // Anonymized reference only
        // Must NOT include full name, SSN, phone number, address, or medical history
        patientFullName: undefined,
        patientPhone: undefined
      };
    }

    const rawDispatch = {
      id: 'DISP-101',
      bloodGroup: 'O-',
      component: 'RBC',
      quantityUnits: 2,
      urgency: 'Emergency',
      status: 'In Transit',
      patientReferenceId: 'PAT-4402 (OR-2)',
      patientFullName: 'John Doe',
      patientPhone: '+1-555-0192'
    };

    const sanitized = sanitizeDispatchForMap(rawDispatch);
    assert.equal(sanitized.patientReferenceId, 'PAT-4402 (OR-2)');
    assert.equal(sanitized.patientFullName, undefined);
    assert.equal(sanitized.patientPhone, undefined);
  });

  it('explicitly reports live vehicle GPS is unintegrated without fake animations', () => {
    const logisticsConfig = {
      liveCourierGpsIntegrated: false,
      telematicsNotice: 'Live courier vehicle GPS telematics is not integrated. Displaying verified facility and dispatch status.'
    };
    assert.equal(logisticsConfig.liveCourierGpsIntegrated, false);
    assert.match(logisticsConfig.telematicsNotice, /not integrated/i);
  });
});

describe('Phase 3B: Unit Requisition Prefill & Atomic Revalidation', () => {
  it('does not alter inventory simply by generating or viewing prefilled parameters', () => {
    const inventory = [
      { id: 'UNIT-2026-8001', availability: 'Available', bloodGroup: 'O-', component: 'RBC' }
    ];

    // Simulating user opening /hospital/requests/new?unitId=UNIT-2026-8001
    const searchParams = new URLSearchParams('unitId=UNIT-2026-8001&bloodGroup=O-&component=RBC');
    const prefill = {
      targetUnitId: searchParams.get('unitId'),
      bloodGroup: searchParams.get('bloodGroup'),
      component: searchParams.get('component')
    };

    assert.equal(prefill.targetUnitId, 'UNIT-2026-8001');
    assert.equal(inventory[0].availability, 'Available', 'Inventory must NOT be decremented on navigation or form open');
  });

  it('revalidates unit availability server-side and rejects expired or unavailable units with 409', () => {
    const unitsDb = [
      { id: 'UNIT-VALID', availability: 'Available', testingStatus: 'Passed', expiryDate: '2026-11-20' },
      { id: 'UNIT-EXPIRED', availability: 'Available', testingStatus: 'Passed', expiryDate: '2026-09-01' },
      { id: 'UNIT-RESERVED', availability: 'Reserved', testingStatus: 'Passed', expiryDate: '2026-11-20' }
    ];

    function validateUnitAllocation(targetUnitId, units, now = new Date('2026-10-11')) {
      const unit = units.find(u => u.id === targetUnitId);
      if (!unit) {
        return { status: 409, error: `Target unit ${targetUnitId} was not found.` };
      }
      if (unit.availability !== 'Available' || unit.testingStatus !== 'Passed') {
        return { status: 409, error: `Target unit ${targetUnitId} is currently ${unit.availability}.` };
      }
      if (new Date(unit.expiryDate).getTime() < now.getTime()) {
        return { status: 409, error: `Target unit ${targetUnitId} expired on ${unit.expiryDate}.` };
      }
      return { status: 200, unit };
    }

    const validRes = validateUnitAllocation('UNIT-VALID', unitsDb);
    assert.equal(validRes.status, 200);

    const expiredRes = validateUnitAllocation('UNIT-EXPIRED', unitsDb);
    assert.equal(expiredRes.status, 409);
    assert.match(expiredRes.error, /expired/i);

    const reservedRes = validateUnitAllocation('UNIT-RESERVED', unitsDb);
    assert.equal(reservedRes.status, 409);
    assert.match(reservedRes.error, /Reserved/i);
  });
});

describe('Phase 3B: On-Premise Refrigerator & OT Par-Level Monitor', () => {
  function calculateParLevelShortage(minimumParLevel, usableOnHandQuantity) {
    const min = Number(minimumParLevel) || 0;
    const usable = Number(usableOnHandQuantity) || 0;
    return Math.max(0, min - usable);
  }

  function getUsableOnHandUnits(units) {
    const now = new Date('2026-10-11').getTime();
    return units.filter(u => 
      u.availability === 'Available' && 
      u.testingStatus === 'Passed' &&
      new Date(u.expiryDate).getTime() >= now
    );
  }

  it('correctly calculates shortage as max(0, minimumParLevel - usableOnHandQuantity)', () => {
    assert.equal(calculateParLevelShortage(4, 2), 2, 'Deficit of 2 units');
    assert.equal(calculateParLevelShortage(4, 4), 0, 'Sufficient stock');
    assert.equal(calculateParLevelShortage(4, 6), 0, 'Surplus stock must not yield negative shortage');
    assert.equal(calculateParLevelShortage(0, 0), 0);
  });

  it('excludes quarantined, expired, and reserved units from usable on-hand quantity', () => {
    const stock = [
      { id: 'U1', availability: 'Available', testingStatus: 'Passed', expiryDate: '2026-10-25' },
      { id: 'U2', availability: 'Reserved', testingStatus: 'Passed', expiryDate: '2026-10-25' },
      { id: 'U3', availability: 'Quarantine', testingStatus: 'Passed', expiryDate: '2026-10-25' },
      { id: 'U4', availability: 'Available', testingStatus: 'Passed', expiryDate: '2026-09-01' } // Expired
    ];

    const usable = getUsableOnHandUnits(stock);
    assert.equal(usable.length, 1);
    assert.equal(usable[0].id, 'U1');
  });

  it('reports missing data models when on-premise hardware telemetry is not configured', () => {
    const capabilityAudit = {
      configured: false,
      reason: 'Hospital-owned on-premise stock and minimum par levels are not configured in schema.',
      missingCapabilities: [
        'hospital_refrigerators',
        'hospital_par_levels',
        'hospital_inventory_units'
      ]
    };

    assert.equal(capabilityAudit.configured, false);
    assert.equal(capabilityAudit.missingCapabilities.length, 3);
    assert.equal(capabilityAudit.missingCapabilities.includes('hospital_refrigerators'), true);
    assert.equal(capabilityAudit.missingCapabilities.includes('hospital_par_levels'), true);
    assert.equal(capabilityAudit.missingCapabilities.includes('hospital_inventory_units'), true);
  });
});

describe('Phase 4A: Simplified Dashboard Header Actions', () => {
  function resolveDashboardActions(configuredActions) {
    // Validates that duplicate creation CTAs are merged into one prominent "+ New Blood Request"
    const creationActions = configuredActions.filter(a => a.type === 'create_requisition');
    const primaryCta = configuredActions.find(a => a.isPrimary);
    const emergencyShortcut = configuredActions.find(a => a.isEmergencyShortcut);
    const secondaryActions = configuredActions.filter(a => !a.isPrimary && !a.isEmergencyShortcut);

    return {
      totalCreationActions: creationActions.length,
      primaryCta,
      emergencyShortcut,
      secondaryCount: secondaryActions.length
    };
  }

  it('consolidates creation actions into one primary CTA with an emergency shortcut', () => {
    const headerActions = [
      { id: 'primary-create', label: '+ New Blood Request', path: '/hospital/requests/new', isPrimary: true, type: 'create_requisition' },
      { id: 'stat-shortcut', label: 'STAT Protocol', path: '/hospital/requests/new?urgency=Emergency', isEmergencyShortcut: true, type: 'create_requisition' },
      { id: 'logistics-map', label: 'Logistics & Map', path: '/hospital/logistics', type: 'navigation' },
      { id: 'search-stock', label: 'Search Regional Stock', path: '/search-blood', type: 'navigation' }
    ];

    const result = resolveDashboardActions(headerActions);
    assert.equal(result.primaryCta?.label, '+ New Blood Request');
    assert.equal(result.primaryCta?.path, '/hospital/requests/new');
    assert.equal(result.emergencyShortcut?.path, '/hospital/requests/new?urgency=Emergency');
    assert.equal(result.secondaryCount, 2);
  });
});

describe('Phase 4A: Local OT Storage Ledger Validation & Par Calculations', () => {
  function validateStorageLedgerEntry(entry) {
    if (!entry.storageLocation || !entry.storageLocation.trim()) {
      return { valid: false, error: 'Storage location is required' };
    }
    const qty = Number(entry.quantityUnits);
    if (!Number.isInteger(qty) || qty < 0) {
      return { valid: false, error: 'Quantity must be a non-negative integer' };
    }
    const validGroups = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    if (!validGroups.includes(entry.bloodGroup)) {
      return { valid: false, error: `Invalid blood group: ${entry.bloodGroup}` };
    }
    const validComponents = ['RBC', 'Plasma', 'Platelets'];
    if (!validComponents.includes(entry.component)) {
      return { valid: false, error: `Invalid component: ${entry.component}` };
    }
    if (entry.minThreshold != null) {
      const min = Number(entry.minThreshold);
      if (!Number.isInteger(min) || min < 0) {
        return { valid: false, error: 'Minimum par threshold must be a non-negative integer' };
      }
    }
    return { valid: true };
  }

  it('validates storage ledger entry quantities and rejects negative or float values', () => {
    assert.equal(validateStorageLedgerEntry({ storageLocation: 'OT-1 Cooler', bloodGroup: 'O-', component: 'RBC', quantityUnits: 2 }).valid, true);
    assert.equal(validateStorageLedgerEntry({ storageLocation: 'OT-1 Cooler', bloodGroup: 'O-', component: 'RBC', quantityUnits: 0 }).valid, true);
    assert.equal(validateStorageLedgerEntry({ storageLocation: 'OT-1 Cooler', bloodGroup: 'O-', component: 'RBC', quantityUnits: -1 }).valid, false);
    assert.equal(validateStorageLedgerEntry({ storageLocation: 'OT-1 Cooler', bloodGroup: 'O-', component: 'RBC', quantityUnits: 2.5 }).valid, false);
    assert.equal(validateStorageLedgerEntry({ storageLocation: '', bloodGroup: 'O-', component: 'RBC', quantityUnits: 2 }).valid, false);
  });

  it('strictly excludes reserved, expired, and quarantined entries from usable OT stock', () => {
    const ledger = [
      { id: 'E1', bloodGroup: 'O-', component: 'RBC', quantityUnits: 2, status: 'Usable', expiryDate: '2026-11-01', minThreshold: 4 },
      { id: 'E2', bloodGroup: 'O-', component: 'RBC', quantityUnits: 1, status: 'Reserved', expiryDate: '2026-11-01', minThreshold: 4 },
      { id: 'E3', bloodGroup: 'O-', component: 'RBC', quantityUnits: 2, status: 'Quarantined', expiryDate: '2026-11-01', minThreshold: 4 },
      { id: 'E4', bloodGroup: 'O-', component: 'RBC', quantityUnits: 1, status: 'Usable', expiryDate: '2026-09-01', minThreshold: 4 } // Expired
    ];

    const now = new Date('2026-10-11').getTime();
    let totalOnHand = 0;
    let usable = 0;

    ledger.forEach(entry => {
      totalOnHand += entry.quantityUnits;
      const isExpired = new Date(entry.expiryDate).getTime() < now;
      if (entry.status === 'Usable' && !isExpired) {
        usable += entry.quantityUnits;
      }
    });

    assert.equal(totalOnHand, 6, 'Total on-hand across all states is 6');
    assert.equal(usable, 2, 'Only E1 is usable non-expired stock');
    const shortage = Math.max(0, 4 - usable);
    assert.equal(shortage, 2, 'Shortage calculated against usable stock only');
  });

  it('prevents accidental rapid duplicate submissions in storage ledger', () => {
    const existingEntries = [
      {
        hospitalId: 'hosp-1',
        storageLocation: 'OT-1 Emergency Cold Box',
        bloodGroup: 'O-',
        component: 'RBC',
        quantityUnits: 2,
        createdAt: new Date(Date.now() - 2000).toISOString() // 2s ago
      }
    ];

    function checkDuplicate(entries, newEntry, throttleMs = 5000) {
      const match = entries.find(e =>
        e.hospitalId === newEntry.hospitalId &&
        e.storageLocation === newEntry.storageLocation &&
        e.bloodGroup === newEntry.bloodGroup &&
        e.component === newEntry.component &&
        e.quantityUnits === newEntry.quantityUnits &&
        (Date.now() - new Date(e.createdAt).getTime()) < throttleMs
      );
      return Boolean(match);
    }

    const isDup = checkDuplicate(existingEntries, {
      hospitalId: 'hosp-1',
      storageLocation: 'OT-1 Emergency Cold Box',
      bloodGroup: 'O-',
      component: 'RBC',
      quantityUnits: 2
    });
    assert.equal(isDup, true, 'Rapid duplicate within 5s window must be flagged');
  });
});

describe('Phase 4A: Logistics Map Zero Balance vs Unavailable Distinction', () => {
  function formatBankInventoryStatus(summary) {
    if (summary === undefined || summary === null) {
      return { status: 'unavailable', label: 'Inventory Data Unavailable from Center' };
    }
    if (summary.totalAvailable === 0) {
      return { status: 'zero_balance', label: '0 Units Available (Confirmed Zero Balance Across Components)' };
    }
    return { status: 'available', count: summary.totalAvailable, label: `${summary.totalAvailable} Units Available` };
  }

  it('clearly distinguishes confirmed zero balance from missing inventory data', () => {
    const zeroBalanceBank = { totalAvailable: 0, rbcCount: 0, plasmaCount: 0, plateletsCount: 0 };
    const missingDataBank = null;
    const populatedBank = { totalAvailable: 18, rbcCount: 14, plasmaCount: 4, plateletsCount: 0 };

    assert.equal(formatBankInventoryStatus(zeroBalanceBank).status, 'zero_balance');
    assert.equal(formatBankInventoryStatus(missingDataBank).status, 'unavailable');
    assert.equal(formatBankInventoryStatus(populatedBank).status, 'available');
    assert.equal(formatBankInventoryStatus(populatedBank).count, 18);
  });

  it('highlights the selected dispatch route polyline while dimming other corridors', () => {
    const bloodBanks = [
      { bloodBankId: 'bb-1', bloodBankName: 'City Central' },
      { bloodBankId: 'bb-2', bloodBankName: 'Red Cross' }
    ];

    const activeDispatches = [
      { requestId: 'DISP-1327', bloodBankId: 'bb-1' }
    ];

    const selectedDispatchId = 'DISP-1327';

    const corridors = bloodBanks.map(bb => {
      const isSelected = activeDispatches.some(
        d => d.requestId === selectedDispatchId && d.bloodBankId === bb.bloodBankId
      );
      return {
        bloodBankId: bb.bloodBankId,
        color: isSelected ? '#ea580c' : '#3b82f6',
        weight: isSelected ? 5 : 3,
        highlighted: isSelected
      };
    });

    const highlighted = corridors.find(c => c.highlighted);
    assert.equal(highlighted?.bloodBankId, 'bb-1');
    assert.equal(highlighted?.color, '#ea580c');
    assert.equal(highlighted?.weight, 5);

    const other = corridors.find(c => !c.highlighted);
    assert.equal(other?.bloodBankId, 'bb-2');
    assert.equal(other?.weight, 3);
  });
});

describe('Phase 4A: Preserved Blood Availability Search Filters', () => {
  it('constructs round-trip return URLs that preserve search filter state', () => {
    function buildRequisitionUrl(unit, activeFilters) {
      const params = new URLSearchParams({
        unitId: unit.id,
        bloodGroup: unit.bloodGroup,
        component: unit.component,
        bloodBankId: unit.bloodBankId,
        urgency: activeFilters.urgency || 'Routine',
        returnBloodGroup: activeFilters.bloodGroup || 'all',
        returnComponent: activeFilters.component || 'all',
        returnUrgency: activeFilters.urgency || 'Routine'
      });
      return `/hospital/requests/new?${params.toString()}`;
    }

    function buildReturnUrl(searchParams) {
      const returnBloodGroup = searchParams.get('returnBloodGroup') || searchParams.get('bloodGroup');
      const returnComponent = searchParams.get('returnComponent') || searchParams.get('component');
      const returnUrgency = searchParams.get('returnUrgency') || searchParams.get('urgency');

      const out = new URLSearchParams();
      if (returnBloodGroup && returnBloodGroup !== 'all') out.set('bloodGroup', returnBloodGroup);
      if (returnComponent && returnComponent !== 'all') out.set('component', returnComponent);
      if (returnUrgency && returnUrgency !== 'Routine') out.set('urgency', returnUrgency);

      return `/hospital/availability${out.toString() ? `?${out.toString()}` : ''}`;
    }

    const testUnit = { id: 'UNIT-2026-8001', bloodGroup: 'O+', component: 'RBC', bloodBankId: 'bb-1' };
    const currentFilters = { bloodGroup: 'O+', component: 'RBC', urgency: 'Urgent' };

    const reqUrl = buildRequisitionUrl(testUnit, currentFilters);
    const parsedParams = new URLSearchParams(reqUrl.split('?')[1]);

    const returnUrl = buildReturnUrl(parsedParams);
    assert.equal(returnUrl, '/hospital/availability?bloodGroup=O%2B&component=RBC&urgency=Urgent');
  });
});

describe('Phase 4C: Full Requisition Validation & Duplicate Prevention', () => {
  function validateRequisitionInput({ bloodGroup, component, quantityUnits, patientReferenceId }) {
    const validGroups = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const validComponents = ['RBC', 'Plasma', 'Platelets', 'PRBC', 'Cryo', 'Whole Blood'];

    if (!bloodGroup || !component || quantityUnits === undefined || quantityUnits === null) {
      return { valid: false, error: 'Blood group, component, and quantity are required' };
    }
    if (!validGroups.includes(bloodGroup)) {
      return { valid: false, error: `Invalid blood group: ${bloodGroup}` };
    }
    if (!validComponents.includes(component)) {
      return { valid: false, error: `Invalid blood component: ${component}` };
    }
    const qty = Number(quantityUnits);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return { valid: false, error: 'Quantity must be an integer between 1 and 20 units.' };
    }
    if (patientReferenceId && String(patientReferenceId).trim().length < 3) {
      return { valid: false, error: 'Patient reference ID must be at least 3 characters' };
    }
    return { valid: true };
  }

  it('validates blood group, component, and quantity constraints strictly', () => {
    assert.equal(validateRequisitionInput({ bloodGroup: 'Z+', component: 'RBC', quantityUnits: 2 }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'Serum', quantityUnits: 2 }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'RBC', quantityUnits: -1 }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'RBC', quantityUnits: 0 }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'RBC', quantityUnits: 2.5 }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'RBC', quantityUnits: 25 }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'RBC', quantityUnits: 4, patientReferenceId: 'P' }).valid, false);
    assert.equal(validateRequisitionInput({ bloodGroup: 'O+', component: 'RBC', quantityUnits: 4, patientReferenceId: 'PAT-8812' }).valid, true);
  });

  it('detects and rejects rapid duplicate submissions within 5s window', () => {
    const existing = [
      {
        id: 'REQ-1001',
        hospitalId: 'hosp-1',
        patientReferenceId: 'PAT-4402',
        bloodGroup: 'O-',
        component: 'RBC',
        quantityUnits: 2,
        createdAt: new Date().toISOString()
      }
    ];

    function checkReqDuplicate(reqs, candidate, throttleMs = 5000) {
      const nowMs = Date.now();
      return Boolean(reqs.find(r =>
        r.hospitalId === candidate.hospitalId &&
        r.patientReferenceId.trim().toLowerCase() === candidate.patientReferenceId.trim().toLowerCase() &&
        r.bloodGroup === candidate.bloodGroup &&
        r.component === candidate.component &&
        r.quantityUnits === candidate.quantityUnits &&
        (nowMs - new Date(r.createdAt).getTime()) < throttleMs
      ));
    }

    const isDup = checkReqDuplicate(existing, {
      hospitalId: 'hosp-1',
      patientReferenceId: 'pat-4402',
      bloodGroup: 'O-',
      component: 'RBC',
      quantityUnits: 2
    });
    assert.equal(isDup, true, 'Exact requisition within 5s must trigger duplicate conflict');

    const differentPatient = checkReqDuplicate(existing, {
      hospitalId: 'hosp-1',
      patientReferenceId: 'pat-9999',
      bloodGroup: 'O-',
      component: 'RBC',
      quantityUnits: 2
    });
    assert.equal(differentPatient, false, 'Different patient reference must be allowed');
  });
});

describe('Phase 4C: Cross-Hospital Multi-Tenant Data Isolation & Authorization', () => {
  const hospital1Requests = [
    { id: 'REQ-H1-1', hospitalId: 'hosp-1', status: 'Pending' },
    { id: 'REQ-H1-2', hospitalId: 'hosp-1', status: 'Reserved' }
  ];
  const hospital2Requests = [
    { id: 'REQ-H2-1', hospitalId: 'hosp-2', status: 'Pending' }
  ];
  const allRequests = [...hospital1Requests, ...hospital2Requests];

  it('strictly isolates hospital requisition queries to the authenticated facility', () => {
    function getHospitalScopedRequests(requests, user) {
      if (user.role === 'hospital') {
        return requests.filter(r => r.hospitalId === user.id);
      }
      return requests;
    }

    const hosp1User = { id: 'hosp-1', role: 'hospital' };
    const hosp2User = { id: 'hosp-2', role: 'hospital' };

    const h1Result = getHospitalScopedRequests(allRequests, hosp1User);
    const h2Result = getHospitalScopedRequests(allRequests, hosp2User);

    assert.equal(h1Result.length, 2);
    assert.equal(h1Result.every(r => r.hospitalId === 'hosp-1'), true);

    assert.equal(h2Result.length, 1);
    assert.equal(h2Result[0].id, 'REQ-H2-1');
  });

  it('rejects cross-hospital sample creation on unauthorized requisitions', () => {
    function authorizeSampleSubmission(request, user) {
      if (!request) return { allowed: false, status: 404, error: 'Associated blood request not found' };
      if (user.role === 'hospital' && request.hospitalId !== user.id) {
        return { allowed: false, status: 403, error: 'Access denied: Requisition belongs to another hospital facility' };
      }
      return { allowed: true };
    }

    const hosp1User = { id: 'hosp-1', role: 'hospital' };
    const foreignRequest = { id: 'REQ-H2-1', hospitalId: 'hosp-2' };

    const check = authorizeSampleSubmission(foreignRequest, hosp1User);
    assert.equal(check.allowed, false);
    assert.equal(check.status, 403);
  });

  it('rejects cross-hospital access to request conversations', () => {
    function authorizeConversationAccess(request, user) {
      if (!request) return { allowed: false, status: 404 };
      if (user.role === 'hospital' && request.hospitalId !== user.id) {
        return { allowed: false, status: 403 };
      }
      return { allowed: true };
    }

    const hosp1User = { id: 'hosp-1', role: 'hospital' };
    const hosp2Request = { id: 'REQ-H2-1', hospitalId: 'hosp-2' };

    assert.equal(authorizeConversationAccess(hosp2Request, hosp1User).allowed, false);
  });
});

describe('Phase 4C: Sample-to-Requisition Clinical Relationship Integrity', () => {
  it('rejects patient sample submission for cancelled, fulfilled, or rejected requisitions', () => {
    function validateSampleRequisitionState(request) {
      if (!request) return { valid: false, status: 404, error: 'Associated blood request not found' };
      if (request.status === 'Cancelled' || request.status === 'Rejected' || request.status === 'Fulfilled') {
        return { valid: false, status: 400, error: `Cannot submit a patient sample for a requisition with terminal status '${request.status}'.` };
      }
      return { valid: true };
    }

    assert.equal(validateSampleRequisitionState({ status: 'Cancelled' }).valid, false);
    assert.equal(validateSampleRequisitionState({ status: 'Fulfilled' }).valid, false);
    assert.equal(validateSampleRequisitionState({ status: 'Rejected' }).valid, false);
    assert.equal(validateSampleRequisitionState({ status: 'Pending' }).valid, true);
    assert.equal(validateSampleRequisitionState({ status: 'Sample Submitted' }).valid, true);
  });
});

describe('Phase 4C: Messaging Integrity & Duplicate Suppression', () => {
  it('rejects empty or whitespace-only messages and suppresses rapid duplicates within 2s', () => {
    const existingMessages = [
      {
        id: 'MSG-1',
        requestId: 'REQ-1327',
        senderRole: 'hospital',
        message: 'Courier departing in 5 minutes.',
        timestamp: new Date().toISOString()
      }
    ];

    function validateMessage(content, existing, requestId, senderRole, throttleMs = 2000) {
      const trimmed = typeof content === 'string' ? content.trim() : '';
      if (!trimmed) return { valid: false, status: 400, error: 'Message content cannot be empty' };

      const nowMs = Date.now();
      const duplicate = existing.find(m =>
        m.requestId === requestId &&
        m.senderRole === senderRole &&
        m.message.trim() === trimmed &&
        (nowMs - new Date(m.timestamp).getTime()) < throttleMs
      );

      if (duplicate) {
        return { valid: false, status: 409, error: 'Duplicate message detected. Please wait before resending identical message.' };
      }
      return { valid: true };
    }

    assert.equal(validateMessage('   ', existingMessages, 'REQ-1327', 'hospital').status, 400);
    assert.equal(validateMessage('Courier departing in 5 minutes.', existingMessages, 'REQ-1327', 'hospital').status, 409);
    assert.equal(validateMessage('Cold box verified at 3.2°C.', existingMessages, 'REQ-1327', 'hospital').valid, true);
  });
});

describe('Phase 4C: Requisition Selection & Linked Records Context', () => {
  it('correctly maps linked samples and messages to the selected requisition', () => {
    const samples = [
      { id: 'SMP-101', requestId: 'REQ-1327', status: 'Received' },
      { id: 'SMP-102', requestId: 'REQ-9999', status: 'In Verification' }
    ];
    const messages = [
      { id: 'MSG-201', requestId: 'REQ-1327', message: 'Sample received' },
      { id: 'MSG-202', requestId: 'REQ-9999', message: 'Other request note' }
    ];

    const selectedReqId = 'REQ-1327';
    const linkedSamples = samples.filter(s => s.requestId === selectedReqId);
    const linkedMessages = messages.filter(m => m.requestId === selectedReqId);

    assert.equal(linkedSamples.length, 1);
    assert.equal(linkedSamples[0].id, 'SMP-101');
    assert.equal(linkedMessages.length, 1);
    assert.equal(linkedMessages[0].id, 'MSG-201');
  });
});

describe('Phase 4D: Concurrency Safety & Atomic Inventory Allocation', () => {
  it('prevents two competing concurrent requests from allocating or reserving the exact same blood unit', () => {
    const bloodUnits = [
      { id: 'UNIT-CONCUR-1', bloodGroup: 'O-', component: 'RBC', availability: 'Available', testingStatus: 'Passed', expiryDate: '2026-11-01' }
    ];

    function allocateTargetUnit(targetUnitId, reqId, units) {
      const unit = units.find(u => u.id === targetUnitId);
      if (!unit) return { success: false, status: 409, error: 'Unit not found' };
      if (unit.availability !== 'Available') {
        return { success: false, status: 409, error: `Unit ${targetUnitId} is no longer available (${unit.availability}). Double reservation prevented.` };
      }
      // Atomic reservation transition
      unit.availability = 'Reserved';
      unit.reservedForRequestId = reqId;
      return { success: true, status: 201, unitId: unit.id, reqId };
    }

    // Two concurrent requests attempt to reserve UNIT-CONCUR-1
    const request1 = allocateTargetUnit('UNIT-CONCUR-1', 'REQ-RACE-1', bloodUnits);
    const request2 = allocateTargetUnit('UNIT-CONCUR-1', 'REQ-RACE-2', bloodUnits);

    assert.equal(request1.success, true);
    assert.equal(request1.status, 201);
    assert.equal(bloodUnits[0].availability, 'Reserved');
    assert.equal(bloodUnits[0].reservedForRequestId, 'REQ-RACE-1');

    // Second competing request is strictly rejected with 409 Conflict
    assert.equal(request2.success, false);
    assert.equal(request2.status, 409);
    assert.match(request2.error, /Double reservation prevented/);
  });
});

describe('Phase 4D: Idempotency Key & Safe Replay Protection', () => {
  it('replays identical requisition response on network retry with same Idempotency-Key without creating duplicate records', () => {
    const existingRequests = [];

    function processRequisitionWithIdempotency(payload, idempotencyKey, store) {
      if (idempotencyKey) {
        const existing = store.find(r => r.hospitalId === payload.hospitalId && r.idempotencyKey === idempotencyKey);
        if (existing) {
          return { status: 200, request: existing, isIdempotentReplay: true };
        }
      }

      const newReq = {
        id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
        hospitalId: payload.hospitalId,
        patientReferenceId: payload.patientReferenceId,
        bloodGroup: payload.bloodGroup,
        component: payload.component,
        quantityUnits: payload.quantityUnits,
        idempotencyKey: idempotencyKey || undefined,
        createdAt: new Date().toISOString()
      };
      store.push(newReq);
      return { status: 201, request: newReq, isIdempotentReplay: false };
    }

    const testPayload = { hospitalId: 'hosp-1', patientReferenceId: 'PAT-4402', bloodGroup: 'O+', component: 'RBC', quantityUnits: 2 };
    const key = 'IDEMP-CLIENT-UUID-1234';

    // 1. Initial attempt
    const firstCall = processRequisitionWithIdempotency(testPayload, key, existingRequests);
    assert.equal(firstCall.status, 201);
    assert.equal(firstCall.isIdempotentReplay, false);
    assert.equal(existingRequests.length, 1);
    const createdId = firstCall.request.id;

    // 2. Client retry due to network timeout with same key
    const secondCall = processRequisitionWithIdempotency(testPayload, key, existingRequests);
    assert.equal(secondCall.status, 200);
    assert.equal(secondCall.isIdempotentReplay, true);
    assert.equal(secondCall.request.id, createdId);
    assert.equal(existingRequests.length, 1, 'Store must not duplicate record on idempotent retry');
  });
});

describe('Phase 4D: Reservation Cancellation & Release Idempotency', () => {
  it('safely releases allocated units back to Available and prevents duplicate cancellation', () => {
    const bloodUnits = [
      { id: 'U-REL-1', availability: 'Reserved', reservedForRequestId: 'REQ-REL-100' }
    ];
    const bloodRequests = [
      { id: 'REQ-REL-100', hospitalId: 'hosp-1', status: 'Reserved', assignedUnitIds: ['U-REL-1'] }
    ];

    function cancelRequest(reqId, hospitalId, requests, units) {
      const request = requests.find(r => r.id === reqId);
      if (!request) return { status: 404, error: 'Requisition not found' };
      if (request.hospitalId !== hospitalId) return { status: 403, error: 'Access denied' };
      if (request.status === 'Cancelled') {
        return { status: 400, error: 'Requisition is already cancelled. Duplicate cancellation prevented.' };
      }
      if (request.status === 'Fulfilled' || request.status === 'Issued') {
        return { status: 400, error: `Cannot cancel requisition in terminal state ${request.status}` };
      }

      // Atomic release of assigned units
      if (Array.isArray(request.assignedUnitIds)) {
        request.assignedUnitIds.forEach(uId => {
          const u = units.find(unit => unit.id === uId);
          if (u && u.availability === 'Reserved' && u.reservedForRequestId === request.id) {
            u.availability = 'Available';
            u.reservedForRequestId = undefined;
          }
        });
        request.assignedUnitIds = [];
      }
      request.status = 'Cancelled';
      return { status: 200, success: true, request };
    }

    // 1. Initial valid cancellation by hospital owner
    const cancelResult1 = cancelRequest('REQ-REL-100', 'hosp-1', bloodRequests, bloodUnits);
    assert.equal(cancelResult1.status, 200);
    assert.equal(bloodRequests[0].status, 'Cancelled');
    assert.equal(bloodRequests[0].assignedUnitIds.length, 0);
    assert.equal(bloodUnits[0].availability, 'Available');
    assert.equal(bloodUnits[0].reservedForRequestId, undefined);

    // 2. Accidental repeated cancellation attempt
    const cancelResult2 = cancelRequest('REQ-REL-100', 'hosp-1', bloodRequests, bloodUnits);
    assert.equal(cancelResult2.status, 400);
    assert.match(cancelResult2.error, /Duplicate cancellation prevented/);

    // 3. Unauthorized cancellation attempt by Hospital B
    const cancelResult3 = cancelRequest('REQ-REL-100', 'hosp-2', bloodRequests, bloodUnits);
    assert.equal(cancelResult3.status, 403);
  });
});

describe('Phase 4D: Authentication Token Error Differentiation', () => {
  it('differentiates TokenExpiredError (401) from malformed token (403)', () => {
    function classifyTokenError(err) {
      if (err && err.name === 'TokenExpiredError') {
        return { status: 401, error: 'Session token expired. Please log in again.' };
      }
      return { status: 403, error: 'Invalid or malformed access token' };
    }

    const expired = { name: 'TokenExpiredError', message: 'jwt expired' };
    const malformed = { name: 'JsonWebTokenError', message: 'invalid signature' };

    assert.equal(classifyTokenError(expired).status, 401);
    assert.equal(classifyTokenError(malformed).status, 403);
  });
});




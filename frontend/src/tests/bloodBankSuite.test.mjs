import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:5001';

let bbToken = '';
let bbUser = null;
let hospToken = '';

// Helper to mimic breadcrumb resolution logic in Navbar.tsx
function resolvePortalBreadcrumb(pathname) {
  if (pathname.startsWith('/blood-bank')) {
    if (pathname.includes('/dashboard')) return 'Dashboard';
    if (pathname.includes('/inventory')) return 'Blood Unit Inventory';
    if (pathname.includes('/reservations')) return 'Reservations';
    if (pathname.includes('/analytics')) return 'Inventory Analytics';
    if (pathname.includes('/testing')) return 'Lab Screening';
    if (pathname.includes('/collections') || pathname.includes('/camps')) return 'Blood Collections & Drives';
    if (pathname.includes('/requests') || pathname.includes('/hospital-requests')) return 'Hospital Requests';
    if (pathname.includes('/ai-insights')) return 'AI Intelligence';
    return 'Dashboard';
  }
  if (pathname.startsWith('/hospital')) {
    if (pathname.includes('/dashboard')) return 'Dashboard';
    if (pathname.includes('/availability')) return 'Blood Availability Search';
    if (pathname.includes('/requests')) return 'Hospital Requests';
    if (pathname.startsWith('/hospital/emergency')) return 'Emergency Requisitions';
    if (pathname.includes('/samples')) return 'Patient Samples Log';
    if (pathname.includes('/messages')) return 'Bank Communications';
    if (pathname.includes('/logistics')) return 'Logistics & Regional Map';
    return 'Dashboard';
  }
  return 'Dashboard';
}

describe('LifeLink Phase 5A: Blood Bank Portal Audit & Core Workflow Repair', () => {

  before(async () => {
    // Ensure test fixtures are seeded for automated test execution
    await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });

    // 1. Authenticate as City Central Blood Center (bb-1)
    const bbLogin = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'central@citybloodbank.org',
        password: 'password123',
        role: 'blood_bank'
      })
    });
    const bbData = await bbLogin.json();
    assert.equal(bbData.success, true, 'Blood bank login must succeed');
    bbToken = bbData.token;
    bbUser = bbData.user;

    // 2. Authenticate as Apollo General Hospital (hosp-1) for regression testing
    const hospLogin = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'emergency@apellogeneral.org',
        password: 'password123',
        role: 'hospital'
      })
    });
    const hospData = await hospLogin.json();
    assert.equal(hospData.success, true, 'Hospital login must succeed');
    hospToken = hospData.token;
  });

  // 1. Identity Resolution & Scoping
  test('1. Blood bank identity resolves verified registration ID BB-LIC-2024-001 and id bb-1', () => {
    assert.equal(bbUser.id, 'bb-1');
    assert.equal(bbUser.role, 'blood_bank');
    assert.equal(bbUser.registrationId, 'BB-LIC-2024-001');
    assert.equal(bbUser.bloodBankName, 'City Central Blood Center');
  });

  // 2. Dashboard KPIs Reconcile with Authoritative Inventory
  test('2. Dashboard metrics reconcile exactly with authoritative inventory query', async () => {
    const dashRes = await fetch(`${BACKEND_URL}/api/blood-bank/dashboard`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const dash = await dashRes.json();
    assert.equal(dash.success, true);
    assert.ok(dash.metrics, 'Dashboard must return metrics');

    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory?availability=Available&testingStatus=Passed`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const inv = await invRes.json();
    assert.equal(inv.success, true);

    // Filter out any expired units if any
    const nonExpiredAvailable = inv.units.filter(u => u.daysRemaining >= 0);
    assert.equal(dash.metrics.totalUnits, nonExpiredAvailable.length, 'Dashboard totalUnits must equal available inventory count');

    // Component counts must sum to totalUnits
    const componentSum = dash.metrics.rbcAvailable + dash.metrics.plasmaAvailable + dash.metrics.plateletsAvailable;
    assert.equal(componentSum, dash.metrics.totalUnits, 'RBC + Plasma + Platelets must sum to totalUnits');

    // Individual component counts match inventory breakdown
    const rbcCount = nonExpiredAvailable.filter(u => u.component === 'RBC').length;
    const plasmaCount = nonExpiredAvailable.filter(u => u.component === 'Plasma').length;
    const plateletsCount = nonExpiredAvailable.filter(u => u.component === 'Platelets').length;

    assert.equal(dash.metrics.rbcAvailable, rbcCount, 'Dashboard rbcAvailable must reconcile with RBC inventory count');
    assert.equal(dash.metrics.plasmaAvailable, plasmaCount, 'Dashboard plasmaAvailable must reconcile with Plasma inventory count');
    assert.equal(dash.metrics.plateletsAvailable, plateletsCount, 'Dashboard plateletsAvailable must reconcile with Platelets inventory count');
  });

  // 3. Inventory is strictly scoped to authenticated blood bank (No data leak)
  test('3. Inventory belongs exclusively to authenticated bank bb-1 without leaking other banks', async () => {
    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const inv = await invRes.json();
    assert.equal(inv.success, true);
    assert.ok(inv.units.length > 0, 'Inventory should return units for bb-1');

    const allBelongToBank = inv.units.every(u => u.bloodBankId === 'bb-1');
    assert.equal(allBelongToBank, true, 'Every inventory unit must have bloodBankId === bb-1');

    const hasRedCrossUnits = inv.units.some(u => u.bloodBankId === 'bb-2');
    assert.equal(hasRedCrossUnits, false, 'bb-1 inventory must not contain bb-2 units');
  });

  // 4. FEFO Ordering & Priority Queue
  test('4. FEFO ordering sorts earliest expiring units first', async () => {
    const fefoRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory/fefo-priority?limit=4`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const fefo = await fefoRes.json();
    assert.equal(fefo.success, true);
    assert.ok(fefo.priorityUnits.length > 0, 'FEFO priority queue should return units');

    for (let i = 0; i < fefo.priorityUnits.length - 1; i++) {
      const currentExp = new Date(fefo.priorityUnits[i].expiryDate).getTime();
      const nextExp = new Date(fefo.priorityUnits[i + 1].expiryDate).getTime();
      assert.ok(currentExp <= nextExp, 'FEFO units must be ordered with earliest expiry date first');
      assert.equal(fefo.priorityUnits[i].priorityRank, i + 1, 'Units should have 1-indexed priority rank');
    }
  });

  // 5. Reservations Desk & REQ-1327 Consistency
  test('5. Reservations Desk reflects real reserved records and links REQ-1327', async () => {
    const resRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory?availability=Reserved`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const resData = await resRes.json();
    assert.equal(resData.success, true);
    assert.ok(resData.units.length > 0, 'Should return reserved blood units');

    // Verify units assigned to REQ-1327 exist
    const req1327Units = resData.units.filter(u => u.reservedForRequestId === 'REQ-1327');
    assert.ok(req1327Units.length >= 2, 'REQ-1327 should have at least 2 reserved units');
    assert.ok(req1327Units.every(u => u.bloodBankId === 'bb-1'), 'Reserved units must belong to bb-1');
    assert.ok(req1327Units.every(u => u.reservedForHospital === 'Apollo General Hospital'), 'Should link Apollo General Hospital');
  });

  // 6. Double Reservation Prevention
  test('6. Double reservation prevention rejects reserving an already-reserved unit', async () => {
    const resRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory?availability=Reserved`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const resData = await resRes.json();
    const reservedUnit = resData.units[0];

    // Attempt to reserve an already reserved unit
    const doubleRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory/${reservedUnit.id}/reserve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}` 
      },
      body: JSON.stringify({ requestId: 'REQ-NEW-TEST', notes: 'Double reservation test' })
    });
    assert.equal(doubleRes.status, 409, 'Double reservation must return 409 Conflict');
    const doubleData = await doubleRes.json();
    assert.equal(doubleData.success, false);
    assert.ok(doubleData.error.includes('Double reservation prevented'));
  });

  // 7. Mandatory Lab Screening KPI Reconciliation
  test('7. Lab screening pending records reconcile with dashboard pendingTesting KPI', async () => {
    const dashRes = await fetch(`${BACKEND_URL}/api/blood-bank/dashboard`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const dash = await dashRes.json();
    const kpiCount = dash.metrics.pendingTesting;

    const testRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing?status=pending`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const testData = await testRes.json();
    assert.equal(testData.success, true);
    assert.equal(testData.count, kpiCount, 'Pending testing records count must match dashboard pendingTesting KPI');

    // Verify statuses are Pending or In Testing
    assert.ok(testData.records.every(r => r.status === 'Pending' || r.status === 'In Testing'));
    assert.ok(testData.records.every(r => r.bloodBankId === 'bb-1'));
  });

  // 8. Updating Lab Screening Status Transitions Unit to Available on Passed
  test('8. Lab screening Passed clears unit to Available stock', async () => {
    // Add a temporary unit to test screening transition safely
    const addRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        bloodGroup: 'B+',
        component: 'RBC',
        volumeMl: 350,
        source: 'Automated Test Donor'
      })
    });
    const addData = await addRes.json();
    assert.equal(addData.success, true);
    const unitId = addData.unit.id;
    const testRecordId = addData.testingRecord.id;

    // Verify initial status is Quarantined / Pending
    assert.equal(addData.unit.availability, 'Quarantined');
    assert.equal(addData.unit.testingStatus, 'Pending');

    // Update status to Passed
    const passRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testRecordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        status: 'Passed',
        hivTest: 'Negative',
        hbvTest: 'Negative',
        hcvTest: 'Negative',
        syphilisTest: 'Negative',
        malariaTest: 'Negative'
      })
    });
    const passData = await passRes.json();
    assert.equal(passData.success, true);
    assert.equal(passData.unit.testingStatus, 'Passed');
    assert.equal(passData.unit.availability, 'Available', 'Unit must become Available once Passed');
  });

  // 9. Phlebotomy Collection Logger & Donor Lookup
  test('9. Donor lookup API and mobile drives/camps API return bank-scoped data', async () => {
    const donorRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/search?q=alex`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const donorData = await donorRes.json();
    assert.equal(donorData.success, true);
    assert.ok(donorData.donors.length > 0, 'Should find donors matching query');
    assert.ok(donorData.donors.some(d => d.name.toLowerCase().includes('alex')));

    const campRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const campData = await campRes.json();
    assert.equal(campData.success, true);
    assert.ok(campData.camps.length > 0, 'Should return drives for bb-1');
    assert.ok(campData.camps.every(c => c.bloodBankId === 'bb-1'), 'All drives must belong to bb-1');
  });

  // 10. Breadcrumb Navigation Resolution
  test('10. Breadcrumbs resolve accurately for all portal routes', () => {
    assert.equal(resolvePortalBreadcrumb('/blood-bank/dashboard'), 'Dashboard');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/inventory'), 'Blood Unit Inventory');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/reservations'), 'Reservations');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/analytics'), 'Inventory Analytics');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/testing'), 'Lab Screening');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/collections'), 'Blood Collections & Drives');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/camps'), 'Blood Collections & Drives');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/requests'), 'Hospital Requests');
    assert.equal(resolvePortalBreadcrumb('/blood-bank/hospital-requests'), 'Hospital Requests');
  });

  // 11. Cross-Bank Access Rejection
  test('11. Blood bank cannot reserve or release another facility units', async () => {
    // Red Cross Regional Center unit
    const bb2Login = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'redcross@regionalblood.org',
        password: 'password123',
        role: 'blood_bank'
      })
    });
    const bb2Data = await bb2Login.json();
    const bb2Token = bb2Data.token;

    const bb2InvRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bb2Token}` }
    });
    const bb2Inv = await bb2InvRes.json();
    const bb2Unit = bb2Inv.units[0];

    // Now try to reserve bb2Unit using bbToken (City Central Blood Center)
    const crossRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory/${bb2Unit.id}/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({ requestId: 'CROSS-BANK-ATTEMPT' })
    });
    assert.equal(crossRes.status, 403, 'Cross-bank reservation must be rejected with 403 Forbidden');
  });

  // 12. Hospital Portal Regression Check
  test('12. Hospital Portal requests and dashboard remain fully functional', async () => {
    const hospDashRes = await fetch(`${BACKEND_URL}/api/hospitals/dashboard`, {
      headers: { Authorization: `Bearer ${hospToken}` }
    });
    const hospDash = await hospDashRes.json();
    assert.equal(hospDash.success, true);
    assert.ok(hospDash.metrics);
    assert.equal(hospDash.facility.id, 'hosp-1');
  });
});

describe('LifeLink Phase 5B: Blood Collections, Mobile Donation Camps & Component Fractionation', () => {
  let createdCollectionId = '';
  let createdCampId = '';
  let fractionatedBatchId = '';
  let producedUnitIds = [];

  // 1. Valid collection creation and persistence
  test('1. In-house phlebotomy creates validated collection record and quarantine testing record without affecting available stock', async () => {
    // Check initial available count
    const dashInitial = await (await fetch(`${BACKEND_URL}/api/blood-bank/dashboard`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    })).json();
    const initialAvailable = dashInitial.metrics.totalUnits;

    const res = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: 'donor-2',
        donorCode: 'donor-2',
        collectionType: 'In-House Phlebotomy',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        collectionTime: '10:30',
        phlebotomistName: 'Nurse Jane Doe',
        notes: 'Smooth collection with no hematoma or adverse reaction.',
        idempotencyKey: `test-phleb-${Date.now()}`
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201, 'Collection recording should return 201 Created');
    assert.equal(data.success, true);
    assert.ok(data.collectionRecord);
    assert.ok(data.collectionRecord.id.startsWith('COL-'));
    assert.equal(data.collectionRecord.donorId, 'donor-2');
    assert.equal(data.collectionRecord.volumeMl, 450);
    assert.equal(data.collectionRecord.status, 'Collected');
    assert.equal(data.collectionRecord.fractionationStatus, 'Pending');

    createdCollectionId = data.collectionRecord.id;

    // Check available stock: must NOT have increased!
    const dashAfter = await (await fetch(`${BACKEND_URL}/api/blood-bank/dashboard`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    })).json();
    assert.equal(dashAfter.metrics.totalUnits, initialAvailable, 'Whole blood phlebotomy must NOT automatically create available inventory');
  });

  // 2. Invalid donor, volume, timestamp, and ownership rejection
  test('2. Rejects invalid volume, deferred donor, and future collection date', async () => {
    // 2a. Out-of-bounds volume (<300 or >550 mL)
    const volRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: 'donor-2',
        volumeMl: 150, // Invalid low volume
        collectionDate: new Date().toISOString().split('T')[0]
      })
    });
    assert.equal(volRes.status, 422, 'Volume < 300 mL must return 422');

    // 2b. Future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: 'donor-2',
        volumeMl: 450,
        collectionDate: futureDate.toISOString().split('T')[0]
      })
    });
    assert.equal(dateRes.status, 422, 'Future collection date must return 422');

    // 2c. Deferred donor (donor-1 is deferred due to recent donation within 56-day cool-off)
    const defRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: 'donor-1', // donor-1 is deferred
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0]
      })
    });
    assert.equal(defRes.status, 422, 'Deferred donor must be rejected with 422 Unprocessable Entity');
    const defData = await defRes.json();
    assert.ok(defData.error.toLowerCase().includes('deferred') || defData.error.toLowerCase().includes('ineligible'));
  });

  // 3. Duplicate collection submission prevention
  test('3. Idempotency key prevents duplicate collection submission', async () => {
    const key = `idem-key-test-${Date.now()}`;
    const payload = {
      donorId: 'donor-2',
      collectionType: 'In-House Phlebotomy',
      volumeMl: 350,
      collectionDate: new Date().toISOString().split('T')[0],
      idempotencyKey: key
    };

    const firstRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify(payload)
    });
    const firstData = await firstRes.json();
    assert.equal(firstRes.status, 201);

    // Exact duplicate with same idempotency key
    const secondRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify(payload)
    });
    const secondData = await secondRes.json();
    assert.equal(secondRes.status, 200, 'Duplicate submission with same idempotency key returns 200 idempotent response');
    assert.equal(secondData.collectionRecord.id, firstData.collectionRecord.id, 'Idempotent response must return the same collection record');
  });

  // 4. Camp creation, editing, cancellation, and bank isolation
  test('4. Full Mobile Camp lifecycle: Create, Edit, Cancel, and Cross-Bank Isolation', async () => {
    // 4a. Create Camp
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const createRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        title: 'Metro Civic Center Blood Drive',
        organizer: 'Metropolis Health Foundation',
        location: 'Metro Civic Center Grand Hall',
        address: '100 Broadway St, Metropolis',
        startDate: today,
        endDate: nextWeek,
        timeSlot: '08:00 AM - 04:00 PM',
        targetUnits: 60,
        contactPhone: '+1-555-4321',
        description: 'Community mobile drive with 4 phlebotomy stations.'
      })
    });
    const createData = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.ok(createData.camp.id.startsWith('CAMP-'));
    assert.equal(createData.camp.status, 'Active');
    createdCampId = createData.camp.id;

    // 4b. Update Camp
    const updateRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps/${createdCampId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        title: 'Metro Civic Center Blood Drive (Expanded)',
        targetUnits: 80
      })
    });
    const updateData = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateData.camp.title, 'Metro Civic Center Blood Drive (Expanded)');
    assert.equal(updateData.camp.targetUnits, 80);

    // 4c. Cross-bank isolation: bb-2 cannot edit or cancel bb-1 camp
    const bb2Login = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'redcross@regionalblood.org',
        password: 'password123',
        role: 'blood_bank'
      })
    });
    const bb2Data = await bb2Login.json();
    const bb2Token = bb2Data.token;

    const crossEditRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps/${createdCampId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb2Token}`
      },
      body: JSON.stringify({ title: 'Hacked Camp' })
    });
    assert.equal(crossEditRes.status, 403, 'Cross-bank camp edit must return 403 Forbidden');
  });

  // 5. Collection-to-camp relationship validation and actual count derivation
  test('5. Camp-linked collection validates ownership and increments actualCollectedUnits', async () => {
    // Record collection linked to createdCampId
    const campColRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: 'donor-3',
        collectionType: 'Mobile Camp',
        campId: createdCampId,
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        phlebotomistName: 'Camp Phlebotomist Mike'
      })
    });
    const campColData = await campColRes.json();
    assert.equal(campColRes.status, 201);
    assert.equal(campColData.collectionRecord.campId, createdCampId);

    // Query camp details: actualCollectedUnits must be >= 1
    const campDetailsRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps/${createdCampId}`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const campDetails = await campDetailsRes.json();
    assert.equal(campDetails.success, true);
    assert.ok(campDetails.camp.actualCollectedUnits >= 1, 'Camp actualCollectedUnits must be dynamically derived from real collection records');

    // Query camp collections
    const campCollectionsRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps/${createdCampId}/collections`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const campCols = await campCollectionsRes.json();
    assert.equal(campCols.success, true);
    assert.ok(campCols.collections.some(c => c.id === campColData.collectionRecord.id), 'Camp collections endpoint must list the linked collection');
  });

  // 6. Component processing linked to a valid collection
  test('6. Whole-blood collection can be fractionated into traceable component records', async () => {
    // Use createdCollectionId from Test 1
    const fracRes = await fetch(`${BACKEND_URL}/api/blood-bank/fractionation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        collectionId: createdCollectionId,
        components: [
          { component: 'RBC', volumeMl: 250, storageLocation: 'Quarantine Bay RBC-1' },
          { component: 'Plasma', volumeMl: 200, storageLocation: 'Quarantine Bay FFP-1' }
        ],
        processingNotes: 'Centrifugation at 4000 RPM at 4°C.'
      })
    });

    const fracData = await fracRes.json();
    assert.equal(fracRes.status, 201, 'Fractionation must return 201 Created');
    assert.equal(fracData.success, true);
    assert.ok(fracData.fractionationRecord.id.startsWith('FRAC-'));
    assert.equal(fracData.fractionationRecord.sourceCollectionId, createdCollectionId);
    assert.equal(fracData.createdUnits.length, 2);

    fractionatedBatchId = fracData.fractionationRecord.id;
    producedUnitIds = fracData.createdUnits.map(u => u.id);

    // Verify source collection status changed to Fractionated
    const colCheck = await (await fetch(`${BACKEND_URL}/api/blood-bank/collections/${createdCollectionId}`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    })).json();
    assert.equal(colCheck.collectionRecord.status, 'Fractionated');
    assert.equal(colCheck.collectionRecord.fractionationStatus, 'Fractionated');
  });

  // 7. Duplicate and concurrent fractionation prevention
  test('7. Double-fractionation of same whole blood collection is rejected with 409 Conflict', async () => {
    const doubleRes = await fetch(`${BACKEND_URL}/api/blood-bank/fractionation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        collectionId: createdCollectionId,
        components: [
          { component: 'RBC', volumeMl: 250, storageLocation: 'Quarantine Bay RBC-1' }
        ]
      })
    });

    assert.equal(doubleRes.status, 409, 'Attempting to fractionate already fractionated collection must return 409 Conflict');
    const doubleData = await doubleRes.json();
    assert.ok(doubleData.error.toLowerCase().includes('already been fractionated'));
  });

  // 8. Source-to-component traceability
  test('8. Resulting component units maintain complete source collection and batch ID traceability', async () => {
    for (const unitId of producedUnitIds) {
      const unitRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
        headers: { Authorization: `Bearer ${bbToken}` }
      });
      const invData = await unitRes.json();
      const unit = invData.units.find(u => u.id === unitId);
      assert.ok(unit, `Unit ${unitId} must exist in inventory`);
      assert.equal(unit.sourceCollectionId, createdCollectionId, 'Unit must reference sourceCollectionId');
      assert.equal(unit.fractionationBatchId, fractionatedBatchId, 'Unit must reference fractionationBatchId');
      assert.ok(unit.bloodGroup, 'Unit must inherit source donor blood group');
    }
  });

  // 9. Correct post-processing testing/quarantine status
  test('9. Fractionated units are initialized in Quarantined status and do not inflate available stock', async () => {
    for (const unitId of producedUnitIds) {
      const unitRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
        headers: { Authorization: `Bearer ${bbToken}` }
      });
      const invData = await unitRes.json();
      const unit = invData.units.find(u => u.id === unitId);

      assert.equal(unit.availability, 'Quarantined', 'Fractionated unit must start in Quarantined availability');
      assert.equal(unit.testingStatus, 'Quarantined', 'Fractionated unit must start in Quarantined testing status');
    }

    // Verify testing records were generated in laboratory queue
    const testingRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const testData = await testingRes.json();
    for (const unitId of producedUnitIds) {
      const record = testData.records.find(r => r.unitId === unitId);
      assert.ok(record, `Testing record must be created for fractionated unit ${unitId}`);
      assert.equal(record.status, 'Quarantined');
    }
  });

  // 10. Volume tolerance check prevents clinical yield excess
  test('10. Reject fractionation when component volume sum exceeds source volume beyond tolerance', async () => {
    // Record another collection of 350 mL
    const colRes = await (await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: 'donor-4',
        volumeMl: 350,
        collectionDate: new Date().toISOString().split('T')[0]
      })
    })).json();

    const newColId = colRes.collectionRecord.id;


    // Try to extract 600 mL from 350 mL
    const excessRes = await fetch(`${BACKEND_URL}/api/blood-bank/fractionation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        collectionId: newColId,
        components: [
          { component: 'RBC', volumeMl: 300, storageLocation: 'Bay 1' },
          { component: 'Plasma', volumeMl: 300, storageLocation: 'Bay 2' }
        ]
      })
    });

    assert.equal(excessRes.status, 422, 'Excessive component yield must return 422 Unprocessable Entity');
  });

  // 11. Camp cancellation
  test('11. Camp can be cancelled safely and status updates to Cancelled', async () => {
    const cancelRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps/${createdCampId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const cancelData = await cancelRes.json();
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelData.camp.status, 'Cancelled');
  });

  // 12. Regressions check across Donor and Hospital portals
  test('12. Donor and Hospital portal endpoints experience zero regression', async () => {
    // Hospital dashboard
    const hospDash = await (await fetch(`${BACKEND_URL}/api/hospitals/dashboard`, {
      headers: { Authorization: `Bearer ${hospToken}` }
    })).json();
    assert.equal(hospDash.success, true);

    // Donor login
    const donorLogin = await (await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.mercer@example.com',
        password: 'password123',
        role: 'donor'
      })
    })).json();
    assert.equal(donorLogin.success, true);
    assert.equal(donorLogin.user.id, 'donor-1');
  });
});



import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:5001';

let bb1Token = '';
let bb2Token = '';
let hosp1Token = '';
let hosp2Token = '';

let testReq1Id = ''; // A+ RBC (for full fulfillment & hospital receipt lifecycle)
let testReq2Id = ''; // B+ Platelets (for allocation, release, and discrepancy)
let testReq3Id = ''; // O- RBC (for compatibility rejection, ceiling & invalid states)

describe('LifeLink Phase 5D: Hospital Fulfillment, Barcode Assignment & Dispatch Suite', () => {

  before(async () => {
    // Ensure test fixtures are seeded for automated test execution
    await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });

    // 1. Authenticate as City Central Blood Center (bb-1)
    const bb1Res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'central@citybloodbank.org',
        password: 'password123',
        role: 'blood_bank'
      })
    });
    const bb1Data = await bb1Res.json();
    assert.equal(bb1Data.success, true, 'bb-1 authentication must succeed');
    bb1Token = bb1Data.token;

    // 2. Authenticate as Red Cross Regional Center (bb-2)
    const bb2Res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'redcross@regionalblood.org',
        password: 'password123',
        role: 'blood_bank'
      })
    });
    const bb2Data = await bb2Res.json();
    assert.equal(bb2Data.success, true, 'bb-2 authentication must succeed');
    bb2Token = bb2Data.token;

    // 3. Authenticate as Apollo General Hospital (hosp-1)
    const h1Res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'emergency@apellogeneral.org',
        password: 'password123',
        role: 'hospital'
      })
    });
    const h1Data = await h1Res.json();
    assert.equal(h1Data.success, true, 'hosp-1 authentication must succeed');
    hosp1Token = h1Data.token;

    // 4. Authenticate as Metro LifeCare Hospital (hosp-2)
    const h2Res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'trauma@metrolifecare.org',
        password: 'password123',
        role: 'hospital'
      })
    });
    const h2Data = await h2Res.json();
    assert.equal(h2Data.success, true, 'hosp-2 authentication must succeed');
    hosp2Token = h2Data.token;

    // 5. Create fresh dedicated requisitions to ensure test idempotency across multiple runs
    const now = Date.now();
    const r1 = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hosp1Token}` },
      body: JSON.stringify({
        bloodBankId: 'bb-1',
        bloodGroup: 'A+',
        component: 'RBC',
        quantityUnits: 2,
        urgency: 'Urgent',
        patientReferenceId: `PAT-SUITE-1-${now}`,
        department: 'Surgical ICU'
      })
    });
    const r1Data = await r1.json();
    assert.equal(r1.status, 201);
    testReq1Id = r1Data.request.id;

    const r2 = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hosp1Token}` },
      body: JSON.stringify({
        bloodBankId: 'bb-1',
        bloodGroup: 'B+',
        component: 'Platelets',
        quantityUnits: 1,
        urgency: 'Emergency',
        patientReferenceId: `PAT-SUITE-2-${now}`,
        department: 'Emergency & Trauma'
      })
    });
    const r2Data = await r2.json();
    assert.equal(r2.status, 201);
    testReq2Id = r2Data.request.id;

    const r3 = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hosp1Token}` },
      body: JSON.stringify({
        bloodBankId: 'bb-1',
        bloodGroup: 'O-',
        component: 'RBC',
        quantityUnits: 2,
        urgency: 'Routine',
        patientReferenceId: `PAT-SUITE-3-${now}`,
        department: 'General Oncology'
      })
    });
    const r3Data = await r3.json();
    assert.equal(r3.status, 201);
    testReq3Id = r3Data.request.id;
  });

  // 1. Blood Bank Requisitions Queue & Multi-Tenant Isolation
  test('1. Blood Bank queue strictly isolates requisitions to authenticated blood bank with filter tabs', async () => {
    const res = await fetch(`${BACKEND_URL}/api/blood-bank/requests`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.requests), 'Requests must be an array');
    
    // Every request must belong to bb-1
    data.requests.forEach(r => {
      assert.equal(r.bloodBankId, 'bb-1', `Request ${r.id} must belong to bb-1`);
      assert.ok(r.remainingNeeded !== undefined, 'Must calculate remaining needed quantity');
      assert.ok(r.allocatedUnitsCount !== undefined, 'Must calculate allocated units count');
    });

    // Test tab filtering
    const emergencyRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests?tab=emergency`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const emergencyData = await emergencyRes.json();
    assert.equal(emergencyRes.status, 200);
    emergencyData.requests.forEach(r => {
      assert.equal(r.urgency, 'Emergency');
    });

    // bb-2 must see its own requests without seeing bb-1
    const bb2Queue = await fetch(`${BACKEND_URL}/api/blood-bank/requests`, {
      headers: { Authorization: `Bearer ${bb2Token}` }
    });
    const bb2Data = await bb2Queue.json();
    assert.equal(bb2Data.success, true);
    bb2Data.requests.forEach(r => {
      assert.equal(r.bloodBankId, 'bb-2', 'bb-2 must only see requests assigned to bb-2');
    });
  });

  // 2. Eligible Units Query (FEFO & Authoritative Clinical Compatibility)
  test('2. Authoritative eligible units endpoint returns FEFO-sorted, tested, clinically compatible units', async () => {
    // Query eligible units for testReq1Id (A+ RBC)
    const res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/eligible-units`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.units));
    assert.ok(data.units.length > 0, 'Should find eligible units');

    // Compatible red cell donors for A+ are: A+, A-, O+, O-
    const allowedDonors = ['A+', 'A-', 'O+', 'O-'];
    for (const unit of data.units) {
      assert.equal(unit.component, 'RBC');
      assert.equal(unit.testingStatus, 'Passed');
      assert.ok(allowedDonors.includes(unit.bloodGroup), `Donor group ${unit.bloodGroup} must be compatible with A+`);
      assert.ok(unit.daysToExpiry >= 0, 'Unit must not be expired');
    }

    // Must be sorted FEFO (earliest expiry first)
    for (let i = 0; i < data.units.length - 1; i++) {
      const expA = new Date(data.units[i].expiryDate).getTime();
      const expB = new Date(data.units[i + 1].expiryDate).getTime();
      assert.ok(expA <= expB, 'Units must be ordered FEFO (earliest expiry first)');
    }
  });

  // 3. Rejects Allocation on Ineligible Requisitions
  test('3. Rejects allocation attempts on cancelled or fulfilled requisitions', async () => {
    // REQ-1002 is already Fulfilled in seed data
    const res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/REQ-1002/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ unitIds: ['UNIT-2026-8007'] })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.error, /Cannot allocate units to requisition in 'Fulfilled' status/i);
  });

  // 4. Testing Status Clearance & Expiry Enforcement
  test('4. Rejects allocation of untested/quarantined units or expired inventory', async () => {
    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const invData = await invRes.json();
    const pendingUnit = (invData.units || []).find(u => u.testingStatus === 'Pending') || { id: 'UNIT-2026-8097' };

    const res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq3Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ unitIds: [pendingUnit.id] })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.error, /not cleared for release|Testing status is 'Pending'|Component mismatch/i);
  });

  // 5. Authoritative Component & Blood Group Mismatch Prevention
  test('5. Rejects allocation when component or blood group is clinically incompatible', async () => {
    // 5A. Component mismatch: testReq2Id is Platelets. Attempting to allocate UNIT-2026-8001 (RBC) must fail.
    const compMismatchRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ unitIds: ['UNIT-2026-8001'] })
    });
    const compData = await compMismatchRes.json();
    assert.equal(compMismatchRes.status, 400);
    assert.equal(compData.success, false);
    assert.match(compData.error, /Component mismatch/i);

    // 5B. Blood group mismatch: testReq3Id is O- RBC. Attempting to allocate UNIT-2026-8029 (B+ RBC) must fail clinical compatibility
    const compatMismatchRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq3Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ unitIds: ['UNIT-2026-8029'] })
    });
    const compatData = await compatMismatchRes.json();
    assert.equal(compatMismatchRes.status, 400);
    assert.equal(compatData.success, false);
    assert.match(compatData.error, /Clinical Compatibility Violation/i);
  });

  // 6. Concurrency & Double Reservation Protection (409 Conflict)
  test('6. Prevents double allocation: attempting to assign an already-reserved unit returns 409 Conflict', async () => {
    // UNIT-2026-8015 is already Reserved for REQ-1327 in seed data
    // Attempt to allocate it to testReq1Id (A+ RBC)
    const res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ unitIds: ['UNIT-2026-8015'] })
    });
    const data = await res.json();
    assert.equal(res.status, 409, 'Must return 409 Conflict for double-reservation attempt');
    assert.equal(data.success, false);
    assert.match(data.error, /Double Reservation Prevented/i);
    assert.equal(data.unitId, 'UNIT-2026-8015');
  });

  // 7. Allocation Quantity Ceiling
  test('7. Rejects allocation when quantity exceeds remaining needed units', async () => {
    // testReq3Id needs 2 units. Attempting to allocate 3 units must be rejected.
    const res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq3Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ unitIds: ['UNIT-2026-8001', 'UNIT-2026-8007', 'UNIT-2026-8008'] })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.error, /exceeds remaining required quantity/i);
  });

  // 8. Atomic Barcode / Unit ID Assignment Lifecycle
  test('8. Atomically allocates compatible units, updates unit availability to Reserved, and records audit log', async () => {
    // Query eligible units for testReq1Id (A+ RBC)
    const eligRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/eligible-units`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const eligData = await eligRes.json();
    assert.equal(eligRes.status, 200);
    assert.ok(eligData.units.length >= 2, 'Must have at least 2 eligible units for A+ RBC');

    const unitsToAssign = [eligData.units[0].id, eligData.units[1].id];

    // Allocate units to testReq1Id
    const allocRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({
        unitIds: unitsToAssign,
        notes: 'Assigned via LifeLink Barcode Desk for surgical reservation.'
      })
    });
    const allocData = await allocRes.json();
    assert.equal(allocRes.status, 200);
    assert.equal(allocData.success, true);
    assert.equal(allocData.request.status, 'Reserved');
    assert.equal(allocData.request.assignedUnitIds.length, 2);

    // Verify unit status in inventory
    const unitCheck = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const unitCheckData = await unitCheck.json();
    const u1 = unitCheckData.units.find(u => u.id === unitsToAssign[0]);
    assert.equal(u1.availability, 'Reserved');
    assert.equal(u1.reservedForRequestId, testReq1Id);
  });

  // 9. Allocation Release & Reversal Idempotency
  test('9. Safely releases allocated units back to Available stock and updates requisition timeline', async () => {
    // Allocate to testReq2Id first (B+ Platelets)
    const eligRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/eligible-units`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const eligData = await eligRes.json();
    assert.ok(eligData.units.length > 0);
    const unitToAssign = eligData.units[0].id;

    await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ unitIds: [unitToAssign] })
    });

    // Release allocation
    const releaseRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/release-allocation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ reason: 'Surgery postponed, units released.' })
    });
    const releaseData = await releaseRes.json();
    assert.equal(releaseRes.status, 200);
    assert.equal(releaseData.success, true);
    assert.equal(releaseData.request.status, 'Sample Submitted');
    assert.equal(releaseData.request.assignedUnitIds.length, 0);

    // Verify unit was released back to Available
    const unitCheck = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const unitCheckData = await unitCheck.json();
    const uReleased = unitCheckData.units.find(u => u.id === unitToAssign);
    assert.equal(uReleased.availability, 'Available');
    assert.equal(uReleased.reservedForRequestId, undefined);

    // Re-assign unitToAssign to testReq2Id for subsequent discrepancy test
    await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ unitIds: [unitToAssign] })
    });
  });

  // 10. Dispatch Preparation & Authoritative Packing Slip Manifest
  test('10. Prepares dispatch manifest with authoritative cold-chain specifications and packing document', async () => {
    // testReq1Id is Reserved with 2 units
    const prepRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/prepare-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({
        courierType: 'Dedicated Hospital Courier',
        courierReference: 'HOSP-AMB-09',
        packagingType: 'Standard Passive Thermal Container with Ice Gel Packs',
        targetTransportTemp: '2°C to 6°C (Chilled)',
        coldChainMonitoring: 'Passive Temp Strips',
        specialHandlingInstructions: 'Maintain upright at 2-6°C. Protect from direct heat.',
        notes: 'Packed 2 units A+ RBC for Apollo Surgery.'
      })
    });
    const prepData = await prepRes.json();
    assert.equal(prepRes.status, 200);
    assert.equal(prepData.success, true);
    assert.equal(prepData.dispatch.status, 'Prepared');
    assert.equal(prepData.request.status, 'Prepared for Dispatch');
    assert.equal(prepData.dispatch.quantityUnits, 2);
    assert.equal(prepData.dispatch.unitItems.length, 2);

    // Fetch printable dispatch slip
    const slipRes = await fetch(`${BACKEND_URL}/api/blood-bank/dispatches/${prepData.dispatch.id}/slip`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const slipData = await slipRes.json();
    assert.equal(slipRes.status, 200);
    assert.equal(slipData.success, true);
    assert.ok(slipData.slip.documentId.startsWith('SLIP-'));
    assert.equal(slipData.slip.requestId, testReq1Id);
    assert.equal(slipData.slip.hospital.name, 'Apollo General Hospital');
    assert.equal(slipData.slip.coldChainSpecifications.gpsTrackingAvailable, false, 'Must not claim fabricated live GPS');
    assert.ok(slipData.slip.coldChainSpecifications.telemetryNote.includes('Real-time GPS unintegrated'));
  });

  // 11. Courier Handoff / Dispatch Transit Confirmation
  test('11. Confirms courier handoff, transitions units to Issued, request to Dispatched, and handles retries idempotently', async () => {
    const dispatchRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/confirm-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({
        courierReference: 'HOSP-AMB-09',
        notes: 'Handed off to Apollo General Hospital courier Driver Sam.'
      })
    });
    const dispatchData = await dispatchRes.json();
    assert.equal(dispatchRes.status, 200);
    assert.equal(dispatchData.success, true);
    assert.equal(dispatchData.request.status, 'Dispatched');
    assert.equal(dispatchData.dispatch.status, 'In Transit');

    // Idempotent retry: re-clicking or network retry must succeed without creating duplicate state
    const retryRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/confirm-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ courierReference: 'HOSP-AMB-09' })
    });
    const retryData = await retryRes.json();
    assert.equal(retryRes.status, 200);
    assert.equal(retryData.success, true);
    assert.equal(retryData.request.status, 'Dispatched');
  });

  // 12. Hospital Delivery Receipt Confirmation
  test('12. Hospital confirms receipt: transitions request to Fulfilled, records custody in OT ledger, rejects duplicates', async () => {
    // hosp-1 confirms receipt of testReq1Id
    const receiptRes = await fetch(`${BACKEND_URL}/api/hospitals/requests/${testReq1Id}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hosp1Token}`
      },
      body: JSON.stringify({
        notes: 'Received in Surgical ICU. Temperature indicator verified green (+4.1°C).'
      })
    });
    const receiptData = await receiptRes.json();
    assert.equal(receiptRes.status, 200);
    assert.equal(receiptData.success, true);
    assert.equal(receiptData.request.status, 'Fulfilled');
    assert.equal(receiptData.request.fulfilledUnits, 2);
    assert.equal(receiptData.dispatch.status, 'Received');
    assert.ok(receiptData.dispatch.receivedAt !== null);

    // Verify hospital local OT storage ledger received the inventory
    const ledgerRes = await fetch(`${BACKEND_URL}/api/hospitals/storage-ledger`, {
      headers: { Authorization: `Bearer ${hosp1Token}` }
    });
    const ledgerData = await ledgerRes.json();
    assert.equal(ledgerRes.status, 200);
    const receivedOTEntry = ledgerData.entries.find(e => e.bloodGroup === 'A+' && e.component === 'RBC' && e.status === 'Usable');
    assert.ok(receivedOTEntry, 'Received units must appear in hospital OT inventory');
    assert.ok(receivedOTEntry.quantityUnits >= 2);

    // Duplicate receipt attempt must be rejected with 400
    const dupRes = await fetch(`${BACKEND_URL}/api/hospitals/requests/${testReq1Id}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hosp1Token}`
      },
      body: JSON.stringify({ notes: 'Duplicate click' })
    });
    const dupData = await dupRes.json();
    assert.equal(dupRes.status, 400);
    assert.equal(dupData.success, false);
    assert.match(dupData.error, /Duplicate receipt confirmation prevented/i);
  });

  // 13. Cross-Tenant Hospital and Blood Bank Access Isolation
  test('13. Strictly enforces cross-hospital and cross-blood-bank tenant isolation', async () => {
    // hosp-2 attempts to confirm receipt of hosp-1 request testReq1Id -> must return 403 Forbidden
    const crossHospRes = await fetch(`${BACKEND_URL}/api/hospitals/requests/${testReq1Id}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hosp2Token}`
      },
      body: JSON.stringify({ notes: 'Unauthorized confirmation attempt' })
    });
    const crossHospData = await crossHospRes.json();
    assert.equal(crossHospRes.status, 403);
    assert.equal(crossHospData.success, false);
    assert.match(crossHospData.error, /Access denied/i);

    // bb-2 attempts to prepare dispatch for bb-1 request testReq1Id -> must return 403 Forbidden
    const crossBankRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq1Id}/prepare-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb2Token}`
      },
      body: JSON.stringify({ courierType: 'Dedicated Hospital Courier' })
    });
    const crossBankData = await crossBankRes.json();
    assert.equal(crossBankRes.status, 403);
    assert.equal(crossBankData.success, false);
    assert.match(crossBankData.error, /Access denied/i);
  });

  // 14. Hospital Discrepancy Reporting
  test('14. Hospital reports delivery discrepancy: records exception audit and alerts regional blood center', async () => {
    // Prepare & dispatch testReq2Id first
    const prepRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/prepare-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({
        courierType: 'External Medical Courier',
        courierReference: 'MED-COURIER-22'
      })
    });
    assert.equal(prepRes.status, 200);

    const dispatchRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReq2Id}/confirm-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bb1Token}`
      },
      body: JSON.stringify({ courierReference: 'MED-COURIER-22' })
    });
    assert.equal(dispatchRes.status, 200);

    // hosp-1 reports temperature excursion exception
    const discRes = await fetch(`${BACKEND_URL}/api/hospitals/requests/${testReq2Id}/report-discrepancy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hosp1Token}`
      },
      body: JSON.stringify({
        discrepancyType: 'Cold-Chain Temperature Breach',
        reason: 'Transport thermal strip activated red (+9.2°C excursion).',
        notes: 'Platelet agitation container arrived stopped and warm to touch.'
      })
    });
    const discData = await discRes.json();
    assert.equal(discRes.status, 200);
    assert.equal(discData.success, true);
    assert.equal(discData.dispatch.status, 'Discrepancy Reported');
    assert.match(discData.dispatch.discrepancyNotes, /Cold-Chain Temperature Breach/i);
  });

  // 15. Emergency Stock Allocation Matrix Calculations
  test('15. Emergency stock matrix transparently reflects released stock, active priority demand, and clinical guidance', async () => {
    const matrixRes = await fetch(`${BACKEND_URL}/api/blood-bank/allocation-matrix`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const data = await matrixRes.json();
    assert.equal(matrixRes.status, 200);
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.matrix));
    assert.equal(data.matrix.length, 3, 'Matrix must cover RBC, Plasma, and Platelets');

    const rbcRow = data.matrix.find(m => m.component === 'RBC');
    assert.ok(rbcRow);
    assert.equal(rbcRow.groups.length, 8, 'Must cover all 8 ABO/Rh blood groups');

    // O- RBC row must highlight critical universal shortage
    const oNegRbc = rbcRow.groups.find(g => g.bloodGroup === 'O-');
    assert.ok(oNegRbc);
    assert.ok(oNegRbc.recommendation.length > 0);

    // Summary KPIs must be defined
    assert.ok(data.summary.totalAvailableReleasedUnits >= 0);
    assert.ok(data.summary.totalActiveRequisitions >= 0);
  });

});

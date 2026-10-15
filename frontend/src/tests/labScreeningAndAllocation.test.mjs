import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

describe('LifeLink: Lab Screening & Blood Unit Allocation Verification Suite', () => {
  let bbToken;
  let bbId;
  let hospToken;
  let hospId;
  let otherBbToken;
  let otherBbId;

  let testUnitId;
  let testTestingRecId;
  let testReqId;

  before(async () => {
    const ts = Date.now();

    // 1. Register test Blood Bank
    const bbRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `lab-bb-${ts}@lifelink.test`,
        password: 'password123',
        role: 'blood_bank',
        name: 'Metropolitan Lab Test Center',
        bloodBankName: 'Metropolitan Lab Test Center',
        registrationId: `LIC-LAB-${ts}`,
        contactPerson: 'Dr. Arthur Conan',
        phone: '555-0199',
        city: 'Metro City'
      })
    });
    assert.equal(bbRes.status, 201);
    const bbData = await bbRes.json();
    bbToken = bbData.token;
    bbId = bbData.user.id;

    // 2. Register a second, isolated Blood Bank (for tenant isolation tests)
    const otherBbRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `other-bb-${ts}@lifelink.test`,
        password: 'password123',
        role: 'blood_bank',
        name: 'Isolated Suburban Blood Center',
        bloodBankName: 'Isolated Suburban Blood Center',
        registrationId: `LIC-OTHER-${ts}`,
        contactPerson: 'Dr. Watson',
        phone: '555-0188',
        city: 'Suburban City'
      })
    });
    assert.equal(otherBbRes.status, 201);
    const otherBbData = await otherBbRes.json();
    otherBbToken = otherBbData.token;
    otherBbId = otherBbData.user.id;

    // 3. Register test Hospital
    const hospRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `lab-hosp-${ts}@lifelink.test`,
        password: 'password123',
        role: 'hospital',
        name: 'Mercy Trauma Hospital',
        hospitalName: 'Mercy Trauma Hospital',
        registrationId: `HOSP-LAB-${ts}`,
        contactPerson: 'Chief Surgeon Miller',
        phone: '555-0144',
        city: 'Metro City'
      })
    });
    assert.equal(hospRes.status, 201);
    const hospData = await hospRes.json();
    hospToken = hospData.token;
    hospId = hospData.user.id;
  });

  // Test 1: Lab screening queue loads real persisted units
  test('1. Lab Screening loads real pending units requiring screening for authenticated facility', async () => {
    // Add a new blood unit to inventory -> placed in quarantine
    const addUnitRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        bloodGroup: 'O+',
        component: 'RBC',
        volumeMl: 350,
        storageLocation: 'Quarantine Cooler Bay 1',
        source: 'Voluntary Donation'
      })
    });
    assert.equal(addUnitRes.status, 201);
    const addUnitData = await addUnitRes.json();
    testUnitId = addUnitData.unit.id;
    assert.ok(testUnitId);
    assert.equal(addUnitData.unit.testingStatus, 'Pending');
    assert.equal(addUnitData.unit.availability, 'Quarantined');

    // Fetch pending lab queue
    const queueRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing?status=pending`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(queueRes.status, 200);
    const queueData = await queueRes.json();
    assert.equal(queueData.success, true);
    assert.ok(queueData.records.length >= 1);

    const targetRec = queueData.records.find(r => r.unitId === testUnitId);
    assert.ok(targetRec, 'Newly created unit must appear in the Lab Screening pending queue');
    assert.equal(targetRec.bloodGroup, 'O+');
    assert.equal(targetRec.component, 'RBC');
    assert.equal(targetRec.status, 'Pending');
    testTestingRecId = targetRec.id;
  });

  // Test 2: Tenant isolation in laboratory testing
  test('2. Tenant isolation: One blood bank cannot view or update another facility units', async () => {
    // Other blood bank queries testing records
    const otherQueueRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing?status=pending`, {
      headers: { Authorization: `Bearer ${otherBbToken}` }
    });
    assert.equal(otherQueueRes.status, 200);
    const otherQueueData = await otherQueueRes.json();
    const leaked = otherQueueData.records.find(r => r.unitId === testUnitId);
    assert.equal(leaked, undefined, 'Unit must not appear in another blood center screening queue');

    // Other blood bank attempts to update our unit's test record
    const illegalUpdateRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testTestingRecId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherBbToken}`
      },
      body: JSON.stringify({
        hivTest: 'Negative',
        status: 'Passed'
      })
    });
    assert.equal(illegalUpdateRes.status, 404, 'Cross-tenant testing update must be rejected with 404');
  });

  // Test 3: Individual screening results persist
  test('3. Individual screening results can be entered and persisted incrementally', async () => {
    // Update HIV and HBV to Negative, leave others Pending
    const updateRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testTestingRecId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        hivTest: 'Negative',
        hbvTest: 'Negative',
        testedBy: 'Analyst Jane Doe',
        notes: 'HIV and HBV ELISA non-reactive.'
      })
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.success, true);
    assert.equal(updateData.record.hivTest, 'Negative');
    assert.equal(updateData.record.hbvTest, 'Negative');
    assert.equal(updateData.record.hcvTest, 'Pending');
    assert.equal(updateData.record.status, 'In Testing');

    // Reload from backend to verify persistence
    const reloadRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing?unitId=${testUnitId}`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(reloadRes.status, 200);
    const reloadData = await reloadRes.json();
    const reloaded = reloadData.records.find(r => r.unitId === testUnitId);
    assert.ok(reloaded);
    assert.equal(reloaded.hivTest, 'Negative');
    assert.equal(reloaded.hbvTest, 'Negative');
    assert.equal(reloaded.hcvTest, 'Pending');
    assert.equal(reloaded.syphilisTest, 'Pending');
    assert.equal(reloaded.malariaTest, 'Pending');
  });

  // Test 4: Missing results strictly prevent release
  test('4. Missing results prevent clinical release with HTTP 422 error', async () => {
    // Attempt to pass unit while HCV, Syphilis, and Malaria are still Pending
    const releaseAttempt = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testTestingRecId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        status: 'Passed'
      })
    });
    assert.equal(releaseAttempt.status, 422);
    const attemptData = await releaseAttempt.json();
    assert.equal(attemptData.success, false);
    assert.ok(attemptData.error.toLowerCase().includes('all 5 mandatory'));
    assert.ok(attemptData.pendingMarkers.includes('Hepatitis C'));
    assert.ok(attemptData.pendingMarkers.includes('Syphilis'));
    assert.ok(attemptData.pendingMarkers.includes('Malaria'));
  });

  // Test 5: Reactive result triggers quarantine and cannot be cleared
  test('5. Reactive marker triggers biohazard quarantine and blocks clinical clearance', async () => {
    // Attempt to pass with Hepatitis C Positive (Reactive)
    const reactiveRelease = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testTestingRecId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        status: 'Passed',
        hcvTest: 'Positive'
      })
    });
    assert.equal(reactiveRelease.status, 422);
    const reactiveData = await reactiveRelease.json();
    assert.equal(reactiveData.success, false);
    assert.ok(reactiveData.error.toLowerCase().includes('reactive result detected'));
  });

  // Test 6: Uncleared unit remains unavailable for hospital allocation
  test('6. Uncleared unit is rejected when checked against hospital requisitions', async () => {
    // Create a clinical blood requisition from Hospital
    const reqRes = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`
      },
      body: JSON.stringify({
        bloodBankId: bbId,
        bloodGroup: 'O+',
        component: 'RBC',
        quantityUnits: 1,
        urgency: 'Urgent',
        patientReferenceId: 'PAT-TRAUMA-410',
        department: 'Emergency Room',
        requiredByDate: new Date(Date.now() + 86400000).toISOString()
      })
    });
    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();
    testReqId = reqData.request.id;
    assert.ok(testReqId);

    // Blood Bank queries eligible units for this requisition
    const eligRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReqId}/eligible-units`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(eligRes.status, 200);
    const eligData = await eligRes.json();
    assert.equal(eligData.units.length, 0, 'Untested unit must not be in eligible released FEFO units');
    assert.ok(eligData.diagnostics.pendingTestingCount >= 1);
    assert.ok(eligData.diagnostics.pendingTestingUnits.some(u => u.id === testUnitId));

    // Direct attempt to allocate untested unit must return 400
    const allocRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReqId}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        unitIds: [testUnitId]
      })
    });
    assert.equal(allocRes.status, 400);
    const allocData = await allocRes.json();
    assert.equal(allocData.success, false);
    assert.ok(allocData.error.toLowerCase().includes('testing status'));
  });

  // Test 7: Authorized full clearance transitions unit to available inventory
  test('7. Authorized clearance with all 5 Negative markers releases unit to Available inventory', async () => {
    // Record all 5 markers as Negative and authorize release
    const clearRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testTestingRecId}`, {
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
        malariaTest: 'Negative',
        testedBy: 'Lab Director Dr. Clara',
        notes: 'Verified all 5 serological & molecular assays Negative. Released to clinical stock.'
      })
    });
    assert.equal(clearRes.status, 200);
    const clearData = await clearRes.json();
    assert.equal(clearData.success, true);
    assert.equal(clearData.record.status, 'Passed');
    assert.equal(clearData.unit.testingStatus, 'Passed');
    assert.equal(clearData.unit.availability, 'Available');

    // Verify unit now appears in available inventory query
    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory?availability=Available&component=RBC`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(invRes.status, 200);
    const invData = await invRes.json();
    const inStock = invData.units.find(u => u.id === testUnitId);
    assert.ok(inStock, 'Unit must now appear in available inventory');
    assert.equal(inStock.availability, 'Available');
    assert.equal(inStock.testingStatus, 'Passed');
  });

  // Test 8: Released unit becomes eligible and can be allocated to requisition
  test('8. Released compatible unit appears in FEFO priority and allocates successfully', async () => {
    // Re-check eligible units for REQ
    const eligRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReqId}/eligible-units`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(eligRes.status, 200);
    const eligData = await eligRes.json();
    assert.equal(eligData.units.length, 1);
    assert.equal(eligData.units[0].id, testUnitId);
    assert.equal(eligData.diagnostics.pendingTestingCount, 0);

    // Allocate unit
    const allocRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${testReqId}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        unitIds: [testUnitId],
        notes: 'Allocating verified unit to emergency requisition.'
      })
    });
    assert.equal(allocRes.status, 200);
    const allocData = await allocRes.json();
    assert.equal(allocData.success, true);
    assert.equal(allocData.request.status, 'Reserved');
    assert.equal(allocData.request.fulfilledUnits, 1);
    assert.deepEqual(allocData.request.assignedUnitIds, [testUnitId]);
  });

  // Test 9: Concurrency and double-allocation protection
  test('9. Concurrency & double allocation protection: Same unit cannot be allocated twice', async () => {
    // Create another requisition for O+ RBC
    const req2Res = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`
      },
      body: JSON.stringify({
        bloodBankId: bbId,
        bloodGroup: 'O+',
        component: 'RBC',
        quantityUnits: 1,
        urgency: 'Routine',
        patientReferenceId: 'PAT-ROUTINE-991',
        department: 'General Surgery',
        requiredByDate: new Date(Date.now() + 86400000).toISOString()
      })
    });
    assert.equal(req2Res.status, 201);
    const req2Data = await req2Res.json();
    const req2Id = req2Data.request.id;

    // Attempting to allocate testUnitId (which is already Reserved for testReqId) must fail with 409
    const doubleAlloc = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${req2Id}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        unitIds: [testUnitId]
      })
    });
    assert.equal(doubleAlloc.status, 409);
    const doubleAllocData = await doubleAlloc.json();
    assert.equal(doubleAllocData.success, false);
    assert.ok(doubleAllocData.error.toLowerCase().includes('double reservation prevented'));
  });

  // Test 10: Persisted state integrity after test reset and fixtures
  test('10. Re-seeding test fixtures preserves database health and developer setup', async () => {
    const seedRes = await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });
    assert.equal(seedRes.status, 200);
    const seedData = await seedRes.json();
    assert.equal(seedData.success, true);
    assert.ok(seedData.counts.bloodUnits >= 60);
    assert.ok(seedData.counts.testingRecords >= 60);
  });
});

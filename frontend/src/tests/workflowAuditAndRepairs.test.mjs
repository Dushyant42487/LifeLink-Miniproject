import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:5001';

describe('LifeLink Workflow Audit & Comprehensive Repairs Test Suite', () => {
  let donorToken = '';
  let donorId = '';
  let donorEmail = '';

  let bbToken = '';
  let bbId = '';
  let bbEmail = '';

  let hospToken = '';
  let hospId = '';
  let hospEmail = '';

  before(async () => {
    const ts = Date.now();

    // 1. Register Blood Bank
    bbEmail = `bank-audit-${ts}@lifelink.org`;
    const bbRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'blood_bank',
        email: bbEmail,
        password: 'password123',
        bloodBankName: 'Audit Testing Center',
        registrationId: `BB-AUDIT-${ts}`,
        contactPerson: 'Director Sarah Connor',
        phone: '+1 (555) 432-1000',
        city: 'Metro City',
        latitude: 40.7128,
        longitude: -74.0060
      })
    });
    assert.equal(bbRes.status, 201);
    const bbData = await bbRes.json();
    bbToken = bbData.token;
    bbId = bbData.user.id;

    // 2. Register Hospital
    hospEmail = `hospital-audit-${ts}@lifelink.org`;
    const hospRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'hospital',
        email: hospEmail,
        password: 'password123',
        hospitalName: 'Audit General Hospital',
        licenseId: `HOSP-AUDIT-${ts}`,
        contactPerson: 'Dr. James Wilson',
        phone: '+1 (555) 432-2000',
        city: 'Metro City',
        latitude: 40.7484,
        longitude: -73.9857
      })
    });
    assert.equal(hospRes.status, 201);
    const hospData = await hospRes.json();
    hospToken = hospData.token;
    hospId = hospData.user.id;

    // 3. Register Donor
    donorEmail = `donor-audit-${ts}@lifelink.org`;
    const donRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: donorEmail,
        password: 'password123',
        name: 'Alex Mercer',
        bloodGroup: 'O+',
        phone: '+1 (555) 432-3000',
        city: 'Metro City',
        dob: '1995-05-15',
        gender: 'Male',
        weightKg: 75
      })
    });
    assert.equal(donRes.status, 201);
    const donData = await donRes.json();
    donorToken = donData.token;
    donorId = donData.user.id;
  });

  test('1. Blood bank dashboard reports authentic zero collections today without fake fallbacks', async () => {
    const dashRes = await fetch(`${BACKEND_URL}/api/blood-bank/dashboard`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(dashRes.status, 200);
    const dashData = await dashRes.json();
    assert.equal(dashData.success, true);

    // Newly registered bank has 0 collections today — MUST NOT be fake 4
    assert.equal(dashData.metrics.todayCollectionsCount, 0, 'todayCollectionsCount must be 0 for new bank, not fake fallback 4');
  });

  test('2. Operational reports endpoint returns calculated genuine numbers and fulfillment rate', async () => {
    const repRes = await fetch(`${BACKEND_URL}/api/blood-bank/reports`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(repRes.status, 200);
    const repData = await repRes.json();
    assert.equal(repData.success, true);
    assert.equal(typeof repData.summary.fulfillmentRate, 'string');
    assert.equal(repData.summary.totalCollectionsThisMonth, 0, 'Must not be fake 124');
    assert.equal(repData.summary.totalRequestsThisMonth, 0, 'Must not be fake 88');
  });

  test('3. Requisition FEFO diagnostics report quarantine status and pending laboratory units', async () => {
    // A. Hospital creates a blood request targeted to this blood bank
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
        quantityUnits: 2,
        urgency: 'Normal',
        patientName: 'Jane Doe',
        patientId: 'PT-9999',
        diagnosis: 'Elective Surgery'
      })
    });
    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();
    const requestId = reqData.request.id;

    // B. Blood bank queries eligible units before any inventory exists
    const elig1Res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/eligible-units`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(elig1Res.status, 200);
    const elig1Data = await elig1Res.json();
    assert.equal(elig1Data.count, 0);
    assert.ok(elig1Data.diagnostics, 'Response must include diagnostic breakdown');
    assert.equal(elig1Data.diagnostics.pendingTestingCount, 0);

    // C. Blood bank adds an in-testing / quarantined unit (simulating phlebotomy)
    const addUnitRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        bloodGroup: 'O+',
        component: 'RBC',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        storageLocation: 'Quarantine Bay A1',
        testingStatus: 'Pending',
        availability: 'Quarantined'
      })
    });
    assert.equal(addUnitRes.status, 201);
    const addUnitData = await addUnitRes.json();
    const createdUnitId = addUnitData.unit.id;

    // D. Blood bank re-queries eligible units — must show 0 released, but diagnostic pending count = 1
    const elig2Res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/eligible-units`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(elig2Res.status, 200);
    const elig2Data = await elig2Res.json();
    assert.equal(elig2Data.count, 0, 'Quarantined unit must NOT be counted as eligible released unit');
    assert.equal(elig2Data.diagnostics.pendingTestingCount, 1, 'Diagnostics must show 1 unit awaiting screening');
    assert.ok(elig2Data.diagnostics.explanation.includes('Laboratory Quarantine') || elig2Data.diagnostics.explanation.includes('screening'));
    assert.equal(elig2Data.diagnostics.pendingTestingUnits[0].id, createdUnitId);

    // E. Blood bank laboratory marks unit as Passed
    const testListRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(testListRes.status, 200);
    const testListData = await testListRes.json();
    const testRecord = testListData.records.find(r => r.unitId === createdUnitId);
    assert.ok(testRecord, 'Testing record must exist for quarantined unit');

    const passRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testRecord.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        status: 'Passed',
        hiv: 'Negative',
        hbv: 'Negative',
        hcv: 'Negative',
        syphilis: 'Negative',
        malaria: 'Negative',
        notes: 'Screened clean by clinical automation'
      })
    });
    assert.equal(passRes.status, 200);

    // F. Re-query eligible units — now unit MUST be eligible and released!
    const elig3Res = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/eligible-units`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(elig3Res.status, 200);
    const elig3Data = await elig3Res.json();
    assert.equal(elig3Data.count, 1, 'Passed unit must now be eligible for allocation');
    assert.equal(elig3Data.units[0].id, createdUnitId);

    // G. Allocate the unit to request
    const allocRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        unitIds: [createdUnitId],
        notes: 'Allocated for surgery'
      })
    });
    assert.equal(allocRes.status, 200);
    const allocData = await allocRes.json();
    assert.equal(allocData.request.fulfilledUnits, 1);
    assert.equal(allocData.request.status, 'Partially Fulfilled');

    // H. Release the allocated unit
    const relRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/release-allocation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({ reason: 'Surgery rescheduled' })
    });
    assert.equal(relRes.status, 200);
    const relData = await relRes.json();
    assert.equal(relData.request.fulfilledUnits, 0);
    assert.equal(relData.request.status, 'Sample Submitted');
  });

  test('4. Donor creates camp request, Blood Bank reviews, accepts, and schedules donation drive', async () => {
    // A. Donor submits camp request targeted to blood bank
    const createCampReqRes = await fetch(`${BACKEND_URL}/api/donors/camp-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        organizationName: 'Nexus Tech Innovations',
        organizationType: 'Company/Office',
        organizerName: 'Alex Mercer',
        organizerEmail: donorEmail,
        organizerPhone: '+1 (555) 432-3000',
        proposedDate: '2026-11-15',
        preferredTimeSlot: '10:00 AM - 04:00 PM',
        venueAddress: 'Building 7, Cyber Tech Park',
        city: 'Metro City',
        estimatedParticipants: 80,
        expectedDonations: 60,
        availableFacilities: 'Air-conditioned conference hall with power backup',
        isAuthorizedRepresentative: true,
        agreedToTerms: true,
        bloodBankId: bbId
      })
    });
    assert.equal(createCampReqRes.status, 201);
    const createCampData = await createCampReqRes.json();
    assert.equal(createCampData.success, true);
    const campRequestId = createCampData.request.id;
    assert.equal(createCampData.request.bloodBankId, bbId);
    assert.equal(createCampData.request.status, 'Submitted');

    // B. Blood Bank retrieves incoming camp requests
    const bankCampReqsRes = await fetch(`${BACKEND_URL}/api/blood-bank/camp-requests`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(bankCampReqsRes.status, 200);
    const bankCampReqsData = await bankCampReqsRes.json();
    assert.equal(bankCampReqsData.success, true);
    const targetReq = bankCampReqsData.requests.find(r => r.id === campRequestId);
    assert.ok(targetReq, 'Target camp request must appear in blood bank queue');

    // C. Blood Bank accepts and schedules the camp
    const acceptRes = await fetch(`${BACKEND_URL}/api/blood-bank/camp-requests/${campRequestId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        scheduledDate: '2026-11-15',
        timeSlot: '10:00 AM - 04:00 PM',
        notes: 'Mobile phlebotomy van #2 assigned'
      })
    });
    assert.equal(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.equal(acceptData.success, true);
    assert.equal(acceptData.campRequest.status, 'Approved');
    assert.ok(acceptData.scheduledCamp.id, 'Scheduled camp record must be created');
    assert.equal(acceptData.scheduledCamp.organizer, 'Nexus Tech Innovations');
    assert.equal(acceptData.scheduledCamp.bloodBankId, bbId);

    // D. Verify the scheduled camp appears in blood bank camps list
    const campsRes = await fetch(`${BACKEND_URL}/api/blood-bank/camps`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(campsRes.status, 200);
    const campsData = await campsRes.json();
    const scheduledDrive = campsData.camps.find(c => c.id === acceptData.scheduledCamp.id);
    assert.ok(scheduledDrive, 'Scheduled camp drive must appear in blood bank camps roster');
  });

  test('5. Universal notification service delivers and persists notifications across roles', async () => {
    // A. Check donor notifications via universal GET /api/notifications
    const donorNotifRes = await fetch(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(donorNotifRes.status, 200);
    const donorNotifData = await donorNotifRes.json();
    assert.equal(donorNotifData.success, true);
    assert.ok(donorNotifData.notifications.length > 0, 'Donor should have notifications (e.g. camp approval)');

    const targetNotif = donorNotifData.notifications[0];
    assert.equal(targetNotif.read, false);

    // B. Mark single notification as read
    const readRes = await fetch(`${BACKEND_URL}/api/notifications/${targetNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(readRes.status, 200);
    const readData = await readRes.json();
    assert.equal(readData.success, true);
    assert.equal(readData.notification.read, true);

    // C. Mark all notifications as read
    const readAllRes = await fetch(`${BACKEND_URL}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(readAllRes.status, 200);
    const readAllData = await readAllRes.json();
    assert.equal(readAllData.success, true);

    // D. Verify all notifications are read
    const verifyNotifRes = await fetch(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const verifyNotifData = await verifyNotifRes.json();
    assert.equal(verifyNotifData.unreadCount, 0);

    // E. Verify Blood Bank can access universal notifications
    const bbNotifRes = await fetch(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(bbNotifRes.status, 200);
    const bbNotifData = await bbNotifRes.json();
    assert.equal(bbNotifData.success, true);
  });
});

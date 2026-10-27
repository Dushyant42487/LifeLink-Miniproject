import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:5001';

describe('LifeLink Phase 8: Clean Data End-to-End Workflow Verification', () => {

  let donorToken = '';
  let donorId = '';
  let donorEmail = '';

  let bbToken = '';
  let bbId = '';
  let bbEmail = '';

  let hospToken = '';
  let hospId = '';
  let hospEmail = '';

  let hosp2Token = '';
  let hosp2Id = '';

  let collectionId = '';
  let unitId = '';
  let testingRecordId = '';
  let requestId = '';
  let dispatchId = '';

  before(async () => {
    // 1. Reset database to completely empty state
    const resetRes = await fetch(`${BACKEND_URL}/api/test/reset`, { method: 'POST' });
    const resetData = await resetRes.json();
    assert.equal(resetRes.status, 200);
    assert.equal(resetData.success, true);
    assert.equal(resetData.counts.donors, 0);
    assert.equal(resetData.counts.bloodUnits, 0);
    assert.equal(resetData.counts.bloodRequests, 0);
  });

  test('Workflow 1: Donor Registration, Login & Eligibility Profile', async () => {
    const ts = Date.now();
    donorEmail = `donor-${ts}@testmail.com`;

    // 1. Register donor
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: donorEmail,
        password: 'password123',
        name: 'Jordan Rivera',
        bloodGroup: 'A+',
        dob: '1996-04-15',
        gender: 'Female',
        phone: '+1 (555) 444-1234',
        weightKg: 62
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.success, true);
    donorToken = regData.token;
    donorId = regData.user.id;
    assert.equal(regData.user.name, 'Jordan Rivera');
    assert.equal(regData.user.bloodGroup, 'A+');

    // 2. Fetch profile via protected route
    const profRes = await fetch(`${BACKEND_URL}/api/donors/profile`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(profRes.status, 200);
    const profData = await profRes.json();
    assert.equal(profData.donor.id, donorId);
    assert.equal(profData.donor.email, donorEmail);

    // 3. Verify newly registered donor is NOT eligible until verified
    const eligRes = await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(eligRes.status, 200);
    const eligData = await eligRes.json();
    assert.equal(eligData.success, true);
    assert.equal(eligData.eligibility.isEligible, false);
    assert.equal(eligData.eligibility.isVerified, false);
    assert.equal(eligData.eligibility.wholeBlood.isEligible, false);
    assert.equal(eligData.eligibility.wholeBlood.verificationRequired, true);

    // 4. Donor uploads blood group verification proof
    const verifyProofRes = await fetch(`${BACKEND_URL}/api/donors/verify-blood-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        bloodGroupProofDocUrl: 'https://cdn.lifelink.io/proofs/rivera-bloodgroup.pdf',
        documentType: 'Lab Blood Report',
        documentNumber: 'LAB-TEST-992'
      })
    });
    assert.equal(verifyProofRes.status, 200);
    const verifyProofData = await verifyProofRes.json();
    assert.equal(verifyProofData.success, true);
  });

  test('Workflow 2: Blood Bank Onboarding, Verification Enforcement & Phlebotomy Collection', async () => {
    const ts = Date.now();
    bbEmail = `bank-${ts}@testmail.com`;

    // 1. Register Blood Bank
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'blood_bank',
        email: bbEmail,
        password: 'password123',
        bloodBankName: 'Metropolitan Clean Blood Hub',
        registrationId: `BB-CLEAN-${ts}`,
        contactPerson: 'Dr. Evelyn Vance',
        phone: '+1 (555) 888-5678',
        city: 'Metro City'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.success, true);
    bbToken = regData.token;
    bbId = regData.user.id;

    // 2. Lookup newly registered donor (shows Pending Verification / Unverified)
    const lookupRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/search?q=Rivera`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(lookupRes.status, 200);
    const lookupData = await lookupRes.json();
    assert.equal(lookupData.success, true);
    assert.ok(lookupData.donors.length >= 1);
    const targetDonor = lookupData.donors.find(d => d.id === donorId);
    assert.ok(targetDonor, 'Newly registered donor must be found in search results');
    assert.equal(targetDonor.isVerified, false);

    // 3. Attempt collection on UNVERIFIED donor -> MUST FAIL WITH 422
    const unverifiedColRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId,
        collectionType: 'In-House Phlebotomy',
        component: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        phlebotomistName: 'Nurse Laura Dean'
      })
    });
    assert.equal(unverifiedColRes.status, 422);
    const unverifiedColData = await unverifiedColRes.json();
    assert.equal(unverifiedColData.success, false);
    assert.ok(unverifiedColData.error.toLowerCase().includes('not verified'));

    // 4. Blood bank staff verifies donor
    const staffVerifyRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/${donorId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        status: 'Verified'
      })
    });
    assert.equal(staffVerifyRes.status, 200);
    const staffVerifyData = await staffVerifyRes.json();
    assert.equal(staffVerifyData.success, true);
    assert.equal(staffVerifyData.donor.bloodGroupVerificationStatus, 'Verified');
    assert.equal(staffVerifyData.donor.isEligible, true);

    // 5. Record in-house whole blood collection (450 mL) - now succeeds!
    const colRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId,
        collectionType: 'In-House Phlebotomy',
        component: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        phlebotomistName: 'Nurse Laura Dean'
      })
    });
    assert.equal(colRes.status, 201);
    const colData = await colRes.json();
    assert.equal(colData.success, true);
    collectionId = colData.collection.id;
    assert.ok(collectionId);
    assert.equal(colData.collection.volumeMl, 450);

    // 4. Verify duplicate collection submission prevention
    const dupRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId,
        collectionType: 'In-House Phlebotomy',
        component: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0]
      })
    });
    assert.ok(dupRes.status === 409 || dupRes.status === 422, 'Duplicate collection attempt must return 409 Conflict or 422 Unprocessable Entity');

    // 5. Fractionate whole blood into RBC component
    const fracRes = await fetch(`${BACKEND_URL}/api/blood-bank/fractionation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        sourceCollectionId: collectionId,
        operatorName: 'Lab Tech Sam Lee',
        components: [
          { component: 'RBC', volumeMl: 280, storageLocation: 'Walk-In Chiller Shelf 1' },
          { component: 'Plasma', volumeMl: 150, storageLocation: 'Deep Freeze Bay 2' }
        ]
      })
    });
    assert.equal(fracRes.status, 201);
    const fracData = await fracRes.json();
    assert.equal(fracData.success, true);
    assert.equal(fracData.createdUnits.length, 2);

    const rbcUnit = fracData.createdUnits.find(u => u.component === 'RBC');
    assert.ok(rbcUnit);
    unitId = rbcUnit.id;
    assert.equal(rbcUnit.availability, 'Quarantined');
    assert.equal(rbcUnit.testingStatus, 'Quarantined');
  });

  test('Workflow 3: Infectious Disease Lab Screening & Release to Available Stock', async () => {
    // 1. Fetch pending lab testing queue
    const queueRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing?status=pending`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(queueRes.status, 200);
    const queueData = await queueRes.json();
    assert.equal(queueData.success, true);

    const targetRecord = queueData.records.find(r => r.unitId === unitId);
    assert.ok(targetRecord, 'RBC unit must be present in pending lab screening queue');
    testingRecordId = targetRecord.id;

    // 2. Record passing infectious disease panel (HIV, HBV, HCV, Syphilis, Malaria)
    const testRes = await fetch(`${BACKEND_URL}/api/blood-bank/testing/${testingRecordId}`, {
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
        notes: 'Clinical clearance verified. Certified safe for allocation.'
      })
    });
    assert.equal(testRes.status, 200);
    const testData = await testRes.json();
    assert.equal(testData.success, true);
    assert.equal(testData.record.status, 'Passed');

    // 3. Confirm that unit is now officially Released and Available in stock
    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(invRes.status, 200);
    const invData = await invRes.json();
    const releasedUnit = invData.units.find(u => u.id === unitId);
    assert.ok(releasedUnit);
    assert.equal(releasedUnit.availability, 'Available');
    assert.equal(releasedUnit.testingStatus, 'Passed');
  });

  test('Workflow 4: Hospital Registration & Clinical Blood Requisition', async () => {
    const ts = Date.now();
    hospEmail = `hospital-${ts}@testmail.com`;

    // 1. Register hospital
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'hospital',
        email: hospEmail,
        password: 'password123',
        hospitalName: 'St. Jude Trauma Hospital',
        licenseId: `HOSP-LIC-${ts}`,
        contactPerson: 'Dr. Marcus Ross',
        phone: '+1 (555) 777-3333',
        emergencyPhone: '+1 (555) 911-3333',
        city: 'Metro City',
        latitude: 40.7306,
        longitude: -73.9352
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.success, true);
    hospToken = regData.token;
    hospId = regData.user.id;

    // 2. Hospital creates emergency blood requisition for A+ RBC (1 unit)
    const reqRes = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`
      },
      body: JSON.stringify({
        bloodBankId: bbId,
        bloodGroup: 'A+',
        component: 'RBC',
        quantityUnits: 1,
        urgency: 'Emergency',
        patientReferenceId: `PAT-CLEAN-${ts}`,
        department: 'Emergency & Trauma Surgery',
        notes: 'Acute surgical hemorrhage. Require cross-matched A+ packed cells.'
      })
    });
    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();
    assert.equal(reqData.success, true);
    requestId = reqData.request.id;
    assert.ok(requestId);
    assert.equal(reqData.request.status, 'Pending');
    assert.equal(reqData.request.hospitalId, hospId);
  });

  test('Workflow 5: Requisition Allocation & Reservation by Blood Bank', async () => {
    // 1. Blood Bank finds requisition and inspects eligible inventory
    const eligRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/eligible-units`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(eligRes.status, 200);
    const eligData = await eligRes.json();
    assert.equal(eligData.success, true);
    const matchingUnit = eligData.units.find(u => u.id === unitId);
    assert.ok(matchingUnit, 'Tested A+ RBC unit must appear as eligible for allocation');

    // 2. Allocate the unit to hospital requisition
    const allocRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        unitIds: [unitId],
        notes: 'Clinically verified compatible. Assigned to emergency trauma order.'
      })
    });
    assert.equal(allocRes.status, 200);
    const allocData = await allocRes.json();
    assert.equal(allocData.success, true);
    assert.equal(allocData.request.status, 'Reserved');
    assert.deepEqual(allocData.request.assignedUnitIds, [unitId]);

    // 3. Confirm unit status changed to Reserved
    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    const invData = await invRes.json();
    const allocatedUnit = invData.units.find(u => u.id === unitId);
    assert.equal(allocatedUnit.availability, 'Reserved');
    assert.equal(allocatedUnit.reservedForRequestId, requestId);
  });

  test('Workflow 6: Dispatch Preparation, Courier Handoff & Hospital Receipt', async () => {
    // 1. Prepare Dispatch
    const prepRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/prepare-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        courierType: 'Dedicated Hospital Courier',
        courierReference: 'VAN-METRO-09',
        packagingType: 'Validated Thermal Insulated Box with Phase-Change Panels',
        coldChainTargetRange: '2.0°C - 6.0°C',
        sealNumber: 'SEAL-4482',
        notes: 'Packed into validated cooler at 3.8°C.'
      })
    });
    assert.equal(prepRes.status, 200);
    const prepData = await prepRes.json();
    assert.equal(prepData.success, true);
    assert.equal(prepData.request.status, 'Prepared for Dispatch');
    assert.equal(prepData.dispatch.status, 'Prepared');
    dispatchId = prepData.dispatch.id;
    assert.ok(dispatchId);

    // 2. Confirm Dispatch (Handoff to Courier)
    const confDispRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/confirm-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        courierReference: 'VAN-METRO-09',
        notes: 'Handed off to courier driver at loading bay.'
      })
    });
    assert.equal(confDispRes.status, 200);
    const confDispData = await confDispRes.json();
    assert.equal(confDispData.success, true);
    assert.equal(confDispData.request.status, 'Dispatched');

    // 3. Hospital confirms receipt
    const recRes = await fetch(`${BACKEND_URL}/api/hospitals/requests/${requestId}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`
      },
      body: JSON.stringify({
        notes: 'Received in OT. Seal SEAL-4482 intact. Temperature verified at 3.9°C.'
      })
    });
    assert.equal(recRes.status, 200);
    const recData = await recRes.json();
    assert.equal(recData.success, true);
    assert.equal(recData.request.status, 'Fulfilled');
    assert.equal(recData.request.fulfilledUnits, 1);

    // 4. Verify OT Storage Ledger entry created for hospital
    const ledgerRes = await fetch(`${BACKEND_URL}/api/hospitals/storage-ledger`, {
      headers: { Authorization: `Bearer ${hospToken}` }
    });
    assert.equal(ledgerRes.status, 200);
    const ledgerData = await ledgerRes.json();
    assert.equal(ledgerData.success, true);
    assert.ok(ledgerData.entries.length >= 1);
    assert.equal(ledgerData.entries[0].bloodGroup, 'A+');
    assert.equal(ledgerData.entries[0].component, 'RBC');
  });

  test('Workflow 7: Cross-Tenant Multi-Hospital Isolation', async () => {
    const ts = Date.now();
    // Register Hospital 2 (unrelated hospital)
    const reg2Res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'hospital',
        email: `otherhosp-${ts}@testmail.com`,
        password: 'password123',
        hospitalName: 'Unrelated City Clinic'
      })
    });
    const reg2Data = await reg2Res.json();
    hosp2Token = reg2Data.token;
    hosp2Id = reg2Data.user.id;

    // Hospital 2 must NOT be able to view Hospital 1's requisition messages or confirm receipt
    const unauthReceiptRes = await fetch(`${BACKEND_URL}/api/hospitals/requests/${requestId}/confirm-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hosp2Token}`
      },
      body: JSON.stringify({ notes: 'Attempt unauthorized receipt' })
    });
    assert.equal(unauthReceiptRes.status, 403, 'Cross-hospital access must return 403 Forbidden');

    // Hospital 2's request list must NOT contain Hospital 1's request
    const list2Res = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      headers: { Authorization: `Bearer ${hosp2Token}` }
    });
    const list2Data = await list2Res.json();
    assert.equal(list2Data.requests.some(r => r.id === requestId), false);
  });

  test('Workflow 8: Negative & Recovery Tests', async () => {
    // 1. Attempting to allocate an already fulfilled request returns 400 error
    const reAllocRes = await fetch(`${BACKEND_URL}/api/blood-bank/requests/${requestId}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({ unitIds: [unitId] })
    });
    assert.equal(reAllocRes.status, 400);

    // 2. Non-existent donor lookup returns 404
    const missingDonor = await fetch(`${BACKEND_URL}/api/blood-bank/donors/UNKNOWN-DONOR-999`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(missingDonor.status, 404);

    // 3. Re-seeding fixtures restores developer environment without errors
    const seedRes = await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });
    assert.equal(seedRes.status, 200);
    const seedData = await seedRes.json();
    assert.equal(seedData.success, true);
    assert.ok(seedData.counts.bloodBanks >= 2);
  });

});

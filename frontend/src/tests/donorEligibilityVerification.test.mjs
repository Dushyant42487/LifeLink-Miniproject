import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEligibilityPolicy } from '../utils/donationEligibility.ts';

const BACKEND_URL = 'http://localhost:5001';

describe('LifeLink Bug Fix 1: Donor Eligibility Must Require Verification Test Suite', () => {
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
    bbEmail = `bank-verifier-${ts}@testmail.com`;
    const bbRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'blood_bank',
        email: bbEmail,
        password: 'password123',
        bloodBankName: 'Verification Testing Blood Center',
        registrationId: `BB-VERIF-${ts}`,
        contactPerson: 'Dr. Clara Oswald',
        phone: '+1 (555) 777-1234',
        city: 'Metro City'
      })
    });
    assert.equal(bbRes.status, 201);
    const bbData = await bbRes.json();
    bbToken = bbData.token;
    bbId = bbData.user.id;

    // 2. Register Hospital
    hospEmail = `hospital-unauth-${ts}@testmail.com`;
    const hospRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'hospital',
        email: hospEmail,
        password: 'password123',
        hospitalName: 'St. Jude Testing Hospital',
        registrationNumber: `HOSP-TEST-${ts}`,
        contactPerson: 'Dr. John Watson',
        phone: '+1 (555) 666-4321',
        city: 'Metro City'
      })
    });
    assert.equal(hospRes.status, 201);
    const hospData = await hospRes.json();
    hospToken = hospData.token;
    hospId = hospData.user.id;
  });

  // Test 1: Newly registered donor starts unverified & ineligible
  test('1. Newly registered donor: starts with isEligible: false and unverified status', async () => {
    const ts = Date.now();
    donorEmail = `donor-fresh-${ts}@testmail.com`;

    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: donorEmail,
        password: 'password123',
        name: 'Jordan Rivera',
        bloodGroup: 'O+',
        phone: '+1 (555) 345-6789',
        weightKg: 65,
        city: 'Metro City'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.success, true);
    donorToken = regData.token;
    donorId = regData.user.id;

    // Server must return isEligible: false on registration response
    assert.equal(regData.user.isEligible, false);
    assert.equal(regData.user.verificationStatus, 'Unverified');
    assert.equal(regData.user.bloodGroupVerificationStatus, 'Unverified');

    // GET /api/donors/eligibility must report verification required and isEligible: false
    const eligRes = await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(eligRes.status, 200);
    const eligData = await eligRes.json();
    assert.equal(eligData.success, true);
    assert.equal(eligData.eligibility.isEligible, false);
    assert.equal(eligData.eligibility.isVerified, false);
    assert.equal(eligData.eligibility.verificationStatus, 'Unverified');
    assert.equal(eligData.eligibility.verificationRequired, true);
    assert.equal(eligData.eligibility.wholeBlood.isEligible, false);
    assert.equal(eligData.eligibility.wholeBlood.nextEligibleDate, 'Verification Required');
    assert.equal(eligData.eligibility.platelets.isEligible, false);
    assert.equal(eligData.eligibility.platelets.nextEligibleDate, 'Verification Required');

    // GET /api/donors/digital-pass reflects unverified status
    const passRes = await fetch(`${BACKEND_URL}/api/donors/digital-pass`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(passRes.status, 200);
    const passData = await passRes.json();
    assert.equal(passData.success, true);
    assert.equal(passData.pass.isEligible, false);
    assert.equal(passData.pass.verificationStatus, 'Unverified');
    assert.equal(passData.pass.bloodGroupVerificationStatus, 'Unverified');
  });

  // Test 2: Attempted client spoofing rejected
  test('2. Attempted spoofing: server ignores client isEligible: true or Verified during registration & profile update', async () => {
    const ts = Date.now();
    const spoofEmail = `donor-spoof-${ts}@testmail.com`;

    // Attempt spoofing at registration
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: spoofEmail,
        password: 'password123',
        name: 'Spoof Attempt',
        bloodGroup: 'AB+',
        phone: '+1 (555) 999-0000',
        weightKg: 70,
        isEligible: true,
        verificationStatus: 'Verified',
        bloodGroupVerificationStatus: 'Verified'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.user.isEligible, false);
    assert.equal(regData.user.verificationStatus, 'Unverified');
    assert.equal(regData.user.bloodGroupVerificationStatus, 'Unverified');

    const spoofToken = regData.token;

    // Attempt spoofing via PUT /api/donors/profile
    const updateRes = await fetch(`${BACKEND_URL}/api/donors/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${spoofToken}`
      },
      body: JSON.stringify({
        name: 'Spoof Attempt Updated',
        isEligible: true,
        verificationStatus: 'Verified',
        bloodGroupVerificationStatus: 'Verified'
      })
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.donor.isEligible, false);
    assert.equal(updateData.donor.verificationStatus, 'Unverified');
  });

  // Test 3: Unverified donor collection blocked with 422
  test('3. Collection creation: unverified donor is strictly blocked with HTTP 422', async () => {
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
        phlebotomistName: 'Phleb Jane'
      })
    });
    assert.equal(colRes.status, 422);
    const colData = await colRes.json();
    assert.equal(colData.success, false);
    assert.ok(colData.error.toLowerCase().includes('not verified') || colData.error.toLowerCase().includes('verification'));
  });

  // Test 4: Donor uploads proof -> status Pending Verification
  test('4. Document upload: donor uploads verification proof -> Pending Verification', async () => {
    const docRes = await fetch(`${BACKEND_URL}/api/donors/verify-blood-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        bloodGroupProofDocUrl: 'https://storage.lifelink.org/reports/lab-doc-123.pdf',
        documentType: 'Lab Blood Report',
        documentNumber: 'LAB-NYC-1092'
      })
    });
    assert.equal(docRes.status, 200);
    const docData = await docRes.json();
    assert.equal(docData.success, true);

    // Profile check
    const profRes = await fetch(`${BACKEND_URL}/api/donors/profile`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    assert.equal(profRes.status, 200);
    const profData = await profRes.json();
    assert.equal(profData.donor.bloodGroupVerificationStatus, 'Pending Verification');
    assert.equal(profData.donor.isEligible, false);

    // Eligibility check still false, next date Pending Review
    const eligRes = await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const eligData = await eligRes.json();
    assert.equal(eligData.eligibility.isEligible, false);
    assert.equal(eligData.eligibility.verificationStatus, 'Pending Verification');
    assert.equal(eligData.eligibility.wholeBlood.nextEligibleDate, 'Verification Pending Review');
  });

  // Test 5: Staff verification authorization (401 / 403 / 200)
  test('5. Staff verification endpoint: enforces role and tenant authorization', async () => {
    // 5a. Unauthenticated caller -> 401
    const unauthRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/${donorId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Verified' })
    });
    assert.equal(unauthRes.status, 401);

    // 5b. Cross-tenant caller (hospital role) -> 403 Forbidden
    const hospCallRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/${donorId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`
      },
      body: JSON.stringify({ status: 'Verified' })
    });
    assert.equal(hospCallRes.status, 403);

    // 5c. Authorized blood_bank staff -> 200 OK
    const staffRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/${donorId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({ status: 'Verified' })
    });
    assert.equal(staffRes.status, 200);
    const staffData = await staffRes.json();
    assert.equal(staffData.success, true);
    assert.equal(staffData.donor.bloodGroupVerificationStatus, 'Verified');
    assert.equal(staffData.donor.isEligible, true);
  });

  // Test 6: Verified donor with no prior donations becomes eligible
  test('6. Verified donor with no prior donations: becomes eligible and collection succeeds', async () => {
    // Verify via eligibility endpoint
    const eligRes = await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const eligData = await eligRes.json();
    assert.equal(eligData.eligibility.isEligible, true);
    assert.equal(eligData.eligibility.isVerified, true);
    assert.equal(eligData.eligibility.wholeBlood.isEligible, true);
    assert.equal(eligData.eligibility.wholeBlood.nextEligibleDate, 'Eligible Now');

    // Collection now succeeds with 201
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
        phlebotomistName: 'Dr. Clara Oswald'
      })
    });
    assert.equal(colRes.status, 201);
    const colData = await colRes.json();
    assert.equal(colData.success, true);
    assert.equal(colData.collection.volumeMl, 450);
  });

  // Test 7: Post-donation cool-off period enforcement
  test('7. Verified donor with recent donation: cool-off timer active, not eligible until period passes', async () => {
    const eligRes = await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    const eligData = await eligRes.json();
    assert.equal(eligData.eligibility.isVerified, true);
    assert.equal(eligData.eligibility.isEligible, false); // whole blood deferred
    assert.equal(eligData.eligibility.wholeBlood.isEligible, false);
    assert.equal(eligData.eligibility.wholeBlood.isDeferred, true);
    assert.equal(eligData.eligibility.wholeBlood.daysRemaining, 56);

    // Another collection immediately afterwards must be blocked with 422
    const secondColRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
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
        phlebotomistName: 'Dr. Clara Oswald'
      })
    });
    assert.equal(secondColRes.status, 422);
    const secondColData = await secondColRes.json();
    assert.ok(secondColData.error.toLowerCase().includes('deferred') || secondColData.error.toLowerCase().includes('cool-off'));
  });

  // Test 8: Underweight donor (<50 kg) is ineligible regardless of verification
  test('8. Underweight donor (<50 kg): ineligible regardless of verification status', async () => {
    const ts = Date.now();
    const lightEmail = `donor-underweight-${ts}@testmail.com`;

    // 1. Register donor with 46 kg
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: lightEmail,
        password: 'password123',
        name: 'Robin Light',
        bloodGroup: 'A+',
        phone: '+1 (555) 222-3344',
        weightKg: 46,
        city: 'Metro City'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    const lightDonorId = regData.user.id;

    // 2. Staff attempts to verify
    await fetch(`${BACKEND_URL}/api/blood-bank/donors/${lightDonorId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({ status: 'Verified' })
    });

    // 3. Check donor eligibility: verified is true, but isEligible MUST be false due to weight
    const eligRes = await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${regData.token}` }
    });
    const eligData = await eligRes.json();
    assert.equal(eligData.eligibility.isVerified, true);
    assert.equal(eligData.eligibility.isEligible, false);
    assert.ok(eligData.eligibility.deferralReason.includes('weight') || eligData.eligibility.deferralReason.includes('50 kg'));

    // 4. Phlebotomy collection must fail with 422
    const colRes = await fetch(`${BACKEND_URL}/api/blood-bank/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        donorId: lightDonorId,
        collectionType: 'In-House Phlebotomy',
        component: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        phlebotomistName: 'Dr. Clara Oswald'
      })
    });
    assert.equal(colRes.status, 422);
    const colData = await colRes.json();
    assert.ok(colData.error.toLowerCase().includes('weight') || colData.error.toLowerCase().includes('deferral') || colData.error.toLowerCase().includes('deferred'));
  });

  // Test 9: Staff rejection of verification proof
  test('9. Staff rejection workflow: staff rejects verification document with reason', async () => {
    const ts = Date.now();
    const rejectEmail = `donor-reject-${ts}@testmail.com`;

    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: rejectEmail,
        password: 'password123',
        name: 'Sam Rejected',
        bloodGroup: 'B+',
        phone: '+1 (555) 111-2233',
        weightKg: 70,
        city: 'Metro City'
      })
    });
    const regData = await regRes.json();
    const rejDonorId = regData.user.id;

    // Staff rejects verification
    const rejRes = await fetch(`${BACKEND_URL}/api/blood-bank/donors/${rejDonorId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bbToken}`
      },
      body: JSON.stringify({
        status: 'Rejected',
        rejectionReason: 'Lab report document expired and illegible'
      })
    });
    assert.equal(rejRes.status, 200);
    const rejData = await rejRes.json();
    assert.equal(rejData.donor.bloodGroupVerificationStatus, 'Rejected');
    assert.equal(rejData.donor.rejectionReason, 'Lab report document expired and illegible');
    assert.equal(rejData.donor.isEligible, false);

    // Profile check
    const profRes = await fetch(`${BACKEND_URL}/api/donors/profile`, {
      headers: { Authorization: `Bearer ${regData.token}` }
    });
    const profData = await profRes.json();
    assert.equal(profData.donor.bloodGroupVerificationStatus, 'Rejected');
    assert.equal(profData.donor.rejectionReason, 'Lab report document expired and illegible');
  });

  // Test 10: Seed fixtures & existing verified donors remain valid
  test('10. Existing verified donors with history: donor-1 cool-off deferred, donor-4 eligible', async () => {
    // Lookup donor-1
    const d1Res = await fetch(`${BACKEND_URL}/api/blood-bank/donors/donor-1`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(d1Res.status, 200);
    const d1Data = await d1Res.json();
    assert.equal(d1Data.donor.isVerified, true);
    assert.equal(d1Data.donor.bloodGroupVerificationStatus, 'Verified');
    assert.equal(d1Data.eligibility.wholeBlood.isEligible, false); // whole blood cool-off active
    assert.ok(d1Data.eligibility.wholeBlood.daysRemaining > 0);
    assert.ok(d1Data.donor.deferralReason.toLowerCase().includes('cool-off'));

    // Lookup donor with expired cool-off (>56 days)
    const d4Res = await fetch(`${BACKEND_URL}/api/blood-bank/donors/donor-4`, {
      headers: { Authorization: `Bearer ${bbToken}` }
    });
    assert.equal(d4Res.status, 200);
    const d4Data = await d4Res.json();
    assert.equal(d4Data.donor.isVerified, true);
    assert.equal(d4Data.donor.bloodGroupVerificationStatus, 'Verified');
    assert.equal(d4Data.donor.isEligible, true); // expired cool-off (>56 days)
    assert.equal(d4Data.eligibility.wholeBlood.isEligible, true);
  });

  // Test 11: Unit calculations for eligibility policy engine
  test('11. Frontend eligibility policy engine: unverified state overrides cool-off and returns ineligible', () => {
    // 11a. Unverified donor with no prior donations
    const unverifiedPolicy = calculateEligibilityPolicy(null, new Date(), false);
    assert.equal(unverifiedPolicy.isEligible, false);
    assert.equal(unverifiedPolicy.wholeBlood.isEligible, false);
    assert.equal(unverifiedPolicy.wholeBlood.verificationRequired, true);
    assert.equal(unverifiedPolicy.wholeBlood.nextEligibleDate, 'Verification Required');
    assert.equal(unverifiedPolicy.platelets.isEligible, false);
    assert.equal(unverifiedPolicy.platelets.nextEligibleDate, 'Verification Required');

    // 11b. Verified donor with no prior donations
    const verifiedPolicy = calculateEligibilityPolicy(null, new Date(), true);
    assert.equal(verifiedPolicy.isEligible, true);
    assert.equal(verifiedPolicy.wholeBlood.isEligible, true);
    assert.ok(verifiedPolicy.wholeBlood.nextEligibleDate === 'Eligible Now' || verifiedPolicy.wholeBlood.nextEligibleDate.length >= 10);

    // 11c. Verified donor with recent donation (20 days ago)
    const recentDate = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0];
    const coolOffPolicy = calculateEligibilityPolicy(recentDate, new Date(), true);
    assert.equal(coolOffPolicy.wholeBlood.isEligible, false);
    assert.equal(coolOffPolicy.wholeBlood.daysRemaining, 36);
    assert.equal(coolOffPolicy.platelets.isEligible, true); // 20 > 14 days

    // 11d. Verified donor with donation 60 days ago (>56 days)
    const oldDate = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
    const maturePolicy = calculateEligibilityPolicy(oldDate, new Date(), true);
    assert.equal(maturePolicy.wholeBlood.isEligible, true);
    assert.equal(maturePolicy.wholeBlood.daysRemaining, 0);
    assert.equal(maturePolicy.platelets.isEligible, true);
  });
});

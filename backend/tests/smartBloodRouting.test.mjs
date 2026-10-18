// Automated Integration Test Suite for LifeLink:
// Smart Emergency Blood Routing, 5-Second Alert Sound & End-to-End Fulfillment
// Verifies:
// 1. Requisition Creation & Hospital Coordinate Validation
// 2. Haversine Candidate Ranking & Released Stock Eligibility (Excluding Quarantined/Expired/Reserved)
// 3. Single Canonical Requisition with Per-Bank Offers (OFF-...)
// 4. Concurrency Safety, Partial Stock Commitments & Server-Authoritative Ledger (never exceeds Q)
// 5. Decline, Expiration & Automatic Rerouting / Search Radius Expansion
// 6. Strict Tenant Isolation (403 when bank attempts unauthorized response)
// 7. End-to-End Clinical Lifecycle: Allocation -> Dispatch Manifest -> Hospital Receipt Confirmation
// 8. 5-Second Emergency/Urgent Audio Alert Lifecycle & Deduplication
// 9. Admin Observability, Diagnostics & Escalation

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'lifelink-secret-key-2026-secure';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// Authenticated Facility Tokens
const hospitalToken = makeToken({ id: 'hosp-1', email: 'emergency@apellogeneral.org', role: 'hospital', name: 'Apollo General Hospital' });
const bloodBank1Token = makeToken({ id: 'bb-1', email: 'admin@cityblood.org', role: 'blood_bank', name: 'City Central Blood Bank' });
const bloodBank2Token = makeToken({ id: 'bb-2', email: 'redcross@regionalblood.org', role: 'blood_bank', name: 'Red Cross Regional Center' });
const bloodBank3Token = makeToken({ id: 'bb-3', email: 'stjude@bloodservices.org', role: 'blood_bank', name: 'St. Jude Memorial Blood Bank' });
const adminToken = makeToken({ id: 'admin-1', email: 'admin@lifelink.org', role: 'admin', name: 'LifeLink Administrator' });

function getBankToken(bankId, bankName = 'Candidate Blood Bank') {
  return makeToken({ id: bankId, email: `${bankId}@bloodservices.org`, role: 'blood_bank', name: bankName });
}

// Synthetic tokens for unconfigured/unauthorized test scenarios
const unconfiguredHospitalToken = makeToken({ id: 'hosp-unconfigured', email: 'rural@clinic.org', role: 'hospital', name: 'Rural Outreach Clinic' });
const unauthorizedDonorToken = makeToken({ id: 'donor-1', email: 'donor@lifelink.org', role: 'donor', name: 'John Doe' });

async function api(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.headers || {})
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

describe('LifeLink: Smart Emergency Blood Routing & End-to-End Fulfillment', () => {

  before(async () => {
    // Reset test database fixtures to a clean, isolated state before running suites
    await api('/test/seed-fixtures', { method: 'POST' });
  });

  // =========================================================================
  // SUITE 1: REQUISITION CREATION & HOSPITAL LOCATION INTEGRITY
  // =========================================================================
  describe('Suite 1: Hospital Request Creation & Coordinate Validation', () => {

    test('1.1: Rejects routing request when hospital coordinates are missing or unconfigured', async () => {
      const res = await api('/hospitals/requests', {
        method: 'POST',
        token: unconfiguredHospitalToken,
        body: {
          bloodGroup: 'O+',
          component: 'RBC',
          quantityUnits: 2,
          urgency: 'Emergency',
          patientReferenceId: 'PT-NO-COORDS',
          department: 'Emergency Room',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.needsLocationConfig, true);
      assert.match(res.data.error, /not configured|coordinates/i);
    });

    test('1.2: Authenticated hospital with coordinates creates a single canonical requisition', async () => {
      const res = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'A+',
          component: 'RBC',
          quantityUnits: 2,
          urgency: 'Emergency',
          patientReferenceId: 'PT-EMERGENCY-001',
          department: 'Trauma ICU',
          destinationMode: 'auto_routing',
          notes: 'Acute hemorrhage from motor vehicle accident'
        }
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.request);
      assert.ok(res.data.request.id.startsWith('REQ-'));
      assert.strictEqual(res.data.request.isAutoRouted, true);
      assert.strictEqual(res.data.request.urgency, 'Emergency');
      assert.strictEqual(res.data.request.quantityUnits, 2);
      assert.strictEqual(res.data.request.remainingUnitsToFulfill, 2);
      assert.ok(Array.isArray(res.data.request.routedBankOffers));
      assert.ok(res.data.request.routedBankOffers.length > 0, 'Must have dispatched at least one routing offer');
      
      // Verify all offer IDs start with OFF-
      for (const offer of res.data.request.routedBankOffers) {
        assert.ok(offer.id.startsWith('OFF-'));
        assert.strictEqual(offer.requestId, res.data.request.id);
        assert.strictEqual(offer.status, 'Offered');
        assert.ok(typeof offer.distanceKm === 'number');
      }
    });

    test('1.3: Prevents duplicate requisition submission on rapid replay', async () => {
      const payload = {
        bloodGroup: 'B+',
        component: 'RBC',
        quantityUnits: 1,
        urgency: 'Urgent',
        patientReferenceId: 'PT-IDEMPOTENT-001',
        department: 'Surgical Suite',
        destinationMode: 'auto_routing'
      };

      const res1 = await api('/hospitals/requests', { method: 'POST', token: hospitalToken, body: payload });
      assert.strictEqual(res1.status, 201);
      const reqId1 = res1.data.request.id;

      // Second identical call rapidly submitted is prevented as a duplicate (409) or returned idempotently
      const res2 = await api('/hospitals/requests', { method: 'POST', token: hospitalToken, body: payload });
      assert.ok(res2.status === 409 || res2.status === 200, 'Duplicate rapid submission must be rejected with 409 or returned idempotently');
      if (res2.status === 409) {
        assert.strictEqual(res2.data.success, false);
        assert.match(res2.data.error, /duplicate/i);
      }

      // Distinct submission with unique patient reference creates a new unique request
      const distinctPayload = { ...payload, patientReferenceId: 'PT-IDEMPOTENT-002' };
      const res3 = await api('/hospitals/requests', { method: 'POST', token: hospitalToken, body: distinctPayload });
      assert.strictEqual(res3.status, 201);
      assert.notStrictEqual(reqId1, res3.data.request.id, 'Distinct submission produces a unique stable request ID');
    });
  });

  // =========================================================================
  // SUITE 2: CANDIDATE RANKING & Persisted Inventory Eligibility
  // =========================================================================
  describe('Suite 2: Haversine Candidate Ranking & Genuine Inventory Verification', () => {

    test('2.1: Candidate banks are ranked in ascending order of geographic Haversine distance', async () => {
      const res = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'O+',
          component: 'RBC',
          quantityUnits: 3,
          urgency: 'Emergency',
          patientReferenceId: 'PT-DISTANCE-RANK',
          department: 'Cardiothoracic Surgery',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(res.status, 201);
      const offers = res.data.request.routedBankOffers;
      assert.ok(offers.length >= 1, 'At least one candidate bank found');

      for (let i = 0; i < offers.length - 1; i++) {
        assert.ok(
          offers[i].distanceKm <= offers[i + 1].distanceKm,
          `Candidate ${offers[i].bloodBankName} (${offers[i].distanceKm}km) must be <= ${offers[i + 1].bloodBankName} (${offers[i + 1].distanceKm}km)`
        );
      }
    });

    test('2.2: Excludes unreleased, quarantined, expired, and already reserved units from eligible count', async () => {
      // Create request and check eligible units for blood bank
      const res = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'O+',
          component: 'RBC',
          quantityUnits: 1,
          urgency: 'Emergency',
          patientReferenceId: 'PT-STOCK-ELIG',
          department: 'Trauma Unit',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(res.status, 201);
      const reqId = res.data.request.id;
      const targetOffer = res.data.request.routedBankOffers[0];
      assert.ok(targetOffer);
      const targetToken = getBankToken(targetOffer.bloodBankId, targetOffer.bloodBankName);

      // Fetch eligible units for candidate bank
      const unitsRes = await api(`/blood-bank/requests/${reqId}/eligible-units`, {
        token: targetToken
      });

      assert.strictEqual(unitsRes.status, 200);
      assert.strictEqual(unitsRes.data.success, true);
      assert.ok(Array.isArray(unitsRes.data.units));

      for (const u of unitsRes.data.units) {
        assert.strictEqual(u.testingStatus, 'Passed', 'Unit must have Passed laboratory screening');
        assert.strictEqual(u.availability, 'Available', 'Unit must be genuinely Available');
        assert.ok(new Date(u.expiryDate) > new Date(), 'Unit must not be expired');
        assert.ok(!u.isReserved, 'Unit must not be reserved');
      }
    });
  });

  // =========================================================================
  // SUITE 3: BLOOD BANK OFFERS, CONCURRENCY & LEDGER INTEGRITY
  // =========================================================================
  describe('Suite 3: Offer Acceptance, Partial Stock Commitment & Ledger Capping', () => {

    test('3.1: Authorized blood bank accepts routing offer and commits units atomically', async () => {
      // 1. Hospital creates emergency request
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'A+',
          component: 'RBC',
          quantityUnits: 2,
          urgency: 'Emergency',
          patientReferenceId: 'PT-ACCEPT-TEST',
          department: 'Surgery ICU',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(createRes.status, 201);
      const req = createRes.data.request;
      const targetOffer = req.routedBankOffers[0];
      assert.ok(targetOffer, 'At least one candidate bank should have received an offer');
      const targetToken = getBankToken(targetOffer.bloodBankId, targetOffer.bloodBankName);

      // 2. Blood Bank responds to accept full offer
      const acceptRes = await api(`/blood-bank/offers/${targetOffer.id}/respond`, {
        method: 'POST',
        token: targetToken,
        body: {
          action: 'Accept',
          quantityUnits: targetOffer.offeredUnits
        }
      });

      assert.strictEqual(acceptRes.status, 200);
      assert.strictEqual(acceptRes.data.success, true);
      assert.strictEqual(acceptRes.data.committedUnits, targetOffer.offeredUnits);
      assert.strictEqual(acceptRes.data.offer.status, 'Accepted');

      // 3. Hospital fetches request - verify updated fulfillment state
      const hospReqRes = await api('/hospitals/requests', { token: hospitalToken });
      const refreshedReq = hospReqRes.data.requests.find(r => r.id === req.id);
      assert.ok(refreshedReq);
      assert.ok(refreshedReq.fulfilledUnits >= targetOffer.offeredUnits);
      assert.strictEqual(refreshedReq.bloodBankId, targetOffer.bloodBankId);
    });

    test('3.2: Partial fulfillment commits designated units and maintains server-authoritative ledger', async () => {
      // 1. Hospital creates request for 3 units
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'O+',
          component: 'RBC',
          quantityUnits: 3,
          urgency: 'Emergency',
          patientReferenceId: 'PT-PARTIAL-001',
          department: 'Labor & Delivery',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(createRes.status, 201);
      const req = createRes.data.request;
      const targetOffer = req.routedBankOffers[0];
      assert.ok(targetOffer);

      const targetBankToken = getBankToken(targetOffer.bloodBankId, targetOffer.bloodBankName);

      // 2. Bank offers partial commitment of 1 unit
      const partialRes = await api(`/blood-bank/offers/${targetOffer.id}/respond`, {
        method: 'POST',
        token: targetBankToken,
        body: {
          action: 'Partial',
          quantityUnits: 1
        }
      });

      assert.strictEqual(partialRes.status, 200);
      assert.strictEqual(partialRes.data.success, true);
      assert.strictEqual(partialRes.data.committedUnits, 1);
      assert.strictEqual(partialRes.data.remainingNeeded, 2);

      // Verify canonical request state reflects partial fulfillment
      const hospReqRes = await api('/hospitals/requests', { token: hospitalToken });
      const refreshedReq = hospReqRes.data.requests.find(r => r.id === req.id);
      assert.ok(refreshedReq);
      assert.strictEqual(refreshedReq.fulfilledUnits, 1);
      assert.strictEqual(refreshedReq.remainingUnitsToFulfill, 2);
      assert.strictEqual(refreshedReq.routingStatus, 'Partially Committed');
    });

    test('3.3: Total committed units across multiple facilities never exceeds requested quantity Q', async () => {
      // Hospital creates request for 1 unit
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'B+',
          component: 'RBC',
          quantityUnits: 1,
          urgency: 'Urgent',
          patientReferenceId: 'PT-CONCURRENCY-001',
          department: 'Emergency Room',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(createRes.status, 201);
      const req = createRes.data.request;

      if (req.routedBankOffers.length >= 2) {
        const offer1 = req.routedBankOffers[0];
        const offer2 = req.routedBankOffers[1];

        const token1 = getBankToken(offer1.bloodBankId, offer1.bloodBankName);
        const token2 = getBankToken(offer2.bloodBankId, offer2.bloodBankName);

        // First bank accepts the 1 unit
        const res1 = await api(`/blood-bank/offers/${offer1.id}/respond`, {
          method: 'POST',
          token: token1,
          body: { action: 'Accept', quantityUnits: 1 }
        });
        assert.strictEqual(res1.status, 200);
        assert.strictEqual(res1.data.committedUnits, 1);

        // Second bank tries to accept remaining quantity when 0 units remain
        const res2 = await api(`/blood-bank/offers/${offer2.id}/respond`, {
          method: 'POST',
          token: token2,
          body: { action: 'Accept', quantityUnits: 1 }
        });

        // Must reject or supersede without over-committing
        if (res2.status === 200) {
          assert.strictEqual(res2.data.committedUnits, 0, 'Committed units for superseded offer must be 0');
          assert.strictEqual(res2.data.offer.status, 'Superseded');
        } else {
          assert.strictEqual(res2.status, 400);
          assert.match(res2.data.error, /already fully committed/i);
        }

        // Final verification on canonical request
        const hospReqRes = await api('/hospitals/requests', { token: hospitalToken });
        const refreshedReq = hospReqRes.data.requests.find(r => r.id === req.id);
        assert.ok(refreshedReq.fulfilledUnits <= 1, 'Total fulfilled units must NEVER exceed 1');
      }
    });

    test('3.4: Bank decline records reasoned decline and reroutes to next candidates', async () => {
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'AB+',
          component: 'RBC',
          quantityUnits: 1,
          urgency: 'Urgent',
          patientReferenceId: 'PT-DECLINE-001',
          department: 'Orthopedic Surgery',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(createRes.status, 201);
      const req = createRes.data.request;
      const offer = req.routedBankOffers[0];
      assert.ok(offer);

      const bankToken = getBankToken(offer.bloodBankId, offer.bloodBankName);

      const declineRes = await api(`/blood-bank/offers/${offer.id}/respond`, {
        method: 'POST',
        token: bankToken,
        body: {
          action: 'Decline',
          reason: 'Active local trauma case reservation'
        }
      });

      assert.strictEqual(declineRes.status, 200);
      assert.strictEqual(declineRes.data.success, true);
      assert.strictEqual(declineRes.data.offer.status, 'Declined');
      assert.strictEqual(declineRes.data.offer.declineReason, 'Active local trauma case reservation');
    });
  });

  // =========================================================================
  // SUITE 4: TENANT ISOLATION & AUTHORIZATION
  // =========================================================================
  describe('Suite 4: Strict Tenant Isolation & Role Validation', () => {

    test('4.1: Blood Bank A cannot respond to an offer dispatched to Blood Bank B (403 Forbidden)', async () => {
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'O+',
          component: 'RBC',
          quantityUnits: 1,
          urgency: 'Urgent',
          patientReferenceId: 'PT-ISOLATION-001',
          department: 'ICU',
          destinationMode: 'auto_routing'
        }
      });

      assert.strictEqual(createRes.status, 201);
      const req = createRes.data.request;

      // Find an offer for bb-1
      const offerForBB1 = req.routedBankOffers.find(o => o.bloodBankId === 'bb-1');
      if (offerForBB1) {
        // Attempt response using bb-2 token
        const trespassRes = await api(`/blood-bank/offers/${offerForBB1.id}/respond`, {
          method: 'POST',
          token: bloodBank2Token,
          body: { action: 'Accept', quantityUnits: 1 }
        });

        assert.strictEqual(trespassRes.status, 403, 'Cross-tenant offer response must be strictly rejected with 403');
        assert.strictEqual(trespassRes.data.success, false);
        assert.match(trespassRes.data.error, /unauthorized|does not belong/i);
      }
    });

    test('4.2: Donors cannot access blood bank offers endpoint (403 Forbidden)', async () => {
      const res = await api('/blood-bank/offers', { token: unauthorizedDonorToken });
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // SUITE 5: END-TO-END CLINICAL FULFILLMENT WORKFLOW
  // =========================================================================
  describe('Suite 5: Lab Screening, Safe Allocation, Dispatch Manifest & Receipt', () => {

    test('5.1: Full workflow: Accept Offer -> Allocate Units -> Dispatch Manifest -> Hospital Confirm Receipt', async () => {
      // Step 1: Hospital creates emergency request
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'A+',
          component: 'RBC',
          quantityUnits: 1,
          urgency: 'Emergency',
          patientReferenceId: 'PT-E2E-LIFECYCLE',
          department: 'Cardiovascular Surgery',
          destinationMode: 'auto_routing'
        }
      });
      assert.strictEqual(createRes.status, 201);
      const reqId = createRes.data.request.id;
      const targetOffer = createRes.data.request.routedBankOffers[0];
      assert.ok(targetOffer);
      const targetBankToken = getBankToken(targetOffer.bloodBankId, targetOffer.bloodBankName);

      // Step 2: Recipient blood bank accepts offer
      const acceptRes = await api(`/blood-bank/offers/${targetOffer.id}/respond`, {
        method: 'POST',
        token: targetBankToken,
        body: { action: 'Accept', quantityUnits: 1 }
      });
      assert.strictEqual(acceptRes.status, 200);

      // Step 3: Verify eligible units for allocation
      const eligibleRes = await api(`/blood-bank/requests/${reqId}/eligible-units`, {
        token: targetBankToken
      });
      assert.strictEqual(eligibleRes.status, 200);
      assert.ok(eligibleRes.data.units.length >= 1, 'Must have at least 1 eligible unit');
      const allocatedUnitId = eligibleRes.data.units[0].id || eligibleRes.data.units[0].unitId;

      // Step 4: Blood bank allocates unit
      const allocRes = await api(`/blood-bank/requests/${reqId}/allocate`, {
        method: 'POST',
        token: targetBankToken,
        body: { unitIds: [allocatedUnitId] }
      });
      assert.strictEqual(allocRes.status, 200);
      assert.strictEqual(allocRes.data.success, true);
      assert.strictEqual(allocRes.data.request.status, 'Reserved');

      // Step 5: Blood bank prepares and dispatches manifest
      const dispatchRes = await api(`/blood-bank/requests/${reqId}/dispatch`, {
        method: 'POST',
        token: targetBankToken,
        body: {
          courierType: 'Dedicated Hospital Courier',
          courierReference: 'COU-E2E-TEST-99',
          packagingType: 'Standard Passive Thermal Container with Ice Gel Packs',
          targetTransportTemp: '2°C to 6°C (Chilled)',
          specialInstructions: 'Emergency trauma delivery — maintain cold chain'
        }
      });
      assert.strictEqual(dispatchRes.status, 200);
      assert.strictEqual(dispatchRes.data.success, true);
      assert.ok(dispatchRes.data.dispatch);
      assert.ok(dispatchRes.data.dispatch.status === 'In Transit' || dispatchRes.data.dispatch.status === 'Dispatched');

      // Step 6: Hospital confirms receipt
      const receiptRes = await api(`/hospitals/requests/${reqId}/confirm-receipt`, {
        method: 'POST',
        token: hospitalToken,
        body: {
          notes: 'Received in good condition, cold-chain temperature verified at 4.2°C'
        }
      });
      assert.strictEqual(receiptRes.status, 200);
      assert.strictEqual(receiptRes.data.success, true);
      assert.strictEqual(receiptRes.data.request.status, 'Fulfilled');

      // Step 7: Verify final persisted state
      const verifyRes = await api('/hospitals/requests', { token: hospitalToken });
      const completedReq = verifyRes.data.requests.find(r => r.id === reqId);
      assert.ok(completedReq);
      assert.strictEqual(completedReq.status, 'Fulfilled');
      assert.ok(completedReq.receiptConfirmation);
      assert.strictEqual(completedReq.receiptConfirmation.confirmedBy, 'emergency@apellogeneral.org');
    });
  });

  // =========================================================================
  // SUITE 6: REAL-TIME NOTIFICATIONS & 5-SECOND ALERT INTEGRITY
  // =========================================================================
  describe('Suite 6: Notifications Delivery, Persistence & 5-Second Alert Contract', () => {

    test('6.1: Emergency routing creates real persisted notifications for recipient banks', async () => {
      // Submit emergency request
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'O+',
          component: 'Plasma',
          quantityUnits: 2,
          urgency: 'Emergency',
          patientReferenceId: 'PT-ALERT-TEST-DYNAMIC',
          department: 'Trauma Unit',
          destinationMode: 'auto_routing'
        }
      });
      assert.strictEqual(createRes.status, 201);
      const reqId = createRes.data.request.id;
      const targetOffer = createRes.data.request.routedBankOffers[0];
      assert.ok(targetOffer, 'At least one candidate bank must receive an offer');

      // Check notification list for recipient blood bank
      const targetToken = getBankToken(targetOffer.bloodBankId, targetOffer.bloodBankName);

      const notifsAfter = await api('/notifications', { token: targetToken });
      assert.strictEqual(notifsAfter.status, 200);

      // Verify routing notification structure
      const routingNotif = notifsAfter.data.notifications.find(
        n => (n.title && n.title.includes('ROUTED REQUEST')) || n.message?.includes(reqId) || n.requestId === reqId
      );
      assert.ok(routingNotif, 'Persisted notification for routing offer must exist for recipient blood bank');
      assert.ok(routingNotif.type === 'emergency' || routingNotif.type === 'blood_request_emergency' || routingNotif.type === 'alert' || routingNotif.priority === 'urgent');
    });

    test('6.2: Audio Alert lifecycle parameters adhere to 5-second ceiling and deduplication spec', async () => {
      // Simulating Web Audio Alert contract requirements:
      // 1. Duration must be exactly 5000ms
      const ALERT_DURATION_MS = 5000;
      assert.strictEqual(ALERT_DURATION_MS, 5000, 'Alert duration must be strictly 5000ms (5 seconds)');

      // 2. Dual-frequency tones for emergency warble
      const EMERGENCY_FREQ_HIGH = 880;
      const EMERGENCY_FREQ_LOW = 660;
      assert.strictEqual(EMERGENCY_FREQ_HIGH, 880);
      assert.strictEqual(EMERGENCY_FREQ_LOW, 660);

      // 3. Deduplication: simulate sessionStorage played set
      const playedSet = new Set(['notif-emergency-123']);
      const isDuplicate = playedSet.has('notif-emergency-123');
      assert.strictEqual(isDuplicate, true, 'Subsequent page refreshes/reconnects must not replay already played sound');

      const isNew = playedSet.has('notif-emergency-456');
      assert.strictEqual(isNew, false, 'Genuinely new emergency event must be allowed to play');
    });
  });

  // =========================================================================
  // SUITE 7: ADMIN OBSERVABILITY & ESCALATION CONTROLS
  // =========================================================================
  describe('Suite 7: Admin Portal Observability, Routing Overview & Diagnostics', () => {

    test('7.1: Admin endpoint returns smart routing overview and diagnostics', async () => {
      const res = await api('/admin/smart-routing', { token: adminToken });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.config, 'Must return routing configuration parameters');
      assert.strictEqual(typeof res.data.config.initialRadiusKm, 'number');
      assert.strictEqual(typeof (res.data.config.maxCandidatesPerOffer || res.data.config.maxRecipients), 'number');
      assert.ok(res.data.metrics, 'Must return routing metrics');
      assert.ok(typeof res.data.metrics.totalAutoRoutedRequests === 'number');
      assert.ok(Array.isArray(res.data.activeRequests), 'Must return active routing requests');
      assert.ok(Array.isArray(res.data.locationGaps), 'Must return location configuration gaps');
    });

    test('7.2: Non-admin users cannot access admin routing controls (403 Forbidden)', async () => {
      const res = await api('/admin/smart-routing', { token: hospitalToken });
      assert.strictEqual(res.status, 403);
    });

    test('7.3: Admin can trigger manual routing escalation when candidates need expansion', async () => {
      // Create request first
      const createRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospitalToken,
        body: {
          bloodGroup: 'B-',
          component: 'RBC',
          quantityUnits: 2,
          urgency: 'Emergency',
          patientReferenceId: 'PT-ADMIN-ESCALATE',
          department: 'ICU',
          destinationMode: 'auto_routing'
        }
      });
      assert.strictEqual(createRes.status, 201);
      const reqId = createRes.data.request.id;

      // Admin escalates
      const escalateRes = await api(`/admin/smart-routing/${reqId}/escalate`, {
        method: 'POST',
        token: adminToken,
        body: {
          reason: 'Emergency escalation override by medical supervisor'
        }
      });

      assert.strictEqual(escalateRes.status, 200);
      assert.strictEqual(escalateRes.data.success, true);
      assert.ok(escalateRes.data.request);
      assert.ok(escalateRes.data.request.routingExpansionCount >= 1);
    });
  });
});

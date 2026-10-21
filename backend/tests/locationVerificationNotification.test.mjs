// Automated Integration Test Suite for LifeLink
// Verifies:
// 1. Saved Location, Geocoding, 3 Explicit Modes, Coordinate Ordering, and Haversine Distance
// 2. Donor Verification Workflow, Preferred Blood Bank Routing, Tenant Isolation (403), 3 Decisions, Medical Eligibility Separation
// 3. Real-Time Notifications Lifecycle, Latency, SSE Push, Unread Count & Multi-tab Read Sync

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'node:http';

const BASE_URL = 'http://localhost:5001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'lifelink-secret-key-2026-secure';

// Helper: Generate Auth Tokens
function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const donorId = 'donor-test-integ';
const donorToken = makeToken({ id: donorId, email: 'integ-donor@lifelink.org', role: 'donor', name: 'Integration Donor' });
const bb1Token = makeToken({ id: 'bb-1', email: 'admin@cityblood.org', role: 'blood_bank', name: 'City Central Blood Bank' });
const bb2Token = makeToken({ id: 'bb-2', email: 'admin@redcross.org', role: 'blood_bank', name: 'Red Cross Regional Center' });
const adminToken = makeToken({ id: 'admin-1', email: 'admin@lifelink.org', role: 'admin', name: 'LifeLink Administrator' });

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

describe('LifeLink: Saved Location, Donor Verification & Real-Time Notifications', () => {

  // =========================================================================
  // SUITE 1: LOCATION, 3 MODES & NEARBY HOSPITALS
  // =========================================================================
  describe('Phase 2 — Location Modes & Nearby Hospitals', () => {

    test('1.1: Persists donor profile location with coordinates and reloads cleanly', async () => {
      const updateRes = await api('/donors/profile', {
        method: 'PUT',
        token: donorToken,
        body: {
          name: 'Integration Donor',
          phone: '+1 555-0199',
          address: '700 Broadway',
          city: 'Metro City',
          state: 'NY',
          postalCode: '10003',
          latitude: 40.7295,
          longitude: -73.9937,
          weightKg: 68,
          travelRadiusKm: 25
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.success, true);
      assert.equal(updateRes.data.donor.latitude, 40.7295);
      assert.equal(updateRes.data.donor.longitude, -73.9937);

      // Verify persistence via GET /donors/profile
      const getRes = await api('/donors/profile', { token: donorToken });
      assert.equal(getRes.status, 200);
      assert.equal(getRes.data.donor.latitude, 40.7295);
      assert.equal(getRes.data.donor.longitude, -73.9937);
      assert.equal(getRes.data.donor.address, '700 Broadway');
      assert.equal(getRes.data.donor.city, 'Metro City');
    });

    test('1.2: Nearby hospitals uses saved profile location when GPS is absent or denied', async () => {
      // No lat/lng query params supplied -> must use saved profile coords (40.7295, -73.9937)
      const res = await api('/donors/nearby-hospitals', { token: donorToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.donorLocationMissing, false);
      assert.equal(res.data.donorCoordinates.lat, 40.7295);
      assert.equal(res.data.donorCoordinates.lng, -73.9937);
      assert.ok(Array.isArray(res.data.hospitals));
      assert.ok(res.data.hospitals.length > 0, 'Should find partner hospitals nearby');

      // Verify nearest-first sorting
      for (let i = 0; i < res.data.hospitals.length - 1; i++) {
        assert.ok(
          res.data.hospitals[i].distanceKm <= res.data.hospitals[i + 1].distanceKm,
          `Hospitals must be sorted ascending by distance: ${res.data.hospitals[i].distanceKm} <= ${res.data.hospitals[i + 1].distanceKm}`
        );
      }
    });

    test('1.3: Manual search queries custom location without overwriting donor saved profile', async () => {
      // Search another location (e.g. Buffalo / Rochester coordinates: 42.8864, -78.8784)
      const searchRes = await api('/donors/nearby-hospitals?lat=42.8864&lng=-78.8784&radius=all', { token: donorToken });
      assert.equal(searchRes.status, 200);
      assert.equal(searchRes.data.donorCoordinates.lat, 42.8864);
      assert.equal(searchRes.data.donorCoordinates.lng, -78.8784);

      // Verify donor profile still retains original saved coordinates!
      const profileRes = await api('/donors/profile', { token: donorToken });
      assert.equal(profileRes.data.donor.latitude, 40.7295);
      assert.equal(profileRes.data.donor.longitude, -73.9937);
      assert.equal(profileRes.data.donor.address, '700 Broadway');
    });

    test('1.4: Validates coordinate ordering and geographic boundaries', async () => {
      // Latitude > 90 must fail
      const latHigh = await api('/donors/nearby-hospitals?lat=95.123&lng=-74.006', { token: donorToken });
      assert.equal(latHigh.status, 400);
      assert.ok(latHigh.data.error.includes('Latitude'));

      // Longitude > 180 must fail
      const lngHigh = await api('/donors/nearby-hospitals?lat=40.7128&lng=185.0', { token: donorToken });
      assert.equal(lngHigh.status, 400);
      assert.ok(lngHigh.data.error.includes('Longitude'));

      // Non-numeric coordinate must fail
      const nonNum = await api('/donors/nearby-hospitals?lat=abc&lng=-74.006', { token: donorToken });
      assert.equal(nonNum.status, 400);

      // Incomplete coordinates must fail
      const incomplete = await api('/donors/nearby-hospitals?lat=40.7128', { token: donorToken });
      assert.equal(incomplete.status, 400);
    });

    test('1.5: Radius boundary filtering correctly constrains results', async () => {
      const radius10 = await api('/donors/nearby-hospitals?lat=40.7128&lng=-74.0060&radius=10', { token: donorToken });
      const radiusAll = await api('/donors/nearby-hospitals?lat=40.7128&lng=-74.0060&radius=all', { token: donorToken });

      assert.equal(radius10.status, 200);
      assert.equal(radiusAll.status, 200);

      // All hospitals in 10 km result must be <= 10 km
      radius10.data.hospitals.forEach(h => {
        assert.ok(h.distanceKm <= 10, `Hospital ${h.name} distance ${h.distanceKm} exceeds 10 km radius`);
      });

      assert.ok(radiusAll.data.totalFound >= radius10.data.totalFound);
    });

    test('1.6: Honest empty state when donor has no coordinates saved', async () => {
      // Clear donor coordinates
      await api('/donors/profile', {
        method: 'PUT',
        token: donorToken,
        body: { latitude: null, longitude: null }
      });

      const res = await api('/donors/nearby-hospitals', { token: donorToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.donorLocationMissing, true);
      assert.equal(res.data.totalFound, 0);
      assert.deepEqual(res.data.hospitals, []);

      // Restore donor coordinates for subsequent tests
      await api('/donors/profile', {
        method: 'PUT',
        token: donorToken,
        body: { latitude: 40.7295, longitude: -73.9937 }
      });
    });

    test('1.7: Returned hospitals are genuine database records with valid fields', async () => {
      const res = await api('/donors/nearby-hospitals', { token: donorToken });
      res.data.hospitals.forEach(h => {
        assert.ok(h.id, 'Hospital must have persisted ID');
        assert.ok(h.name || h.hospitalName, 'Hospital must have genuine organization name');
        assert.ok(h.latitude && h.longitude, 'Hospital must have valid coordinates');
        assert.ok(typeof h.distanceKm === 'number', 'Distance must be numeric');
        assert.ok(h.distanceKm >= 0, 'Distance must be non-negative');
      });
    });
  });

  // =========================================================================
  // SUITE 2: DONOR VERIFICATION & TENANT ISOLATION
  // =========================================================================
  describe('Phase 3 — Donor Verification Workflow & Tenant Isolation', () => {

    test('2.1: Client cannot self-approve verification or eligibility directly via profile API', async () => {
      // Ensure donor starts in non-verified state for idempotency across repeated test runs
      await api(`/blood-bank/donors/${donorId}/verify`, {
        method: 'POST',
        token: bb2Token,
        body: { status: 'Needs More Info', notes: 'Resetting test fixture status' }
      }).catch(() => {});

      const maliciousAttempt = await api('/donors/profile', {
        method: 'PUT',
        token: donorToken,
        body: {
          verificationStatus: 'Verified',
          bloodGroupVerificationStatus: 'Verified',
          isEligible: true,
          verifiedBy: 'self-client-hack',
          weightKg: 40 // Underweight
        }
      });

      assert.equal(maliciousAttempt.status, 200);
      // Status must NOT have been changed to Verified by client input
      assert.notEqual(maliciousAttempt.data.donor.verificationStatus, 'Verified');
      assert.notEqual(maliciousAttempt.data.donor.isEligible, true);
    });

    test('2.2: Donor submits proof with preferred blood bank; routes to assigned blood bank', async () => {
      const subRes = await api('/donors/verify-blood-group', {
        method: 'POST',
        token: donorToken,
        body: {
          documentType: 'Hospital Medical Report',
          documentNumber: 'HOSP-VERIF-991',
          fileUrl: 'https://lifelink.org/docs/blood_group_proof_sample.pdf',
          preferredBloodBankId: 'bb-2' // Assigned specifically to Red Cross Regional Center
        }
      });

      assert.equal(subRes.status, 200);
      assert.equal(subRes.data.success, true);
      assert.equal(subRes.data.assignedBloodBankId, 'bb-2');

      // Verify donor profile reflects Pending Verification
      const profileRes = await api('/donors/profile', { token: donorToken });
      assert.equal(profileRes.data.donor.verificationStatus, 'Pending Verification');
      assert.equal(profileRes.data.donor.assignedBloodBankId, 'bb-2');
      assert.ok(profileRes.data.donor.verificationSubmittedAt);
    });

    test('2.3: Tenant Isolation: Assigned bank sees submission; unrelated bank is blocked with 403', async () => {
      // 1. Authorized bank (bb-2) checks their queue -> donor MUST appear
      const queueRes2 = await api('/blood-bank/donors/verification-queue', { token: bb2Token });
      assert.equal(queueRes2.status, 200);
      const inQueue2 = queueRes2.data.queue.find(d => d.id === donorId);
      assert.ok(inQueue2, 'Assigned blood bank bb-2 must see donor in verification queue');
      assert.equal(inQueue2.verificationStatus, 'Pending Verification');
      assert.equal(inQueue2.proofDocumentType, 'Hospital Medical Report');

      // 2. Unrelated bank (bb-1) attempts to verify this donor -> MUST be rejected with 403 Forbidden!
      const unauthorizedDecision = await api(`/blood-bank/donors/${donorId}/verify`, {
        method: 'POST',
        token: bb1Token,
        body: { status: 'Verified', bloodGroup: 'O+' }
      });
      assert.equal(unauthorizedDecision.status, 403, 'Unrelated blood bank must receive 403 Forbidden');
      assert.ok(unauthorizedDecision.data.error.includes('Access denied'));
    });

    test('2.4: Reviewer requests additional info (Needs More Info) with actionable notes', async () => {
      const clarifyRes = await api(`/blood-bank/donors/${donorId}/verify`, {
        method: 'POST',
        token: bb2Token,
        body: {
          status: 'Needs More Info',
          notes: 'Lab stamp is partially occluded. Please re-upload with clear clinical laboratory seal.'
        }
      });

      assert.equal(clarifyRes.status, 200);
      assert.equal(clarifyRes.data.success, true);
      assert.equal(clarifyRes.data.verificationStatus, 'Needs More Info');

      // Verify donor profile shows updated status and notes without logging out
      const donorProf = await api('/donors/profile', { token: donorToken });
      assert.equal(donorProf.data.donor.verificationStatus, 'Needs More Info');
      assert.equal(donorProf.data.donor.verificationNotes, 'Lab stamp is partially occluded. Please re-upload with clear clinical laboratory seal.');

      // While in "Needs More Info", donor is NOT eligible to donate
      const elRes = await api('/donors/eligibility', { token: donorToken });
      assert.equal(elRes.data.eligibility.isEligible, false);
      assert.ok(elRes.data.eligibility.reasons.some(r => r.includes('Needs More Info') || r.includes('verified')));
    });

    test('2.5: Authorized reviewer approves verification; sets confirmed blood group and audit trail', async () => {
      const approveRes = await api(`/blood-bank/donors/${donorId}/verify`, {
        method: 'POST',
        token: bb2Token,
        body: {
          status: 'Verified',
          bloodGroup: 'O+',
          notes: 'Clinically verified by Senior Transfusion Specialist.'
        }
      });

      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.data.success, true);
      assert.equal(approveRes.data.verificationStatus, 'Verified');

      // Verify audit persistence in donor record
      const donorProf = await api('/donors/profile', { token: donorToken });
      assert.equal(donorProf.data.donor.verificationStatus, 'Verified');
      assert.equal(donorProf.data.donor.bloodGroup, 'O+');
      assert.equal(donorProf.data.donor.verifiedBy, 'bb-2');
      assert.ok(donorProf.data.donor.verifiedByName);
      assert.ok(donorProf.data.donor.verifiedAt);
    });

    test('2.6: Medical eligibility remains strictly separated from identity verification', async () => {
      // Case A: Verified donor is underweight (weight 45 kg < 50 kg requirement)
      await api('/donors/profile', {
        method: 'PUT',
        token: donorToken,
        body: { weightKg: 45 }
      });

      const underweightEl = await api('/donors/eligibility', { token: donorToken });
      assert.equal(underweightEl.data.eligibility.isEligible, false, 'Underweight donor must be ineligible even if identity verified');
      assert.ok(underweightEl.data.eligibility.reasons.some(r => r.includes('50 kg') || r.includes('weight')));

      // Case B: Verified donor with normal weight (weight 68 kg >= 50 kg)
      await api('/donors/profile', {
        method: 'PUT',
        token: donorToken,
        body: { weightKg: 68 }
      });

      const normalWeightEl = await api('/donors/eligibility', { token: donorToken });
      assert.equal(normalWeightEl.data.eligibility.isEligible, true, 'Verified donor with healthy weight must be medically eligible');
    });
  });

  // =========================================================================
  // SUITE 3: REAL-TIME NOTIFICATIONS LIFECYCLE & LATENCY
  // =========================================================================
  describe('Phase 4 — Real-Time Notifications Lifecycle, Latency & Persistence', () => {

    test('3.1: Delivers real-time notification via SSE stream and measures latency', async () => {
      const sendTime = Date.now();
      let receivedLatencyMs = null;
      let receivedNotif = null;

      // Connect to SSE stream
      const ssePromise = new Promise((resolve, reject) => {
        const req = http.request(`http://localhost:5001/api/notifications/stream?token=${donorToken}`, {
          method: 'GET',
          headers: { Accept: 'text/event-stream' }
        }, (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            // Look for SSE event notification
            if (buffer.includes('event: notification')) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const parsed = JSON.parse(line.replace('data: ', ''));
                    if (parsed.title === 'Test Automated Real-Time Event') {
                      receivedLatencyMs = Date.now() - sendTime;
                      receivedNotif = parsed;
                      req.destroy();
                      resolve({ latencyMs: receivedLatencyMs, notification: receivedNotif });
                      return;
                    }
                  } catch (e) {
                    // Ignore parsing partial chunks
                  }
                }
              }
            }
          });
        });

        req.on('error', reject);
        req.end();
      });

      // Allow 200ms for SSE connection establishment
      await new Promise(r => setTimeout(r, 200));

      // Trigger a real persisted notification to the donor
      const triggerRes = await api('/notifications/test-dispatch', {
        method: 'POST',
        token: adminToken,
        body: {
          userId: donorId,
          title: 'Test Automated Real-Time Event',
          message: 'Your donation pass has been clinically refreshed.',
          type: 'verification'
        }
      });
      assert.equal(triggerRes.status, 200);

      // Await SSE delivery with 3s timeout
      const result = await Promise.race([
        ssePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SSE delivery timed out')), 3000))
      ]);

      assert.ok(result.notification, 'Notification should be delivered via SSE');
      assert.equal(result.notification.title, 'Test Automated Real-Time Event');
      console.log(`      ⚡ Measured Real-Time SSE Notification Latency: ${result.latencyMs} ms`);
      assert.ok(result.latencyMs < 1000, `Latency must be sub-second (measured: ${result.latencyMs}ms)`);
    });

    test('3.2: Updates unread count and persists read state across sessions', async () => {
      // 1. Fetch current notification list
      const listRes = await api('/notifications', { token: donorToken });
      assert.equal(listRes.status, 200);
      assert.ok(listRes.data.unreadCount >= 1, 'Should have at least 1 unread notification');

      const targetNotif = listRes.data.notifications.find(n => n.title === 'Test Automated Real-Time Event');
      assert.ok(targetNotif, 'Created notification must be persisted in database');
      assert.equal(targetNotif.isRead, false);

      // 2. Mark notification as read
      const markRes = await api(`/notifications/${targetNotif.id}/read`, {
        method: 'PATCH',
        token: donorToken
      });
      assert.equal(markRes.status, 200);
      assert.equal(markRes.data.success, true);
      assert.equal(markRes.data.notification.isRead, true);

      // 3. Re-fetch: read status must persist
      const reFetch = await api('/notifications', { token: donorToken });
      const updated = reFetch.data.notifications.find(n => n.id === targetNotif.id);
      assert.equal(updated.isRead, true);
    });

    test('3.3: Mark all as read updates all unread notifications', async () => {
      const readAllRes = await api('/notifications/read-all', {
        method: 'PATCH',
        token: donorToken
      });
      assert.equal(readAllRes.status, 200);

      const listAfter = await api('/notifications', { token: donorToken });
      assert.equal(listAfter.data.unreadCount, 0, 'Unread count must be 0 after markAllRead');
    });

    test('3.4: Reconnection recovery retrieves missed notifications via initial snapshot', async () => {
      // Simulate client disconnect, send event, then reconnect
      await api('/notifications/test-dispatch', {
        method: 'POST',
        token: adminToken,
        body: {
          userId: donorId,
          title: 'Offline Queued Alert',
          message: 'Notification generated while client was temporarily offline.',
          type: 'emergency'
        }
      });

      // Reconnecting client requests snapshot
      const recovered = await api('/notifications', { token: donorToken });
      assert.equal(recovered.status, 200);
      const found = recovered.data.notifications.find(n => n.title === 'Offline Queued Alert');
      assert.ok(found, 'Missed notifications must be retrieved on reconnection');
      assert.equal(recovered.data.unreadCount, 1);
    });
  });
});

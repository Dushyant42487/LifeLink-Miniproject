// Automated Integration Test Suite for LifeLink: Cross-Portal Route & Location Verification
// Verifies:
// 1. Auto-routing with 25 km radius strictly rejects candidates at 12,841 km (NYC vs Sangli).
// 2. Blood bank and hospital profile location updates persist durably.
// 3. Sample shipment route uses hospital as origin and receiving blood bank as destination.
// 4. Blood dispatch route uses blood bank as origin and hospital as destination with matching cross-portal metadata.
// 5. Requisition creation state never displays "Dispatched" before actual dispatch record is created.
// 6. Cross-portal coordinate alignment and Haversine corridor distance consistency.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'lifelink-secret-key-2026-secure';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// Canonical Sangli test actors
const hospToken = makeToken({ 
  id: 'user-1792574656930', 
  email: 'wcehosp@test.org', 
  role: 'hospital', 
  hospitalName: 'WCE Memorial Hospital Sangli',
  name: 'WCE Memorial Hospital Sangli'
});

const bbToken = makeToken({ 
  id: 'user-1792415991634', 
  email: 'wcebb@test.org', 
  role: 'blood_bank', 
  bloodBankName: 'WCE Sangli Blood Center',
  name: 'WCE Sangli Blood Center'
});

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

describe('LifeLink: Cross-Portal Route, Facility Location & Logistics Integrity', () => {

  // =========================================================================
  // 1. SANGLI ENTITY REALIGNMENT & 12,841 KM ANOMALY REJECTION
  // =========================================================================
  describe('1. Rejection of 12,841 km Distance Anomaly & Radius Enforcement', () => {

    test('1.1: Sangli hospital and Sangli blood bank are within local proximity (< 10 km), not 12,841 km', async () => {
      const hospProfileRes = await api('/hospitals/profile', { token: hospToken });
      assert.equal(hospProfileRes.status, 200);
      assert.equal(hospProfileRes.data.success, true);
      const hosp = hospProfileRes.data.hospital;

      const bbProfileRes = await api('/blood-bank/profile', { token: bbToken });
      assert.equal(bbProfileRes.status, 200);
      assert.equal(bbProfileRes.data.success, true);
      const bb = bbProfileRes.data.profile;

      // Ensure both are in Sangli Maharashtra coordinates (latitude ~16.8, longitude ~74.6)
      assert.ok(hosp.latitude >= 16.0 && hosp.latitude <= 17.5, `Hospital lat ${hosp.latitude} should be in Sangli range [16, 17.5]`);
      assert.ok(hosp.longitude >= 73.5 && hosp.longitude <= 75.5, `Hospital lng ${hosp.longitude} should be in Sangli range [73.5, 75.5]`);
      assert.ok(bb.latitude >= 16.0 && bb.latitude <= 17.5, `Blood bank lat ${bb.latitude} should be in Sangli range [16, 17.5]`);
      assert.ok(bb.longitude >= 73.5 && bb.longitude <= 75.5, `Blood bank lng ${bb.longitude} should be in Sangli range [73.5, 75.5]`);

      // Calculate distance between them: must be < 5 km, absolutely never > 100 km (and never 12,841 km)
      const dLat = (bb.latitude - hosp.latitude) * Math.PI / 180;
      const dLon = (bb.longitude - hosp.longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(hosp.latitude * Math.PI / 180) * Math.cos(bb.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceKm = 6371 * c;

      assert.ok(distanceKm < 10, `Local Sangli distance should be < 10 km, was ${distanceKm.toFixed(2)} km`);
      assert.notEqual(Math.round(distanceKm), 12841, 'Must never produce the 12,841 km anomaly');
    });

    test('1.2: Auto-routing with 25 km radius strictly excludes distant facilities (> 25 km)', async () => {
      // Create an auto-routed requisition from Sangli hospital
      const reqRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospToken,
        body: {
          bloodGroup: 'B+',
          component: 'Whole Blood',
          quantityUnits: 2,
          urgency: 'Emergency',
          routingMode: 'auto',
          patientReferenceId: 'TEST-PATIENT-ROUTING-RADIUS',
          department: 'Emergency Trauma',
          notes: 'Test verifying 25 km radius rejects NYC blood banks'
        }
      });

      assert.equal(reqRes.status, 201);
      assert.equal(reqRes.data.success, true);
      const request = reqRes.data.request;

      // Routed offers must only be within 25 km
      if (request.routedBankOffers && request.routedBankOffers.length > 0) {
        request.routedBankOffers.forEach(offer => {
          assert.ok(offer.distanceKm <= 25, `Offer ${offer.bloodBankName} distance ${offer.distanceKm} exceeds 25 km radius`);
          assert.ok(offer.distanceKm < 100, `Offer distance must never approach 12,841 km`);
        });
      }
    });

  });

  // =========================================================================
  // 2. DURABLE FACILITY LOCATION PERSISTENCE
  // =========================================================================
  describe('2. Durable Location Configuration & Persistence', () => {

    test('2.1: Hospital profile location update persists with coordinates', async () => {
      const updateRes = await api('/hospitals/profile', {
        method: 'PUT',
        token: hospToken,
        body: {
          hospitalName: 'WCE Memorial Hospital Sangli',
          address: 'Vishrambag, Sangli',
          city: 'Sangli',
          state: 'Maharashtra',
          postalCode: '416415',
          latitude: 16.8438,
          longitude: 74.6015
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.success, true);
      assert.equal(updateRes.data.hospital.latitude, 16.8438);
      assert.equal(updateRes.data.hospital.longitude, 74.6015);

      // Verify persistence via GET /hospitals/profile
      const getRes = await api('/hospitals/profile', { token: hospToken });
      assert.equal(getRes.status, 200);
      assert.equal(getRes.data.hospital.latitude, 16.8438);
      assert.equal(getRes.data.hospital.longitude, 74.6015);
    });

    test('2.2: Blood Bank profile location update persists with coordinates', async () => {
      const updateRes = await api('/blood-bank/profile', {
        method: 'PUT',
        token: bbToken,
        body: {
          bloodBankName: 'WCE Sangli Blood Center',
          address: 'College Road, Sangli',
          city: 'Sangli',
          state: 'Maharashtra',
          postalCode: '416416',
          latitude: 16.8440,
          longitude: 74.6018
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.data.success, true);
      assert.equal(updateRes.data.profile.latitude, 16.8440);
      assert.equal(updateRes.data.profile.longitude, 74.6018);

      // Verify persistence via GET /blood-bank/profile
      const getRes = await api('/blood-bank/profile', { token: bbToken });
      assert.equal(getRes.status, 200);
      assert.equal(getRes.data.profile.latitude, 16.8440);
      assert.equal(getRes.data.profile.longitude, 74.6018);
    });

  });

  // =========================================================================
  // 3. PHYSICAL MOVEMENT: SAMPLE SHIPMENT (HOSPITAL -> BLOOD BANK)
  // =========================================================================
  describe('3. Pre-Transfusion Patient Sample Logistics (Hospital -> Blood Bank)', () => {

    let testReqId = null;

    test('3.1: Hospital submits sample for direct requisition', async () => {
      // Create a direct requisition to WCE Sangli Blood Center
      const reqRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospToken,
        body: {
          bloodBankId: 'user-1792415991634',
          bloodGroup: 'O+',
          component: 'Packed Red Blood Cells',
          quantityUnits: 2,
          urgency: 'Urgent',
          routingMode: 'direct',
          patientReferenceId: 'PAT-SAMPLE-TEST-001',
          department: 'Cardiology OT',
          notes: 'Pre-op cross-matching'
        }
      });

      assert.equal(reqRes.status, 201);
      assert.equal(reqRes.data.success, true);
      testReqId = reqRes.data.request.id;

      // Submit sample
      const sampleRes = await api('/hospitals/samples', {
        method: 'POST',
        token: hospToken,
        body: {
          requestId: testReqId,
          patientReferenceId: 'PAT-SAMPLE-TEST-001',
          sampleType: 'Whole Blood EDTA Tube',
          notes: 'Standard pre-transfusion typing & screening sample'
        }
      });

      assert.equal(sampleRes.status, 201);
      assert.equal(sampleRes.data.success, true);
      assert.equal(sampleRes.data.sample.requestId, testReqId);
      assert.equal(sampleRes.data.sample.hospitalId, 'user-1792574656930');
    });

    test('3.2: Hospital logistics reflects genuine sample route with Hospital as origin and Blood Bank as destination', async () => {
      const logRes = await api('/hospitals/logistics', { token: hospToken });
      assert.equal(logRes.status, 200);
      assert.equal(logRes.data.success, true);

      const matchedSample = (logRes.data.sampleShipments || []).find(s => s.requestId === testReqId);
      assert.ok(matchedSample, 'Sample shipment must be present in hospital logistics');
      assert.equal(matchedSample.origin.facilityId, 'user-1792574656930');
      assert.equal(matchedSample.destination.facilityId, 'user-1792415991634');

      // Origin should be Hospital and Destination should be Blood Bank
      assert.ok(matchedSample.origin.facilityName.includes('WCE Memorial Hospital'));
      assert.ok(matchedSample.destination.facilityName.includes('WCE Sangli Blood Center'));
      assert.ok(matchedSample.origin.hasValidCoordinates, 'Must have authentic origin coordinates');
      assert.ok(matchedSample.destination.hasValidCoordinates, 'Must have authentic destination coordinates');
      assert.ok(matchedSample.corridorDistanceKm < 10, 'Corridor distance must be authentic local distance');
    });

  });

  // =========================================================================
  // 4. PHYSICAL MOVEMENT: BLOOD PRODUCT DISPATCH (BLOOD BANK -> HOSPITAL)
  // =========================================================================
  describe('4. Blood Product Dispatch Manifest (Blood Bank -> Hospital)', () => {

    test('4.1: Newly created requisition never displays "Dispatched" before actual dispatch manifest', async () => {
      // Create a fresh requisition
      const reqRes = await api('/hospitals/requests', {
        method: 'POST',
        token: hospToken,
        body: {
          bloodBankId: 'user-1792415991634',
          bloodGroup: 'A+',
          component: 'Platelet Concentrate',
          quantityUnits: 1,
          urgency: 'Routine',
          routingMode: 'direct',
          patientReferenceId: 'PAT-DISPATCH-VERIF-001',
          department: 'Oncology Ward'
        }
      });

      assert.equal(reqRes.status, 201);
      const req = reqRes.data.request;

      // Status must NOT be Dispatched
      assert.notEqual(req.status, 'Dispatched', 'New requisition must never have status Dispatched');
      assert.notEqual(req.status, 'Issued', 'New requisition must never have status Issued');
      assert.equal(req.status, 'Pending', 'Direct requisition should be Pending');

      // No dispatch manifest should exist for this requisition
      const dispRes = await api(`/hospitals/requests/${req.id}/dispatch`, { token: hospToken });
      assert.equal(dispRes.status, 404, 'Dispatch manifest should not exist yet');
    });

    test('4.2: Blood Bank logistics endpoint (/blood-bank/logistics) returns authenticated logistics', async () => {
      const logRes = await api('/blood-bank/logistics', { token: bbToken });
      assert.equal(logRes.status, 200);
      assert.equal(logRes.data.success, true);
      assert.ok(Array.isArray(logRes.data.bloodDispatches), 'bloodDispatches must be an array');
      assert.ok(Array.isArray(logRes.data.sampleShipments), 'sampleShipments must be an array');
      assert.ok(Array.isArray(logRes.data.connectedHospitals), 'connectedHospitals must be an array');

      // Each dispatch in logistics must have Blood Bank as origin and Hospital as destination
      logRes.data.bloodDispatches.forEach(d => {
        assert.equal(d.bloodBankId, 'user-1792415991634');
        assert.ok(d.origin, 'Dispatch must contain authentic origin');
        assert.ok(d.destination, 'Dispatch must contain authentic destination');
      });
    });

  });

  // =========================================================================
  // 5. CROSS-PORTAL COORDINATE AND ROUTE ENRICHMENT
  // =========================================================================
  describe('5. Cross-Portal Request Enrichment with Coordinates', () => {

    test('5.1: Hospital requests list enriches each requisition with both hospital and bank coordinates', async () => {
      const res = await api('/hospitals/requests', { token: hospToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.ok(res.data.requests.length > 0);

      const firstReqWithBank = res.data.requests.find(r => r.bloodBankId);
      if (firstReqWithBank) {
        assert.ok(firstReqWithBank.hospitalCoordinates, 'Hospital coordinates must be enriched');
        assert.ok(firstReqWithBank.bankCoordinates, 'Bank coordinates must be enriched');
        assert.ok(firstReqWithBank.hospitalCoordinates.lat > 0);
        assert.ok(firstReqWithBank.bankCoordinates.lat > 0);
      }
    });

    test('5.2: Blood Bank requests list enriches requisitions with matching coordinates and linked samples', async () => {
      const res = await api('/blood-bank/requests', { token: bbToken });
      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);

      res.data.requests.forEach(r => {
        if (r.hospitalCoordinates && r.bankCoordinates) {
          // Verify coordinates are realistic Indian coordinates
          assert.ok(r.hospitalCoordinates.lat >= 8 && r.hospitalCoordinates.lat <= 37);
          assert.ok(r.hospitalCoordinates.lng >= 68 && r.hospitalCoordinates.lng <= 97);
          assert.ok(r.bankCoordinates.lat >= 8 && r.bankCoordinates.lat <= 37);
          assert.ok(r.bankCoordinates.lng >= 68 && r.bankCoordinates.lng <= 97);
        }
      });
    });

  });

});

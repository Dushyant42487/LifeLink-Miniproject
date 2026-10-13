import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCoordinate, parseCoordinates, calcHaversineKm } from '../utils/geo.ts';

const BACKEND_URL = 'http://localhost:5001';

describe('LifeLink: Location Workflow End-to-End Test Suite', () => {

  let donor1Token = '';
  let donor1Id = '';
  let donor1Email = '';

  let donor2Token = '';
  let donor2Id = '';

  let hosp1Token = '';
  let hosp1Id = '';
  let hosp1Email = '';

  let hosp2Token = '';
  let hosp2Id = '';
  let hosp2Email = '';

  let hospNoCoordsToken = '';
  let hospNoCoordsId = '';

  // =========================================================================
  // 1. UNIT TESTS: Coordinate Validation and Haversine Distance Calculation
  // =========================================================================
  describe('Unit Tests: Geographic Math and Coordinate Integrity', () => {
    test('isValidCoordinate accepts finite real-world coordinates', () => {
      assert.equal(isValidCoordinate(40.7128, -74.0060), true);
      assert.equal(isValidCoordinate(-33.8688, 151.2093), true);
      assert.equal(isValidCoordinate(0.5, 0.5), true);
      assert.equal(isValidCoordinate(90, 180), true);
      assert.equal(isValidCoordinate(-90, -180), true);
    });

    test('isValidCoordinate strictly rejects (0, 0) unconfigured null-island defaults', () => {
      assert.equal(isValidCoordinate(0, 0), false);
      assert.equal(isValidCoordinate('0', '0'), false);
    });

    test('isValidCoordinate rejects out-of-range latitude (> 90 or < -90)', () => {
      assert.equal(isValidCoordinate(90.1, 50), false);
      assert.equal(isValidCoordinate(-90.1, 50), false);
    });

    test('isValidCoordinate rejects out-of-range longitude (> 180 or < -180)', () => {
      assert.equal(isValidCoordinate(45, 180.1), false);
      assert.equal(isValidCoordinate(45, -180.1), false);
    });

    test('isValidCoordinate rejects non-finite, null, undefined, and empty string coordinates', () => {
      assert.equal(isValidCoordinate(NaN, -74), false);
      assert.equal(isValidCoordinate(40, Infinity), false);
      assert.equal(isValidCoordinate(null, -74), false);
      assert.equal(isValidCoordinate(undefined, -74), false);
      assert.equal(isValidCoordinate('', ''), false);
      assert.equal(isValidCoordinate('abc', 'xyz'), false);
    });

    test('parseCoordinates parses valid numeric string coordinates', () => {
      const parsed = parseCoordinates('40.7128', '-74.0060');
      assert.equal(parsed.lat, 40.7128);
      assert.equal(parsed.lng, -74.0060);
      assert.equal(parsed.error, undefined);
    });

    test('parseCoordinates returns descriptive error if only one coordinate is provided', () => {
      const parsed = parseCoordinates('40.7128', '');
      assert.ok(parsed.error);
      assert.match(parsed.error, /Both latitude and longitude must be provided together/);
    });

    test('parseCoordinates allows clearing when both coordinates are null or empty', () => {
      const parsedNull = parseCoordinates(null, null);
      assert.equal(parsedNull.error, undefined);
      assert.equal(parsedNull.lat, undefined);

      const parsedEmpty = parseCoordinates('', '');
      assert.equal(parsedEmpty.error, undefined);
      assert.equal(parsedEmpty.lat, undefined);
    });

    test('calcHaversineKm calculates accurate distances between geographic coordinates', () => {
      // Known distance between Times Square [40.7580, -73.9855] and Empire State Building [40.7484, -73.9857] ~ 1.07 km
      const distKm = calcHaversineKm(40.7580, -73.9855, 40.7484, -73.9857);
      assert.ok(distKm >= 1.0 && distKm <= 1.2, `Expected distance ~1.1 km, got ${distKm}`);

      // Distance from a point to itself must be 0
      assert.equal(calcHaversineKm(40.7128, -74.0060, 40.7128, -74.0060), 0);
    });
  });

  // =========================================================================
  // 2. INTEGRATION TESTS: Donor Location Lifecycle & Discovery
  // =========================================================================
  describe('Integration Tests: Donor Location Lifecycle', () => {
    before(async () => {
      const ts = Date.now();
      donor1Email = `loc-donor1-${ts}@testmail.com`;
      const donor2Email = `loc-donor2-${ts}@testmail.com`;

      // Register Donor 1 without initial coordinates
      const r1 = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'donor',
          email: donor1Email,
          password: 'Password123!',
          name: 'Sarah Connor',
          bloodGroup: 'O+',
          dob: '1992-05-10',
          gender: 'Female',
          phone: '+1 (555) 777-1111',
          weightKg: 65
        })
      });
      assert.equal(r1.status, 201);
      const d1 = await r1.json();
      donor1Token = d1.token;
      donor1Id = d1.user.id;

      // Register Donor 2 for cross-tenant unauthorized check
      const r2 = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'donor',
          email: donor2Email,
          password: 'Password123!',
          name: 'John Connor',
          bloodGroup: 'A+',
          dob: '1995-02-14',
          gender: 'Male',
          phone: '+1 (555) 777-2222',
          weightKg: 75
        })
      });
      assert.equal(r2.status, 201);
      const d2 = await r2.json();
      donor2Token = d2.token;
      donor2Id = d2.user.id;
    });

    test('New donor with no location returns undefined coordinates and missing state', async () => {
      const res = await fetch(`${BACKEND_URL}/api/donors/profile`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.donor.latitude, undefined);
      assert.equal(data.donor.longitude, undefined);

      // Nearby hospitals endpoint reports donorLocationMissing: true
      const nhRes = await fetch(`${BACKEND_URL}/api/donors/nearby-hospitals`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(nhRes.status, 200);
      const nhData = await nhRes.json();
      assert.equal(nhData.success, true);
      assert.equal(nhData.donorLocationMissing, true);
      assert.equal(nhData.hospitals.length, 0);
    });

    test('Donor cannot save invalid coordinates (out of range or malformed)', async () => {
      const res = await fetch(`${BACKEND_URL}/api/donors/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${donor1Token}`
        },
        body: JSON.stringify({
          latitude: 95.5, // Invalid > 90
          longitude: -74.0060
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.error, /Latitude .* is out of range/);
    });

    test('Donor manual location entry persists successfully and reloads accurately', async () => {
      // Save valid location for Donor 1 (e.g. Metro City Downtown: 40.7128, -74.0060)
      const updateRes = await fetch(`${BACKEND_URL}/api/donors/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${donor1Token}`
        },
        body: JSON.stringify({
          address: '742 Evergreen Terrace',
          city: 'Metro City',
          state: 'NY',
          postalCode: '10001',
          latitude: 40.7128,
          longitude: -74.0060,
          travelRadiusKm: 30
        })
      });
      assert.equal(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.equal(updateData.success, true);
      assert.equal(updateData.donor.latitude, 40.7128);
      assert.equal(updateData.donor.longitude, -74.0060);
      assert.equal(updateData.donor.postalCode, '10001');

      // Reload profile to verify persistence
      const reloadRes = await fetch(`${BACKEND_URL}/api/donors/profile`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(reloadRes.status, 200);
      const reloadData = await reloadRes.json();
      assert.equal(reloadData.donor.address, '742 Evergreen Terrace');
      assert.equal(reloadData.donor.latitude, 40.7128);
      assert.equal(reloadData.donor.longitude, -74.0060);
      assert.equal(reloadData.donor.postalCode, '10001');
    });

    test('Unauthorized cross-tenant attempt: Donor 2 cannot overwrite Donor 1 location', async () => {
      // Attempting to send donor1Id in payload under Donor 2 token should only update Donor 2
      const res = await fetch(`${BACKEND_URL}/api/donors/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${donor2Token}`
        },
        body: JSON.stringify({
          id: donor1Id, // malicious client attempt to specify another user id
          address: 'Hacked Address',
          latitude: 51.5074,
          longitude: -0.1278
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.donor.id, donor2Id); // strictly bound to donor2

      // Verify Donor 1 was not modified
      const checkDonor1 = await fetch(`${BACKEND_URL}/api/donors/profile`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      const d1Data = await checkDonor1.json();
      assert.equal(d1Data.donor.address, '742 Evergreen Terrace');
      assert.equal(d1Data.donor.latitude, 40.7128);
    });
  });

  // =========================================================================
  // 3. INTEGRATION TESTS: Hospital Location Lifecycle & Organization Profile
  // =========================================================================
  describe('Integration Tests: Hospital Location Lifecycle', () => {
    before(async () => {
      const ts = Date.now();
      hosp1Email = `loc-hosp1-${ts}@testmail.com`;
      hosp2Email = `loc-hosp2-${ts}@testmail.com`;
      const hospNoCoordsEmail = `loc-hosp-nocoords-${ts}@testmail.com`;

      // Hospital 1: Near Donor 1 (~3.5 km away: 40.7410, -73.9897)
      const r1 = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'hospital',
          email: hosp1Email,
          password: 'Password123!',
          name: 'Metro Central Hospital',
          hospitalName: 'Metro Central Hospital',
          licenseId: 'HOSP-LIC-101',
          contactPerson: 'Dr. Jane Foster',
          phone: '+1 (555) 111-2222',
          emergencyPhone: '+1 (555) 111-9999',
          address: '450 1st Avenue',
          city: 'Metro City',
          state: 'NY',
          postalCode: '10016',
          latitude: 40.7410,
          longitude: -73.9897
        })
      });
      assert.equal(r1.status, 201);
      const d1 = await r1.json();
      hosp1Token = d1.token;
      hosp1Id = d1.user.id;

      // Hospital 2: Farther away (~18 km away: 40.8500, -73.9200)
      const r2 = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'hospital',
          email: hosp2Email,
          password: 'Password123!',
          name: 'Northern Heights Medical Center',
          hospitalName: 'Northern Heights Medical Center',
          licenseId: 'HOSP-LIC-102',
          contactPerson: 'Dr. Bruce Banner',
          phone: '+1 (555) 222-3333',
          address: '1200 Grand Concourse',
          city: 'Metro City',
          state: 'NY',
          postalCode: '10456',
          latitude: 40.8500,
          longitude: -73.9200
        })
      });
      assert.equal(r2.status, 201);
      const d2 = await r2.json();
      hosp2Token = d2.token;
      hosp2Id = d2.user.id;

      // Hospital with NO coordinates
      const r3 = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'hospital',
          email: hospNoCoordsEmail,
          password: 'Password123!',
          name: 'Unconfigured Rural Clinic',
          hospitalName: 'Unconfigured Rural Clinic',
          licenseId: 'HOSP-LIC-999',
          phone: '+1 (555) 999-0000',
          address: 'Rural Route 9',
          city: 'Upstate',
          state: 'NY'
          // no latitude or longitude
        })
      });
      assert.equal(r3.status, 201);
      const d3 = await r3.json();
      hospNoCoordsToken = d3.token;
      hospNoCoordsId = d3.user.id;
    });

    test('Hospital can fetch its profile and view saved organization location', async () => {
      const res = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        headers: { Authorization: `Bearer ${hosp1Token}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.hospital.hospitalName, 'Metro Central Hospital');
      assert.equal(data.hospital.latitude, 40.7410);
      assert.equal(data.hospital.longitude, -73.9897);
      assert.equal(data.hospital.postalCode, '10016');
    });

    test('Hospital with unconfigured location returns undefined coordinates', async () => {
      const res = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        headers: { Authorization: `Bearer ${hospNoCoordsToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.hospital.latitude, undefined);
      assert.equal(data.hospital.longitude, undefined);
    });

    test('Hospital updates facility location and reloads persisted values', async () => {
      const updateRes = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hospNoCoordsToken}`
        },
        body: JSON.stringify({
          hospitalName: 'Configured Rural Health Center',
          address: '88 Hillside Drive',
          city: 'Albany',
          state: 'NY',
          postalCode: '12201',
          latitude: 42.6526,
          longitude: -73.7562
        })
      });
      assert.equal(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.equal(updateData.success, true);
      assert.equal(updateData.hospital.latitude, 42.6526);
      assert.equal(updateData.hospital.longitude, -73.7562);

      // Verify reload
      const reload = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        headers: { Authorization: `Bearer ${hospNoCoordsToken}` }
      });
      const reloadData = await reload.json();
      assert.equal(reloadData.hospital.latitude, 42.6526);
      assert.equal(reloadData.hospital.longitude, -73.7562);
    });

    test('Hospital update rejects invalid coordinates', async () => {
      const res = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hosp1Token}`
        },
        body: JSON.stringify({
          latitude: 40.7128,
          longitude: 250 // Invalid > 180
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.error, /Longitude .* is out of range/);
    });

    test('Hospital update ignores client-supplied hospital ID and uses req.user.id', async () => {
      const res = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hosp2Token}`
        },
        body: JSON.stringify({
          id: hosp1Id, // attempt to overwrite Hospital 1
          hospitalName: 'Malicious Attempt Hospital'
        })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.hospital.id, hosp2Id);

      // Hospital 1 should remain unaffected
      const h1Check = await fetch(`${BACKEND_URL}/api/hospitals/profile`, {
        headers: { Authorization: `Bearer ${hosp1Token}` }
      });
      const h1Data = await h1Check.json();
      assert.equal(h1Data.hospital.hospitalName, 'Metro Central Hospital');
    });
  });

  // =========================================================================
  // 4. INTEGRATION TESTS: Nearby Hospital Discovery Feature
  // =========================================================================
  describe('Integration Tests: Nearby Hospital Discovery', () => {
    test('Calculates real Haversine distance and sorts nearest-first', async () => {
      // Donor 1 is at [40.7128, -74.0060]
      // Hospital 1 is at [40.7410, -73.9897] (~3.4 km)
      // Hospital 2 is at [40.8500, -73.9200] (~16.8 km)
      const res = await fetch(`${BACKEND_URL}/api/donors/nearby-hospitals?radius=50`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.donorLocationMissing, false);
      assert.ok(data.hospitals.length >= 2);

      // Verify nearest first
      const h1Index = data.hospitals.findIndex(h => h.id === hosp1Id);
      const h2Index = data.hospitals.findIndex(h => h.id === hosp2Id);

      assert.ok(h1Index !== -1, 'Hospital 1 must be present in nearby results');
      assert.ok(h2Index !== -1, 'Hospital 2 must be present in nearby results');
      assert.ok(h1Index < h2Index, 'Nearest hospital (Hospital 1) must be before farther hospital (Hospital 2)');

      const h1Result = data.hospitals[h1Index];
      assert.ok(h1Result.distanceKm >= 3.0 && h1Result.distanceKm <= 4.0, `Expected ~3.5 km, got ${h1Result.distanceKm}`);

      // Verify distance is monotonically increasing
      for (let i = 0; i < data.hospitals.length - 1; i++) {
        assert.ok(
          data.hospitals[i].distanceKm <= data.hospitals[i + 1].distanceKm,
          `Hospitals must be strictly ordered by distance: index ${i} (${data.hospitals[i].distanceKm}) > index ${i+1} (${data.hospitals[i+1].distanceKm})`
        );
      }
    });

    test('Filters out hospitals outside the configured search radius', async () => {
      // Small search radius of 5 km should include Hospital 1 (~3.4 km) but exclude Hospital 2 (~16.8 km)
      const res = await fetch(`${BACKEND_URL}/api/donors/nearby-hospitals?radius=5`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      const hasHosp1 = data.hospitals.some(h => h.id === hosp1Id);
      const hasHosp2 = data.hospitals.some(h => h.id === hosp2Id);

      assert.equal(hasHosp1, true, 'Hospital 1 (~3.4 km) must be within 5 km radius');
      assert.equal(hasHosp2, false, 'Hospital 2 (~16.8 km) must be excluded from 5 km radius');
    });

    test('Supports dynamic current location coordinates via query parameters', async () => {
      // Query with custom location right next to Hospital 2 (e.g. [40.8505, -73.9205])
      const res = await fetch(`${BACKEND_URL}/api/donors/nearby-hospitals?lat=40.8505&lng=-73.9205&radius=10`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Now Hospital 2 should be the nearest (~0.1 km away)
      const firstHospital = data.hospitals[0];
      assert.equal(firstHospital.id, hosp2Id);
      assert.ok(firstHospital.distanceKm < 1.0);
    });

    test('Data Privacy: Only public discovery fields are exposed in nearby hospital response', async () => {
      const res = await fetch(`${BACKEND_URL}/api/donors/nearby-hospitals?radius=50`, {
        headers: { Authorization: `Bearer ${donor1Token}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      const hospital = data.hospitals[0];

      // Public allowed fields
      assert.ok(hospital.id);
      assert.ok(hospital.name || hospital.hospitalName);
      assert.ok(hospital.distanceKm !== undefined);
      assert.ok(hospital.latitude !== undefined);
      assert.ok(hospital.longitude !== undefined);

      // Forbidden sensitive fields
      assert.equal(hospital.passwordHash, undefined);
      assert.equal(hospital.staff, undefined);
      assert.equal(hospital.patients, undefined);
      assert.equal(hospital.inventory, undefined);
      assert.equal(hospital.requests, undefined);
    });
  });
});

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:5001';

describe('LifeLink Phase 7: Production Readiness & Reliability Hardening Suite', () => {

  let hospToken = '';
  let bbToken = '';

  before(async () => {
    // Seed fixtures for test suite execution
    await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });

    // Authenticate as hospital
    const hRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'emergency@apellogeneral.org',
        password: 'password123',
        role: 'hospital'
      })
    });
    const hData = await hRes.json();
    assert.equal(hData.success, true);
    hospToken = hData.token;

    // Authenticate as blood bank
    const bbRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'central@citybloodbank.org',
        password: 'password123',
        role: 'blood_bank'
      })
    });
    const bbData = await bbRes.json();
    assert.equal(bbData.success, true);
    bbToken = bbData.token;
  });

  // 1. Health & Telemetry Reporting
  test('1. /api/health returns comprehensive operational status without exposing secrets', async () => {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(['healthy', 'degraded'].includes(body.status));
    assert.equal(body.service, 'LifeLink Central API');
    assert.ok(typeof body.uptimeSeconds === 'number');
    assert.ok(body.timestamp);
    assert.ok(body.storage);
    assert.ok(['supabase_durable', 'in_memory_datastore_fallback'].includes(body.storage.mode));
    assert.ok(typeof body.storage.isDurablePersistence === 'boolean');
    assert.ok(body.system);
    assert.ok(body.system.memory.heapUsedMb > 0);
    assert.ok(body.registryEntityCounts.bloodUnits > 0);

    // Verify secrets are strictly NOT leaked in telemetry
    const stringified = JSON.stringify(body);
    assert.ok(!stringified.includes('password'));
    assert.ok(!stringified.includes('JWT_SECRET'));
    assert.ok(!stringified.includes('SUPABASE_SECRET_KEY'));
    assert.ok(!stringified.includes('service_role'));
  });

  // 2. Liveness & Readiness Probes
  test('2. /api/health/live and /api/health/ready probes return 200 OK', async () => {
    const liveRes = await fetch(`${BACKEND_URL}/api/health/live`);
    assert.equal(liveRes.status, 200);
    const liveData = await liveRes.json();
    assert.equal(liveData.status, 'alive');

    const readyRes = await fetch(`${BACKEND_URL}/api/health/ready`);
    assert.equal(readyRes.status, 200);
    const readyData = await readyRes.json();
    assert.equal(readyData.status, 'ready');
  });

  // 3. HTTP Security Headers
  test('3. API responses include standard HTTP security headers and correlation ID', async () => {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    assert.equal(res.status, 200);

    const headers = res.headers;
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.ok(headers.get('strict-transport-security'));
    assert.ok(headers.get('content-security-policy'));
    assert.ok(headers.get('x-request-id'), 'X-Request-Id correlation header must be present');
  });

  // 4. Request Correlation Tracking
  test('4. Incoming X-Request-Id header is propagated through the response cycle', async () => {
    const customReqId = 'trace-client-uuid-999888';
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      headers: { 'X-Request-Id': customReqId }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-request-id'), customReqId);
  });

  // 5. Standardized 404 Error Handler
  test('5. Nonexistent API routes return structured 404 with correlation ID', async () => {
    const res = await fetch(`${BACKEND_URL}/api/v1/invalid-route-probe`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.statusCode, 404);
    assert.match(data.error, /Resource not found/i);
    assert.ok(data.requestId);
    assert.ok(data.timestamp);
  });

  // 6. Role-Based Access Control Enforcement
  test('6. Strictly blocks hospital token from invoking blood-bank privileged mutations (403)', async () => {
    const res = await fetch(`${BACKEND_URL}/api/blood-bank/camps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}` // Hospital token used on Blood Bank endpoint
      },
      body: JSON.stringify({ name: 'Unauthorized Camp Attempt' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Access denied/i);
  });

  // 7. Unauthenticated Access Rejection
  test('7. Mutation endpoints reject unauthenticated calls with 401 Unauthorized', async () => {
    const res = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityUnits: 1 })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Access token required/i);
  });

  // 8. Payload Size & Validation Protection
  test('8. Rejects malformed JSON bodies gracefully with 400 Bad Request', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"malformed": "json, missing_brace'
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Malformed JSON payload/i);
  });

  // 9. Storage Architecture Transparency
  test('9. Accurately reports storage durability mode without claiming in-memory is durable', async () => {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    const data = await res.json();

    if (!data.storage.isDurablePersistence) {
      assert.equal(data.storage.mode, 'in_memory_datastore_fallback');
      assert.match(data.storage.notice, /in-memory DataStore/i);
      assert.equal(data.status, 'degraded');
    } else {
      assert.equal(data.storage.mode, 'supabase_durable');
      assert.equal(data.status, 'healthy');
    }
  });

  // 10. Idempotency Key Replay Protection
  test('10. Safely handles Idempotency-Key headers without creating duplicate records', async () => {
    const uniqueIdemKey = `IDEM-TEST-${Date.now()}`;
    const payload = {
      bloodBankId: 'bb-1',
      bloodGroup: 'B+',
      component: 'PRBC',
      quantityUnits: 1,
      urgency: 'Routine',
      patientReferenceId: `PAT-IDEM-${Date.now()}`,
      department: 'General Surgery'
    };

    // First request
    const res1 = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`,
        'Idempotency-Key': uniqueIdemKey
      },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 201);
    const data1 = await res1.json();
    const createdId = data1.request.id;

    // Second request with identical Idempotency-Key (simulating client retry)
    const res2 = await fetch(`${BACKEND_URL}/api/hospitals/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hospToken}`,
        'Idempotency-Key': uniqueIdemKey
      },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 200, 'Replay should return 200 OK');
    const data2 = await res2.json();
    assert.equal(data2.isIdempotentReplay, true);
    assert.equal(data2.request.id, createdId);
  });

  // 11. Phase 8: DataStore Reset & Clean Initial State
  test('11. /api/test/reset completely clears in-memory DataStore without crashing', async () => {
    const res = await fetch(`${BACKEND_URL}/api/test/reset`, { method: 'POST' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.counts.donors, 0);
    assert.equal(data.counts.hospitals, 0);
    assert.equal(data.counts.bloodBanks, 0);
    assert.equal(data.counts.bloodUnits, 0);
    assert.equal(data.counts.bloodRequests, 0);
  });

  // 12. Phase 8: Empty Public Stats Integrity (No Hardcoded +420 Baseline)
  test('12. /api/public/stats returns strictly zero counts for empty database without hardcoded offsets', async () => {
    const res = await fetch(`${BACKEND_URL}/api/public/stats`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.stats.totalDonors, 0);
    assert.equal(data.stats.totalHospitals, 0);
    assert.equal(data.stats.totalBloodBanks, 0);
    assert.equal(data.stats.totalUnitsAvailable, 0);
    assert.equal(data.stats.totalRequestsFulfilled, 0, 'Must NOT contain fake +420 baseline offset');
  });

  // 13. Phase 8: Fresh Account Registration & Real Authentication in Clean State
  test('13. Register fresh donor, hospital, and blood bank into empty database and authenticate', async () => {
    const ts = Date.now();

    // Register fresh donor
    const donorRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'donor',
        email: `freshdonor-${ts}@lifelink.test`,
        password: 'password123',
        name: 'Fresh Voluntary Donor',
        bloodGroup: 'O+'
      })
    });
    assert.equal(donorRes.status, 201);
    const donorData = await donorRes.json();
    assert.equal(donorData.success, true);
    assert.ok(donorData.token);

    // Register fresh hospital
    const hospRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'hospital',
        email: `freshhosp-${ts}@lifelink.test`,
        password: 'password123',
        hospitalName: 'Fresh Medical Center'
      })
    });
    assert.equal(hospRes.status, 201);
    const hospData = await hospRes.json();
    assert.equal(hospData.success, true);
    assert.ok(hospData.token);

    // Register fresh blood bank
    const bbRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'blood_bank',
        email: `freshbb-${ts}@lifelink.test`,
        password: 'password123',
        bloodBankName: 'Fresh Regional Blood Hub'
      })
    });
    assert.equal(bbRes.status, 201);
    const bbData = await bbRes.json();
    assert.equal(bbData.success, true);
    assert.ok(bbData.token);

    // Verify stats now reflect exactly 1 of each
    const statsRes = await fetch(`${BACKEND_URL}/api/public/stats`);
    const statsData = await statsRes.json();
    assert.equal(statsData.stats.totalDonors, 1);
    assert.equal(statsData.stats.totalHospitals, 1);
    assert.equal(statsData.stats.totalBloodBanks, 1);
  });

  // 14. Phase 8: Restore Test Fixtures for Downstream Testing
  test('14. /api/test/seed-fixtures re-seeds fixtures reliably for developer test suites', async () => {
    const res = await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.counts.bloodBanks >= 2);
    assert.ok(data.counts.hospitals >= 2);
    assert.ok(data.counts.bloodUnits >= 50);
  });

});

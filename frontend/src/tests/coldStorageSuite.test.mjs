import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_URL = process.env.VITE_API_BASE_URL || 'http://localhost:5001';

describe('LifeLink Phase 5C: Cold-Storage Monitoring, Temperature Alarms & Audit Trail', () => {
  let bb1Token = '';
  let bb2Token = '';
  let hospToken = '';
  let donorToken = '';
  let testAlarmId = '';

  // Setup: Authenticate users across roles and tenants before running tests
  before(async () => {
    // Ensure test fixtures are seeded for automated test execution
    await fetch(`${BACKEND_URL}/api/test/seed-fixtures`, { method: 'POST' });

    // 1. BB-1 (City Central Blood Center)
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
    assert.equal(bb1Res.status, 200);
    assert.equal(bb1Data.user.id, 'bb-1');
    bb1Token = bb1Data.token;

    // 2. BB-2 (Red Cross Regional Center)
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
    assert.equal(bb2Res.status, 200);
    assert.equal(bb2Data.user.id, 'bb-2');
    bb2Token = bb2Data.token;

    // 3. Hospital
    const hospRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'emergency@apellogeneral.org',
        password: 'password123',
        role: 'hospital'
      })
    });
    const hospData = await hospRes.json();
    assert.equal(hospRes.status, 200);
    hospToken = hospData.token;

    // 4. Donor
    const donorRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.mercer@example.com',
        password: 'password123',
        role: 'donor'
      })
    });
    const donorData = await donorRes.json();
    assert.equal(donorRes.status, 200);
    donorToken = donorData.token;
  });

  // 1. Equipment tenant isolation
  test('1. Equipment tenant isolation: bb-1 cannot see or access bb-2 equipment and vice versa', async () => {
    // Query equipment as BB-1
    const bb1EqRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const bb1EqData = await bb1EqRes.json();
    assert.equal(bb1EqRes.status, 200);
    assert.equal(bb1EqData.success, true);
    assert.ok(bb1EqData.equipment.length >= 3, 'BB-1 must have its seeded equipment');
    // Ensure all returned equipment belongs strictly to bb-1
    assert.ok(bb1EqData.equipment.every(eq => eq.bloodBankId === 'bb-1'), 'All equipment must belong to bb-1');
    assert.ok(!bb1EqData.equipment.some(eq => eq.id === 'EQ-BB2-REF-01'), 'BB-1 must not see BB-2 equipment');

    // Query single equipment from BB-2 using BB-1 credentials -> must 404
    const crossRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment/EQ-BB2-REF-01`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    assert.equal(crossRes.status, 404, 'Cross-tenant equipment access must return 404 Not Found');

    // Query as BB-2 -> must only see BB-2 equipment
    const bb2EqRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment`, {
      headers: { Authorization: `Bearer ${bb2Token}` }
    });
    const bb2EqData = await bb2EqRes.json();
    assert.equal(bb2EqRes.status, 200);
    assert.ok(bb2EqData.equipment.every(eq => eq.bloodBankId === 'bb-2'));
    assert.ok(bb2EqData.equipment.some(eq => eq.id === 'EQ-BB2-REF-01'));
  });

  // 2. Reading validation and unit consistency
  test('2. Reading validation rejects missing fields, non-numeric values, and physically impossible temperatures', async () => {
    // Missing equipment ID
    const missRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ temperatureCelsius: 4.0 })
    });
    assert.equal(missRes.status, 400);

    // Non-numeric temperature
    const nonNumRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ equipmentId: 'EQ-RBC-REF-01', temperatureCelsius: 'warm' })
    });
    assert.equal(nonNumRes.status, 400);

    // Physically impossible reading (< -100°C or > 60°C)
    const impossibleRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ equipmentId: 'EQ-RBC-REF-01', temperatureCelsius: -150.0 })
    });
    assert.equal(impossibleRes.status, 422);

    // Cross-tenant reading attempt (BB-1 recording reading for BB-2 equipment)
    const crossTenantRead = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ equipmentId: 'EQ-BB2-REF-01', temperatureCelsius: 4.0 })
    });
    assert.equal(crossTenantRead.status, 404);
  });

  // 3. Duplicate and out-of-order readings
  test('3. Duplicate readings within 60s are handled idempotently without spamming storage', async () => {
    const fixedTimestamp = new Date(Date.now() - 30000).toISOString();
    
    // First valid reading
    const read1 = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        equipmentId: 'EQ-RBC-REF-01',
        temperatureCelsius: 3.7,
        timestamp: fixedTimestamp,
        readingSource: 'manual_log',
        notes: 'Initial morning check'
      })
    });
    const data1 = await read1.json();
    assert.equal(read1.status, 201);
    assert.equal(data1.success, true);
    assert.equal(data1.isDuplicate, false);

    // Second reading with identical timestamp and temperature (duplicate)
    const read2 = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        equipmentId: 'EQ-RBC-REF-01',
        temperatureCelsius: 3.7,
        timestamp: fixedTimestamp,
        readingSource: 'manual_log',
        notes: 'Accidental duplicate click'
      })
    });
    const data2 = await read2.json();
    assert.equal(read2.status, 200, 'Duplicate submission must return 200 OK gracefully');
    assert.equal(data2.isDuplicate, true, 'Duplicate must be explicitly flagged');
    assert.equal(data2.reading.id, data1.reading.id, 'Must return original reading record');
  });

  // 4. Threshold breach detection and Platelet Agitation fault detection
  test('4. Threshold breach triggers cold-storage alarm and updates equipment status to in_alarm', async () => {
    // EQ-RBC-REF-01 allowed range is 2.0°C to 6.0°C. Reading 9.5°C is a critical breach.
    const breachRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        equipmentId: 'EQ-RBC-REF-01',
        temperatureCelsius: 9.5,
        readingSource: 'manual_log',
        notes: 'Refrigeration door left ajar during stock restocking'
      })
    });
    const breachData = await breachRes.json();
    assert.equal(breachRes.status, 201);
    assert.equal(breachData.alarmTriggered, true, 'Alarm must be triggered for out-of-range temperature');
    assert.ok(breachData.alarm, 'Alarm object must be returned in response');
    assert.equal(breachData.alarm.equipmentId, 'EQ-RBC-REF-01');
    assert.ok(['active', 'triggered'].includes(breachData.alarm.status.toLowerCase()));
    assert.ok(['critical', 'warning'].includes(breachData.alarm.severity.toLowerCase()));

    testAlarmId = breachData.alarm.id;

    // Verify equipment status changed to in_alarm / alarm excursion
    const eqCheck = await (await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment/EQ-RBC-REF-01`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    })).json();
    assert.ok(['in_alarm', 'alarm excursion'].includes(eqCheck.equipment.status.toLowerCase()));
    assert.equal(eqCheck.equipment.activeAlarmsCount >= 1, true);

    // Platelet agitator fault detection test on EQ-PLT-INC-01 (Platelet incubator)
    const pltFault = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        equipmentId: 'EQ-PLT-INC-01',
        temperatureCelsius: 22.0, // within temp range 20-24°C
        agitationOperational: false,
        plateletAgitationWorking: false, // mechanical agitator stopped!
        readingSource: 'manual_log',
        notes: 'Agitator motor halted'
      })
    });
    const pltFaultData = await pltFault.json();
    assert.equal(pltFault.status, 201);
    assert.equal(pltFaultData.alarmTriggered, true, 'Agitation fault must trigger alarm');
  });

  // 5. Stale and disconnected sensor states
  test('5. Equipment without recent readings evaluates to stale status (> 4 hours)', async () => {
    // EQ-QC-HOLD-01 was seeded with last reading 6 hours ago
    const eqRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment/EQ-QC-HOLD-01`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const eqData = await eqRes.json();
    assert.equal(eqRes.status, 200);
    assert.ok(['stale'].includes(eqData.equipment.connectivityStatus?.toLowerCase() || eqData.equipment.sensorConnectivity?.toLowerCase()), 'Reading > 4 hours ago must flag connectivity as stale');
  });

  // 6. Alarm deduplication: repeat breach updates existing alarm; normal reading does NOT auto-resolve
  test('6. Ongoing breach updates existing alarm rather than duplicating; normal reading retains open alarm', async () => {
    // Send another breach reading for EQ-RBC-REF-01 (e.g. 10.2°C)
    const repeatBreach = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        equipmentId: 'EQ-RBC-REF-01',
        temperatureCelsius: 10.2,
        readingSource: 'manual_log',
        notes: 'Second check 15m later'
      })
    });
    const repeatData = await repeatBreach.json();
    assert.equal(repeatBreach.status, 201);
    assert.equal(repeatData.alarmTriggered, true);
    assert.equal(repeatData.alarm.id, testAlarmId, 'Existing open alarm ID must be retained instead of spawning duplicate');

    // Send a normal in-range reading (4.0°C). Operational rule: normal reading MUST NOT automatically resolve open alarm!
    const normalRead = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        equipmentId: 'EQ-RBC-REF-01',
        temperatureCelsius: 4.0,
        readingSource: 'manual_log',
        notes: 'Door closed, temperature returning'
      })
    });
    const normalData = await normalRead.json();
    assert.equal(normalRead.status, 201);
    assert.equal(normalData.alarmTriggered, false);

    // Verify the alarm is STILL open (status is Active or Acknowledged, NOT resolved)
    const alarmCheck = await (await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/alarms?equipmentId=EQ-RBC-REF-01&status=active`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    })).json();
    const openAlarm = alarmCheck.alarms.find(a => a.id === testAlarmId);
    assert.ok(openAlarm, 'Alarm must remain open until authorized operator formally resolves it');
    assert.ok(['active', 'triggered'].includes(openAlarm.status.toLowerCase()));
  });

  // 7. Alarm lifecycle: Acknowledge -> Resolve with full operator audit trail
  test('7. Authorized operator acknowledges and resolves alarm with mandatory notes and corrective action', async () => {
    // Step A: Acknowledge without notes -> rejected with 400
    const badAck = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/alarms/${testAlarmId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ notes: '   ' })
    });
    assert.equal(badAck.status, 400, 'Empty acknowledgement notes must be rejected');

    // Step B: Valid acknowledgement
    const ackRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/alarms/${testAlarmId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ notes: 'Lead biomedical technician on site. Inspecting door seal.' })
    });
    const ackData = await ackRes.json();
    assert.equal(ackRes.status, 200);
    assert.equal(ackData.alarm.status.toLowerCase(), 'acknowledged');
    assert.ok(ackData.alarm.acknowledgedBy, 'Must record acknowledging operator ID');
    assert.ok(ackData.alarm.acknowledgedAt, 'Must record acknowledgement timestamp');

    // Step C: Resolve without corrective action -> rejected with 400
    const badResolve = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/alarms/${testAlarmId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({ correctiveAction: '' })
    });
    assert.equal(badResolve.status, 400, 'Empty corrective action must be rejected');

    // Step D: Valid resolution
    const resolveRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/alarms/${testAlarmId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb1Token}` },
      body: JSON.stringify({
        correctiveAction: 'Door gasket adjusted and magnetic latch re-aligned. Temperature stabilized at 3.8°C.',
        notes: 'Quality Assurance Supervisor sign-off complete.'
      })
    });
    const resolveData = await resolveRes.json();
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveData.alarm.status.toLowerCase(), 'resolved');
    assert.ok(resolveData.alarm.resolvedBy);
    assert.ok(resolveData.alarm.resolvedAt);

    // Step E: Verify audit trail contains full history
    const auditEntries = resolveData.alarm.auditHistory || resolveData.alarm.auditTrail;
    assert.ok(auditEntries.length >= 3, 'Audit trail must contain all lifecycle events');
    const actions = auditEntries.map(e => e.action.toLowerCase());
    assert.ok(actions.some(a => a.includes('trigger') || a.includes('excursion')));
    assert.ok(actions.some(a => a.includes('acknowledge')));
    assert.ok(actions.some(a => a.includes('resolve')));

    // Step F: Equipment status returns to operational
    const eqStatus = await (await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment/EQ-RBC-REF-01`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    })).json();
    assert.equal(eqStatus.equipment.status.toLowerCase(), 'operational');
  });

  // 8. Unauthorized access prevention: Hospital and Donor roles cannot access cold storage
  test('8. Access control enforces strict role isolation (hospital and donor roles receive 403 Forbidden)', async () => {
    // Hospital attempting to view equipment
    const hospGet = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment`, {
      headers: { Authorization: `Bearer ${hospToken}` }
    });
    assert.equal(hospGet.status, 403, 'Hospital token must receive 403 Forbidden');

    // Donor attempting to post reading
    const donorPost = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ equipmentId: 'EQ-RBC-REF-01', temperatureCelsius: 4.0 })
    });
    assert.equal(donorPost.status, 403, 'Donor token must receive 403 Forbidden');

    // Cross-tenant alarm resolve attempt (BB-2 operator attempting to resolve BB-1 alarm)
    const crossAck = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/alarms/${testAlarmId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bb2Token}` },
      body: JSON.stringify({ notes: 'Unauthorized cross-tenant attempt' })
    });
    assert.equal(crossAck.status, 404, 'Cross-tenant alarm manipulation must return 404 Not Found');
  });

  // 9. Storage-to-inventory association
  test('9. Exposed inventory endpoint accurately identifies blood units mapped to the affected storage unit', async () => {
    const exposedRes = await fetch(`${BACKEND_URL}/api/blood-bank/cold-storage/equipment/EQ-RBC-REF-01/exposed-inventory`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const exposedData = await exposedRes.json();
    assert.equal(exposedRes.status, 200);
    assert.equal(exposedData.success, true);
    assert.ok(Array.isArray(exposedData.affectedUnits));
    assert.ok(exposedData.affectedUnits.length > 0, 'Must match blood units stored in RBC Main Storage Bay');
    
    // Check that clinical review notice is returned
    assert.ok(exposedData.reviewNotice, 'Response must include clinical QA review guidance');
    assert.ok(exposedData.reviewNotice.includes('NOT automatically discarded or released'));
  });

  // 10. Prevention of automatic unauthorized product release or discard
  test('10. Inventory units retain their actual clinical status and are not automatically modified by excursions', async () => {
    const invRes = await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    });
    const invData = await invRes.json();
    assert.equal(invRes.status, 200);

    // Units must still exist in their genuine availability statuses (e.g. available, reserved, quarantined)
    // and MUST NOT have been silently altered to discarded purely from sensor alarms
    const activeUnits = invData.units.filter(u => u.storageLocation.includes('RBC Locker'));
    assert.ok(activeUnits.length > 0);
    for (const u of activeUnits) {
      assert.ok(['available', 'reserved', 'quarantined', 'issued'].includes(u.availability.toLowerCase()));
    }
  });

  // 11. Existing blood bank inventory, reservations, and lab testing workflows are intact
  test('11. Phase 5A and 5B workflows (inventory, FEFO, reservations, lab screening) continue functioning', async () => {
    // Inventory
    const invRes = await (await fetch(`${BACKEND_URL}/api/blood-bank/inventory`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    })).json();
    assert.equal(invRes.success, true);
    assert.ok(invRes.units.length > 0);

    // FEFO Priority
    const fefoRes = await (await fetch(`${BACKEND_URL}/api/blood-bank/inventory/fefo-priority`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    })).json();
    assert.equal(fefoRes.success, true);

    // Testing records
    const testRes = await (await fetch(`${BACKEND_URL}/api/blood-bank/testing`, {
      headers: { Authorization: `Bearer ${bb1Token}` }
    })).json();
    assert.equal(testRes.success, true);
  });

  // 12. Donor and Hospital portal zero regression check
  test('12. Donor and Hospital portals experience zero regression', async () => {
    // Hospital Dashboard
    const hospDash = await (await fetch(`${BACKEND_URL}/api/hospitals/dashboard`, {
      headers: { Authorization: `Bearer ${hospToken}` }
    })).json();
    assert.equal(hospDash.success, true);

    // Hospital Storage Ledger
    const hospLedger = await (await fetch(`${BACKEND_URL}/api/hospitals/storage-ledger`, {
      headers: { Authorization: `Bearer ${hospToken}` }
    })).json();
    assert.equal(hospLedger.success, true);

    // Donor Eligibility
    const donorElig = await (await fetch(`${BACKEND_URL}/api/donors/eligibility`, {
      headers: { Authorization: `Bearer ${donorToken}` }
    })).json();
    assert.equal(donorElig.success, true);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuthoritativeMetrics } from '../utils/donorMetrics.ts';
import { 
  DONOR_MOCK_HISTORY_FIXTURE, 
  checkBloodGroupDiscrepancy, 
  findRecordDiscrepancies, 
  VERIFIED_DONOR_BLOOD_GROUP 
} from '../utils/donorIntegrity.ts';
import { checkAlertCompatibility } from '../utils/bloodCompatibility.ts';
import { evaluateProfileCompleteness } from '../utils/profileCompleteness.ts';
import { calculateEligibilityPolicy } from '../utils/donationEligibility.ts';

// 1. Authoritative Donation Metrics Tests
test('Authoritative Metrics: calculates metrics accurately from history records', () => {
  const records = [
    { donationId: 'REC-1', volumeMl: 450, status: 'Transfused / Utilized' },
    { donationId: 'REC-2', volumeMl: 300, status: 'Tested & Available' },
    { donationId: 'REC-3', volumeMl: 450, status: 'Transfused / Utilized' }
  ];

  const metrics = calculateAuthoritativeMetrics(records);
  assert.equal(metrics.totalDonations, 3);
  assert.equal(metrics.totalVolumeMl, 1200);
  assert.equal(metrics.livesImpactedEst, 9);
});

test('Authoritative Metrics: excludes cancelled or rejected donations', () => {
  const records = [
    { donationId: 'REC-1', volumeMl: 450, status: 'Transfused / Utilized' },
    { donationId: 'REC-2', volumeMl: 450, status: 'Cancelled' },
    { donationId: 'REC-3', volumeMl: 450, status: 'Sample Rejected' }
  ];

  const metrics = calculateAuthoritativeMetrics(records);
  assert.equal(metrics.totalDonations, 1);
  assert.equal(metrics.totalVolumeMl, 450);
});

test('Authoritative Metrics: deduplicates records by donationId (lifecycle stepper safety)', () => {
  const records = [
    { donationId: 'UNIT-101', volumeMl: 450, status: 'Collected' },
    { donationId: 'UNIT-101', volumeMl: 450, status: 'Tested & Available' }, // same unit in next stage
    { donationId: 'UNIT-102', volumeMl: 300, status: 'Tested & Available' }
  ];

  const metrics = calculateAuthoritativeMetrics(records);
  assert.equal(metrics.totalDonations, 2);
  assert.equal(metrics.totalVolumeMl, 750);
});

test('Authoritative Metrics: handles empty or invalid records safely', () => {
  assert.equal(calculateAuthoritativeMetrics([]).totalDonations, 0);
  assert.equal(calculateAuthoritativeMetrics(null).totalDonations, 0);
  assert.equal(calculateAuthoritativeMetrics(undefined).totalVolumeMl, 0);

  const invalidVolRecords = [{ donationId: 'REC-1', volumeMl: 'invalid' }];
  assert.equal(calculateAuthoritativeMetrics(invalidVolRecords).totalVolumeMl, 0);
});

// 2. Donor Blood Group Consistency Tests
test('Donor Integrity: mock fixtures strictly match verified O+ blood group', () => {
  assert.equal(VERIFIED_DONOR_BLOOD_GROUP, 'O+');
  for (const record of DONOR_MOCK_HISTORY_FIXTURE) {
    assert.equal(record.bloodGroup, 'O+', `Fixture record ${record.donationId} must be O+`);
    assert.ok(record.component === 'Whole Blood' || record.component === 'Platelets');
  }
});

test('Donor Integrity: checkBloodGroupDiscrepancy correctly flags mismatches', () => {
  assert.equal(checkBloodGroupDiscrepancy('O+', 'O+'), false);
  assert.equal(checkBloodGroupDiscrepancy('A+', 'O+'), true);
  assert.equal(checkBloodGroupDiscrepancy('B-', 'O+'), true);
  assert.equal(checkBloodGroupDiscrepancy('AB-', 'O+'), true);
});

test('Donor Integrity: findRecordDiscrepancies surfaces persisted conflicts without rewriting', () => {
  const records = [
    { donationId: 'REC-1', bloodGroup: 'O+' },
    { donationId: 'REC-2', bloodGroup: 'A+' },
    { donationId: 'REC-3', bloodGroup: 'B-' }
  ];

  const flagged = findRecordDiscrepancies(records, 'O+');
  assert.equal(flagged.length, 2);
  assert.equal(flagged[0].donationId, 'REC-2');
  assert.equal(flagged[1].donationId, 'REC-3');
});

// 3. Clinical Blood Compatibility Engine Tests
test('Blood Compatibility: O+ donor is confirmed incompatible for O- RBC alert', () => {
  const result = checkAlertCompatibility('O+', 'O-', 'RBC');
  assert.equal(result.status, 'confirmed_incompatible');
  assert.equal(result.isCompatible, false);
  assert.match(result.message, /Not blood-match compatible/);
  assert.match(result.message, /requires O- red cells/);
});

test('Blood Compatibility: O- donor is confirmed compatible for O+ and O- RBC alerts', () => {
  const resOminusToOminus = checkAlertCompatibility('O-', 'O-', 'RBC');
  assert.equal(resOminusToOminus.status, 'confirmed_compatible');
  assert.equal(resOminusToOminus.isCompatible, true);

  const resOminusToOplus = checkAlertCompatibility('O-', 'O+', 'RBC');
  assert.equal(resOminusToOplus.status, 'confirmed_compatible');
  assert.equal(resOminusToOplus.isCompatible, true);
});

test('Blood Compatibility: O+ donor is confirmed compatible for A+ and AB+ RBC', () => {
  const resAplus = checkAlertCompatibility('O+', 'A+', 'RBC');
  assert.equal(resAplus.status, 'confirmed_compatible');
  assert.equal(resAplus.isCompatible, true);

  const resABplus = checkAlertCompatibility('O+', 'AB+', 'RBC');
  assert.equal(resABplus.status, 'confirmed_compatible');
  assert.equal(resABplus.isCompatible, true);
});

test('Blood Compatibility: handles unknown/missing blood group safely', () => {
  const res = checkAlertCompatibility(null, 'O-', 'RBC');
  assert.equal(res.status, 'unverified');
  assert.equal(res.isCompatible, false);
  assert.match(res.message, /Compatibility not verified/);
});

// 4. Profile Completeness Engine Tests
test('Profile Completeness: calculates 100% when all 9 required fields are valid', () => {
  const completeProfile = {
    name: 'Alex Mercer',
    phone: '+1 (555) 123-4500',
    address: '100 Maple Street',
    city: 'Metro City',
    state: 'NY',
    weightKg: 72,
    travelRadiusKm: 25,
    emergencyContact: {
      name: 'Jane Mercer',
      phone: '+1 (555) 987-6500',
      relation: 'Spouse'
    }
  };

  const evalResult = evaluateProfileCompleteness(completeProfile);
  assert.equal(evalResult.score, 100);
  assert.equal(evalResult.completedCount, 9);
  assert.equal(evalResult.missingFields.length, 0);
});

test('Profile Completeness: identifies missing required fields and agrees with percentage', () => {
  const partialProfile = {
    name: 'Alex Mercer',
    phone: '+1 (555) 123-4500',
    address: '', // missing
    city: 'Metro City',
    state: '', // missing
    weightKg: 70,
    travelRadiusKm: 25,
    emergencyContact: {
      name: 'Jane Mercer',
      phone: '' // missing
    }
  };

  const evalResult = evaluateProfileCompleteness(partialProfile);
  // 6 out of 9 populated -> 67%
  assert.equal(evalResult.completedCount, 6);
  assert.equal(evalResult.totalFields, 9);
  assert.equal(evalResult.score, 67);
  assert.equal(evalResult.missingFields.length, 3);
  assert.ok(evalResult.missingFields.some(f => f.id === 'address'));
  assert.ok(evalResult.missingFields.some(f => f.id === 'state'));
  assert.ok(evalResult.missingFields.some(f => f.id === 'emergPhone'));
});

// 5. Dynamic Eligibility Policy Engine Tests
test('Eligibility Policy: computes correct cooldown dates from last donation date', () => {
  // Donation occurred 20 days ago
  const baseTime = new Date('2026-10-10T12:00:00Z');
  const lastDonationDate = '2026-09-20'; // 20 days prior

  const breakdown = calculateEligibilityPolicy(lastDonationDate, baseTime);

  // Whole blood: 56-day policy -> 36 days remaining
  assert.equal(breakdown.wholeBlood.coolOffDaysTotal, 56);
  assert.equal(breakdown.wholeBlood.isEligible, false);
  assert.equal(breakdown.wholeBlood.daysRemaining, 36);
  assert.equal(breakdown.wholeBlood.nextEligibleDate, '2026-11-15');

  // Platelets: 14-day policy -> 20 days passed > 14 days -> eligible!
  assert.equal(breakdown.platelets.coolOffDaysTotal, 14);
  assert.equal(breakdown.platelets.isEligible, true);
  assert.equal(breakdown.platelets.daysRemaining, 0);
});

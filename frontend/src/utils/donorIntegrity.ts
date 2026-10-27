import type { BloodGroup } from '../types/index.ts';
import type { DonationRecord } from './donorMetrics.ts';

/**
 * Verified donor blood group and integrity helper.
 * Standardizes donor-specific mock fixtures to O+ while protecting persisted clinical data.
 */

export const VERIFIED_DONOR_BLOOD_GROUP: BloodGroup = 'O+';

/**
 * Standard donor mock donation history fixture.
 * Strictly consistent with verified O+ blood group and clinical component distinctions.
 */
export const DONOR_MOCK_HISTORY_FIXTURE: DonationRecord[] = [
  {
    donationId: 'UNIT-2026-8001',
    date: '2026-06-01',
    bloodBankName: 'City Central Blood Center',
    bloodGroup: 'O+',
    component: 'Whole Blood',
    volumeMl: 450,
    status: 'Tested & Available',
    source: 'Voluntary Donation'
  },
  {
    donationId: 'UNIT-2025-4102',
    date: '2025-12-15',
    bloodBankName: 'Red Cross Regional Center',
    bloodGroup: 'O+',
    component: 'Whole Blood',
    volumeMl: 450,
    status: 'Transfused / Utilized',
    source: 'Voluntary Donation'
  },
  {
    donationId: 'UNIT-2025-1088',
    date: '2025-06-10',
    bloodBankName: 'City Central Blood Center',
    bloodGroup: 'O+',
    component: 'Platelets',
    volumeMl: 300,
    status: 'Transfused / Utilized',
    source: 'Voluntary Donation'
  }
];

export interface BloodGroupDiscrepancy {
  hasDiscrepancy: boolean;
  expectedGroup: string;
  actualGroup: string;
  donationId: string;
}

/**
 * Checks if a historical record conflicts with the verified donor profile blood group.
 * Crucial rule: We never silently rewrite persisted clinical data.
 */
export const checkBloodGroupDiscrepancy = (
  recordBloodGroup: string | undefined,
  profileBloodGroup: string | undefined = VERIFIED_DONOR_BLOOD_GROUP
): boolean => {
  if (!recordBloodGroup || !profileBloodGroup || profileBloodGroup.trim().toLowerCase() === 'unspecified') return false;
  return recordBloodGroup.trim().toUpperCase() !== profileBloodGroup.trim().toUpperCase();
};

/**
 * Scans a list of donation records for any blood group discrepancies.
 */
export const findRecordDiscrepancies = (
  records: DonationRecord[],
  profileBloodGroup: string = VERIFIED_DONOR_BLOOD_GROUP
): DonationRecord[] => {
  if (!Array.isArray(records)) return [];
  return records.filter(r => checkBloodGroupDiscrepancy(r.bloodGroup, profileBloodGroup));
};

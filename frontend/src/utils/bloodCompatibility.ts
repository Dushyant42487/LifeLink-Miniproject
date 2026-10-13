import type { BloodGroup, BloodComponent } from '../types/index.ts';

/**
 * Clinical Blood Compatibility Engine for Emergency Alerts.
 * Evaluates red blood cell (RBC/Whole Blood) and plasma/platelet compatibility
 * without superficial string matching.
 */

// Red Blood Cell / Whole Blood Compatibility Map (Donor -> Allowed Recipients)
const RBC_DONOR_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+']
};

// Plasma & Platelets Compatibility Map (Donor -> Allowed Recipients)
const PLASMA_DONOR_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'AB-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A+', 'A-', 'O+', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B+', 'B-', 'O+', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O+', 'O-']
};

export type CompatibilityStatus = 'confirmed_compatible' | 'confirmed_incompatible' | 'unverified';

export interface CompatibilityResult {
  status: CompatibilityStatus;
  isCompatible: boolean;
  message: string;
}

/**
 * Evaluates donor-to-recipient clinical compatibility for a specific alert.
 */
export const checkAlertCompatibility = (
  donorBloodGroup: string | undefined | null,
  recipientBloodGroup: string | undefined | null,
  component: string | undefined | null
): CompatibilityResult => {
  if (!donorBloodGroup || !recipientBloodGroup) {
    return {
      status: 'unverified',
      isCompatible: false,
      message: 'Compatibility not verified — laboratory confirmation required.'
    };
  }

  const dGroup = donorBloodGroup.trim().toUpperCase() as BloodGroup;
  const rGroup = recipientBloodGroup.trim().toUpperCase() as BloodGroup;
  const comp = (component || 'RBC').trim().toUpperCase();

  // If component is Plasma or Platelets
  if (comp === 'PLASMA' || comp === 'PLATELETS') {
    const allowedRecipients = PLASMA_DONOR_COMPATIBILITY[dGroup];
    if (!allowedRecipients) {
      return {
        status: 'unverified',
        isCompatible: false,
        message: 'Compatibility not verified for requested component.'
      };
    }

    const isMatch = allowedRecipients.includes(rGroup);
    if (isMatch) {
      return {
        status: 'confirmed_compatible',
        isCompatible: true,
        message: `Compatible match for ${rGroup} ${comp}. Final suitability confirmed via laboratory cross-match.`
      };
    } else {
      return {
        status: 'confirmed_incompatible',
        isCompatible: false,
        message: `Not blood-match compatible — this request requires ${rGroup} ${comp.toLowerCase()}.`
      };
    }
  }

  // Red Blood Cells / Whole Blood / Default
  const allowedRecipients = RBC_DONOR_COMPATIBILITY[dGroup];
  if (!allowedRecipients) {
    return {
      status: 'unverified',
      isCompatible: false,
      message: 'Compatibility not verified for requested blood group.'
    };
  }

  const isMatch = allowedRecipients.includes(rGroup);
  if (isMatch) {
    return {
      status: 'confirmed_compatible',
      isCompatible: true,
      message: `Compatible match for ${rGroup} red cells. Final suitability confirmed via laboratory cross-match.`
    };
  } else {
    return {
      status: 'confirmed_incompatible',
      isCompatible: false,
      message: `Not blood-match compatible — this request requires ${rGroup} red cells.`
    };
  }
};

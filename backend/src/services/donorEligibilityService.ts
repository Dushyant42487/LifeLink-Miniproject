import { db } from '../models/store';
import { DonorProfile } from '../models/types';

export const COOL_OFF_DAYS_WHOLE_BLOOD = 56;
export const COOL_OFF_DAYS_PLATELETS = 14;
export const MIN_DONOR_WEIGHT_KG = 50;

export interface ComponentEligibilityResult {
  componentName: string;
  coolOffDaysTotal: number;
  isEligible: boolean;
  daysRemaining: number;
  daysElapsed: number;
  nextEligibleDate: string;
  isDeferred?: boolean;
  verificationRequired?: boolean;
}

export interface DonorEligibilityAssessment {
  isEligible: boolean;
  reasons: string[];
  verificationStatus: 'Unverified' | 'Pending Verification' | 'Verified' | 'Rejected' | 'Needs More Info';
  isVerified: boolean;
  verificationRequired: boolean;
  bloodGroup: string;
  weightKg: number;
  lastDonationDate: string | null;
  daysSinceLastDonation: number | null;
  wholeBlood: ComponentEligibilityResult;
  platelets: ComponentEligibilityResult;
  deferralReason?: string;
  nextAction: string;
  disclaimer: string;
}

/**
 * Authoritative LifeLink Donor Eligibility Calculation Engine
 * 
 * Rules:
 * 1. Verification is a mandatory precondition: Unverified, Pending, or Needs More Info donors are NEVER eligible.
 * 2. Weight clearance: Donor weight must be at least 50 kg.
 * 3. Cooldown window: 56 days for Whole Blood, 14 days for Platelet Apheresis from last donation.
 * 4. Clinical pre-screening: Medical flags require review and prevent automated clearance.
 */
export function calculateDonorEligibility(donor: DonorProfile, now: Date = new Date()): DonorEligibilityAssessment {
  // 1. Determine Authoritative Verification Status
  let verificationStatus: 'Unverified' | 'Pending Verification' | 'Verified' | 'Rejected' | 'Needs More Info' = 'Unverified';

  if (donor.verificationStatus) {
    verificationStatus = donor.verificationStatus as any;
  } else if (donor.bloodGroupVerificationStatus) {
    verificationStatus = donor.bloodGroupVerificationStatus as any;
  } else if (donor.totalDonationsCount && donor.totalDonationsCount > 0) {
    // Existing donors with established donation history records default to verified if status not set
    verificationStatus = 'Verified';
  } else {
    verificationStatus = 'Unverified';
  }

  const isVerified = verificationStatus === 'Verified';

  // 2. Weight Clearance (min 50 kg)
  const weight = Number(donor.weightKg) || 0;
  let weightDeferral: string | null = null;
  if (weight > 0 && weight < MIN_DONOR_WEIGHT_KG) {
    weightDeferral = `Weight (${weight} kg) must be at least ${MIN_DONOR_WEIGHT_KG} kg for blood donation.`;
  } else if (weight === 0) {
    weightDeferral = 'Weight information required for clinical eligibility assessment.';
  }

  // 3. Medical Pre-Screening Flag Check
  let medicalDeferral: string | null = null;
  const prescreening = (donor as any).prescreeningResult;
  if (prescreening && prescreening.isCleared === false) {
    medicalDeferral = prescreening.reason || 'Medical pre-screening flags require review by donation center personnel.';
  }

  // 4. Determine Last Donation Date from donor record or recorded collections
  let lastDonation: string | null = donor.lastDonationDate || null;
  if (!lastDonation) {
    const donorCollections = db.bloodCollections.filter(c => c.donorId === donor.id && c.collectionDate);
    if (donorCollections.length > 0) {
      const validDates = donorCollections
        .map(c => c.collectionDate)
        .filter(d => Boolean(d) && new Date(d).getTime() <= now.getTime())
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      if (validDates.length > 0) {
        lastDonation = validDates[0];
      }
    }
  } else if (new Date(lastDonation).getTime() > now.getTime()) {
    // Sanity check: future dates cannot represent completed donations
    lastDonation = null;
  }

  // 5. Cooldown Calculation
  let daysSinceLastDonation: number | null = null;
  let daysUntilEligibleWb = 0;
  let daysUntilEligiblePlt = 0;
  let nextDateWbStr: string | null = null;
  let nextDatePltStr: string | null = null;
  let isWbCoolOffSatisfied = true;
  let isPltCoolOffSatisfied = true;

  if (lastDonation) {
    const lastDate = new Date(lastDonation);
    if (!isNaN(lastDate.getTime())) {
      const diffMs = Math.max(0, now.getTime() - lastDate.getTime());
      daysSinceLastDonation = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (daysSinceLastDonation < COOL_OFF_DAYS_WHOLE_BLOOD) {
        daysUntilEligibleWb = COOL_OFF_DAYS_WHOLE_BLOOD - daysSinceLastDonation;
        isWbCoolOffSatisfied = false;
        const nextDate = new Date(lastDate.getTime() + COOL_OFF_DAYS_WHOLE_BLOOD * 24 * 60 * 60 * 1000);
        nextDateWbStr = nextDate.toISOString().split('T')[0];
      }

      if (daysSinceLastDonation < COOL_OFF_DAYS_PLATELETS) {
        daysUntilEligiblePlt = COOL_OFF_DAYS_PLATELETS - daysSinceLastDonation;
        isPltCoolOffSatisfied = false;
        const nextDate = new Date(lastDate.getTime() + COOL_OFF_DAYS_PLATELETS * 24 * 60 * 60 * 1000);
        nextDatePltStr = nextDate.toISOString().split('T')[0];
      }
    } else {
      lastDonation = null;
    }
  }

  // 6. Component Eligibility (Strict: requires isVerified && !weightDeferral && !medicalDeferral && coolOffSatisfied)
  const isWbEligible = isVerified && !weightDeferral && !medicalDeferral && isWbCoolOffSatisfied;
  const isPltEligible = isVerified && !weightDeferral && !medicalDeferral && isPltCoolOffSatisfied;
  const isOverallEligible = isWbEligible || isPltEligible;

  // 7. Human-Friendly Next Eligible Dates
  const getNextDateLabel = (isCompEligible: boolean, coolOffSatisfied: boolean, coolOffNextDate: string | null) => {
    if (!isVerified) {
      return verificationStatus === 'Pending Verification' 
        ? 'Verification Pending Review' 
        : verificationStatus === 'Rejected'
        ? 'Verification Rejected'
        : verificationStatus === 'Needs More Info'
        ? 'Additional Information Required'
        : 'Verification Required';
    }
    if (weightDeferral) return 'Deferred - Weight below 50kg';
    if (medicalDeferral) return 'Deferred - Medical Review Required';
    if (!coolOffSatisfied && coolOffNextDate) return coolOffNextDate;
    return 'Eligible Now';
  };

  const wbNextEligibleDate = getNextDateLabel(isWbEligible, isWbCoolOffSatisfied, nextDateWbStr);
  const pltNextEligibleDate = getNextDateLabel(isPltEligible, isPltCoolOffSatisfied, nextDatePltStr);

  // 8. Determine Specific Deferral Reason & Recommended Next Action
  let deferralReason: string | undefined;
  let nextAction: string;

  if (!isVerified) {
    if (verificationStatus === 'Pending Verification') {
      deferralReason = 'Blood group verification document is under review by authorized blood bank staff.';
      nextAction = 'Your proof document is currently being reviewed. Approvals are typically completed within 24-48 hours.';
    } else if (verificationStatus === 'Rejected') {
      deferralReason = (donor as any).rejectionReason || 'Submitted blood group verification document could not be verified.';
      nextAction = 'Please upload a clear official lab report or medical certificate from your profile page.';
    } else if (verificationStatus === 'Needs More Info') {
      deferralReason = `Additional information required (Needs More Info): ${(donor as any).verificationNotes || 'Clearer documentation requested by reviewer'}`;
      nextAction = 'Please review reviewer feedback and upload the requested documentation in My Profile.';
    } else {
      deferralReason = 'Donor verification required. Please submit blood group verification proof to confirm eligibility.';
      nextAction = 'Navigate to your Profile and upload official blood group proof (lab report, government donor card) to complete verification.';
    }
  } else if (weightDeferral) {
    deferralReason = weightDeferral;
    nextAction = 'Donors must meet the minimum clinical weight threshold (50 kg) to donate safely.';
  } else if (medicalDeferral) {
    deferralReason = medicalDeferral;
    nextAction = 'Consult with medical staff at your local donation center regarding your recent health pre-screening answers.';
  } else if (!isWbCoolOffSatisfied && !isPltCoolOffSatisfied) {
    deferralReason = `Within active cool-off period (${daysUntilEligibleWb} days remaining for Whole Blood).`;
    nextAction = `You may donate again starting on ${nextDatePltStr || nextDateWbStr}. Thank you for your continued life-saving support!`;
  } else if (!isWbCoolOffSatisfied && isPltEligible) {
    deferralReason = `Within Whole Blood cool-off period (${daysUntilEligibleWb} days remaining). Platelet apheresis is permitted.`;
    nextAction = 'You are currently eligible for Platelet Apheresis donation.';
  } else {
    deferralReason = undefined;
    nextAction = 'You are medically cleared and verified to donate! Book a donation slot at a nearby blood center or camp.';
  }

  const wbDaysElapsed = daysSinceLastDonation !== null ? Math.min(COOL_OFF_DAYS_WHOLE_BLOOD, daysSinceLastDonation) : COOL_OFF_DAYS_WHOLE_BLOOD;
  const pltDaysElapsed = daysSinceLastDonation !== null ? Math.min(COOL_OFF_DAYS_PLATELETS, daysSinceLastDonation) : COOL_OFF_DAYS_PLATELETS;

  return {
    isEligible: isOverallEligible,
    reasons: deferralReason ? [deferralReason] : [],
    verificationStatus,
    isVerified,
    verificationRequired: !isVerified,
    bloodGroup: donor.bloodGroup || 'O+',
    weightKg: weight,
    lastDonationDate: lastDonation,
    daysSinceLastDonation,
    wholeBlood: {
      componentName: 'Whole Blood',
      coolOffDaysTotal: COOL_OFF_DAYS_WHOLE_BLOOD,
      isEligible: isWbEligible,
      daysRemaining: Math.max(0, daysUntilEligibleWb),
      daysElapsed: wbDaysElapsed,
      nextEligibleDate: wbNextEligibleDate,
      isDeferred: !isWbEligible,
      verificationRequired: !isVerified
    },
    platelets: {
      componentName: 'Platelet Apheresis',
      coolOffDaysTotal: COOL_OFF_DAYS_PLATELETS,
      isEligible: isPltEligible,
      daysRemaining: Math.max(0, daysUntilEligiblePlt),
      daysElapsed: pltDaysElapsed,
      nextEligibleDate: pltNextEligibleDate,
      isDeferred: !isPltEligible,
      verificationRequired: !isVerified
    },
    deferralReason,
    nextAction,
    disclaimer: 'LifeLink provides calculated eligibility guidelines. Final medical clearance, hemoglobin testing, and donor suitability must be performed by authorized medical staff prior to collection.'
  };
}

/**
 * Synchronizes donor in-memory record and persists authoritative eligibility flags.
 */
export function syncDonorAuthoritativeEligibility(donor: DonorProfile, now: Date = new Date()): DonorEligibilityAssessment {
  const assessment = calculateDonorEligibility(donor, now);
  donor.isEligible = assessment.isEligible;
  donor.deferralReason = assessment.deferralReason;
  donor.bloodGroupVerificationStatus = assessment.verificationStatus;
  donor.verificationStatus = assessment.verificationStatus;
  return assessment;
}

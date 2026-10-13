/**
 * Donation Eligibility Engine helper.
 * Computes next eligible dates dynamically from verified donation history and configured policy.
 * - Whole Blood: 56-day cool-off
 * - Platelet Apheresis: 14-day cool-off
 */

export interface ComponentEligibilityPolicy {
  componentName: string;
  coolOffDaysTotal: number;
  isEligible: boolean;
  daysRemaining: number;
  daysElapsed: number;
  progressPct: number;
  nextEligibleDate: string; // ISO date string YYYY-MM-DD
}

export interface DonorEligibilityBreakdown {
  lastDonationDate: string | null;
  wholeBlood: ComponentEligibilityPolicy;
  platelets: ComponentEligibilityPolicy;
  isAnyEligible: boolean;
}

export const WHOLE_BLOOD_COOLDOWN_DAYS = 56;
export const PLATELET_COOLDOWN_DAYS = 14;

export const calculateEligibilityPolicy = (
  lastDonationDateStr: string | null | undefined,
  now: Date = new Date()
): DonorEligibilityBreakdown => {
  if (!lastDonationDateStr || isNaN(new Date(lastDonationDateStr).getTime())) {
    const todayStr = now.toISOString().split('T')[0];
    return {
      lastDonationDate: null,
      wholeBlood: {
        componentName: 'Whole Blood',
        coolOffDaysTotal: WHOLE_BLOOD_COOLDOWN_DAYS,
        isEligible: true,
        daysRemaining: 0,
        daysElapsed: WHOLE_BLOOD_COOLDOWN_DAYS,
        progressPct: 100,
        nextEligibleDate: todayStr
      },
      platelets: {
        componentName: 'Platelet Apheresis',
        coolOffDaysTotal: PLATELET_COOLDOWN_DAYS,
        isEligible: true,
        daysRemaining: 0,
        daysElapsed: PLATELET_COOLDOWN_DAYS,
        progressPct: 100,
        nextEligibleDate: todayStr
      },
      isAnyEligible: true
    };
  }

  const lastDate = new Date(lastDonationDateStr);
  const diffMs = now.getTime() - lastDate.getTime();
  const daysSinceDonation = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  // 1. Whole Blood
  const wbRemaining = Math.max(0, WHOLE_BLOOD_COOLDOWN_DAYS - daysSinceDonation);
  const wbElapsed = Math.min(WHOLE_BLOOD_COOLDOWN_DAYS, daysSinceDonation);
  const wbIsEligible = wbRemaining === 0;
  const wbNextDateObj = new Date(lastDate.getTime() + WHOLE_BLOOD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const wbNextEligibleDate = wbNextDateObj.toISOString().split('T')[0];
  const wbProgressPct = wbIsEligible ? 100 : Math.min(100, Math.round((wbElapsed / WHOLE_BLOOD_COOLDOWN_DAYS) * 100));

  // 2. Platelet Apheresis
  const pltRemaining = Math.max(0, PLATELET_COOLDOWN_DAYS - daysSinceDonation);
  const pltElapsed = Math.min(PLATELET_COOLDOWN_DAYS, daysSinceDonation);
  const pltIsEligible = pltRemaining === 0;
  const pltNextDateObj = new Date(lastDate.getTime() + PLATELET_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const pltNextEligibleDate = pltNextDateObj.toISOString().split('T')[0];
  const pltProgressPct = pltIsEligible ? 100 : Math.min(100, Math.round((pltElapsed / PLATELET_COOLDOWN_DAYS) * 100));

  return {
    lastDonationDate: lastDonationDateStr,
    wholeBlood: {
      componentName: 'Whole Blood',
      coolOffDaysTotal: WHOLE_BLOOD_COOLDOWN_DAYS,
      isEligible: wbIsEligible,
      daysRemaining: wbRemaining,
      daysElapsed: wbElapsed,
      progressPct: wbProgressPct,
      nextEligibleDate: wbNextEligibleDate
    },
    platelets: {
      componentName: 'Platelet Apheresis',
      coolOffDaysTotal: PLATELET_COOLDOWN_DAYS,
      isEligible: pltIsEligible,
      daysRemaining: pltRemaining,
      daysElapsed: pltElapsed,
      progressPct: pltProgressPct,
      nextEligibleDate: pltNextEligibleDate
    },
    isAnyEligible: wbIsEligible || pltIsEligible
  };
};

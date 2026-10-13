/**
 * Authoritative donor donation metrics calculation.
 * Ensures Single Source of Truth derived strictly from the donation history records collection.
 */

export interface DonationRecord {
  donationId: string;
  date?: string;
  bloodBankName?: string;
  bloodGroup?: string;
  component?: string;
  volumeMl?: number | string;
  volume?: number | string;
  status?: string;
  source?: string;
}

export interface AuthoritativeMetrics {
  totalDonations: number;
  totalVolumeMl: number;
  livesImpactedEst: number;
  countableDonations: DonationRecord[];
}

/**
 * Derives lifetime donation metrics from the authoritative history records.
 * Rules:
 * - Excludes cancelled or rejected donations.
 * - Deduplicates records by donationId to avoid counting multiple lifecycle stages.
 * - Safely parses volume and defaults invalid or missing values to 0.
 * - Estimates ~3 lives impacted per successful donation.
 */
export const calculateAuthoritativeMetrics = (
  records: DonationRecord[] | null | undefined
): AuthoritativeMetrics => {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalDonations: 0,
      totalVolumeMl: 0,
      livesImpactedEst: 0,
      countableDonations: []
    };
  }

  const seenIds = new Set<string>();
  const countableDonations: DonationRecord[] = [];

  for (const record of records) {
    if (!record || !record.donationId) continue;

    // Deduplicate by donationId
    if (seenIds.has(record.donationId)) continue;
    seenIds.add(record.donationId);

    // Exclusion filter: non-countable statuses
    const normalizedStatus = String(record.status || '').toLowerCase().trim();
    if (
      normalizedStatus.includes('cancelled') ||
      normalizedStatus.includes('canceled') ||
      normalizedStatus.includes('rejected') ||
      normalizedStatus.includes('failed')
    ) {
      continue;
    }

    countableDonations.push(record);
  }

  const totalDonations = countableDonations.length;

  const totalVolumeMl = countableDonations.reduce((acc, curr) => {
    const rawVol = curr.volumeMl !== undefined ? curr.volumeMl : curr.volume;
    const parsed = Number(rawVol);
    const validVol = !isNaN(parsed) && parsed > 0 ? parsed : 0;
    return acc + validVol;
  }, 0);

  const livesImpactedEst = totalDonations * 3;

  return {
    totalDonations,
    totalVolumeMl,
    livesImpactedEst,
    countableDonations
  };
};

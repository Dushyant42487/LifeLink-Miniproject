/**
 * Profile Completeness and Validation Engine.
 * Evaluates the required fields of the donor profile, ensuring accurate percentage,
 * progress bar consistency, and clear missing-field checklists.
 */

export interface ProfileCompletenessField {
  id: string;
  label: string;
  isComplete: boolean;
  value: any;
  hint: string;
}

export interface ProfileCompletenessResult {
  score: number; // 0 to 100
  totalFields: number;
  completedCount: number;
  missingFields: ProfileCompletenessField[];
  fields: ProfileCompletenessField[];
}

export interface DonorProfileInput {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  weightKg?: number | string;
  travelRadiusKm?: number | string;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
}

export const evaluateProfileCompleteness = (
  profile: DonorProfileInput | null | undefined
): ProfileCompletenessResult => {
  if (!profile) {
    return {
      score: 0,
      totalFields: 9,
      completedCount: 0,
      missingFields: [],
      fields: []
    };
  }

  const name = String(profile.name || '').trim();
  const phone = String(profile.phone || '').trim();
  const address = String(profile.address || '').trim();
  const city = String(profile.city || '').trim();
  const state = String(profile.state || '').trim();
  const weight = Number(profile.weightKg);
  const radius = Number(profile.travelRadiusKm);
  const emergName = String(profile.emergencyContact?.name || '').trim();
  const emergPhone = String(profile.emergencyContact?.phone || '').trim();

  const phoneDigits = phone.replace(/\D/g, '');
  const emergPhoneDigits = emergPhone.replace(/\D/g, '');

  const fields: ProfileCompletenessField[] = [
    {
      id: 'name',
      label: 'Full Name',
      isComplete: name.length >= 2,
      value: name,
      hint: 'Provide legal full name'
    },
    {
      id: 'phone',
      label: 'Contact Phone Number',
      isComplete: phoneDigits.length >= 7,
      value: phone,
      hint: 'Provide valid phone number'
    },
    {
      id: 'address',
      label: 'Street Address',
      isComplete: address.length >= 3,
      value: address,
      hint: 'Provide street address'
    },
    {
      id: 'city',
      label: 'City',
      isComplete: city.length >= 2,
      value: city,
      hint: 'Provide residential city'
    },
    {
      id: 'state',
      label: 'State / Province',
      isComplete: state.length >= 2,
      value: state,
      hint: 'Provide state or province'
    },
    {
      id: 'weightKg',
      label: 'Body Weight (45–200 kg)',
      isComplete: !isNaN(weight) && weight >= 45 && weight <= 200,
      value: profile.weightKg,
      hint: 'Donor weight must be between 45 and 200 kg'
    },
    {
      id: 'travelRadiusKm',
      label: 'Service Radius (km)',
      isComplete: !isNaN(radius) && radius >= 1,
      value: profile.travelRadiusKm,
      hint: 'Set minimum notification radius (≥ 1 km)'
    },
    {
      id: 'emergName',
      label: 'Emergency Contact Name',
      isComplete: emergName.length >= 2,
      value: emergName,
      hint: 'Provide contact name for emergency'
    },
    {
      id: 'emergPhone',
      label: 'Emergency Contact Phone',
      isComplete: emergPhoneDigits.length >= 7,
      value: emergPhone,
      hint: 'Provide contact phone number'
    }
  ];

  const completedCount = fields.filter(f => f.isComplete).length;
  const totalFields = fields.length;
  const score = Math.round((completedCount / totalFields) * 100);
  const missingFields = fields.filter(f => !f.isComplete);

  return {
    score,
    totalFields,
    completedCount,
    missingFields,
    fields
  };
};

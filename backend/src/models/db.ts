import '../env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db as inMemoryDb } from './store';
import { BloodGroup, BloodComponent, TestingStatus, AvailabilityStatus, UserRole, RequestUrgency, RequestStatus } from './types';
import { syncDonorAuthoritativeEligibility } from '../services/donorEligibilityService';

function isValidHttpUrl(urlString?: string): boolean {
  if (!urlString || urlString.startsWith('YOUR_') || urlString.includes('...')) {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const rawUrl = process.env.SUPABASE_URL?.trim();
const rawKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

const isUrlValid = isValidHttpUrl(rawUrl);
const isKeyValid = Boolean(rawKey && !rawKey.startsWith('YOUR_') && !rawKey.includes('...'));

let supabaseClient: SupabaseClient;

if (isUrlValid && isKeyValid && rawUrl && rawKey) {
  supabaseClient = createClient(rawUrl, rawKey);
} else {
  if (!isUrlValid) {
    console.warn('[Database] SUPABASE_URL is missing or invalid in environment variables. Expected a valid HTTP or HTTPS URL.');
  }
  if (!isKeyValid) {
    console.warn('[Database] SUPABASE_SECRET_KEY is missing in environment variables.');
  }
  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
}
export const supabase = supabaseClient;
export const isSupabaseReal = isUrlValid && isKeyValid;

// Authoritative Postgres column allowlists for all 5 core Supabase tables
export const TABLE_COLUMNS: Record<string, string[]> = {
  donors: [
    'id', 'email', 'passwordHash', 'role', 'name', 'phone', 'createdAt', 'avatarUrl',
    'bloodGroup', 'dob', 'gender', 'address', 'city', 'state', 'emergencyContact',
    'lastDonationDate', 'weightKg', 'isEligible', 'deferralReason', 'totalDonationsCount',
    'totalVolumeMl', 'notificationPreferences'
  ],
  hospitals: [
    'id', 'email', 'passwordHash', 'role', 'name', 'phone', 'createdAt', 'avatarUrl',
    'hospitalName', 'licenseId', 'verificationStatus', 'address', 'city', 'state',
    'contactPerson', 'emergencyPhone', 'latitude', 'longitude'
  ],
  blood_banks: [
    'id', 'email', 'passwordHash', 'role', 'name', 'phone', 'createdAt', 'avatarUrl',
    'bloodBankName', 'registrationId', 'contactPerson', 'address', 'city', 'state',
    'emergencyPhone', 'latitude', 'longitude'
  ],
  blood_units: [
    'id', 'bloodBankId', 'bloodBankName', 'donorId', 'donorCode', 'bloodGroup',
    'component', 'volumeMl', 'collectionDate', 'expiryDate', 'testingStatus',
    'availability', 'storageLocation', 'source', 'reservedForRequestId', 'notes', 'createdAt'
  ],
  blood_requests: [
    'id', 'hospitalId', 'hospitalName', 'bloodBankId', 'bloodBankName', 'bloodGroup',
    'component', 'quantityUnits', 'fulfilledUnits', 'urgency', 'patientReferenceId',
    'department', 'requiredByDate', 'status', 'assignedUnitIds', 'notes', 'createdAt',
    'updatedAt', 'timeline'
  ]
};

export function sanitizeRecord(tableName: string, record: any): any {
  const allowed = TABLE_COLUMNS[tableName];
  if (!allowed || !record) return record;
  const sanitized: Record<string, any> = {};
  for (const col of allowed) {
    if (record[col] !== undefined) {
      sanitized[col] = record[col];
    }
  }

  // Ensure mandatory defaults for donors relation in Supabase
  if (tableName === 'donors') {
    if (!sanitized.dob) sanitized.dob = '2000-01-01';
    if (!sanitized.gender) sanitized.gender = 'Unspecified';
    if (!sanitized.bloodGroup) sanitized.bloodGroup = 'Unspecified';
    if (sanitized.isEligible === undefined) sanitized.isEligible = false;
    if (sanitized.totalDonationsCount === undefined) sanitized.totalDonationsCount = 0;
    if (sanitized.totalVolumeMl === undefined) sanitized.totalVolumeMl = 0;
  }

  // Do not silently inject fake coordinates for blood banks or hospitals; preserve genuine undefined status
  if (tableName === 'blood_banks' || tableName === 'hospitals') {
    if (sanitized.latitude !== undefined && sanitized.latitude !== null) {
      sanitized.latitude = Number(sanitized.latitude);
    }
    if (sanitized.longitude !== undefined && sanitized.longitude !== null) {
      sanitized.longitude = Number(sanitized.longitude);
    }
  }

  if (!sanitized.createdAt) {
    sanitized.createdAt = new Date().toISOString();
  }
  return sanitized;
}

export function sanitizeRecords(tableName: string, records: any[]): any[] {
  if (!Array.isArray(records)) return [];
  return records.map(r => sanitizeRecord(tableName, r));
}

export async function persistRecordDirect(
  tableName: 'donors' | 'hospitals' | 'blood_banks' | 'blood_units' | 'blood_requests',
  record: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseReal) {
    return { success: false, error: 'Supabase credentials not configured' };
  }
  try {
    const sanitized = sanitizeRecord(tableName, record);
    const { data, error } = await supabase.from(tableName).upsert(sanitized);
    if (error) {
      console.error(`[Supabase Direct Persist Error (${tableName})]:`, error.message, error.details);
      return { success: false, error: error.message };
    }
    console.log(`[Supabase Direct Persist Success (${tableName})]: Persisted record id ${record.id}`);
    return { success: true, data };
  } catch (err: any) {
    console.error(`[Supabase Direct Persist Exception (${tableName})]:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function syncMutationToSupabase(
  targetTable?: 'donors' | 'hospitals' | 'blood_banks' | 'blood_units' | 'blood_requests'
) {
  if (!isSupabaseReal) return;
  const tables = targetTable
    ? [targetTable]
    : (['blood_units', 'blood_requests', 'donors', 'hospitals', 'blood_banks'] as const);

  for (const tbl of tables) {
    try {
      let items: any[] = [];
      if (tbl === 'donors') items = inMemoryDb.donors;
      else if (tbl === 'hospitals') items = inMemoryDb.hospitals;
      else if (tbl === 'blood_banks') items = inMemoryDb.bloodBanks;
      else if (tbl === 'blood_units') items = inMemoryDb.bloodUnits;
      else if (tbl === 'blood_requests') items = inMemoryDb.bloodRequests;

      if (items && items.length > 0) {
        const sanitized = sanitizeRecords(tbl, items);
        const { error } = await supabase.from(tbl).upsert(sanitized);
        if (error) {
          console.error(`[Supabase Mutation Sync Error (${tbl})]:`, error.message);
        }
      }
    } catch (err: any) {
      console.error(`[Supabase Mutation Sync Exception (${tbl})]:`, err.message);
    }
  }
}

export let isSyncPaused = false;
export const setSyncPaused = (paused: boolean) => {
  isSyncPaused = paused;
};

let lastSyncTimestamp = 0;
const SYNC_THROTTLE_MS = 15000; // 15-second throttle to eliminate 5-second per-request overhead

export const safeSupabaseSync = async (force: boolean = false) => {
  if (!isSupabaseReal || isSyncPaused) return;
  const nowMs = Date.now();
  if (!force && nowMs - lastSyncTimestamp < SYNC_THROTTLE_MS) {
    return;
  }
  lastSyncTimestamp = nowMs;

  try {
    const syncPromise = (async () => {
      const [buRes, brRes, donRes, hospRes, bbRes] = await Promise.all([
        supabase.from('blood_units').select('*'),
        supabase.from('blood_requests').select('*'),
        supabase.from('donors').select('*'),
        supabase.from('hospitals').select('*'),
        supabase.from('blood_banks').select('*')
      ]);

      if (donRes.data && donRes.data.length > 0) {
        for (const remoteDonor of donRes.data) {
          const idx = inMemoryDb.donors.findIndex(d => d.id === remoteDonor.id);
          if (idx >= 0) {
            const local = inMemoryDb.donors[idx];
            inMemoryDb.donors[idx] = {
              ...local,
              ...remoteDonor,
              name: remoteDonor.name || local.name,
              address: remoteDonor.address !== undefined ? remoteDonor.address : local.address,
              city: remoteDonor.city !== undefined ? remoteDonor.city : local.city,
              state: remoteDonor.state !== undefined ? remoteDonor.state : local.state,
              postalCode: remoteDonor.postalCode !== undefined ? remoteDonor.postalCode : local.postalCode,
              latitude: remoteDonor.latitude !== undefined && remoteDonor.latitude !== null ? Number(remoteDonor.latitude) : local.latitude,
              longitude: remoteDonor.longitude !== undefined && remoteDonor.longitude !== null ? Number(remoteDonor.longitude) : local.longitude,
              travelRadiusKm: remoteDonor.travelRadiusKm !== undefined ? remoteDonor.travelRadiusKm : local.travelRadiusKm,
              assignedBloodBankId: remoteDonor.assignedBloodBankId || local.assignedBloodBankId,
              assignedBloodBankName: remoteDonor.assignedBloodBankName || local.assignedBloodBankName,
              preferredBloodBankId: remoteDonor.preferredBloodBankId || local.preferredBloodBankId,
              preferredBloodBankName: remoteDonor.preferredBloodBankName || local.preferredBloodBankName,
              verificationSubmittedAt: remoteDonor.verificationSubmittedAt || local.verificationSubmittedAt,
              verificationDecisionAt: remoteDonor.verificationDecisionAt || local.verificationDecisionAt,
              verificationNotes: remoteDonor.verificationNotes !== undefined ? remoteDonor.verificationNotes : local.verificationNotes,
              rejectionReason: remoteDonor.rejectionReason !== undefined ? remoteDonor.rejectionReason : local.rejectionReason,
              bloodGroupVerificationStatus: remoteDonor.bloodGroupVerificationStatus || local.bloodGroupVerificationStatus || 'Unverified',
              verificationStatus: remoteDonor.verificationStatus || local.verificationStatus || 'Unverified',
              verifiedAt: remoteDonor.verifiedAt || local.verifiedAt,
              verifiedBy: remoteDonor.verifiedBy || local.verifiedBy,
              verifiedByName: remoteDonor.verifiedByName || local.verifiedByName,
              proofDocument: (local as any).proofDocument,
              weightKg: remoteDonor.weightKg ?? local.weightKg,
              isEligible: remoteDonor.isEligible !== undefined ? remoteDonor.isEligible : local.isEligible
            };
            syncDonorAuthoritativeEligibility(inMemoryDb.donors[idx]);
          } else {
            const newDonor = {
              ...remoteDonor,
              bloodGroupVerificationStatus: (remoteDonor as any).bloodGroupVerificationStatus || 'Unverified',
              verificationStatus: (remoteDonor as any).verificationStatus || 'Unverified'
            };
            syncDonorAuthoritativeEligibility(newDonor);
            inMemoryDb.donors.push(newDonor as any);
          }
        }
      }

      if (hospRes.data && hospRes.data.length > 0) {
        for (const remoteHosp of hospRes.data) {
          const idx = inMemoryDb.hospitals.findIndex(h => h.id === remoteHosp.id);
          const chosenLat = remoteHosp.latitude !== undefined && remoteHosp.latitude !== null ? Number(remoteHosp.latitude) : undefined;
          const chosenLng = remoteHosp.longitude !== undefined && remoteHosp.longitude !== null ? Number(remoteHosp.longitude) : undefined;

          if (idx >= 0) {
            const local = inMemoryDb.hospitals[idx];
            inMemoryDb.hospitals[idx] = {
              ...local,
              ...remoteHosp,
              hospitalName: remoteHosp.hospitalName || remoteHosp.name || local.hospitalName || local.name,
              name: remoteHosp.hospitalName || remoteHosp.name || local.name,
              address: remoteHosp.address !== undefined ? remoteHosp.address : local.address,
              city: remoteHosp.city !== undefined ? remoteHosp.city : local.city,
              state: remoteHosp.state !== undefined ? remoteHosp.state : local.state,
              latitude: chosenLat !== undefined ? chosenLat : local.latitude,
              longitude: chosenLng !== undefined ? chosenLng : local.longitude,
              verificationStatus: remoteHosp.verificationStatus || local.verificationStatus || 'Pending Verification'
            };
          } else {
            inMemoryDb.hospitals.push({
              ...remoteHosp,
              latitude: chosenLat,
              longitude: chosenLng,
              verificationStatus: remoteHosp.verificationStatus || 'Pending Verification'
            });
          }
        }
      }

      if (bbRes.data && bbRes.data.length > 0) {
        for (const remoteBb of bbRes.data) {
          const idx = inMemoryDb.bloodBanks.findIndex(b => b.id === remoteBb.id);
          const chosenLat = remoteBb.latitude !== undefined && remoteBb.latitude !== null ? Number(remoteBb.latitude) : undefined;
          const chosenLng = remoteBb.longitude !== undefined && remoteBb.longitude !== null ? Number(remoteBb.longitude) : undefined;

          if (idx >= 0) {
            const local = inMemoryDb.bloodBanks[idx];
            inMemoryDb.bloodBanks[idx] = {
              ...local,
              ...remoteBb,
              bloodBankName: remoteBb.bloodBankName || remoteBb.name || local.bloodBankName || local.name,
              name: remoteBb.bloodBankName || remoteBb.name || local.name,
              address: remoteBb.address !== undefined ? remoteBb.address : local.address,
              city: remoteBb.city !== undefined ? remoteBb.city : local.city,
              state: remoteBb.state !== undefined ? remoteBb.state : local.state,
              latitude: chosenLat !== undefined ? chosenLat : local.latitude,
              longitude: chosenLng !== undefined ? chosenLng : local.longitude,
              isActive: remoteBb.isActive !== undefined ? remoteBb.isActive : (local.isActive !== undefined ? local.isActive : true),
              verificationStatus: remoteBb.verificationStatus || local.verificationStatus || 'Verified'
            };
          } else {
            inMemoryDb.bloodBanks.push({
              ...remoteBb,
              latitude: chosenLat,
              longitude: chosenLng,
              isActive: remoteBb.isActive !== undefined ? remoteBb.isActive : true,
              verificationStatus: remoteBb.verificationStatus || 'Verified'
            });
          }
        }
      }

      if (buRes.data && buRes.data.length > 0) {
        for (const remoteUnit of buRes.data) {
          const idx = inMemoryDb.bloodUnits.findIndex(u => u.id === remoteUnit.id);
          if (idx >= 0) {
            const local = inMemoryDb.bloodUnits[idx];
            inMemoryDb.bloodUnits[idx] = {
              ...local,
              ...remoteUnit,
              availability: remoteUnit.availability || local.availability,
              testingStatus: remoteUnit.testingStatus || local.testingStatus,
              reservedForRequestId: remoteUnit.reservedForRequestId !== undefined ? remoteUnit.reservedForRequestId : local.reservedForRequestId
            };
          } else {
            inMemoryDb.bloodUnits.push(remoteUnit);
          }
        }
      }

      if (brRes.data && brRes.data.length > 0) {
        for (const remoteReq of brRes.data) {
          const idx = inMemoryDb.bloodRequests.findIndex(r => r.id === remoteReq.id);
          if (idx >= 0) {
            const local = inMemoryDb.bloodRequests[idx];
            inMemoryDb.bloodRequests[idx] = {
              ...local,
              ...remoteReq,
              status: remoteReq.status || local.status,
              fulfilledUnits: remoteReq.fulfilledUnits !== undefined ? remoteReq.fulfilledUnits : local.fulfilledUnits,
              assignedUnitIds: remoteReq.assignedUnitIds || local.assignedUnitIds,
              timeline: remoteReq.timeline || local.timeline,
              routedBankOffers: local.routedBankOffers || remoteReq.routedBankOffers
            };
          } else {
            inMemoryDb.bloodRequests.push(remoteReq);
          }
        }
      }
    })();

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));
    await Promise.race([syncPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn('[Supabase Sync Notice]:', err?.message || err);
  }
};

// Mocking models to preserve existing backwards compatibility in imports elsewhere
export const UserModel = {};
export const BloodUnitModel = {
  countDocuments: async () => {
    const { count } = await supabase.from('blood_units').select('*', { count: 'exact', head: true });
    return count || 0;
  },
  insertMany: async (data: any) => supabase.from('blood_units').insert(data)
};
export const BloodRequestModel = {
  insertMany: async (data: any) => supabase.from('blood_requests').insert(data)
};

// Connection Manager with Fallback & Auto-Seeding
let isSupabaseConnected = false;

export const connectDatabase = async () => {
  try {
    const { data: testData, error: testError } = await supabase.from('blood_units').select('id').limit(1);

    if (testError && (testError.code === '42P01' || testError.code === 'PGRST106' || testError.message.includes('Could not find the table'))) {
      console.warn(`[Database] Supabase connected, but 'blood_units' table is not in the schema cache or does not exist. (1) Ensure you ran the SQL script in the SQL Editor. (2) Try running "NOTIFY pgrst, 'reload schema';" in the Supabase SQL editor to force a cache refresh.`);
      isSupabaseConnected = true; 
    } else if (testError) {
      throw new Error(testError.message);
    } else {
      isSupabaseConnected = true;
      console.log(`[Database] Connected to Supabase at ${rawUrl}`);
      // Perform initial hydration sync from Supabase into memory
      await safeSupabaseSync();
    }
  } catch (err: any) {
    isSupabaseConnected = false;
    console.warn(`[Database] Supabase connection unavailable (${err.message}). Using high-performance in-memory DataStore.`);
  }
};

export const getIsMongoConnected = () => isSupabaseConnected;
export const getIsSupabaseConnected = () => isSupabaseConnected;

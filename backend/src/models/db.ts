import '../env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db as inMemoryDb } from './store';
import { BloodGroup, BloodComponent, TestingStatus, AvailabilityStatus, UserRole, RequestUrgency, RequestStatus } from './types';

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
    if (!sanitized.bloodGroup) sanitized.bloodGroup = 'O+';
    if (sanitized.isEligible === undefined) sanitized.isEligible = true;
    if (sanitized.totalDonationsCount === undefined) sanitized.totalDonationsCount = 0;
    if (sanitized.totalVolumeMl === undefined) sanitized.totalVolumeMl = 0;
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

export const safeSupabaseSync = async () => {
  if (!isSupabaseReal) return;
  try {
    const syncPromise = (async () => {
      const [buRes, brRes, donRes, hospRes, bbRes] = await Promise.all([
        supabase.from('blood_units').select('*'),
        supabase.from('blood_requests').select('*'),
        supabase.from('donors').select('*'),
        supabase.from('hospitals').select('*'),
        supabase.from('blood_banks').select('*')
      ]);

      if (buRes.data && buRes.data.length > 0) inMemoryDb.bloodUnits = buRes.data;
      if (brRes.data && brRes.data.length > 0) inMemoryDb.bloodRequests = brRes.data;
      if (donRes.data && donRes.data.length > 0) inMemoryDb.donors = donRes.data;
      if (hospRes.data && hospRes.data.length > 0) inMemoryDb.hospitals = hospRes.data;
      if (bbRes.data && bbRes.data.length > 0) inMemoryDb.bloodBanks = bbRes.data;
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

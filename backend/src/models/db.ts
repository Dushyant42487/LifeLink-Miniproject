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

export const safeSupabaseSync = async () => {
  if (!isSupabaseReal) return;
  try {
    const syncPromise = (async () => {
      const { data: __bu } = await supabase.from('blood_units').select('*');
      if (__bu && __bu.length > 0) inMemoryDb.bloodUnits = __bu;
      const { data: __br } = await supabase.from('blood_requests').select('*');
      if (__br && __br.length > 0) inMemoryDb.bloodRequests = __br;
      const { data: __don } = await supabase.from('donors').select('*');
      if (__don && __don.length > 0) inMemoryDb.donors = __don;
      const { data: __hosp } = await supabase.from('hospitals').select('*');
      if (__hosp && __hosp.length > 0) inMemoryDb.hospitals = __hosp;
      const { data: __bb } = await supabase.from('blood_banks').select('*');
      if (__bb && __bb.length > 0) inMemoryDb.bloodBanks = __bb;
    })();

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000));
    await Promise.race([syncPromise, timeoutPromise]);
  } catch (err) {
    // Ignore network timeouts and fallback seamlessly to in-memory DataStore
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
    // Test connection by fetching 1 row
    const { data: testData, error: testError } = await supabase.from('blood_units').select('id').limit(1);

    if (testError && (testError.code === '42P01' || testError.code === 'PGRST106' || testError.message.includes('Could not find the table'))) {
      console.warn(`[Database] Supabase connected, but 'blood_units' table is not in the schema cache or does not exist. (1) Ensure you ran the SQL script in the SQL Editor. (2) Try running "NOTIFY pgrst, 'reload schema';" in the Supabase SQL editor to force a cache refresh.`);
      // We will intentionally NOT throw here so that the app starts up, but it will use inMemory data since tables aren't ready
      isSupabaseConnected = true; 
    } else if (testError) {
      throw new Error(testError.message);
    } else {
      isSupabaseConnected = true;
      console.log(`[Database] Connected to Supabase at ${rawUrl}`);
    }
  } catch (err: any) {
    isSupabaseConnected = false;
    console.warn(`[Database] Supabase connection unavailable (${err.message}). Using high-performance in-memory DataStore.`);
  }
};

export const getIsMongoConnected = () => isSupabaseConnected;
export const getIsSupabaseConnected = () => isSupabaseConnected;

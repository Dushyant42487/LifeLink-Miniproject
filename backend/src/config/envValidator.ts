import fs from 'fs';
import path from 'path';

export interface EnvValidationResult {
  isValid: boolean;
  isProduction: boolean;
  jwtSecret: string;
  port: number;
  corsAllowedOrigins: string[];
  isDurableStorageConfigured: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validates critical environment configuration at server boot time.
 * In production mode, fails fast if critical secrets or configs are missing or insecure.
 */
export function validateEnvironment(): EnvValidationResult {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase().trim();
  const isProduction = nodeEnv === 'production';
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Port Validation
  const rawPort = process.env.PORT || '5001';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT configuration: "${rawPort}". Must be an integer between 1 and 65535.`);
  }

  // 2. JWT Secret Validation
  const rawJwtSecret = process.env.JWT_SECRET?.trim();
  const defaultInsecureSecret = 'lifelink-secret-key-2026-secure';
  let jwtSecret = rawJwtSecret || defaultInsecureSecret;

  if (isProduction) {
    if (!rawJwtSecret) {
      errors.push('CRITICAL: JWT_SECRET environment variable is missing in production mode.');
    } else if (rawJwtSecret === defaultInsecureSecret) {
      errors.push('CRITICAL: JWT_SECRET is set to the default insecure development string in production mode.');
    } else if (rawJwtSecret.length < 32) {
      errors.push('CRITICAL: JWT_SECRET in production must be at least 32 characters in length for cryptographic security.');
    }
  } else {
    if (!rawJwtSecret || rawJwtSecret === defaultInsecureSecret) {
      warnings.push('[Security Notice] Using default development JWT_SECRET. Must be changed for production deployments.');
    }
  }

  // 3. CORS Allowed Origins
  const rawCors = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN;
  let corsAllowedOrigins: string[] = [];

  const defaultLocalOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

  if (rawCors) {
    corsAllowedOrigins = rawCors
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    // In development mode, ensure standard local dev origins are permitted if not wildcard
    if (!isProduction && !corsAllowedOrigins.includes('*')) {
      for (const origin of defaultLocalOrigins) {
        if (!corsAllowedOrigins.includes(origin)) {
          corsAllowedOrigins.push(origin);
        }
      }
    }
  } else if (!isProduction) {
    // Default to wildcard for local development
    corsAllowedOrigins = ['*'];
  } else {
    warnings.push('[Security Warning] CORS_ALLOWED_ORIGINS is not set in production. Defaulting to strict same-origin.');
    corsAllowedOrigins = [];
  }

  // 4. Storage & Persistence Validation
  const rawSupabaseUrl = process.env.SUPABASE_URL?.trim();
  const rawSupabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const isSupabaseConfigured = Boolean(
    rawSupabaseUrl &&
    rawSupabaseKey &&
    !rawSupabaseUrl.startsWith('YOUR_') &&
    !rawSupabaseKey.startsWith('YOUR_') &&
    !rawSupabaseUrl.includes('placeholder')
  );

  if (!isSupabaseConfigured) {
    const msg = '[Storage Architecture] Supabase durable storage credentials not configured. Server will operate on in-memory DataStore (changes will reset on restart).';
    if (isProduction) {
      warnings.push(`PRODUCTION ALERT: ${msg}`);
    } else {
      warnings.push(msg);
    }
  }

  // Log warnings to standard error/out
  warnings.forEach(w => console.warn(w));

  if (errors.length > 0) {
    console.error('========================================================');
    console.error('FATAL: Environment validation failed with the following errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('========================================================');
    if (isProduction) {
      throw new Error(`Environment validation failed with ${errors.length} error(s). Server boot aborted.`);
    }
  }

  return {
    isValid: errors.length === 0,
    isProduction,
    jwtSecret,
    port,
    corsAllowedOrigins,
    isDurableStorageConfigured: isSupabaseConfigured,
    warnings,
    errors
  };
}

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Ensures environment variables are reliably loaded from the project root (.env)
 * or backend directory before any other modules initialize.
 */
const loadEnv = (): void => {
  // __dirname in backend/src/env.ts -> /Users/.../LifeLinkmo/backend/src
  const rootEnvPath = path.resolve(__dirname, '../../.env');
  const backendEnvPath = path.resolve(__dirname, '../.env');

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath, override: true });
  } else if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath, override: true });
  } else {
    dotenv.config({ override: true });
  }
};

loadEnv();

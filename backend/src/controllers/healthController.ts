import { Request, Response } from 'express';
import { db } from '../models/store';
import { isSupabaseReal, getIsSupabaseConnected } from '../models/db';

const START_TIME = Date.now();

export const getHealth = async (req: Request, res: Response) => {
  const isSupabaseConn = getIsSupabaseConnected();
  const memUsage = process.memoryUsage();

  const isDurable = isSupabaseReal && isSupabaseConn;
  const status = isDurable ? 'healthy' : 'degraded';

  const healthData = {
    status,
    service: 'LifeLink Central API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    storage: {
      mode: isDurable ? 'supabase_durable' : 'in_memory_datastore_fallback',
      isDurablePersistence: isDurable,
      durableDatabaseConnected: isSupabaseConn,
      notice: isDurable
        ? 'Durable relational storage active and operational.'
        : 'Running on in-memory DataStore. Data does not persist across process restarts.'
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMb: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024)
      }
    },
    registryEntityCounts: {
      bloodUnits: db.bloodUnits.length,
      bloodRequests: db.bloodRequests.length,
      bloodDispatches: (db.bloodDispatches || []).length,
      donors: db.donors.length,
      hospitals: db.hospitals.length,
      bloodBanks: db.bloodBanks.length
    }
  };

  // 200 OK even if running in degraded mode so orchestrator knows process is alive and responsive
  res.status(200).json(healthData);
};

export const getLiveness = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
};

export const getReadiness = (req: Request, res: Response) => {
  // If in production and durable storage is strictly required, could check isDurable
  // Here we check if the in-memory or database store is initialized
  const isReady = db && db.bloodUnits && db.bloodUnits.length > 0;

  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      error: 'Data registry is not yet initialized.',
      timestamp: new Date().toISOString()
    });
  }
};

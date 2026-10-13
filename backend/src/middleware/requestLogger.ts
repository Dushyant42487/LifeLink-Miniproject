import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface TraceableRequest extends Request {
  id?: string;
  startTime?: number;
}

/**
 * Redacts sensitive credentials, tokens, and patient identifiable data from logs.
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeLogData);

  const sensitiveKeys = [
    'password',
    'passwordhash',
    'token',
    'jwt',
    'secret',
    'authorization',
    'cookie',
    'patientreferenceid',
    'phone',
    'email'
  ];

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Structured, privacy-preserving HTTP request logger middleware.
 */
export const requestLogger = (req: TraceableRequest, res: Response, next: NextFunction) => {
  // Generate or propagate correlation request ID
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId || crypto.randomUUID();
  req.id = requestId;
  req.startTime = Date.now();

  res.setHeader('X-Request-Id', requestId);

  // Hook into response finish event
  res.on('finish', () => {
    const durationMs = Date.now() - (req.startTime || Date.now());
    const statusCode = res.statusCode;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Color code log level based on status code
    const isError = statusCode >= 500;
    const isWarn = statusCode >= 400 && statusCode < 500;

    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs,
      clientIp,
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    if (isError) {
      console.error(`[API ERROR] ${JSON.stringify(logEntry)}`);
    } else if (isWarn) {
      console.warn(`[API WARN] ${JSON.stringify(logEntry)}`);
    } else {
      // In production, avoid noisy log flooding on health checks
      if (!req.url.startsWith('/api/health') && !req.url.startsWith('/health')) {
        console.log(`[API INFO] ${JSON.stringify(logEntry)}`);
      }
    }
  });

  next();
};

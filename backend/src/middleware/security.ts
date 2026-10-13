import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

export function createSecurityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*"],
        connectSrc: ["'self'", "https://*"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

export function createCorsMiddleware(allowedOrigins: string[]) {
  const isWildcardAllowed = allowedOrigins.length === 0 || allowedOrigins.includes('*');

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (isWildcardAllowed || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check subdomains if configured
      const isSubdomain = allowedOrigins.some(ao => {
        try {
          const aoHost = new URL(ao).hostname;
          const originHost = new URL(origin).hostname;
          return originHost === aoHost || originHost.endsWith(`.${aoHost}`);
        } catch {
          return false;
        }
      });

      if (isSubdomain) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} is not allowed by LifeLink CORS policy.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    credentials: true,
    maxAge: 86400 // 24 hours preflight cache
  };

  return cors(corsOptions);
}

/**
 * Strict Rate Limiter for Authentication Endpoints (Brute-force / Credential Stuffing Protection)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 1000, // 30 in production, high in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
    statusCode: 429
  }
});

/**
 * Sensitive Mutation Rate Limiter (Denial of Service / Rapid Mutation Flooding Protection)
 */
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 mutations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded for state mutations. Please wait before retrying.',
    statusCode: 429
  }
});

/**
 * General API Rate Limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'API rate limit exceeded. Please throttle request frequency.',
    statusCode: 429
  }
});

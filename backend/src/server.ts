import './env';
import express from 'express';
import { validateEnvironment } from './config/envValidator';
import { createSecurityHeaders, createCorsMiddleware, apiRateLimiter } from './middleware/security';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import donorRoutes from './routes/donorRoutes';
import bloodBankRoutes from './routes/bloodBankRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import aiRoutes from './routes/aiRoutes';
import publicRoutes from './routes/publicRoutes';
import testRoutes from './routes/testRoutes';
import { connectDatabase, supabase, safeSupabaseSync, syncMutationToSupabase } from './models/db';
import { db } from './models/store';

// 1. Startup Environment & Security Validation
const envConfig = validateEnvironment();
const PORT = envConfig.port;

const app = express();

// 2. Reverse Proxy & IP Resolution (Cloudflare, AWS ALB, Nginx, Render)
app.set('trust proxy', 1);

// 3. HTTP Security Headers (Helmet CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
app.use(createSecurityHeaders());

// 4. Strict CORS Allowlist
app.use(createCorsMiddleware(envConfig.corsAllowedOrigins));

// 5. Safe Payload Size Limits (Mitigate DoS memory exhaustion)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Structured Operational & Audit Request Logger (with Request-ID propagation)
app.use(requestLogger);

// 7. Supabase Mutation Sync Middleware (Sanitized fire-and-forget sync with error containment)
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      syncMutationToSupabase()
        .then(() => originalJson.call(this, body))
        .catch((err: any) => {
          console.error('[Supabase Background Sync Notice]:', err?.message || err);
          originalJson.call(this, body);
        });
      return this;
    } else {
      return originalJson.call(this, body);
    }
  };
  next();
});

// 8. Health, Liveness & Readiness Probes (mounted before rate-limiting to avoid false 429 probe drops)
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

// 9. General API Rate Limiting for Abuse Prevention
app.use('/api', apiRateLimiter);

// 10. Core Application Feature Routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/blood-bank', bloodBankRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/public', publicRoutes);
if (!envConfig.isProduction) {
  app.use('/api/test', testRoutes);
}

// 11. 404 Route Handler & Global Standardized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// 12. Initialize Database Connection (Supabase with in-memory DataStore fallback)
connectDatabase();

// 13. Start HTTP Server with Graceful Shutdown Handlers
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  LifeLink Central API Server running on port ${PORT}`);
  console.log(`  Environment: ${envConfig.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`  Health Probe: http://localhost:${PORT}/api/health`);
  console.log(`  Liveness:     http://localhost:${PORT}/api/health/live`);
  console.log(`  Readiness:    http://localhost:${PORT}/api/health/ready`);
  console.log(`=======================================================`);
});

// Graceful Termination Protocol
const handleGracefulShutdown = (signal: string) => {
  console.log(`\n[Process] Received ${signal}. Initiating graceful termination sequence...`);
  server.close(async () => {
    console.log('[Process] HTTP server closed. In-flight requests drained.');
    try {
      // Perform final database sync flush if enabled
      await safeSupabaseSync();
      console.log('[Process] Final state synchronization completed.');
    } catch (err: any) {
      console.error('[Process] Error during final state flush:', err?.message);
    }
    console.log('[Process] LifeLink process terminated cleanly.');
    process.exit(0);
  });

  // Force termination if draining hangs beyond 10 seconds
  setTimeout(() => {
    console.error('[Process] Forceful shutdown timeout exceeded (10s). Terminating process.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default app;

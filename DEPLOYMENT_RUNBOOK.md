# LifeLink Healthcare Platform — Production Deployment Runbook

## 1. Overview & Architecture
LifeLink is an intelligent blood donation, inventory management, hospital fulfillment, and demand prediction platform.
- **Backend API**: Node.js / Express / TypeScript (running on port `5001`).
- **Frontend SPA**: React 18 / Vite / TailwindCSS (served via Nginx on port `80` / `3000`).
- **Database & Persistence**: Supabase PostgreSQL for durable relational storage, with an in-memory `DataStore` fallback for local development and emergency degraded execution.

---

## 2. Environment Configuration & Secret Management

### Required Environment Variables
Configure these variables in your deployment environment (e.g. AWS ECS/SSM, Kubernetes Secrets, Doppler, or Docker `.env`):

| Variable | Type / Requirement | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security checks, hides stack traces, and enforces secret lengths. |
| `PORT` | `5001` (or dynamic) | Network port for the Express backend. |
| `JWT_SECRET` | String (>= 32 chars) | Cryptographic signing secret for user authentication tokens. **Must be randomly generated.** |
| `CORS_ALLOWED_ORIGINS` | Comma-separated URLs | Explicit domain allowlist (e.g., `https://lifelink.org,https://hospital.lifelink.org`). Never use `*` in production. |
| `SUPABASE_URL` | HTTPS URL | Endpoint for managed Supabase PostgreSQL instance. |
| `SUPABASE_SECRET_KEY` | Secret String | Service-role key for backend server-to-database mutations. |
| `SUPABASE_ANON_KEY` | Public String | Anonymous client key for public read operations. |
| `LOG_LEVEL` | `info` / `warn` / `error`| Operational logging granularity. |

### Generating Cryptographic Secrets
Generate high-entropy secrets using OpenSSL:
```bash
# Generate 32+ character JWT Secret
openssl rand -base64 36
```

### Zero-Downtime Secret Rotation Procedure
1. **JWT Secret Rotation**:
   - Step 1: Deploy a temporary backend configuration supporting both `OLD_JWT_SECRET` and `NEW_JWT_SECRET` (accepting verification with either, but signing new tokens with `NEW_JWT_SECRET`).
   - Step 2: Allow 24 hours for all existing active user sessions (max token lifetime: 24h) to refresh.
   - Step 3: Remove `OLD_JWT_SECRET` and restart backend instances.
2. **Database Key Rotation**:
   - Step 1: In the Supabase project dashboard, generate a secondary API key.
   - Step 2: Update the backend container secret store with the secondary key and initiate a rolling deployment.
   - Step 3: Revoke the decommissioned primary key after all pods report healthy liveness and readiness probes.

---

## 3. Database Schema, Migrations & Disaster Recovery

### Schema Initialization
Run the PostgreSQL schema definitions in the Supabase SQL editor:
```sql
-- Core schemas: blood_units, blood_requests, blood_dispatches, donors, hospitals, blood_banks
NOTIFY pgrst, 'reload schema';
```

### Database Backup & Disaster Recovery Procedure
1. **Automated Point-in-Time Recovery (PITR)**:
   - Ensure Supabase Daily Automated Backups or continuous WAL archiving is enabled.
2. **Manual Snapshot Export (Before Major Deployments)**:
   ```bash
   pg_dump -h db.<PROJECT-REF>.supabase.co -U postgres -d postgres -F c -b -v -f "lifelink_backup_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. **Database Restoration Verification**:
   ```bash
   # Restore snapshot into isolated staging replica for validation
   pg_restore -h staging-db.internal -U postgres -d postgres -v "lifelink_backup_YYYYMMDD_HHMMSS.dump"
   ```

---

## 4. Container Deployment with Docker

### Multi-Stage Production Build & Run
```bash
# Build and start all production services with healthchecks
docker-compose up -d --build

# Inspect container health statuses
docker-compose ps
```

### Built-in Container Health Checks
- **Backend**: `wget --no-verbose --tries=1 --spider http://localhost:5001/api/health/live || exit 1`
- **Frontend**: `wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1`

---

## 5. Production Health Probes & Monitoring

The backend exposes standardized monitoring endpoints:
- **Comprehensive Telemetry**: `GET /api/health`
  - Returns `status: "healthy" | "degraded"`
  - Reports storage durability mode: `"supabase_durable"` vs `"in_memory_datastore_fallback"`
  - Reports memory consumption (`rssMb`, `heapUsedMb`), process uptime, and live entity counts.
- **Liveness Probe**: `GET /api/health/live` (Returns HTTP 200 `{ status: "alive" }`).
- **Readiness Probe**: `GET /api/health/ready` (Returns HTTP 200 `{ status: "ready" }`).

---

## 6. Rollback & Incident Response Checklist

If a deployment exhibits degraded behavior, elevated HTTP 5xx errors, or failing database synchronization:
1. **Immediate Traffic Rollback**:
   - In container orchestrator (Kubernetes / ECS / Swarm), roll back to previous image tag:
     ```bash
     docker-compose down && docker-compose up -d <PREVIOUS_IMAGE_TAG>
     ```
2. **Persistence Integrity Verification**:
   - Execute `/api/health` and verify `storage.isDurablePersistence === true`.
3. **Audit Log Inspection**:
   - Filter logs by correlation `requestId` to identify failing operations:
     ```bash
     grep "[API ERROR]" /var/log/lifelink-backend.log | jq .
     ```
4. **Data Reconciliation**:
   - Ensure in-flight dispatches and unit reservations remain consistent in `blood_dispatches` and `blood_units`.

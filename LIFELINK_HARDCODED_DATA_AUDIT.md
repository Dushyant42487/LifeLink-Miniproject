# LifeLink — Comprehensive Hardcoded Data, Dummy Data & Mock API Audit

**Audit Date**: October 2026  
**Audited Codebase**: LifeLink Platform (`backend`, `frontend`, `ml-service`, `sms-service`, `gateway`)  
**Objective**: Identify all hardcoded, seeded, mocked, fabricated, and fallback data across all application workflows to transition the platform into an authoritative, database-backed, real-user system.

---

## Executive Summary & Audit Methodology

LifeLink connects voluntary donors, accredited hospitals, regional blood centers, and administrators. A repository-wide audit was conducted across frontend user interface components, backend Express controllers, Supabase/DataStore persistence models, routing services, and test harnesses.

The audit discovered several categories of data fabrication and hardcoded values:
1. **Unconditional demo data seeding on server startup**: In-memory DataStore seeds 20 fake donors, 3 blood banks, 4 hospitals, dozens of blood units, fake requisitions, samples, and dispatches whenever the local snapshot is absent or empty.
2. **Hardcoded IDs and fallback routing**: Operations default to `'bb-1'` when a blood bank is unassigned or not found, causing fake routing.
3. **Hardcoded user IDs & ad-hoc coordinate overrides in database synchronization**: Hardcoded checks for specific test IDs (`user-1792574656930`, `user-1792415991634`, `user-1792574733075`, `hosp-unconfigured`) and arbitrary coordinate adjustments in `safeSupabaseSync()`.
4. **Fabricated emergency alert coordinates & distances**: Hardcoded coordinates (`40.7484, -73.9857`) and a fixed distance (`3.2 km`) in donor emergency alert workflows.
5. **Fabricated AI campaign recommendations**: Hardcoded array of emergency campaign recommendations citing fabricated clinical justifications.
6. **Fabricated testimonials and mockup badge IDs on public landing page**: Fake person quotes ("Dr. Priya Menon", "Arjun Sharma", "Meera Krishnan") presented as verified testimonials; hardcoded donor/request badges (`#LL-8924`, `REQ-1327`, `REQ-1326`).
7. **Default blood group fallback to 'O+'**: Donor profile and history fall back to `'O+'` when unverified or unselected, fabricating medical blood groups.
8. **Hardcoded NYC center coordinates on maps**: Map components fallback to `[40.7128, -74.0060]` when donor or facility location is unconfigured.
9. **Unconditional test fixture injection in `loadSnapshot()`**: Test accounts (`donor-test-integ`, `hosp-unconfigured`) injected into standard snapshot loading, polluting clean database states.

---

## Detailed Findings Matrix

| Finding ID | Component / File | Hardcoding Type | Environment | Current Effect on Application | Authoritative Source | Risk of Removal | Proposed Fix |
|---|---|---|---|---|---|---|---|
| **AUD-01** | `backend/src/models/store.ts` (`DataStore.constructor`) | Automatic Demo Data Seeding | Dev & Prod (if empty) | Normal startup automatically populates 20 fake donors, 3 blood banks, 4 hospitals, 60+ units, fake requests, dispatches, and camps | Authoritative database records / Empty state | Low (if dev seed script provided) | Guard `seedInitialData()` strictly behind explicit `process.env.SEED_DEV_FIXTURES === 'true'`. Normal startup must start clean. |
| **AUD-02** | `backend/src/models/store.ts` (`loadSnapshot`) | Test Fixture Auto-Injection | Dev & Prod | Unconditionally injects `donor-test-integ` and `hosp-unconfigured` on every snapshot load, corrupting clean database counts | Synthetic test fixtures isolated to test runner | Low | Move `donor-test-integ` and `hosp-unconfigured` into `seedTestFixtures()` only. Remove from `loadSnapshot()`. |
| **AUD-03** | `backend/src/models/db.ts` (`safeSupabaseSync`) | Hardcoded Specific User IDs & Coords Override | Dev & Prod | Checks `remoteHosp.id === 'user-1792574656930'`, `remoteBb.id === 'user-1792415991634'`, `user-1792574733075`, `hosp-unconfigured` and selectively overrides lat/lng | Canonical Postgres columns (`latitude`, `longitude`) | Medium | Remove hardcoded user ID checks and city string hacks. Read and preserve persisted coordinates directly. |
| **AUD-04** | `backend/src/models/db.ts` (`sanitizeRecord`) | Default Blood Group Injection | Dev & Prod | Sets `if (!sanitized.bloodGroup) sanitized.bloodGroup = 'O+'`, fabricating blood group for donors who haven't specified one | Real donor profile input or `Unspecified` | Low | Remove `sanitized.bloodGroup = 'O+'` default. Allow `Unspecified` or null in Supabase. |
| **AUD-05** | `backend/src/controllers/donorController.ts` (`submitVerificationDocuments`) | Hardcoded Blood Bank Fallback ID | Production | `const assignedBankId = targetBank?.id || 'bb-1'`. If no blood bank matches, assigns donor to fake `'bb-1'` | Authenticated/preferred blood bank or admin review queue | Low | Remove `'bb-1'` fallback. If no bank found, set `assignedBloodBankId = undefined`, status = `'Pending Assignment'`. |
| **AUD-06** | `backend/src/controllers/bloodBankController.ts` (`getDonorVerificationQueue`) | Hardcoded Blood Bank Fallback Match | Production | `return bankId === 'bb-1' || db.bloodBanks.length <= 1;` matches unassigned donors to `'bb-1'` | Explicit blood bank assignment or admin routing | Low | Remove `bankId === 'bb-1'` shortcut. Only return donors explicitly assigned or within authenticated bank's city. |
| **AUD-07** | `backend/src/controllers/bloodBankController.ts` (`acceptCampRequest`) | Hardcoded Blood Bank Fallback ID | Production | `bloodBankId: bankId || 'bb-1'`. Falls back to `'bb-1'` if bankId missing | Authenticated blood bank `req.user.id` | Low | If `!bankId`, reject with 401 Unauthorized instead of falling back to `'bb-1'`. |
| **AUD-08** | `frontend/src/pages/donor/DonorEmergencyAlerts.tsx` | Fabricated Alert Coordinates & Distance | Production | Falls back to `alert.latitude || 40.7484`, `alert.longitude || -73.9857`, and `alert.distanceKmApprox || 3.2` | Real hospital/bank facility coordinates and real Haversine calculation | Low | Remove fallback coordinates and fixed 3.2 km. If coordinates missing, display "Location unavailable" and omit map marker. |
| **AUD-09** | `backend/src/models/store.ts` (`seedInitialData`) | Hardcoded Emergency Alert Fixture | Dev Fixture | Seeds `ALERT-901` with `distanceKmApprox: 3.2` and fixed coords `40.7484, -73.9857` | Real emergency blood requisitions / blood bank emergency broadcasts | Low | Retain only in isolated test seed fixtures; remove from normal startup. |
| **AUD-010** | `backend/src/controllers/aiController.ts` (`getCampaignRecommendations`) | Hardcoded AI Recommendation Array | Production | Returns static `REC-1` ("O- Negative stock is down to 2 units...") and `REC-2` ("Elective cardiac procedures...") regardless of real inventory | Authoritative blood bank inventory deficits and active requisitions | Low | Dynamically inspect `db.bloodUnits` and `db.bloodRequests`. Generate recommendations only if genuine deficits exist; return empty array if stock is healthy. |
| **AUD-011** | `frontend/src/components/landing/LandingTestimonials.tsx` | Fabricated Testimonial Personas | Production Landing | Displays 3 fabricated quotes with fake names ("Dr. Priya Menon", "Arjun Sharma", "Meera Krishnan") presented as verified users | Operational design standards & verified clinical objectives | Low | Refactor component into "Operational Standards & Clinical Objectives" or real platform capabilities without fake user personas. |
| **AUD-012** | `frontend/src/components/landing/LandingHero.tsx` | Hardcoded Mock IDs & Requisitions in UI | Production Landing | Displays "Verified Voluntary Donor #LL-8924", "Req #REQ-1327 · 2 Units RBC Dispatched", "Req #REQ-1326 · Cross-Matched Fulfilled" | Platform capabilities preview with clear illustrative disclaimer | Low | Maintain purely generic illustrative preview with explicit "Platform Preview" notice, or wire to live public stats. |
| **AUD-013** | `frontend/src/utils/donorIntegrity.ts` | Mock Donation History Fixture | Production bundle | Contains `DONOR_MOCK_HISTORY_FIXTURE` with 3 fake units (`UNIT-2026-8001`, `UNIT-2025-4102`, `UNIT-2025-1088`) and `VERIFIED_DONOR_BLOOD_GROUP = 'O+'` | Real donor donation history API (`/api/donors/history`) | Low | Deprecate `DONOR_MOCK_HISTORY_FIXTURE` from production bundle. Isolate test fixtures to test directory. |
| **AUD-014** | `frontend/src/pages/donor/DonorDashboard.tsx` & `DonorHistory.tsx` | Fallback Blood Group to 'O+' | Production | Uses `user?.bloodGroup || VERIFIED_DONOR_BLOOD_GROUP` (falling back to 'O+') | Authenticated user profile blood group | Low | Replace fallback with `user?.bloodGroup || 'Unspecified'`. |
| **AUD-015** | `backend/src/controllers/donorController.ts` (`getDigitalPass`) | Fallback Blood Group to 'O+' | Production | Line 869: `bloodGroup: donor.bloodGroup || 'O+'` prints 'O+' on digital pass for unverified donors | Persisted donor blood group or `Unspecified` | Low | Return `donor.bloodGroup || 'Unspecified'`. |
| **AUD-016** | `frontend/src/pages/donor/DonorNearbyHospitals.tsx` & `OSMMap.tsx` | Hardcoded Map Center Coordinates | Production | Defaults map center to `[40.7128, -74.0060]` (NYC) when donor has no coordinates | Donor's saved profile location, device GPS, or nearest facility | Low | Center on first available facility marker or default regional bounding box; do not invent NYC coordinates. |
| **AUD-017** | `backend/src/controllers/aiController.ts` | Direct In-Memory Table Replacement | Production | Lines 9-18, 80-89, 129-138, 189-198 overwrite `db.bloodUnits = __bu` directly without merge or error protection | `safeSupabaseSync()` | Low | Replace raw table assignments with `safeSupabaseSync()`. |
| **AUD-018** | `backend/src/routes/notificationRoutes.ts` | Unrestricted Test Dispatch Endpoint | Production | `router.post('/test-dispatch', dispatchNotificationEndpoint)` is mounted in production routes | Authenticated administrator or test harness | Low | Protect `/test-dispatch` with `requireRole(['admin'])` or mount under `/api/test/` only. |

---

## Portal-by-Portal Analysis

### 1. Donor Portal
- **Donor Registration & Login**: Real bcrypt hashing and JWT generation. Newly registered donors correctly start with `isEligible: false`, `verificationStatus: 'Unverified'`, `bloodGroupVerificationStatus: 'Unverified'`.
- **Eligibility & Verification**: Authoritative eligibility evaluated by `donorEligibilityService.ts`. Must eliminate the `VERIFIED_DONOR_BLOOD_GROUP = 'O+'` fallback in `DonorDashboard.tsx`, `DonorHistory.tsx`, and `donorController.ts`.
- **Emergency Alerts**: Alerts must show real issuing facility coordinates and true Haversine distance, with empty/unconfigured states properly handled without fallback to NYC (40.7484, -73.9857) or fixed 3.2 km distance.
- **Nearby Hospitals**: Correctly returns empty list when donor has no coordinates. The frontend map must not default center to NYC if no coordinates exist.

### 2. Hospital Portal
- **Hospital Requisitions**: Requisitions are persisted directly in `db.bloodRequests` and Supabase. Enforces hospital location calibration before submission.
- **Dashboard Metrics**: Accurately derives counts from persisted `myRequests` and `calculateReservedUnits`. No hardcoded counter offsets.
- **Patient Samples & OT Storage Ledger**: Fully persisted in `db.patientSamples` and `db.hospitalStorageEntries`.

### 3. Blood Bank Portal
- **Dashboard KPIs**: Accurately queries `bankUnits` owned by authenticated blood bank. Dashboard sum check requires Whole Blood to be included in component breakdown for mathematical reconciliation.
- **Inventory & Reservations**: Units belong strictly to authenticated `bankId`. Double reservation and unauthorized cross-bank reservation are blocked.
- **Laboratory Screening**: Units transition from `Quarantined` to `Available` only upon verified `Passed` infectious disease panel.
- **Collections & Fractionation**: Collections validate donor eligibility (unverified donors rejected). Traceable component fractionation records generated.

### 4. Admin Portal
- **Smart Routing & Verification Desk**: Authenticated admin oversight (`/api/admin/verification-requests`, `/api/admin/smart-routing`). No hardcoded admin user IDs in production logic.

### 5. Public Landing Page
- **Stats Strip**: Dynamically fetches real counts from `/api/public/stats`.
- **Camps Section**: Fetches real scheduled camps from `/api/public/camps` with clean empty state.
- **Testimonials**: Fabricated quotes need conversion to platform capabilities / clinical design standards.

---

## Action Plan & Remediation Roadmap

1. **Step 1: Isolate Startup Demo Seeding**
   - In `backend/src/models/store.ts`, wrap `seedInitialData()` so it only executes when `process.env.SEED_DEV_FIXTURES === 'true'`.
   - Remove unconditional injection of `donor-test-integ` and `hosp-unconfigured` from `loadSnapshot()`.
2. **Step 2: Clean Up Hardcoded IDs in `db.ts`**
   - Remove hardcoded IDs (`user-1792574656930`, `user-1792415991634`, `user-1792574733075`, `hosp-unconfigured`) and ad-hoc coordinate overrides.
   - Remove `sanitized.bloodGroup = 'O+'` default in `sanitizeRecord`.
3. **Step 3: Remove Fallback `'bb-1'` in Controllers**
   - In `donorController.ts` and `bloodBankController.ts`, eliminate `'bb-1'` fallback. Use real authenticated facility IDs or explicit unassigned status.
4. **Step 4: Remove Fabricated Coordinates & Distances in Emergency Alerts**
   - In `DonorEmergencyAlerts.tsx`, remove fallback `40.7484, -73.9857` and `3.2 km`.
5. **Step 5: Replace Fabricated AI Campaign Recommendations**
   - In `aiController.ts`, generate recommendations based on actual stock levels and active requisitions.
   - Replace raw table overwrites with `safeSupabaseSync()`.
6. **Step 6: Eliminate Blood Group 'O+' Fallback for Unverified Donors**
   - In `DonorDashboard.tsx`, `DonorHistory.tsx`, and `donorController.ts` (`getDigitalPass`), fall back to `'Unspecified'`.
7. **Step 7: Clean Up Landing Page Testimonials & Mock References**
   - Refactor `LandingTestimonials.tsx` into transparent platform standards and design principles.
   - Clarify preview mockup in `LandingHero.tsx`.
8. **Step 8: Verify Test Suites & Builds**
   - Run type checks, build bundles, and execute backend and frontend automated test suites.

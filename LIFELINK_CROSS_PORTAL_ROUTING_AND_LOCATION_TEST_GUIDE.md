# LifeLink: Cross-Portal Emergency Alerts, Smart Routing, Location Management & Clinical Workflow Test Guide

---

## 1. Executive Summary & Clinical Architecture Overview

The LifeLink emergency routing and coordination platform has been hardened across the **Hospital**, **Blood Bank**, **Donor**, and **Admin** portals. This guide documents the end-to-end verification procedures for:

1. **Cross-Portal Emergency Audible Alerts**:
   - Strictly conforms to a **5.0-second hard ceiling** with zero lingering oscillators or memory leaks.
   - Distinct clinical tone separation:
     - **Emergency / STAT**: High-priority alternating dual-tone warble (880 Hz / 660 Hz with 440 Hz / 330 Hz harmonic sub-layer).
     - **Urgent**: Melodic dual-chime sequence (523.25 Hz - C5 to 659.25 Hz - E5).
     - **Routine**: Silent notification delivery (zero audio).
   - Strict browser autoplay compliance: Web Audio API context resumes on global user gestures (`click`, `touchstart`, `keydown`) and buffers unplayed alerts arriving while the context is suspended.
   - **Zero False Requester Alarms**: Hospital users creating requisitions receive normal-priority non-alarm submission confirmations (`type: 'request_update'`, `priority: 'medium'`), while intended blood bank staff receive high-priority audible alarms (`priority: 'urgent'`, `type: 'emergency'`).

2. **Automated Smart Proximity Routing**:
   - Replaced cumbersome manual dropdowns with an **Automatic Smart Routing** indicator card by default.
   - Server-authoritative candidate ranking:
     - Real-time **Haversine spatial distance** computation from genuine hospital coordinates.
     - Clinical compatibility matching (isogroup and compatible group logic).
     - Strict testing status enforcement (only units with `testingStatus === 'Passed'` and `availability === 'Available'`).
     - Automatic exclusion of expired, quarantined, or already reserved units.
     - Automated radius expansion starting at **25 km**, expanding up to **100 km** when local stock is exhausted.
     - Atomic stock reservation and multi-facility ledger management preventing double-commitment.

3. **Hospital Requisition UI Simplification**:
   - Clean, focused form defaulting to Automatic Proximity Routing.
   - Collapsible, secondary **Direct Facility Requisition** section with verified, deduplicated blood banks with genuine geographic coordinates.
   - Immediate **Post-Submission Dispatched Routing Summary Banner** displaying ranked candidate blood banks, proximity distances, and offer statuses.

4. **Facility & Camp Location Management**:
   - Genuine organization locations are persisted reliably to Supabase and snapshots.
   - Full lifecycle for donor camp requests:
     - `Donor creates Camp Request` -> `Target Blood Bank receives real-time alert` -> `Bank accepts and schedules Camp` -> `Camp appears on donor map with authentic coordinates`.
     - Eliminated hardcoded fallback coordinates (`40.7128, -74.0060`); unplaced camps are clearly badged as `"Map pin unconfigured"`.

5. **Data Cleanliness & Tenant Isolation**:
   - Purged 109 transient test accounts (`user-179...` fixtures with `@testmail.com` and `@lifelink.test`) from both Supabase and datastore snapshot.
   - Preserved all genuine facilities (`bb-1`..`bb-10`, `hosp-1`..`hosp-10`, `donor-test-integ`, user `dushyant@gmail.com`, `Harshal@gmail.com`, `wce_bb`, etc.).
   - Deduplicated public location directory by normalized facility name and city.

---

## 2. Facility Directory & Test Credentials

| Role | Facility Name | Email | Password | Location Coordinates |
| :--- | :--- | :--- | :--- | :--- |
| **Hospital** | Apollo General Hospital (`hosp-1`) | `emergency@apellogeneral.org` / `contact@apollogeneral.example.com` | `password123` | `40.7484, -73.9857` (Metro City) |
| **Hospital** | Metro LifeCare Hospital (`hosp-2`) | `contact@metrolifecare.example.com` | `password123` | `40.7589, -73.9851` (Metro City) |
| **Hospital** | Rural Outreach Clinic (`hosp-unconfigured`) | `rural@clinic.org` | `password123` | Unconfigured (For validation testing) |
| **Blood Bank** | City Central Blood Center (`bb-1`) | `admin@cityblood.org` / `central@citybloodbank.org` | `password123` | `40.7128, -74.0060` (Metro City, ~4.2 km) |
| **Blood Bank** | Red Cross Regional Center (`bb-2`) | `redcross@regionalblood.org` | `password123` | `40.7306, -73.9352` (Metro City, ~4.7 km) |
| **Blood Bank** | St. Jude Memorial Blood Bank (`bb-3`) | `stjude@bloodservices.org` | `password123` | `40.7829, -73.9654` (Metro City, ~4.2 km) |
| **Donor** | Integration Test Donor | `integ-donor@lifelink.org` | `password123` | Configurable in Donor Profile |
| **Admin** | LifeLink Regional Administrator | `admin@lifelink.org` | `password123` | Central Administration |

---

## 3. Step-by-Step Cross-Portal Manual Test Scenarios

### Test 1: Hospital Automatic Smart Emergency Requisition
1. **Login as Hospital**:
   - Navigate to `http://localhost:5173/login`.
   - Select **Hospital** portal, log in with `emergency@apellogeneral.org` / `password123`.
2. **Open Requisition Form**:
   - Go to `http://localhost:5173/hospital/create-request`.
   - Select **Emergency / STAT** urgency.
   - Select Blood Group **O+**, Component **Packed Red Blood Cells (RBC)**, Quantity **2 units**.
   - Enter Patient Reference ID: `PAT-STAT-901`, Department: `Trauma Bay 1`.
   - Note the **Automatic Smart Proximity Routing** active default card.
3. **Submit Requisition**:
   - Click **Transmit Emergency Requisition**.
   - **Verify Hospital Requester Confirmation**:
     - An immediate post-submission summary banner appears displaying:
       - Requisition ID (e.g. `REQ-...`).
       - Dispatched candidate offers ranked by proximity (e.g. `City Central Blood Center`, `Red Cross Regional Center`).
       - Proximity distances in kilometers.
     - **Critical Audio Check**: The hospital browser does **NOT** play an emergency siren. Hospital notifications receive a calm submission confirmation ticket (`priority: 'medium'`).
4. **Log into Receiving Blood Bank Portal**:
   - Open an incognito browser window or separate tab at `http://localhost:5173/login`.
   - Log in as **Blood Bank** using `admin@cityblood.org` / `password123`.
   - **Verify Audible Alarm Contract**:
     - The top **Emergency Alert Banner** flashes: `CRITICAL EMERGENCY - Emergency Blood Requisition Received`.
     - An audible 880 Hz / 660 Hz alternating emergency warble plays.
     - The sound **strictly ceases at exactly 5 seconds** (countdown indicator shows `Audio playing (5s) -> (0s)`).
     - Clicking **Mute** immediately silences playback if clicked before 5 seconds.
     - Clicking **View Requisition** navigates directly to `/blood-bank/requests` with the target requisition pre-selected.
5. **Verify Tenant Isolation**:
   - In a third window, log into Blood Bank C (`stjude@bloodservices.org` / `password123`).
   - If Bank C was not in the immediate candidate offer batch, verify that Bank C does not receive the alarm or offer notification.

---

### Test 2: Manual Direct Facility Override
1. In Hospital Portal, navigate to `/hospital/create-request`.
2. Click **Manual Direct Facility Requisition (Optional Override) →**.
3. Select a specific destination, e.g. `Red Cross Regional Center (Metro City)`.
4. Note that the card turns amber with badge: `Manual Override Active`.
5. Enter required fields and submit.
6. Verify the offer is dispatched directly to `bb-2` without sequential proximity dispatching to other centers.

---

### Test 3: Unconfigured Hospital Location Guard
1. Log into Hospital Portal with `rural@clinic.org` / `password123` (`hosp-unconfigured`).
2. Attempt to create a blood requisition.
3. Verify that the server rejects the request with HTTP 422:
   - Error: `"Hospital geographic coordinates are not configured. Automatic emergency routing requires genuine hospital coordinates."`
   - A direct link appears: **Configure Hospital Location** navigating to `/hospital/profile`.

---

### Test 4: Donor Camp Request, Blood Bank Approval & Discovery Map
1. **Donor Proposes Camp**:
   - Log in as **Donor** (`integ-donor@lifelink.org` / `password123`).
   - Navigate to `/donor/camps?tab=request`.
   - Fill in organizational camp details:
     - Organization: `Metro Tech University`
     - Proposed Date: (7 days in future)
     - Venue: `Student Union Quad, 100 University Ave`
     - City: `Metro City`
     - Select target blood bank: `City Central Blood Center`.
     - Submit request.
2. **Blood Bank Approves Drive**:
   - Log into Blood Bank Portal (`admin@cityblood.org` / `password123`).
   - Open `/blood-bank/collections`.
   - Locate the incoming camp request from `Metro Tech University`.
   - Click **Approve & Schedule Camp**.
3. **Verify Public & Donor Map Discovery**:
   - Return to the Donor Portal (`/donor/camps`).
   - Verify that `Metro Tech University Blood Donation Drive` appears in the active camps list.
   - Switch to **Map View**:
     - Verify the marker pin is placed at the genuine venue coordinates.
     - Camps lacking coordinates do not fall back to `40.7128, -74.0060`, but are clearly tagged `"Map pin unconfigured"`.

---

## 4. Automated Backend Test Suites

All 44 automated tests pass natively without mocks:

### 1. Emergency Alarm Routing & Tone Controls
```bash
node --test backend/tests/emergencyAlarmRoutingAndToneControls.test.mjs
```
- **Tests**: 10 passed, 0 failed.
- **Coverage**:
  - Emergency routing dispatches to candidate blood banks.
  - Hospital requester gets normal submission ticket, zero sirens.
  - Recipient blood bank receives rich notification with 5-second alarm contract.
  - Direct navigation link to requisition ledger.
  - Unselected blood banks do not receive cross-portal offers.
  - Urgent urgency triggers melodic chime (`priority: 'high'`).
  - Routine urgency is silent (`priority: 'medium'`).
  - Idempotency contract prevents replaying already processed alarms.

### 2. Smart Emergency Blood Routing & End-to-End Fulfillment
```bash
node --test backend/tests/smartBloodRouting.test.mjs
```
- **Tests**: 17 passed, 0 failed.
- **Coverage**:
  - Missing coordinates validation.
  - Haversine candidate ranking.
  - Quarantined / expired stock exclusion.
  - Multi-facility partial stock commitment without over-allocation.
  - Radius expansion (25 km -> 50 km -> 100 km).
  - Dispatch manifest generation and hospital receipt confirmation.

### 3. Location Modes, Donor Verification & Notifications
```bash
node --test backend/tests/locationVerificationNotification.test.mjs
```
- **Tests**: 17 passed, 0 failed.
- **Coverage**:
  - Profile location persistence across restarts.
  - Proximity hospital search.
  - Real-time SSE latency measurement (< 250 ms).
  - Multi-tab read synchronization.

---

## 5. Build & Verification Commands

```bash
# Verify backend compilation
npm --prefix backend run build

# Verify frontend bundle build
npm --prefix frontend run build

# Run all test suites sequentially
node --test backend/tests/emergencyAlarmRoutingAndToneControls.test.mjs
node --test backend/tests/smartBloodRouting.test.mjs
node --test backend/tests/locationVerificationNotification.test.mjs
```

---
*Documentation updated and verified for LifeLink Production Release 2026.*

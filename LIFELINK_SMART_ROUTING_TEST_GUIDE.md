# LifeLink Smart Blood Routing & 5-Second Alert: Verification & Testing Guide

This guide provides end-to-end instructions for clinical operators, QA engineers, and developers to verify and test the **Smart Emergency Blood Routing Engine**, **Dual-Tone 5-Second Audible Alert System**, and **Clinical Fulfillment Workflow**.

---

## 1. Quick Start & Service Execution

Ensure both backend API and frontend dev servers are active:

```bash
# 1. Backend Service (Port 5001)
cd /Users/dushyant/LifeLinkmo/backend
npm run dev

# 2. Frontend Application (Port 3000)
cd /Users/dushyant/LifeLinkmo/frontend
npm run dev
```

### Health Probes:
- **Backend Health Check**: `curl -s http://localhost:5001/api/health`
- **Frontend App**: `http://localhost:3000`

---

## 2. Automated Integration Test Suite

LifeLink includes an exhaustive integration test suite containing **17 end-to-end tests** covering coordinate validation, Haversine candidate selection, stock clearance, concurrency control, ledger integrity, dispatch, and receipt.

### Run All Routing Tests:
```bash
cd /Users/dushyant/LifeLinkmo/backend
node --test tests/smartBloodRouting.test.mjs
```

### Expected Output:
```
✔ LifeLink: Smart Emergency Blood Routing & End-to-End Fulfillment (32442ms)
ℹ tests 17
ℹ suites 8
ℹ pass 17
ℹ fail 0
```

### Run Regression Test Suite:
```bash
node --test tests/locationVerificationNotification.test.mjs
```

---

## 3. Pre-Seeded Test Credentials

| Role | Name | Email | Password | Coordinates (Lat, Lng) |
| :--- | :--- | :--- | :--- | :--- |
| **Hospital** | Apollo General Hospital | `emergency@apellogeneral.org` | `password123` | `40.7484, -73.9857` (Midtown NY) |
| **Hospital (Unconfigured)** | Rural Outreach Clinic | `rural@clinic.org` | `password123` | `undefined, undefined` |
| **Blood Bank 1** | City Central Blood Bank | `central@citybloodbank.org` | `password123` | `40.7128, -74.0060` (4.3 km away) |
| **Blood Bank 2** | Red Cross Regional Center | `redcross@regionalblood.org` | `password123` | `40.7306, -73.9352` (4.7 km away) |
| **Blood Bank 3** | St. Jude Memorial Blood Bank | `stjude@bloodservices.org` | `password123` | `40.7589, -73.9851` (1.1 km away) |
| **Admin** | LifeLink Administrator | `admin@lifelink.org` | `password123` | N/A |

---

## 4. Resetting Test Data Fixtures Safely

To restore database inventory, facilities, and requests back to their pristine baseline:

```bash
curl -X POST http://localhost:5001/api/test/seed-fixtures
```

Response:
```json
{
  "success": true,
  "message": "Test fixtures seeded successfully for automated testing suite.",
  "counts": { "bloodBanks": 3, "hospitals": 4, "bloodUnits": 91, ... }
}
```

---

## 5. End-to-End Visual Testing in the Browser

### Step 1: Hospital Submits Smart Routing Request
1. Open `http://localhost:3000/login` in Browser Tab A.
2. Sign in as **Apollo General Hospital** (`emergency@apellogeneral.org` / `password123`).
3. Click **"New Requisition"** in the sidebar.
4. Verify the destination mode is automatically defaulted to:
   **"⚡ Automatic Smart Routing (Recommended)"**
   *(Subtitle: "LifeLink automatically discovers, ranks by distance, and routes to nearby licensed blood banks with eligible stock.")*
5. Fill out the requisition:
   - **Blood Group**: `A+`
   - **Component**: `Red Blood Cells (PRBC)`
   - **Quantity (Units)**: `1`
   - **Urgency**: `Emergency`
   - **Patient Reference**: `PT-TRAUMA-101`
   - **Department**: `Emergency Trauma OR`
6. Click **"Submit Requisition"**.
7. Observe the success notification showing the Haversine search radius and candidate count.

---

### Step 2: Emergency 5-Second Sound & Banner in Blood Bank Portal
1. Open an incognito browser window or separate browser profile (Tab B).
2. Log in as the closest candidate blood bank:
   **St. Jude Memorial Blood Bank** (`stjude@bloodservices.org` / `password123`) or **City Central Blood Bank** (`central@citybloodbank.org` / `password123`).
3. **Sound Verification**:
   - Immediately upon arrival of the emergency offer via SSE, the **Dual-Tone Emergency Warble (880Hz / 660Hz)** plays through the speakers.
   - Look at the top of the viewport: A glowing crimson **Emergency Alert Banner** appears with an animated progress bar counting down **5 seconds**.
   - After exactly 5.0 seconds, the audio stops completely.
   - Refresh the page: Observe that the alert **does not replay** because its ID is tracked in `sessionStorage`.
4. **Sound Controls Verification**:
   - In the top navigation bar, click the **Bell Icon** to open the Notification Center.
   - Click **"Test Alert Tone"**: Confirm the tone plays for exactly 5 seconds.
   - Click the **Volume / Mute Toggle**: Mute the audio and trigger another notification; confirm silence.

---

### Step 3: Candidate Ledger & Offer Actions
1. Navigate to **"Hospital Requests Hub"** (`/blood-bank/requests`).
2. Click the **"⚡ Incoming Offers (Smart Routing)"** tab.
3. Review the **Candidate Routing Ledger** card:
   - Request ID: `REQ-XXXX`
   - Hospital: `Apollo General Hospital`
   - Distance: e.g. `1.1 km away`
   - Offered Units: `1 unit`
   - Response Countdown: Active timer (15 min for Emergency).
4. **Action: Full Acceptance**:
   - Click the green **"Accept (1 Unit)"** button.
   - The modal confirms unit reservation.
   - Observe that the offer status updates to `Accepted`, and the unit is atomically marked `Reserved` in inventory.
5. **Action: Partial Fulfillment (Optional Branch)**:
   - If a requisition requests multiple units (e.g. 3 units), click **"Offer Partial Fulfillment"**.
   - Input `1` unit and submit.
   - The candidate ledger records 1 committed unit, and automatically redispatches offers for the remaining 2 units to the next closest bank.
6. **Action: Reasoned Decline (Optional Branch)**:
   - Click **"Decline Request"**.
   - Select reason (e.g., *"Active local trauma case reservation"*).
   - Confirm decline. The system logs the decline and immediately reroutes to the next closest facility.

---

### Step 4: Unit Allocation & Verification
1. Click the **"Active Requests"** tab.
2. Click on the accepted requisition row.
3. In the allocation drawer, review the eligible stock table:
   - Verify every listed unit displays `Testing: Passed`, `Status: Available` (or `Reserved for this Requisition`), and unexpired shelf-life.
4. Select the unit checkbox and click **"Confirm Unit Allocation"**.
5. The request moves to `Status: Reserved`.

---

### Step 5: Cold-Chain Packaging & Dispatch Manifest
1. In the requisition fulfillment modal, click **"Prepare Dispatch Manifest"**.
2. Fill out transit parameters:
   - **Courier**: `Dedicated Hospital Courier`
   - **Reference / Courier ID**: `COU-EMERGENCY-505`
   - **Packaging**: `Standard Passive Thermal Container with Ice Gel Packs`
   - **Target Temp**: `2°C to 6°C (Chilled)`
3. Click **"Generate Dispatch Manifest & Hand Off to Courier"**.
4. The status transitions to `Dispatched` (`In Transit`).
5. A printable **Authoritative Dispatch Slip** is generated with packaging and temperature monitoring guidelines.

---

### Step 6: Hospital Confirm Physical Receipt
1. Switch back to Browser Tab A (Hospital portal).
2. Go to **"Hospital Requisitions"** (`/hospital/requests`).
3. Click on the requisition: Notice the status is now `Dispatched`.
4. Click **"Confirm Delivery Receipt"**.
5. Input inspection notes: *"Units verified, packaging intact, temperature log verified at 3.8°C"*.
6. Click **"Confirm Clinical Receipt"**.
7. The status permanently transitions to **`Fulfilled`**.
8. View the complete timeline audit trail showing timestamps and operators for submission, smart routing, acceptance, unit allocation, courier handoff, and hospital receipt.

---

## 6. Admin Observability & Diagnostics

1. Sign in as Administrator (`admin@lifelink.org` / `password123`).
2. Navigate to **"Smart Emergency Routing Overview"** in Admin portal.
3. Review:
   - **Candidate Ledger**: Live list of active, accepted, and superseded offers.
   - **Radius Expansions**: Requisitions that expanded search perimeter (25 km $\to$ 50 km $\to$ 100 km).
   - **Unconfigured Hospital Locations**: Table highlighting any healthcare facilities missing GPS coordinates.
   - **Manual Escalation Button**: Emergency button allowing administrators to manually widen the radius or ping regional centers.

---

## 7. Common Troubleshooting & FAQs

### Q1: Why did the audio not play when the emergency notification appeared?
- **Root Cause**: Browsers (Chrome, Safari) block autoplay until the user interacts with the page (clicks or keys).
- **Solution**: Click anywhere in the LifeLink portal once after login to satisfy the browser's User Gesture requirement. Verify that the audio icon in the top right is unmuted.

### Q2: Why did an auto-routed request return HTTP 400?
- **Root Cause**: The requesting hospital organization has not configured latitude and longitude in its profile.
- **Solution**: Update the hospital coordinates in Hospital Profile, or use `emergency@apellogeneral.org` (pre-configured at `40.7484, -73.9857`).

### Q3: Why did a blood bank not receive an offer even though it is within 25 km?
- **Root Cause**: The candidate blood bank has 0 units of the requested blood component with `testingStatus === 'Passed'` and `availability === 'Available'`.
- **Solution**: LifeLink strictly prevents ghost offers for unavailable stock. Check blood bank inventory to ensure units are cleared and not expired or quarantined.

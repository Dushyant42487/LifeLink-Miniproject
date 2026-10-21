# LifeLink: Hospital Requisition UI, Blood Bank Location Setup & Cross-Portal Route Tracking Guide

---

## 1. Executive Summary & Architecture Overview

This guide details the verification and operational workflows for three interconnected subsystems in LifeLink:

1. **Hospital Create Requisition UI & Clean Workflow**:
   - **Decoupled Create vs Result Views**: The Create Requisition form exclusively handles requisition authoring. Upon submission, it immediately navigates to `/hospital/requests?requestId=${req.id}&submitted=true` with a clear submission confirmation banner, preventing duplicate submissions on page refresh and eliminating confusion from lingering previous fulfillment cards.
   - **Logical Ergonomic Sections**:
     - *Urgency Level*: Routine, Urgent, Emergency (STAT) with color-coded badges and descriptions.
     - *Blood Component Requirements*: Standard clinical dropdowns (Packed Red Blood Cells / PRBC, Whole Blood, Platelets, Plasma, Cryoprecipitate) and unit quantity slider (1–20 units).
     - *Clinical & Patient Details*: Patient Reference ID, Department (ICU, Trauma Bay, Cardiology OT), Required By timestamp, and clinical indications.
     - *Regional Routing Mode*: Automated Smart Proximity Routing (default, 25 km radius expanding to 100 km) vs. Direct Facility Requisition (with real-time Haversine corridor distance check and > 100 km warning).
     - *Active Emergency Orders*: Cleanly collapsed into a dedicated collapsible accordion so urgent cases remain accessible without cluttering the creation form.

2. **Durable Facility Location Configuration & Persistence**:
   - Both Hospital staff (`/hospital/profile`) and Blood Bank staff (`/blood-bank/profile`) can configure verified operational locations with interactive geocoding and manual coordinate adjustment.
   - **Direct Persistence (`persistRecordDirect`)**: Profile updates call `await persistRecordDirect('blood_banks', bb)` and `await persistRecordDirect('hospitals', hosp)`, ensuring coordinates are committed durably to persistent storage and protected from being overwritten by remote synchronization.
   - **Sangli Geographic Alignment**: All Sangli test fixtures (`wceHospital`, `wce_bb`, `wceBloodBank`, `Dushyant`, `sangli_miraj_hospital`) have been realigned to authentic Sangli coordinates (`~16.8440, ~74.6018`), permanently eliminating the 12,841.1 km anomaly caused by default NYC fallback coordinates.

3. **Accurate Cross-Portal Physical Route Visualization**:
   - Physical logistics is strictly categorized into two separate movements with matching metadata across both portals:
     - **Hospital to Blood Bank Lab**: Patient sample shipment for pre-transfusion typing and cross-matching (Origin: Hospital, Destination: Blood Bank Lab).
     - **Blood Bank to Hospital**: Allocated blood product dispatch (Origin: Blood Bank, Destination: Hospital).
   - **Interactive Route Corridor Modal (`OSMMap`)**:
     - Displays genuine facility coordinates, polyline corridor, and Haversine distance.
     - Contains movement switcher tabs (*Blood Product Dispatch* vs. *Sample Transport*).
     - Embeds cold-chain transit parameters (target temp, departure temp, packaging type, courier handover).
     - Explicitly indicates that transit metrics represent direct facility-to-facility corridors without fabricated vehicle GPS.

---

## 2. Test Accounts & Facility Directory

| Role | Facility Name | Email | Password | Location Coordinates | Region |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hospital** | WCE Memorial Hospital Sangli (`user-1792574656930`) | `wce@hospital.com` | `password123` | `16.8438, 74.6015` | Sangli, MH |
| **Hospital** | Apollo General Hospital (`hosp-1`) | `emergency@apellogeneral.org` | `password123` | `40.7484, -73.9857` | Metro City |
| **Blood Bank** | WCE Sangli Blood Center (`user-1792415991634`) | `wcebb@test.org` | `password123` | `16.8440, 74.6018` | Sangli, MH (~0.4 km) |
| **Blood Bank** | City Central Blood Center (`bb-1`) | `admin@cityblood.org` | `password123` | `40.7128, -74.0060` | Metro City (~4.2 km) |
| **Blood Bank** | Red Cross Regional Center (`bb-2`) | `redcross@regionalblood.org` | `password123` | `40.7306, -73.9352` | Metro City (~4.7 km) |
| **Donor** | Integration Donor | `integ-donor@lifelink.org` | `password123` | `40.7295, -73.9937` | Metro City |
| **Admin** | LifeLink Regional Administrator | `admin@lifelink.org` | `password123` | Central Administration | All Regions |

---

## 3. Step-by-Step Test Scenarios

### Scenario 1: Hospital Create Requisition UI & Immediate Navigation
1. **Login as Hospital**:
   - Open browser at `http://localhost:5173/login`.
   - Log in with `wce@hospital.com` / `password123`.
2. **Access Requisition Form**:
   - Navigate to `http://localhost:5173/hospital/create-request`.
   - Verify that NO lingering previous dispatch/offer result card is visible on the page.
   - Note the four clean sections:
     - **Urgency Level**: Select **Urgent**.
     - **Blood Component Requirements**: Select Blood Group **O+**, Component **Packed Red Blood Cells (PRBC)**, Quantity **2 Units**.
     - **Clinical & Patient Details**: Enter Patient Reference ID `PAT-SANGLI-001`, Department `Surgery OT 2`.
     - **Routing Mode**: Leave default **Automatic Smart Proximity Routing**.
3. **Submit Requisition**:
   - Click **Transmit Requisition to Regional Network**.
   - **Verification**:
     - Browser immediately navigates to `/hospital/requests?requestId=REQ-...&submitted=true`.
     - An emerald success banner displays at the top: *"Requisition Successfully Transmitted — Live Tracking Initialized"*.
     - The newly submitted requisition is highlighted in the left queue and active in the detail pane.
     - Refreshing the page does NOT duplicate the request.

---

### Scenario 2: Blood Bank Facility Location Setup & Direct Persistence
1. **Login as Blood Bank**:
   - Open browser at `http://localhost:5173/login`.
   - Log in with `wcebb@test.org` / `password123`.
2. **Open Profile**:
   - Navigate to `http://localhost:5173/blood-bank/profile`.
3. **Update Coordinates**:
   - Set Address: `College Road, Vishrambag`, City: `Sangli`, State: `Maharashtra`, Postal Code: `416416`.
   - Set Latitude: `16.8440`, Longitude: `74.6018`.
   - Click **Save Profile & Location Coordinates**.
4. **Verification**:
   - Success toast appears: *"Blood bank organization profile and location coordinates updated successfully"*.
   - Restart the backend or reload the page; coordinates remain `16.8440, 74.6018`.
   - Direct persistence ensures Supabase sync will not overwrite with default coordinates.

---

### Scenario 3: Pre-Transfusion Patient Sample Route Verification (Hospital → Blood Bank)
1. **Hospital Submits Cross-Matching Sample**:
   - Log in as Hospital (`wce@hospital.com`).
   - Navigate to `http://localhost:5173/hospital/requests`.
   - Select an active requisition assigned to `WCE Sangli Blood Center`.
   - Click **Submit Sample** (navigates to `/hospital/samples?requestId=...`).
   - Enter Sample Type: `Whole Blood EDTA Tube`, Notes: `Urgent pre-op cross-matching`.
   - Click **Register Sample for Courier Pickup**.
2. **View Sample Transit Route in Hospital Portal**:
   - Navigate to `/hospital/requests`.
   - Click the **Transit Route** button on the selected requisition header.
   - Select the **Pre-Transfusion Sample Transport (Hospital → Lab)** tab.
   - **Verify Route Modal Details**:
     - Origin: *WCE Memorial Hospital Sangli* (`16.8438, 74.6015`).
     - Destination: *WCE Sangli Blood Center Lab* (`16.8440, 74.6018`).
     - Geospatial Metric: Distance is accurately shown as **~0.4 km** (never 12,841 km).
     - Interactive Leaflet map renders blue origin marker (Hospital), red destination marker (Lab), and dashed blue polyline.
     - Registered sample is itemized in the manifest table with status `In Transit`.

---

### Scenario 4: Blood Product Dispatch Manifest & Route Tracking (Blood Bank → Hospital)
1. **Blood Bank Prepares Dispatch Manifest**:
   - Log in as Blood Bank (`wcebb@test.org`).
   - Navigate to `http://localhost:5173/blood-bank/requests`.
   - Select the reserved requisition.
   - Click **Prepare Dispatch Manifest & Packing Slip**.
   - Enter Courier: `Dedicated Medical Courier`, Target Temp: `2°C to 6°C (Chilled)`, Packaging: `Validated Cold-Chain Shipper with Ice Packs`.
   - Click **Generate Dispatch Manifest**.
   - Click **Confirm Courier Handoff (Dispatch)**.
2. **View Dispatch Route in Blood Bank Portal**:
   - In the Dispatch Manifest section, click **View Transit Route** (or click **Transit Route** in the header).
   - **Verify Route Modal Details**:
     - Tab: *Blood Product Dispatch (Blood Bank → Hospital)*.
     - Origin: *WCE Sangli Blood Center* (`16.8440, 74.6018`).
     - Destination: *WCE Memorial Hospital Sangli* (`16.8438, 74.6015`).
     - Distance: **~0.4 km**.
     - Cold-Chain Box: Displays Target Temp (`+2°C to +6°C`), Courier reference, and Status `DISPATCHED`.
     - Map renders purple corridor polyline.
3. **Cross-Portal Verification in Hospital Portal**:
   - Switch back to Hospital portal (`/hospital/requests`).
   - Click **Transit Route**.
   - Confirm that the Hospital portal displays the identical origin, destination, distance (~0.4 km), courier, and status.

---

### Scenario 5: Dedicated Hospital Logistics Page Verification
1. Log in as Hospital (`wce@hospital.com`).
2. Navigate to `http://localhost:5173/hospital/logistics`.
3. Verify the three tabs:
   - **Blood Dispatches (Bank → Hospital)**: Lists authoritative dispatches from `db.bloodDispatches` with genuine origin/destination coordinates and cold-chain indicators.
   - **Sample Routes (Hospital → Lab)**: Lists genuine patient sample shipments from `db.patientSamples`.
   - **Centers Network**: Shows connected regional blood banks with distance calculations and live inventory counts.
4. Verify the interactive map at the bottom renders authentic facility markers and transport corridors without mock GPS trails.

---

## 4. Automated Test Suite Execution

All test suites can be executed via terminal commands from the repository root:

### 1. Cross-Portal Route & Location Verification (10 Tests)
```bash
node backend/tests/crossPortalRouteAndLocation.test.mjs
```
**Test Coverage**:
- Auto-routing with 25 km radius strictly rejects candidates at 12,841 km.
- Sangli hospital and blood bank proximity verification (< 10 km).
- Durable Hospital profile location persistence with coordinates.
- Durable Blood Bank profile location persistence with coordinates.
- Sample shipment route validation (Origin: Hospital, Destination: Blood Bank Lab).
- Hospital logistics endpoint data integrity without mock fallbacks.
- Requisition creation state never displays "Dispatched" before actual dispatch record is created.
- Blood Bank logistics endpoint (`/blood-bank/logistics`) returns authenticated records.
- Cross-portal coordinate enrichment on both hospital and blood bank requisition endpoints.

### 2. Location Verification & Notifications (17 Tests)
```bash
node backend/tests/locationVerificationNotification.test.mjs
```
**Test Coverage**:
- Saved location persistence and coordinate bounds validation.
- Nearby hospitals spatial query within radius.
- Tenant isolation and donor verification review workflow.
- SSE real-time notification push and unread count persistence.

### 3. Smart Emergency Blood Routing (17 Tests)
```bash
node backend/tests/smartBloodRouting.test.mjs
```
**Test Coverage**:
- Haversine candidate ranking in ascending distance order.
- Inventory exclusion for unreleased, expired, or reserved units.
- Atomic stock reservation and multi-facility ledger management.
- Re-routing upon decline to next closest facility.

### 4. Emergency Audible Alarm Routing & Tone Controls (10 Tests)
```bash
node backend/tests/emergencyAlarmRoutingAndToneControls.test.mjs
```
**Test Coverage**:
- 5.0-second hard ceiling on emergency audio alarms.
- Requester vs receiver audio separation (no self-alarms for hospital).
- Autoplay unlock via global user gestures.

### 5. SMS Microservice (11 Tests)
```bash
npm --prefix sms-service test
```
**Test Coverage**:
- Phone number normalization and E.164 formatting.
- SMS dispatch validation and dev-mode simulation.

### 6. Frontend Production Build Validation
```bash
npm --prefix frontend run build
```
**Expected Output**: Exit code `0` with zero TypeScript or bundling errors.

---

## 5. Summary of Key Integrity Safeguards

1. **No Fake Roads or Simulated GPS**: Transit visualizations depict the authoritative geospatial corridor between verified facilities. Dispatches and samples clearly state: *"Direct cold-chain courier transport. Live GPS vehicle telemetry is not connected; following verified chain-of-custody hand-off protocol."*
2. **Honest Clinical States**: Newly created requisitions remain in `Pending`, `Sample Submitted`, or `Reserved` until an authoritative dispatch manifest is created.
3. **Symmetric Cross-Portal Data**: Both the hospital staff and blood bank staff view the identical transit corridor, origin, destination, distance, courier reference, and temperature parameters.
4. **Shielded Local Coordinates**: Sync logic protects Sangli facilities from ever being overwritten by default NYC coordinates.

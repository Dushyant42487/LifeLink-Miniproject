# LifeLink — Phase 8: Clean Data, Comprehensive Manual Verification Runbook

## Overview

This document provides a click-by-click, reproducible manual testing runbook for the LifeLink clinical blood supply chain platform. It is tailored to the active codebase, verified routes, and authentic UI components.

Follow this guide to execute an end-to-end verification starting from a completely clean database state without hardcoded fallback records or stale fixtures.

---

## 1. Environment & Setup

### 1.1 Prerequisites
- **Node.js**: `v20.x` or higher (verified on Node 20.x+)
- **npm**: `v10.x` or higher
- **Web Browser**: Chrome, Firefox, Safari, or Chromium-based modern browser
- **Operating System**: macOS, Linux, or Windows WSL

### 1.2 Configuration & Ports
- **Backend API**: `http://localhost:5001`
- **Frontend Web Portal**: `http://localhost:3000`
- **Database Engine**: In-memory `DataStore` (with optional Supabase persistence if credentials are provided in `.env`).

#### Environment Configuration (.env in project root or backend/.env)
```env
# Application Ports
PORT=5001
NODE_ENV=development

# JWT Authentication
JWT_SECRET=lifelink-dev-jwt-secret-replace-in-production-min-32-chars
JWT_EXPIRES_IN=7d

# Database Connection (Leave dummy values for disposable in-memory store)
SUPABASE_URL=https://dummy-dev-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_dev_key

# Test Fixture Isolation Flag (Must be 'false' for clean manual verification)
SEED_DEV_FIXTURES=false
```

### 1.3 Service Startup Commands

Open two terminal tabs:

**Terminal 1 — Backend API Server:**
```bash
cd backend
npm install
npm run dev
```
*Expected log output:*
```
[LifeLink] Starting server...
[Security] Production rate limiter initialized with relaxed dev limits.
[LifeLink] Storage mode: In-Memory DataStore (disposable dev sandbox)
[LifeLink] Clean startup: DataStore initialized empty (SEED_DEV_FIXTURES=false).
[LifeLink] Express server running on port 5001
```

**Terminal 2 — Frontend Application:**
```bash
cd frontend
npm install
npm run dev
```
*Expected log output:*
```
  VITE v5.4.21  ready in ~200 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### 1.4 How to Confirm Database State & Reset Data
Before starting a test session, verify that the database is completely empty:

```bash
# Check record counts in the active DataStore
curl -s http://localhost:5001/api/test/counts | jq .

# Reset database to strictly zero records at any time
curl -s -X POST http://localhost:5001/api/test/reset | jq .

# Confirm public analytics counts are strictly zero
curl -s http://localhost:5001/api/public/stats | jq .
```
Expected output of `curl http://localhost:5001/api/public/stats`:
```json
{
  "success": true,
  "stats": {
    "totalDonors": 0,
    "totalHospitals": 0,
    "totalBloodBanks": 0,
    "totalUnitsAvailable": 0,
    "totalRequestsFulfilled": 0,
    "livesSavedEstimate": 0
  }
}
```

---

## 2. Test Account Setup & Matrix

All accounts must be created using the real web interface at `http://localhost:3000/register`. No pre-seeded demo credentials are required.

| Role | Creation Route | Required Fields / Synthetic Values | Permissions & Boundary | How to Verify Tenant Isolation |
| :--- | :--- | :--- | :--- | :--- |
| **Donor** | `/register` (Select "Donor" tab) | Name: `Jordan Rivers`<br>Email: `jordan.donor@testmail.com`<br>Pass: `password123`<br>Blood Group: `A+`<br>DOB: `1995-06-15`<br>Weight: `72`<br>City: `Metropolis` | Donor profile, camp appointments, donation history, emergency pass. Cannot view hospital orders or inventory. | Cannot access `/hospital/*` or `/blood-bank/*`; redirected to `/donor/dashboard`. |
| **Blood Bank** | `/register` (Select "Blood Bank" tab) | Facility: `Apex Regional Blood Bank`<br>Reg ID: `BB-LIC-APEX-01`<br>Email: `apex.bank@testmail.com`<br>Pass: `password123`<br>Contact: `Dr. Sarah Chen`<br>City: `Metropolis` | Phlebotomy collections, camps, component fractionation, disease lab screening, inventory release, hospital requisition allocation, courier dispatch. | Cannot view or modify blood units, requests, or dispatches belonging to other blood centers. |
| **Hospital A** (Primary) | `/register` (Select "Hospital" tab) | Facility: `St. Jude Trauma Hospital`<br>License: `HOSP-SJ-9001`<br>Email: `stjude.hosp@testmail.com`<br>Pass: `password123`<br>Contact: `Dr. Robert Vance`<br>City: `Metropolis` | Requisition creation, clinical urgency flagging, blood availability search, cross-match samples, delivery receipt confirmation, OT storage ledger. | Requests created by St. Jude are strictly isolated to St. Jude. |
| **Hospital B** (Isolation Check) | `/register` (Select "Hospital" tab) | Facility: `City Mercy Clinic`<br>License: `HOSP-CMC-4002`<br>Email: `citymercy@testmail.com`<br>Pass: `password123`<br>Contact: `Nurse Clara Barton`<br>City: `Metropolis` | Same as Hospital A, strictly scoped to City Mercy Clinic. | Must NOT see Hospital A's requisitions, patients, samples, or messages. |

---

## 3. End-to-End Cross-Portal Workflow (The 8-Phase Verification)

```
[Donor Portal]
Jordan Rivers registers -> Completes eligibility check -> Books appointment at Apex Blood Center
      │
      ▼
[Blood Bank Portal]
Apex Blood Bank searches Jordan -> Records 450 mL Whole Blood collection
      │
      ▼
[Blood Bank Processing]
Fractionates Whole Blood -> 280 mL RBC + 170 mL Plasma (Both Quarantined)
      │
      ▼
[Blood Bank Testing Lab]
Performs infectious disease panel -> Clears unit (Negative) -> Unit becomes Available
      │
      ▼
[Hospital Portal]
St. Jude Trauma Hospital creates Requisition for 1 unit of A+ RBC (Emergency Trauma)
      │
      ▼
[Blood Bank Allocation Desk]
Blood Bank views requisition -> Allocates released A+ RBC unit -> Status becomes Reserved
      │
      ▼
[Blood Bank Dispatch Desk]
Prepares dispatch (Manifest DSP-xxxx) -> Confirms courier handoff -> Status becomes Dispatched
      │
      ▼
[Hospital Portal Receiving]
Hospital confirms physical receipt -> Requisition Fulfilled -> Unit logged to OT storage ledger
```

---

## 4. Click-by-Click Execution Instructions

### Step 1: Clean Reset & Public Landing Verification
1. Open a terminal and run:
   ```bash
   curl -s -X POST http://localhost:5001/api/test/reset
   ```
2. In browser, navigate to: `http://localhost:3000/`
3. **Verify**:
   - Hero banner displays "Verified Blood Supply Chain Network".
   - Stats section shows `0 Donors`, `0 Partner Hospitals`, `0 Blood Centers`, `0 Units Available`, `0 Requests Fulfilled`.
   - "Active Donation Camps" section displays clean empty state: *"No active donation camps scheduled in your area currently."*
   - No mock arrays (like Alex Mercer or hardcoded 420 counts) appear.

---

### Step 2: Donor Registration & Eligibility Check
1. Navigate to: `http://localhost:3000/register`
2. Click the **Donor** tab.
3. Fill in the fields:
   - Full Name: `Jordan Rivers`
   - Email: `jordan.donor@testmail.com`
   - Password: `password123`
   - Blood Group: `A+`
   - Date of Birth: `1995-06-15`
   - Gender: `Male`
   - Contact Phone: `+1-555-0144`
   - Address: `742 Evergreen Terrace`
   - City: `Metropolis`
   - State: `NY`
   - Weight (kg): `74`
4. Click **Complete Registration**.
5. **Expected Result**: Successfully redirects to `/donor/dashboard`.
6. Inspect the dashboard:
   - Greeting shows *"Welcome back, Jordan Rivers"*.
   - Blood group badge displays `A+`.
   - Empty state on history: *"No donation records found yet."* with button to find camps.
7. Click sidebar navigation link **Eligibility Check** (`/donor/eligibility`).
8. Complete the questionnaire:
   - Age: `29` (Auto-calculated)
   - Weight: `74` (Auto-filled)
   - Well-being checkboxes: Answer Yes to feeling healthy, No to recent tattoo/surgery, No to antibiotic treatment.
9. Click **Calculate Eligibility**.
10. **Expected Result**: Banner displays *"You are currently eligible to donate blood!"* with a green checkmark and next donation date permitted today.

---

### Step 3: Blood Bank Registration & Phlebotomy Collection
1. Click **Sign Out** in the top navigation bar.
2. Navigate to: `http://localhost:3000/register`
3. Click the **Blood Bank** tab.
4. Fill in the fields:
   - Blood Bank Name: `Apex Regional Blood Bank`
   - Registration / License ID: `BB-LIC-APEX-01`
   - Email: `apex.bank@testmail.com`
   - Password: `password123`
   - Contact Person: `Dr. Sarah Chen`
   - Phone: `+1-555-0188`
   - Emergency Phone: `+1-555-0189`
   - Address: `100 Health Sciences Plaza`
   - City: `Metropolis`
   - State: `NY`
5. Click **Register Account**.
6. **Expected Result**: Successfully redirects to `/blood-bank/dashboard`.
7. Inspect the dashboard:
   - Facility header shows `Apex Regional Blood Bank` and `License: BB-LIC-APEX-01`.
   - Total Inventory shows `0 units`.
8. Click sidebar navigation link **Collections & Camps** (`/blood-bank/collections`).
9. On Tab 1 (**Phlebotomy Collections**):
   - Click **Record In-House Collection**.
   - In Donor Search box, type `Jordan` or `jordan.donor@testmail.com` and click Search.
   - Select donor `Jordan Rivers (A+)`.
   - Set Collection Type: `In-House Phlebotomy`.
   - Set Component: `Whole Blood`.
   - Volume: `450` mL.
   - Phlebotomist Name: `Nurse Laura Dean`.
   - Click **Confirm & Record Collection**.
10. **Expected Result**: Modal closes. Collection appears in table with status `Collected / Quarantined`.
11. **Negative Test**: Immediately click **Record In-House Collection** again with identical parameters for Jordan today.
    - **Expected Result**: Server returns `409 Conflict` error: *"Donor Jordan Rivers already completed a donation on this date."*

---

### Step 4: Component Fractionation Processing
1. In `/blood-bank/collections`, click Tab 3: **Component Processing** (or Fractionation).
2. The Whole Blood collection for Jordan Rivers appears in the **Pending Fractionation** list.
3. Click **Process / Fractionate**.
4. In the Fractionation Modal:
   - Operator Name: `Lab Tech Sam Lee`
   - Method: `Centrifugation`
   - Select components to produce:
     - Check **RBC (Packed Red Blood Cells)**: Volume `280` mL, Storage `Walk-In Chiller Shelf 1`.
     - Check **Plasma (Fresh Frozen Plasma)**: Volume `170` mL, Storage `Deep Freeze Bay 2`.
   - Sum equals 450 mL (within clinical volume tolerance).
5. Click **Execute Component Processing**.
6. **Expected Result**:
   - Modal reports success: 2 component units generated.
   - Navigate to **Inventory** (`/blood-bank/inventory`).
   - Both units (RBC and Plasma) are listed.
   - **Crucial**: Both units have Availability = `Quarantined` and Testing Status = `Quarantined`.
   - Available Units on the top metric card remains `0` (quarantined units do not inflate available stock).

---

### Step 5: Laboratory Screening & Release to Available Stock
1. Click sidebar navigation link **Lab Testing & Screening** (`/blood-bank/testing`).
2. The testing queue displays both newly fractionated units with status `Pending` (or `Quarantined`).
3. Click the **RBC** unit (`A+`, `280 mL`).
4. Review the infectious disease screening panel:
   - HIV 1/2 Ab/Ag
   - Hepatitis B (HBsAg)
   - Hepatitis C (Anti-HCV)
   - Syphilis (VDRL / RPR)
   - Malaria Parasite
5. Click **Clear & Release to Stock (All Negative)**.
6. **Expected Result**:
   - Confirmation toast appears: *"Unit verified NEGATIVE and cleared into available inventory!"*
   - Status changes to `Passed`.
7. Navigate to **Inventory** (`/blood-bank/inventory`):
   - The A+ RBC unit now displays Availability = `Available` and Testing Status = `Passed`.
   - Storage Location has updated to `RBC Main Storage Bay`.
   - Dashboard total available inventory now increments to `1`.

---

### Step 6: Hospital Registration & Clinical Blood Requisition
1. Click **Sign Out**.
2. Navigate to: `http://localhost:3000/register`
3. Click the **Hospital** tab.
4. Fill in the fields:
   - Hospital Name: `St. Jude Trauma Hospital`
   - License ID: `HOSP-SJ-9001`
   - Email: `stjude.hosp@testmail.com`
   - Password: `password123`
   - Contact Person: `Dr. Robert Vance`
   - Phone: `+1-555-0211`
   - Emergency Phone: `+1-555-0212`
   - Address: `500 Medical Center Way`
   - City: `Metropolis`
   - State: `NY`
5. Click **Register Account**.
6. **Expected Result**: Successfully redirects to `/hospital/dashboard`.
7. Click sidebar navigation link **Create Request** (`/hospital/requests/new`).
8. Fill in the clinical requisition:
   - Patient Reference ID: `PAT-2026-901`
   - Blood Group: `A+`
   - Component: `RBC`
   - Quantity: `1` Unit
   - Urgency Level: Select `Emergency (Within 2 Hours)`
   - Department: `Trauma Surgery OT-3`
   - Target Blood Bank: Select `Apex Regional Blood Bank`
   - Clinical Reason: `Acute hemorrhagic trauma requiring immediate PRBC transfusion.`
9. Click **Submit Blood Requisition**.
10. **Expected Result**: Requisition submitted successfully. Redirects to `/hospital/requests`.
11. Requisition appears in the list with status `Pending` (or `Urgent Pending`).

---

### Step 7: Blood Bank Unit Allocation & Reservation
1. Open an incognito/private browser window (or Sign Out and log back in as `apex.bank@testmail.com`).
2. Navigate to: `http://localhost:3000/blood-bank/requests` (Hospital Requisitions Desk).
3. The requisition from St. Jude Trauma Hospital for `1 Unit A+ RBC` appears at the top with an `Emergency` tag.
4. Click on the requisition card to open the **Fulfillment & Allocation Workspace**.
5. Inspect the **Eligible Available Units** panel:
   - The released A+ RBC unit from Jordan Rivers is listed.
   - Untested or quarantined units are NOT shown.
6. Click the unit or type its Unit ID into the barcode staging box and click **Add Unit**.
7. Click **Commit Allocation & Reserve**.
8. **Expected Result**:
   - Requisition status transitions to `Reserved`.
   - The unit's availability in inventory changes from `Available` to `Reserved`.
   - Reserved quantity updates to `1`.

---

### Step 8: Dispatch Preparation & Courier Handoff
1. With the same requisition selected in `/blood-bank/requests`:
2. Click **Prepare Dispatch Manifest**.
3. In the Dispatch Modal:
   - Courier Type: Select `Dedicated Hospital Courier`.
   - Courier Vehicle / Staff Reference: `VAN-METRO-09`.
   - Packaging Type: `Standard Passive Thermal Container with Ice Gel Packs`.
   - Temperature Range: `2°C to 6°C (Chilled)`.
   - Special Instructions: `Keep upright. Verify cold chain indicator on arrival.`
4. Click **Generate Dispatch Slip & Seal**.
5. **Expected Result**:
   - Manifest `DSP-xxxx` generated.
   - Requisition status transitions to `Prepared for Dispatch`.
   - Packing slip can be previewed/printed.
6. Click **Confirm Courier Handoff** (or **Confirm Dispatch**).
7. Confirm the prompt dialog.
8. **Expected Result**:
   - Requisition status transitions to `Dispatched`.
   - Assigned blood unit transitions from `Reserved` to `Issued`.
   - Courier is marked in transit to `St. Jude Trauma Hospital`.

---

### Step 9: Hospital Physical Receipt & OT Storage Stocking
1. Switch back to the window logged in as `stjude.hosp@testmail.com`.
2. Navigate to: `http://localhost:3000/hospital/requests`.
3. The requisition status now shows `Dispatched` with the courier reference `VAN-METRO-09`.
4. Click the requisition, then click the green button **Confirm Delivery Receipt**.
5. In the confirmation modal:
   - Receipt Notes: `Physical cooler inspected. Seal intact. Temperature confirmed at 3.8°C.`
6. Click **Confirm Receipt & Accept Into Care**.
7. **Expected Result**:
   - Requisition status changes to `Fulfilled` (1/1 units fulfilled).
   - Timeline appends completion entry.
8. Navigate to **Hospital Dashboard** (`/hospital/dashboard`) or OT Storage Ledger:
   - The received A+ RBC unit is automatically added to the Hospital's on-hand storage ledger.
   - Public landing page (`http://localhost:3000/`) now reflects `1 Total Request Fulfilled`!

---

## 5. Multi-Tenant Isolation & Security Verification

Execute these negative test checks to ensure complete privacy across facilities:

### 5.1 Hospital Multi-Tenant Isolation
1. Register a second hospital at `/register`:
   - Name: `City Mercy Clinic`
   - License: `HOSP-CMC-4002`
   - Email: `citymercy@testmail.com`
   - Password: `password123`
2. Navigate to: `http://localhost:3000/hospital/requests`.
3. **Verify**:
   - The requisition list is completely empty.
   - Requisitions created by `St. Jude Trauma Hospital` are NOT visible.
4. Test API unauthorized access:
   - Using City Mercy's JWT token, attempt to fetch St. Jude's requisition via API:
     ```bash
     curl -s -H "Authorization: Bearer <CITY_MERCY_TOKEN>" http://localhost:5001/api/hospitals/requests/<ST_JUDE_REQ_ID>
     ```
   - **Expected Result**: HTTP `403 Forbidden` or `404 Not Found` with error *"Access denied: Requisition belongs to another hospital facility"*.

### 5.2 Blood Bank Multi-Tenant Isolation
1. Register a second blood bank:
   - Name: `Valley Red Cross Depot`
   - License: `BB-LIC-VRC-02`
   - Email: `valley.depot@testmail.com`
2. Navigate to `/blood-bank/inventory`.
3. **Verify**:
   - Inventory is `0`.
   - Valley Depot cannot see Apex Blood Bank's units or dispatches.

### 5.3 Role Isolation & Route Guarding
1. While logged in as `jordan.donor@testmail.com`, paste this URL directly into the browser address bar:
   `http://localhost:3000/blood-bank/inventory`
2. **Expected Result**:
   - Route guard automatically intercepts the navigation and redirects to `/donor/dashboard`.
   - Privileged blood bank data is never rendered.

---

## 6. Negative & Recovery Test Checklist

| Test Scenario | Steps to Execute | Expected Behavior | Recovery Action |
| :--- | :--- | :--- | :--- |
| **Empty Database** | Run `curl -X POST http://localhost:5001/api/test/reset`, then visit every portal dashboard. | All cards show 0 counts; lists render friendly empty states without crashing or NaN values. | Normal behavior. Proceed with account registration. |
| **Invalid Form Submission** | Attempt to submit requisition with quantity = `-5` or empty patient ID. | Form validation flags the invalid field; submit button disabled or returns 400 Bad Request. | Correct inputs and re-submit. |
| **Duplicate Collection** | Submit two identical phlebotomy collections for the same donor on the same day. | Server rejects the second attempt with `409 Conflict`. | Use a different donor or proceed with processing the first collection. |
| **Untested Unit Allocation** | Attempt to allocate a Quarantined unit directly to a requisition. | Unit does not appear in eligible list; manual barcode entry returns `400 Bad Request`. | Complete lab testing first to clear the unit. |
| **Cross-Tenant Access** | Access another hospital's requisition ID directly in the URL `/hospital/requests/:otherId`. | Redirects or displays `403 Access Denied`. | Switch back to the authenticated hospital's own orders. |
| **Backend Restart Persistence** | Create a donor and blood unit, restart the backend server, and reload the web page. | In-memory sandbox resets cleanly to empty; if Supabase credentials are configured, records persist. | Use the documented startup commands to test either configuration. |

---

## 7. Troubleshooting Guide

| Symptom / Error | Root Cause | Solution / Fix |
| :--- | :--- | :--- |
| `ERR_CONNECTION_REFUSED` on port 5001 | Backend server is not running. | Run `cd backend && npm run dev` in a terminal. |
| Port 5001 or 3000 already in use | Previous process lingering in background. | Run `lsof -i :5001` or `lsof -i :3000`, then `kill -9 <PID>`. |
| Login fails with `401 Invalid email or password` | Testing against clean database without re-registering account. | Accounts do not persist across in-memory server restarts; register a fresh test account at `/register`. |
| "Unit is either not in available inventory or clinically incompatible" | The unit is still in `Quarantined` status or blood group is incompatible. | Navigate to `/blood-bank/testing` and click **Clear & Release to Stock**. |
| "Cannot confirm receipt: Requisition is currently in 'Pending' status" | Requisition must be allocated and dispatched before hospital receipt. | Log in as blood bank, allocate units, prepare dispatch, and confirm courier handoff first. |

---

## 8. Manual Test Execution Results Table

*Execute each test step in order and record your findings below. Leave actual results blank until tested.*

| Test ID | Test Scenario | Verified Expected Result | Actual Result | Status (Pass / Fail / Blocked) | Evidence / Notes | Follow-Up Issue |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Clean Reset & Landing Page | All counters show 0; empty camp banner renders cleanly; no mock data. | | | | |
| **TC-02** | Donor Registration | Form submits cleanly; redirects to `/donor/dashboard`; name and blood group match. | | | | |
| **TC-03** | Donor Eligibility | Completed questionnaire returns green eligible badge with next allowed date today. | | | | |
| **TC-04** | Blood Bank Registration | Registers successfully; dashboard shows facility name and license ID. | | | | |
| **TC-05** | Phlebotomy Collection | Donor searchable by name; collection recorded in Quarantined state. | | | | |
| **TC-06** | Duplicate Collection Prevention | Repeated collection attempt for same donor on same day blocked with 409 Conflict. | | | | |
| **TC-07** | Component Fractionation | Whole blood yields 280 mL RBC + 170 mL Plasma; both units start Quarantined. | | | | |
| **TC-08** | Lab Disease Screening | Marking viral markers Negative transitions unit testingStatus to Passed and stock to Available. | | | | |
| **TC-09** | Hospital Registration | Registers cleanly; lands on `/hospital/dashboard`. | | | | |
| **TC-10** | Clinical Requisition Creation | Emergency A+ RBC request submitted and appears in hospital order list as Pending. | | | | |
| **TC-11** | Blood Bank Allocation | Blood bank sees requisition; only Passed A+ RBC unit is eligible; transitions to Reserved. | | | | |
| **TC-12** | Dispatch Preparation | Packing manifest DSP-xxxx generated with cold-chain parameters (2°C - 6°C). | | | | |
| **TC-13** | Courier Handoff Confirmation | Handover to courier transitions requisition to Dispatched and unit to Issued. | | | | |
| **TC-14** | Hospital Delivery Receipt | Hospital confirms delivery; requisition marked Fulfilled; unit added to OT storage ledger. | | | | |
| **TC-15** | Multi-Tenant Hospital Isolation | Second hospital cannot view or modify First hospital's requisition or patient samples. | | | | |
| **TC-16** | Cross-Portal Sync | Donor history, blood bank stock, hospital requests, and public stats all agree. | | | | |

---

## 9. Recommended Order for First Manual Test Run

1. Open Terminal and run: `curl -s -X POST http://localhost:5001/api/test/reset`
2. Open Browser Tab 1: `http://localhost:3000/` (Verify clean landing stats).
3. Open Browser Tab 2: `http://localhost:3000/register` -> Register **Jordan Rivers** (Donor).
4. In Tab 2: Test `/donor/eligibility`.
5. Open Browser Tab 3 (Incognito): `http://localhost:3000/register` -> Register **Apex Regional Blood Bank**.
6. In Tab 3: Navigate to `/blood-bank/collections` -> Record Jordan's collection -> Fractionate into RBC & Plasma.
7. In Tab 3: Navigate to `/blood-bank/testing` -> Release RBC unit to stock.
8. Open Browser Tab 4 (Second Incognito or separate profile): `http://localhost:3000/register` -> Register **St. Jude Trauma Hospital**.
9. In Tab 4: Navigate to `/hospital/requests/new` -> Create Emergency requisition for 1 unit of A+ RBC.
10. In Tab 3 (Blood Bank): Navigate to `/blood-bank/requests` -> Allocate unit -> Prepare dispatch -> Confirm courier handoff.
11. In Tab 4 (Hospital): Navigate to `/hospital/requests` -> Click **Confirm Delivery Receipt**.
12. In Tab 1: Refresh `http://localhost:3000/` -> Verify `1 Total Request Fulfilled`!

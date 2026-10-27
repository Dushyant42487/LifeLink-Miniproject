# LifeLink — End-to-End Manual Verification & Testing Guide

**System**: LifeLink Healthcare Platform  
**Target Architecture**: Node.js/Express Backend (`http://localhost:5001`), React/Vite Frontend (`http://localhost:5173`)  
**Data Engine**: Relational DataStore with Supabase Sync (`backend/data/datastore.json`)  
**Scope**: Manual verification of clean, non-mocked cross-portal workflows, tenant authorization, dynamic location routing, and persistent storage.

---

## 1. Startup & Environment Setup

### 1.1 Backend Service Startup
Open a terminal in the project root `/Users/dushyant/LifeLinkmo`:
```bash
# 1. Build TypeScript sources
npm --prefix backend run build

# 2. Start Central API in normal authoritative mode (no auto-seeding of fake users)
npm --prefix backend run start
```
- Health Probe: Verify API status via `curl http://localhost:5001/api/health`
- Expected Output: `status: "healthy"`, `storage.isDurablePersistence: true`.

### 1.2 Frontend Web App Startup
Open a second terminal:
```bash
# Start Vite development server
npm --prefix frontend run dev
```
- Web Application URL: `http://localhost:5173`

---

## 2. Test Account Directory

All passwords in the default testing environment are: **`password123`**

| Portal | Role | Email | Organization / Name | Default Status |
|---|---|---|---|---|
| **Blood Bank** | `blood_bank` | `central@citybloodbank.org` | City Central Blood Bank (`bb-1`) | Verified Licensed Facility (`BB-LIC-2024-001`) |
| **Blood Bank (B)** | `blood_bank` | `redcross@regionalblood.org` | Red Cross Regional Center (`bb-2`) | Verified Licensed Facility (`BB-LIC-2024-008`) |
| **Hospital** | `hospital` | `emergency@apellogeneral.org` | Apollo General Hospital (`hosp-1`) | Verified Clinical Facility (`HOSP-NY-9021`) |
| **Hospital (B)** | `hospital` | `trauma@metrolifecare.org` | Metro LifeCare Hospital (`hosp-2`) | Verified Clinical Facility (`HOSP-NY-9088`) |
| **Donor (Cool-off)** | `donor` | `alex.mercer@example.com` | Alex Mercer (`donor-1`) | Verified, Whole Blood Cool-off Active (O+) |
| **Donor (Eligible)** | `donor` | `emma.watson@example.com` | Emma Watson (`donor-4`) | Verified, Fully Eligible (A-) |
| **Donor (Fresh)** | `donor` | `integ-donor@lifelink.org` | Integration Donor (`donor-test-integ`) | Fresh Account, Unverified, Zero Donations |

---

## 3. Real Portal Navigation Routes

### Public Pages
- Landing Page: `http://localhost:5173/`
- Login: `http://localhost:5173/login`
- Registration: `http://localhost:5173/register`
- Public Blood Search: `http://localhost:5173/search-blood`
- Public Awareness: `http://localhost:5173/awareness`
- Notifications Inbox: `http://localhost:5173/notifications`

### Donor Portal (`/donor/*`)
- Dashboard: `http://localhost:5173/donor/dashboard`
- Eligibility Assessment: `http://localhost:5173/donor/eligibility`
- Donation History: `http://localhost:5173/donor/donations`
- Mobile Camps & Drives: `http://localhost:5173/donor/camps`
- Emergency Alerts: `http://localhost:5173/donor/alerts`
- Nearby Hospitals Map: `http://localhost:5173/donor/hospitals`
- Donor Profile: `http://localhost:5173/donor/profile`

### Hospital Portal (`/hospital/*`)
- Dashboard: `http://localhost:5173/hospital/dashboard`
- Create Requisition: `http://localhost:5173/hospital/create-request`
- Requisitions & Tracking: `http://localhost:5173/hospital/requests`
- Emergency Requisition Hub: `http://localhost:5173/hospital/emergency`
- Patient Samples Desk: `http://localhost:5173/hospital/samples`
- Requisition Communications: `http://localhost:5173/hospital/messages`
- Logistics & Transit Map: `http://localhost:5173/hospital/logistics`
- Hospital Profile: `http://localhost:5173/hospital/profile`

### Blood Bank Portal (`/blood-bank/*`)
- Dashboard: `http://localhost:5173/blood-bank/dashboard`
- Inventory & FEFO Desk: `http://localhost:5173/blood-bank/inventory`
- Phlebotomy & Collections: `http://localhost:5173/blood-bank/collections`
- Lab Screening Desk: `http://localhost:5173/blood-bank/testing`
- Hospital Requisitions Hub: `http://localhost:5173/blood-bank/hospital-requests`
- Unit Reservations: `http://localhost:5173/blood-bank/reservations`
- Cold Storage & IoT Alarms: `http://localhost:5173/blood-bank/cold-storage`
- Expiry & Wastage Tracking: `http://localhost:5173/blood-bank/expiry`
- AI Insights & Deficits: `http://localhost:5173/blood-bank/insights`
- Operational Reports: `http://localhost:5173/blood-bank/reports`
- Blood Bank Profile: `http://localhost:5173/blood-bank/profile`

---

## 4. Step-by-Step Cross-Portal Workflows

### Workflow A: Real Donor Registration & Verification
1. Navigate to `http://localhost:5173/register`.
2. Register a new voluntary donor (e.g. `testdonor@example.com`, select role "Donor").
3. Log in as the new donor.
4. Verify Dashboard initial state:
   - Verification Status: **Unverified** (no fake pre-approval).
   - Medical Eligibility: **Not Eligible** (`isEligible: false`).
   - Blood Group: **Unspecified** (no default to O+).
   - Donations Count: **0**.
5. Navigate to **Donor Profile** (`/donor/profile`).
6. Upload proof of blood group (select assigned blood bank `City Central Blood Bank`).
7. Log out and log in as Blood Bank operator (`central@citybloodbank.org`).
8. Open the **Donor Verification Queue**.
9. The newly registered donor appears in the queue. Review the document and click **Approve Verification**.
10. Log back in as the donor: the profile now reflects **Verified** with an official digital badge.

---

### Workflow B: Phlebotomy Collection & Infectious Disease Screening
1. Log in as Blood Bank operator (`central@citybloodbank.org`).
2. Navigate to **Collections** (`/blood-bank/collections`).
3. Under "Record New Phlebotomy Donation":
   - Select verified donor `Emma Watson` (`donor-4`).
   - Collection Type: `Whole Blood`.
   - Volume: `450 mL`.
   - Click **Record Collection**.
4. Navigate to **Lab Screening Desk** (`/blood-bank/testing`).
5. Notice that the new unit (`UNIT-...`) appears under **Quarantine** with **Pending Testing**.
   - Available inventory has **not** inflated (quarantine isolation strictly enforced).
6. Under Serology Panel, test all 5 markers:
   - HIV: `Negative`
   - HBV: `Negative`
   - HCV: `Negative`
   - Syphilis: `Negative`
   - Malaria: `Negative`
   - Select overall status: **Passed**. Click **Submit Screening Result**.
7. Navigate to **Inventory Desk** (`/blood-bank/inventory`):
   - The unit transitions to **Available** stock with verified FEFO shelf-life.

---

### Workflow C: Component Fractionation & Cold-Chain Storage
1. Navigate to **Component Processing** under Collections.
2. Select the whole-blood collection recorded above.
3. Choose component separation:
   - Packed RBC: `250 mL` -> Assigned to Refrigerator Unit `SU-BB1-REF-01` (4°C target).
   - Fresh Frozen Plasma: `150 mL` -> Assigned to Deep Freezer `SU-BB1-FRZ-01` (-30°C target).
   - Platelets: `50 mL` -> Assigned to Agitator Incubator `SU-BB1-AGI-01` (22°C target).
4. Verify that total yield (`450 mL`) adheres to clinical yield tolerance (exceeding volume returns 422).
5. Click **Process Fractionation**. Each component unit is created with complete parent collection traceability and batch numbers.

---

### Workflow D: Clinical Hospital Requisition & Smart Auto-Routing
1. Log in as Hospital Chief Surgeon (`emergency@apellogeneral.org`).
2. Navigate to **Create Requisition** (`/hospital/create-request`).
3. Enter Requisition Parameters:
   - Patient Reference: `PAT-2026-CARD-01` (e.g., Cardiac Bypass).
   - Blood Group: `A+`.
   - Component: `RBC`.
   - Required Quantity: `2 Units`.
   - Urgency: `Emergency (Immediate Life Support)`.
4. Submit Requisition.
5. Expected Behavior:
   - Server runs Haversine candidate ranking using actual facility coordinates.
   - Selected candidate blood bank (`City Central Blood Bank`) receives an emergency offer notification with high-priority audio alert within 200 ms.
   - Hospital dashboard reflects status **Submitted / Auto-Routing Dispatched**.

---

### Workflow E: Offer Acceptance, Unit Allocation & Cold-Chain Dispatch
1. Log in as Blood Bank operator (`central@citybloodbank.org`).
2. Navigate to **Hospital Requests Hub** (`/blood-bank/hospital-requests`).
3. The emergency request appears at the top of the queue with candidate rank `#1`.
4. Click **Accept Routing Offer**.
5. Click **Allocate Units**:
   - The modal presents authoritative, tested, clinically compatible units in FEFO order.
   - Select 2 eligible units and click **Confirm Allocation**.
   - Attempting to assign an already-reserved unit immediately returns **409 Conflict**.
6. Generate **Dispatch Manifest**:
   - Assign Courier Name: `Metro Medical Logistics Express`.
   - Transport Cold Box ID: `BOX-ICE-402`.
   - Target Temperature: `2°C - 6°C`.
   - Click **Confirm Cold-Chain Dispatch**.
7. Requisition updates to **Dispatched**.

---

### Workflow F: Hospital Receipt Confirmation & Multi-Portal Reconciliation
1. Switch back to Hospital portal (`emergency@apellogeneral.org`).
2. Navigate to **Requisitions & Tracking** (`/hospital/requests`).
3. Select the dispatched requisition.
4. Click **Confirm Receipt & Cold-Chain Inspection**:
   - Temperature on arrival: `4.2°C` (acceptable range).
   - Seal Integrity: `Intact`.
   - Click **Sign Receipt**.
5. Requisition transitions to **Fulfilled**.
6. Verify Cross-Portal Reconciliation:
   - Blood Bank dashboard: Allocated units transition to **Issued**.
   - Hospital dashboard: Requisition marked **Fulfilled**, and fulfillment rate KPI updates dynamically.
   - Notification Bell: Both organizations receive confirmed delivery receipts.

---

## 5. Persistence & Durability Verification

To verify that operational records survive process restarts without database corruption:
1. Complete any workflow above (e.g., submit a requisition or record a collection).
2. Kill the running backend server terminal: `Ctrl + C` (or `npm run stop`).
3. Restart the backend:
   ```bash
   npm --prefix backend run start
   ```
4. Refresh the frontend browser (`Cmd + R` or `F5`).
5. Verify that:
   - The created requisition, allocated unit IDs, and statuses remain intact.
   - Newly registered donors remain verified.
   - Notification read/unread states are preserved.
   - No duplicate records or phantom seed records have been injected.

---

## 6. Troubleshooting Common Issues

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| Requisition creation returns HTTP 400 with `needsLocationConfig: true` | Hospital facility location is missing coordinates | Open `/hospital/profile`, set valid address or click "Calibrate Coordinates" to save latitude and longitude. |
| Phlebotomy collection returns HTTP 422 with "deferred" | Selected donor donated within 56 days (Whole Blood) or 14 days (Platelets) | Select a donor with no recent donations (e.g. `Emma Watson` `donor-4`). |
| Allocation returns HTTP 409 Conflict | Unit is already allocated or reserved for another requisition | Select available units from the FEFO-sorted list with status `Available`. |
| Map displays empty or unconfigured state | Facility has not configured coordinates | Enter valid geographic coordinates in facility profile; fake NYC fallbacks are intentionally disabled. |
| Test suite reports port conflict | Another instance of LifeLink backend is running on port 5001 | Run `lsof -ti:5001 | xargs kill -9` and restart the backend. |

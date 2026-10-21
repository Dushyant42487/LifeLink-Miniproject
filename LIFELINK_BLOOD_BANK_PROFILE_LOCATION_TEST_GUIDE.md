# LifeLink: Blood Bank Organization Profile & Persistent Location Management Test Guide

---

## 1. Executive Summary & Root Cause Analysis

### Why Previous Attempts Failed
Previous location and routing changes were primarily UI-only adjustments that masked symptoms rather than addressing the core architectural gaps:

1. **Missing Client-Side Route Registration**:
   - `BloodBankProfilePage.tsx` existed in the codebase and was imported in [frontend/src/App.tsx](file:///Users/dushyant/LifeLinkmo/frontend/src/App.tsx#L46), but was **never registered as a `<Route path="/blood-bank/profile" ... />`** inside `<Routes>`.
   - Navigating to `/blood-bank/profile` (or any profile link) was caught by the catch-all redirect `<Route path="*" element={<Navigate to="/" replace />} />` and immediately bounced back to `/`.

2. **Missing Sidebar Navigation Link**:
   - [frontend/src/components/common/Sidebar.tsx](file:///Users/dushyant/LifeLinkmo/frontend/src/components/common/Sidebar.tsx#L173-L214) included navigation for inventory, cold-storage, requests, camps, and AI intelligence, but had **no navigation item for Organization Profile & Location** for the `blood_bank` role.
   - Blood bank staff had no way in the portal to discover or access their organization profile or configure their operational address.

3. **Incomplete Identity Resolution**:
   - `resolveBloodBank(req)` in [backend/src/controllers/bloodBankController.ts](file:///Users/dushyant/LifeLinkmo/backend/src/controllers/bloodBankController.ts#L49-L53) matched strictly by `b.id === userId || b.registrationId === userId`. If an organization staff member logged in where JWT claims contained their user ID or email, resolution could fail. `resolveBloodBank` has now been hardened to verify by `userId`, `registrationId`, and verified lowercase `userEmail`.

4. **Default Unconfigured NYC Coordinates**:
   - Because staff could not access the profile screen, newly registered blood banks like `wce@bloodbank.com` retained default NYC fallback coordinates `(40.7128, -74.006)`.
   - When a local hospital in Sangli (`wce@hospital.com` at `16.8438, 74.6015`) queried nearby facilities, distance calculations resulted in the **12,841 km distance anomaly**, or the blood bank was excluded from smart routing's 25–100 km radius.

5. **Durable Persistence Across Restarts**:
   - Profile updates now invoke `await persistRecordDirect('blood_banks', bb)` and `db.saveSnapshot()`, guaranteeing changes survive browser reloads, user logouts, and backend process restarts.

---

## 2. Architecture & Data Flow

```
[ Blood Bank Portal UI ]
   ├── Sidebar Nav: "Organization Profile & Location" -> /blood-bank/profile
   ├── BloodBankProfilePage.tsx:
   │     ├── Address Search (Nominatim Geocoding via LocationSearchInput)
   │     ├── Manual Coordinate Inputs (Validated: Lat [-90, 90], Lng [-180, 180])
   │     ├── Browser Facility GPS ("Use Facility Browser GPS")
   │     └── Interactive OpenStreetMap Leaflet Map (Draggable Marker)
   └── Submits PUT /api/blood-bank/profile
           │
           ▼
[ Backend Controller & Persistence ]
   ├── resolveBloodBank(req) (Validates JWT userId, registrationId, and email)
   ├── Updates in-memory db.bloodBanks
   ├── Calls persistRecordDirect('blood_banks', bb)
   └── Calls db.saveSnapshot() (persists to backend/data/datastore.json)
           │
           ▼
[ Consumer Subsystems ]
   ├── /api/public/locations (Deduplicated, genuine coordinates, no dummy markers)
   ├── /api/hospitals/logistics (Hospital Logistics Map, accurate corridor distance)
   └── smartRoutingService.ts (Ranks blood banks by authentic Haversine km distance)
```

---

## 3. Verified Test Accounts Directory

| Role | Facility Name | Email | Password | Coordinates | Region |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Blood Bank** | WCE Blood Bank Sangli (`user-1792574733075`) | `wce@bloodbank.com` | `password123` | `16.8440, 74.6018` | Sangli, MH |
| **Blood Bank** | City Central Blood Center (`bb-1`) | `admin@cityblood.org` | `password123` | `40.7130, -74.0065` | Metro City |
| **Blood Bank** | Red Cross Regional Center (`bb-2`) | `redcross@regionalblood.org` | `password123` | `40.7306, -73.9352` | Metro City |
| **Hospital** | WCE Memorial Hospital Sangli (`user-1792574656930`) | `wce@hospital.com` | `password123` | `16.8438, 74.6015` | Sangli, MH |
| **Hospital** | Apollo General Hospital (`hosp-1`) | `emergency@apellogeneral.org` | `password123` | `40.7484, -73.9857` | Metro City |
| **Admin** | LifeLink Administrator | `admin@lifelink.org` | `password123` | Central Admin | All Regions |

---

## 4. Step-by-Step Browser Verification Tests

### Test A: Blood Bank Profile Access & Navigation
1. **Open Browser**:
   - Navigate to `http://localhost:5173/login`.
   - Log in as Blood Bank staff:
     - **Email**: `wce@bloodbank.com`
     - **Password**: `password123`
     - **Role**: `Blood Bank`
2. **Verify Sidebar Link**:
   - In the left sidebar under **Blood Bank Operations**, look for:
     - **"Organization Profile & Location"** (with a red building icon).
   - Click the link.
3. **Verify Route & Page Loading**:
   - URL navigates to `http://localhost:5173/blood-bank/profile`.
   - The page renders the facility profile workspace with:
     - Header displaying facility name (`WCE Blood Bank Sangli`) and verification status (`Verified`).
     - License / Registration ID badge.
     - "GPS Location Configured" green status pill.

---

### Test B: Setting Real Location via Address Geocoding & Leaflet Map
1. **Search Address**:
   - In the **Registered Physical Address** card, locate the **Address Search & Geocoding** input.
   - Type `Vishrambag, Sangli`.
   - Click one of the suggestions from the dropdown.
   - Verify that City (`Sangli`), State (`Maharashtra`), and Coordinates auto-populate.
2. **Interactive Map Adjustment**:
   - In the **Geographic Position & Routing Coordinates** card:
     - Note the interactive OpenStreetMap preview.
     - Click and drag the red facility marker on the map.
     - Notice that Latitude and Longitude input fields update in real time to 6 decimal places.
3. **Manual Coordinate Entry**:
   - Set Latitude to `16.8440` and Longitude to `74.6018`.
   - Note that invalid coordinates (e.g., Lat > 90 or Lng > 180) are rejected with an explicit validation error.
4. **Save Facility Profile**:
   - Click **"Save Facility Profile & Coordinates"**.
   - Verify that a green confirmation alert appears:
     - *"Blood bank facility profile and verified coordinates updated successfully!"*
   - Verify that the "Unsaved changes" badge disappears.

---

### Test C: Persistence Across Reload, Re-Login & Backend Restart
1. **Browser Hard Reload**:
   - Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) while on `http://localhost:5173/blood-bank/profile`.
   - Verify all fields (facility name, contact person, address, city, state, latitude `16.8440`, longitude `74.6018`) remain exactly as saved.
2. **Logout & Re-Login**:
   - Click **Logout** at the bottom of the sidebar.
   - Log back in with `wce@bloodbank.com` / `password123`.
   - Click **Organization Profile & Location**.
   - Verify coordinates and address details are intact.
3. **Backend Persistence Verification**:
   - Verify via API that the database holds the updated record:
     ```bash
     curl -s http://localhost:5001/api/public/locations | jq '.bloodBanks[] | select(.id == "user-1792574733075")'
     ```
   - Expected Output:
     ```json
     {
       "id": "user-1792574733075",
       "name": "WCE Blood Bank Sangli",
       "bloodBankName": "WCE Blood Bank Sangli",
       "address": "Vishrambag, Sangli",
       "city": "Sangli",
       "state": "Maharashtra",
       "lat": 16.844,
       "lng": 74.6018,
       "hasValidLocation": true,
       "type": "blood_bank"
     }
     ```

---

### Test D: Hospital Map Verification (Genuine Coordinates, No NYC Anomaly)
1. **Login as Hospital**:
   - Log in with `wce@hospital.com` / `password123`.
2. **Access Regional Logistics Map**:
   - Navigate to `http://localhost:5173/hospital/logistics`.
3. **Verify Connected Centers Network**:
   - In the right-hand panel under **Connected Blood Centers Network**:
     - Locate `WCE Blood Bank Sangli`.
     - Verify the calculated distance is approximately **0.0 km – 0.1 km** (local Sangli proximity), **NEVER 12,841 km**.
   - Click `WCE Blood Bank Sangli` in the list:
     - The map centers directly on the Sangli facility at `16.8440, 74.6018`.
     - The hospital marker appears at `16.8438, 74.6015`.
     - The transit corridor polyline connects the two facilities across town.

---

### Test E: Nearest Blood Bank Routing with Genuine Proximity Calculation
1. **Create Emergency Requisition**:
   - Navigate to `http://localhost:5173/hospital/requests/new`.
   - Fill in:
     - **Urgency**: `Emergency (STAT)`
     - **Blood Group**: `O+`
     - **Component**: `Packed Red Blood Cells (PRBC)`
     - **Quantity**: `2 Units`
     - **Department**: `Emergency Trauma Bay`
     - **Routing Mode**: `Automated Nearest Proximity Routing (Default)`
   - Click **"Submit Emergency Blood Requisition"**.
2. **Verify Candidate Selection**:
   - The smart routing algorithm calculates Haversine distances from `wce@hospital.com` (`16.8438, 74.6015`).
   - `WCE Blood Bank Sangli` is identified as the **#1 nearest candidate** (~0.04 km away within the initial 25 km radius).
   - Distant facilities (e.g., Metro City facilities 12,800+ km away) are strictly excluded from the initial local radius.

---

## 5. Automated Regression Test Results

All four automated test suites run clean with 100% pass rate:

```bash
# 1. Cross-Portal Route & Facility Location Integrity Suite
node backend/tests/crossPortalRouteAndLocation.test.mjs
# Result: 10 / 10 passed (0 failed)

# 2. Smart Emergency Blood Routing & End-to-End Fulfillment Suite
node backend/tests/smartBloodRouting.test.mjs
# Result: 17 / 17 passed (0 failed)

# 3. Emergency Alarm Routing & Tone Controls Verification Suite
node backend/tests/emergencyAlarmRoutingAndToneControls.test.mjs
# Result: 10 / 10 passed (0 failed)

# 4. Saved Location, Donor Verification & Real-Time Notifications Suite
node backend/tests/locationVerificationNotification.test.mjs
# Result: 17 / 17 passed (0 failed)

# Total: 54 / 54 tests passing
```

### Production Build Verification
```bash
npm --prefix frontend run build
# Result: ✓ built in 2.08s (0 errors, 0 type issues)
```

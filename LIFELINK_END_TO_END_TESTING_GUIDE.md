# LifeLink — End-to-End Cross-Portal Testing & Verification Guide

**Document Version:** 2.0.0  
**Target Environment:** Local Full-Stack Deployment  
- Frontend Portal: `http://localhost:5173`  
- Backend API Server: `http://localhost:5001`  

---

## 1. Quick Start & Seed Credentials

Before beginning manual verification, ensure both frontend and backend servers are active. You can reset and re-seed the standard demo fixtures at any time by executing:

```bash
curl -X POST http://localhost:5001/api/test/seed-fixtures
```

### Pre-Configured Test Accounts

| Portal Role | Email Address | Password | Facility / Display Name |
| :--- | :--- | :--- | :--- |
| **Blood Bank Staff** | `admin@redcrossblood.org` | `password123` | Metropolitan Red Cross Blood Center |
| **Hospital Staff** | `stjudes@metrohealth.org` | `password123` | St. Jude Children's Memorial Hospital |
| **Active Donor (Verified)** | `sarah.j@example.com` | `password123` | Sarah Jenkins (A+ Donor) |
| **New Donor (Unverified)** | *Register via UI* | *Your choice* | Create via `/register` |

---

## 2. Interactive End-to-End Verification Scenarios

### Scenario 1: Donor Registration, Verification Barrier & Digital Pass Unlock

#### Objective
Verify that newly registered donors are strictly marked as unverified and ineligible until identity/blood group documentation is reviewed and verified by blood bank personnel.

#### Step-by-Step Instructions:
1. Open an incognito browser window and navigate to `http://localhost:5173/register`.
2. Select **"Donor"** role, fill out registration details (e.g., Name: `Alex Rivera`, Blood Group: `O+`, Weight: `68 kg`, City: `Metropolis`), and submit.
3. **Verify Donor Dashboard State (`/donor/dashboard`):**
   - Confirm that the top alert shows an amber warning: **"Verification Required: Please upload your blood group report or government ID"**.
   - Confirm the Eligibility Card displays **"Ineligible / Pending Verification"**.
   - Click **"Digital Donor Pass"** in the navigation/card: confirm the pass indicates **"Status: Unverified"** and barcode collection is disabled.
4. **Upload Blood Group Document:**
   - Navigate to `/donor/profile` or click **"Upload Proof"** in the alert banner.
   - Enter Document Type: `Lab Blood Group Report`, ID: `LAB-9942`, Document URL: `https://cdn.lifelink.io/reports/rivera.pdf`, and click **"Submit for Verification"**.
   - Notice the status badge transitions to amber **"Pending Verification"**.
5. **Staff Review & Approval in Blood Bank Portal:**
   - Open another browser tab, log in as `admin@redcrossblood.org` / `password123`.
   - In the search bar or donor lookup, enter `Rivera`.
   - Locate Alex Rivera in the results: observe the badge **"Pending Verification"**.
   - Click **"Verify Donor"** and confirm.
6. **Confirm Donor Unlocked:**
   - Refresh the Donor Portal tab (`/donor/dashboard`).
   - The amber warning is replaced by a green banner: **"Verified Donor — You are eligible to donate blood!"**
   - The Digital Donor Pass is now active and displays an authentic green verification seal.

---

### Scenario 2: Phlebotomy Collection & Clinical Cool-Off Window

#### Objective
Verify that blood bank staff can record a blood donation, that immediate duplicate entries are rejected, and that the donor enters a clinical cool-off window.

#### Step-by-Step Instructions:
1. In the Blood Bank Portal, navigate to **Collections Hub** (`/blood-bank/collections`).
2. Select the **"In-House Phlebotomy"** tab.
3. Click **"Record New Collection"**:
   - Donor: Select `Alex Rivera` (or enter Donor ID).
   - Component: `Whole Blood`.
   - Volume: `450 mL`.
   - Phlebotomist: `Nurse Laura Dean`.
   - Click **"Save Collection Record"**.
4. Confirm successful creation toast and observe collection `COL-2026-XXXX` added to the table.
5. **Attempt Duplicate Submission (Safety Test):**
   - Click **"Record New Collection"** again immediately with the same donor.
   - Click **"Save Collection Record"**.
   - **Expected Outcome:** The system rejects the request with an error: *"Duplicate collection prevented: A donation for this donor was already recorded today"* or *"Clinical cool-off window active"*.
6. **Verify Donor Cool-Off Timer:**
   - Switch back to Alex Rivera's Donor Portal (`/donor/dashboard`).
   - Notice the Eligibility badge now states: **"Ineligible — Cool-off window active"**.
   - The Whole Blood countdown displays **"56 Days Remaining"** until next permissible donation.

---

### Scenario 3: Blood Fractionation, 5-Marker Lab Screening & Clearance Walkthrough (REQ-6809 Resolution)

#### Objective
Demonstrate component fractionation, quarantine induction, and verify the clinical safety gate: all 5 mandatory disease markers must be tested and confirmed `Negative` before a unit becomes available in inventory or eligible for hospital allocation.

#### Step-by-Step Instructions:
1. In the Blood Bank Portal (`/blood-bank/collections`), find any un-fractionated collection and click **"Fractionate"** to produce RBC and Plasma components. Both start in status **"Quarantined"** with testing status **"Pending"**.
2. **Examine Quarantined Units from Hospital Requests Hub (`REQ-6809`):**
   - Navigate to **Hospital Requests Hub** (`/blood-bank/requests`).
   - Locate Requisition **`REQ-6809`** (requiring 1 unit of O+ RBC for `Baby Liam`).
   - Open the Fulfillment & Allocation drawer:
     - Notice **Eligible Released FEFO Units shows 0**.
     - Notice the amber diagnostic card: *"3 Compatible O+ RBC units held in laboratory quarantine awaiting clearance"*.
     - Unit badges are displayed: `UNIT-2026-4106778`, `UNIT-2026-1367152`, `UNIT-2026-7335630`.
   - Click the badge **`UNIT-2026-4106778`** or click **"Go to Laboratory Testing & Clearance"**.
3. **Inspect the Healed Laboratory Screening Queue (`/blood-bank/testing`):**
   - The page opens with `?unitId=UNIT-2026-4106778` and automatically selects `UNIT-2026-4106778`.
   - The queue displays real, persisted quarantined units with accurate blood group (`O+`), component (`RBC`), volume, and storage location.
4. **Enforce Clinical Safety Gates (No Artificial Shortcuts):**
   - Observe that the dangerous "Mark All Negative" shortcut has been completely removed.
   - Each of the 5 mandatory markers must be individually recorded:
     - **HIV 1/2 Antibody / Antigen**
     - **Hepatitis B Surface Antigen (HBsAg)**
     - **Hepatitis C Virus Antibody (HCV)**
     - **Syphilis Serology (VDRL / RPR)**
     - **Malaria Antigen / Smear**
   - Observe that while any marker is set to `Pending`, the **"Authorize & Release Unit to Available Stock"** button is strictly disabled.
   - If an unauthorized or premature release request is sent to the backend, the server immediately rejects it with **HTTP 422 Unprocessable Entity** naming the incomplete markers.
5. **Record Authentic Screening Results:**
   - Click **"Negative"** for each of the 5 markers.
   - (Optional) Click **"Save Screening Results"** to persist assay progress without releasing.
   - The **"Authorize & Release Unit to Available Stock"** button now enables in green.
   - Click **"Authorize & Release Unit to Available Stock"**.
   - The unit status transitions to **"Passed"**, availability updates to **"Available"**, storage location updates to **"Main Storage Bay (Released)"**, and audit fields (`testedBy`, `reviewedBy`, `reviewedAt`) are permanently recorded in `datastore.json`.
6. **Allocate Released Unit to `REQ-6809`:**
   - In the success confirmation banner, click **"Back to Hospital Requests Hub"**.
   - Open Requisition **`REQ-6809`**.
   - Notice that **Eligible Released FEFO Units now displays 1** (`UNIT-2026-4106778`).
   - Select or enter `UNIT-2026-4106778` and click **"Allocate & Reserve Units"**.
   - The allocation succeeds instantly! The requisition transitions to **"Reserved"**, and the hospital receives an in-app allocation notification.

---

### Scenario 4: Hospital Requisition & FEFO Allocation Diagnostics

#### Objective
Verify that hospital requisitions trigger FEFO matching, and that quarantined or reserved units provide actionable diagnostic alerts rather than generic empty states.

#### Step-by-Step Instructions:
1. In an incognito window, log in to the Hospital Portal as `stjudes@metrohealth.org` / `password123`.
2. Navigate to **Requisitions Hub** (`/hospital/requisitions`).
3. Click **"Create Clinical Blood Requisition"**:
   - Patient Name: `Baby Thomas (Pediatric Surgery)`.
   - Blood Group Required: `O+`.
   - Component: `RBC`.
   - Units Required: `1`.
   - Urgency: `Urgent`.
   - Preferred Facility: `Metropolitan Red Cross Blood Center`.
   - Click **"Submit Requisition"**.
4. Observe the requisition created with status **"Submitted"**.
5. Switch to the Blood Bank Portal and navigate to **Hospital Requests Hub** (`/blood-bank/requests`).
6. Click on Baby Thomas's requisition to open the Allocation Drawer:
   - **Diagnostic FEFO Verification:** If tested units exist, they are ordered strictly by earliest expiry date.
   - If compatible units are still in quarantine, observe the new **Amber Quarantine Alert Card**:
     > *"1 Compatible O+ RBC unit is held in quarantine awaiting infectious disease test results."*
     > Button: **[Review & Test Quarantined Units]** (links directly to `/blood-bank/testing`).
7. Select the tested available unit and click **"Allocate & Reserve Units"**.
8. Observe:
   - Request status transitions to **"Reserved"**.
   - Unit availability transitions to **"Reserved"** in inventory.
   - Hospital receives an in-app notification: *"Units allocated for Requisition REQ-XXXX"*.

---

### Scenario 5: Cold Chain Dispatch & Hospital Receipt Confirmation

#### Objective
Complete the chain-of-custody handoff with thermal container seals, courier logging, and hospital receipt.

#### Step-by-Step Instructions:
1. On the Blood Bank Requisitions Hub (`/blood-bank/requests`), select the reserved requisition.
2. Click **"Prepare Dispatch"**:
   - Courier: `Dedicated Hospital Transport`.
   - Vehicle / Courier Reference: `VAN-METRO-09`.
   - Packaging: `Thermal Insulated Shipper with Phase Change Gel Packs`.
   - Seal Number: `SEAL-9081`.
   - Target Temp: `2.0°C - 6.0°C`.
   - Click **"Authorize & Pack"**.
   - Status transitions to **"Prepared for Dispatch"**.
3. Click **"Confirm Courier Handoff"**:
   - Status transitions to **"Dispatched"**.
4. Switch to the Hospital Portal (`/hospital/requisitions`):
   - Locate the requisition: Status is **"Dispatched"**.
5. Click **"Confirm Delivery & Receive Units"**:
   - Enter Received Temperature: `3.6°C` (within 2-6°C range).
   - Seal Intact: `Yes`.
   - Click **"Confirm Safe Receipt"**.
6. Requisition status transitions to **"Fulfilled"**; blood units are marked as **"Issued"** in the central registry.

---

### Scenario 6: Organizational Donation Camp Request & Drive Scheduling

#### Objective
Verify that community organizations can request donation drives and that blood banks can review, approve, and automatically schedule live donation camps.

#### Step-by-Step Instructions:
1. In the Donor Portal, navigate to **Donation Camps** (`/donor/camps`).
2. Click **"Organize a Blood Drive"**:
   - Organization: `Metro Tech Campus`.
   - Target Date: *Select a date 2 weeks ahead*.
   - Venue: `Student Union Grand Ballroom`.
   - Expected Donors: `75`.
   - Target Facility: `Metropolitan Red Cross Blood Center`.
   - Click **"Submit Drive Request"**.
3. Confirm toast notification: *"Camp request submitted for blood bank review"*.
4. Switch to the Blood Bank Portal and navigate to **Collections Hub** (`/blood-bank/collections`).
5. Click the **"Camp Requests"** tab:
   - Notice the new request from `Metro Tech Campus` in the **"Pending"** list.
6. Click **"Accept & Schedule Drive"**:
   - Review venue and proposed date.
   - Set Target Units Goal: `60`.
   - Operating Hours: `09:00 AM - 04:00 PM`.
   - Click **"Confirm & Schedule Camp"**.
7. Observe:
   - Request status updates to **"Approved"**.
   - A live entry is created under **"Mobile Donation Camps"** tab.
   - The camp is instantly discoverable by donors in `/donor/camps`.
   - The organizer receives an in-app confirmation notification.

---

### Scenario 7: Authentic Analytics & Report Validation

#### Objective
Confirm that the blood bank management dashboard and operational reports display calculated real-time numbers without hardcoded placeholders or fallback artifacts.

#### Step-by-Step Instructions:
1. In the Blood Bank Portal, navigate to **Operational Reports** (`/blood-bank/reports`).
2. Observe the KPI summary cards:
   - **Collections This Month:** Accurately reflects genuine collection counts (not `124`).
   - **Hospital Requests:** Accurately reflects recorded clinical orders (not `88`).
   - **Fulfillment Rate:** Real-time percentage calculated as $(\text{Fulfilled} / \text{Total}) \times 100\%$ (not hardcoded `94.2%`).
3. If database was just reset, confirm that empty counters render `0` and `0%` cleanly without UI layout shifts.

---

## 3. Automated CLI Verification Commands

To run all automated verification suites directly from your terminal:

```bash
# 1. Lab Screening Queue Healing, 5-Marker Validation & REQ-6809 Allocation (10 tests)
node ./frontend/src/tests/labScreeningAndAllocation.test.mjs

# 2. LifeLink Workflow Audit & Comprehensive Repairs (5 tests)
node ./frontend/src/tests/workflowAuditAndRepairs.test.mjs

# 3. Donor Eligibility Verification & Deferral Suite (11 tests)
node ./frontend/src/tests/donorEligibilityVerification.test.mjs

# 4. Clean End-to-End Workflow Verification Suite (8 tests)
node ./frontend/src/tests/cleanEndToEndWorkflow.test.mjs

# 5. Hospital Clinical Requisition Suite (50 tests)
node ./frontend/src/tests/hospitalSuite.test.mjs

# 6. Blood Bank FEFO & Fulfillment Suite (15 tests)
node ./frontend/src/tests/fulfillmentSuite.test.mjs
```

---

## 4. Troubleshooting & FAQs

### Q: Why does a donor show "Ineligible" immediately after a successful collection?
**A:** This is medically correct behavior. Standard blood donation guidelines mandate an authoritative clinical cool-off interval (56 days for whole blood, 90 days for red cells). The countdown timer tracks the remaining days until the donor is eligible again.

### Q: Why can't I see eligible units for an urgent hospital request?
**A:** Check the **Quarantine Alert** in the Allocation Drawer. Compatible units may be in the facility but pending infectious disease clearance. Navigate to `/blood-bank/testing` to record test results and authorize release.

### Q: How do I restore clean demonstration fixtures?
**A:** Run `curl -X POST http://localhost:5001/api/test/seed-fixtures`. This populates standard test accounts, hospitals, verified donors, and baseline inventory without corrupting datastore schema.

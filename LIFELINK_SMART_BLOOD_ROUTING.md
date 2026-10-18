# LifeLink Smart Emergency Blood Routing & Audio Alert Engine Architecture

## 1. Executive Summary & Core Objectives

LifeLink's **Smart Emergency Blood Routing System** is a backend-driven clinical logistics engine designed to automate the discovery, ranking, allocation, and dispatch of life-saving blood components. When an acute hemorrhage, trauma, or emergency surgery occurs at a healthcare facility, the platform immediately eliminates manual phone coordination by programmatically matching nearby licensed blood banks that possess genuinely released, unexpired, compatible inventory.

Simultaneously, the **Dual-Tone 5-Second Audible Alert Engine** delivers immediate auditory notification to authorized clinical recipients without continuous annoying loops or replay on browser refresh.

---

## 2. Canonical Workflow & State Transitions

LifeLink enforces a **single canonical requisition record** per hospital request (`REQ-XXXX`). It never spawns duplicate requisitions per invited blood center. Instead, it dispatches isolated per-bank offers (`OFF-REQ-XXXX-BB-XXXX`) linked to the canonical parent request.

```mermaid
stateDiagram-v2
    [*] --> RequisitionCreated: Hospital Submits Requisition (REQ-XXXX)
    RequisitionCreated --> ValidateLocation: Verify Hospital Geo-Coordinates
    ValidateLocation --> LocationMissing: Invalid / Undefined Lat/Lng
    LocationMissing --> [*]: HTTP 400 (needsLocationConfig: true)

    ValidateLocation --> CandidateDiscovery: Valid Coordinates Confirmed
    CandidateDiscovery --> HaversineRanking: Search Initial Radius (25 km)
    HaversineRanking --> CheckEligibleStock: Verify Genuine Released Stock
    CheckEligibleStock --> RadiusExpansion: Stock < Q (Expand +25 km up to 100 km)
    RadiusExpansion --> CheckEligibleStock
    CheckEligibleStock --> OffersDispatched: Offers Generated (OFF-XXXX)
    
    OffersDispatched --> BloodBankResponds: Notify Recipient via SSE & Web Audio
    BloodBankResponds --> BankAccepted: Full Acceptance (Qty = Q)
    BloodBankResponds --> BankPartial: Partial Fulfillment (Qty < Q)
    BloodBankResponds --> BankDeclined: Reasoned Decline
    BloodBankResponds --> OfferExpired: Response Deadline Exceeded

    BankDeclined --> TriggerReroute: Search Replacement Candidates
    OfferExpired --> TriggerReroute: Release Pending Commitment & Expand Search
    TriggerReroute --> CandidateDiscovery

    BankPartial --> AtomicCommitUnits: Commit Qty; Re-route Remaining Units (Q - committed)
    BankAccepted --> AtomicCommitUnits: Commit Full Qty; Supersede Competing Offers

    AtomicCommitUnits --> ClinicalAllocation: Blood Bank Allocates Specific Unit IDs
    ClinicalAllocation --> DispatchPreparation: Cold-Chain Verification & Manifest Generation
    DispatchPreparation --> CourierHandoff: Status = 'In Transit' (Manifest DSP-XXXX)
    CourierHandoff --> HospitalReceiptConfirmation: Physical Seal & Temp Verification (Status = 'Fulfilled')
    HospitalReceiptConfirmation --> [*]
```

---

## 3. Location Validation & Haversine Distance Engine

### 3.1 Strict Hospital Coordinate Validation
LifeLink never fabricates GPS coordinates or falls back to personal staff device locations. If the authenticated hospital organization has unconfigured coordinates (`latitude === undefined` or `longitude === undefined`), the request is rejected with:
```json
{
  "success": false,
  "needsLocationConfig": true,
  "error": "Hospital organization location coordinates are not configured. Please configure valid latitude/longitude in the Hospital Profile before dispatching auto-routed blood requests."
}
```

### 3.2 Geographic Haversine Calculation
The engine applies standard Great-Circle Haversine calculations over the spherical Earth radius ($R = 6,371\text{ km}$):

$$\Delta\text{lat} = \text{lat}_2 - \text{lat}_1$$
$$\Delta\text{lon} = \text{lon}_2 - \text{lon}_1$$
$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cdot\cos(\text{lat}_2)\cdot\sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
$$d = 2 R \cdot \arctan2\left(\sqrt{a}, \sqrt{1 - a}\right)$$

Coordinate inputs are strictly validated:
- $-90 \le \text{latitude} \le 90$
- $-180 \le \text{longitude} \le 180$
- Coordinate order is never swapped (`[lat, lng]`).

---

## 4. Persistent Stock Eligibility Rules

LifeLink completely rejects summary dashboard counts as evidence of stock. Every candidate blood center must hold real, physical units in `db.bloodUnits` that pass **6 strict clinical filters**:

| Filter | Requirement | Clinical Rationale |
| :--- | :--- | :--- |
| **Component Match** | `unit.component === request.component` | Normalizes RBC / PRBC, Platelets, Plasma, Whole Blood. |
| **ABO/Rh Compatibility** | `checkClinicalCompatibility(unit.bg, req.bg, component).isCompatible` | Enforces red cell vs plasma cross-compatibility tables. |
| **Laboratory Screening** | `unit.testingStatus === 'Passed'` | Excludes units under testing, pending clearance, or failed. |
| **Physical Availability** | `unit.availability === 'Available'` | Excludes quarantined, discarded, expired, or issued units. |
| **Expiration Margin** | `new Date(unit.expiryDate).getTime() > Date.now()` | Expired blood is strictly unallocatable. |
| **Reservation Isolation** | `!unit.reservedForRequestId || unit.reservedForRequestId === request.id` | Atomic lock preventing double-reservation across concurrent requests. |

---

## 5. Dynamic Search Radius Expansion & Configurable Defaults

```typescript
export const DEFAULT_ROUTING_CONFIG: SmartRoutingConfig = {
  initialRadiusKm: 25,              // Initial search perimeter
  expansionStepKm: 25,              // Step increment when inventory < Q
  maxRadiusKm: 100,                 // Maximum regional ceiling
  maxRecipients: 3,                 // Maximum simultaneous candidate facilities
  responseDeadlineMinutes: {
    Emergency: 15,                  // Rapid 15-minute response window
    Urgent: 60,                     // 1 hour window
    Routine: 1440                   // 24 hours window
  }
};
```

1. **Monotonic Distance Ranking**: Candidate facilities within the active radius are sorted in ascending order of Haversine distance (`distanceKm`).
2. **Expansion Policy**: If the cumulative eligible units across candidates within the active radius is less than the requested quantity $Q$, the engine expands by `expansionStepKm` (25 km $\to$ 50 km $\to$ 75 km $\to$ 100 km) before dispatching offers.
3. **No-Match Safe State**: If no candidates have stock within 100 km, the canonical requisition is persisted in `routingStatus: 'No Candidates'` (or `'Partially Committed'` if units are already reserved) and flags the requisition for manual Administrator escalation.

---

## 6. Server-Authoritative Fulfillment Ledger & Concurrency Safety

### 6.1 Ledger Invariants
For any clinical requisition requiring $Q$ units:
1. **Total Committed Quantity Ceiling**:
   $$\sum \text{Committed Units} \le Q$$
2. **Superseded Offers**: When an accepting facility commits the remaining needed quantity ($\text{remaining} = 0$), all other outstanding offers (`status === 'Offered'`) are automatically marked `Superseded`.
3. **Partial Fulfillment Accounting**: When a bank offers $P < Q$ units, exactly $P$ units are atomically reserved (`u.availability = 'Reserved'`), and the routing engine immediately issues targeted offers for the remaining $Q - P$ units to the next closest candidate.
4. **Idempotent Decline & Reroute**: Declining a request requires a reasoned note (`offer.declineReason`), releases no stock, and instantly initiates candidate expansion without creating duplicate hospital requests.

---

## 7. Dual-Tone 5-Second Audible Alert Engine

### 7.1 Web Audio API Synthesis
To eliminate external MP3 network dependencies, audio alerts are synthesized entirely on the client using the browser's native `AudioContext`:

```typescript
// Dual-Tone Acoustic Signatures
EMERGENCY_FREQ_HIGH = 880 Hz  // A5
EMERGENCY_FREQ_LOW  = 660 Hz  // E5 (Rapid 0.15s warble alternation)

URGENT_FREQ_HIGH    = 659.25 Hz // E5
URGENT_FREQ_LOW     = 523.25 Hz // C5 (Harmonic chime alternation)
```

### 7.2 Strict 5-Second Duration Ceiling
Playback is bounded by an atomic timeout:
```typescript
const ALERT_DURATION_MS = 5000; // Strictly 5 seconds
```
The audio oscillator node is stopped and the audio context resources are freed when:
1. 5000 ms elapsed.
2. The user closes or dismisses the notification.
3. The component unmounts.
4. A new high-priority alert supersedes the current alert.

### 7.3 Deduplication & Replay Prevention
To prevent duplicate alerts upon background SSE reconnections, polling cycles, or component re-renders:
- **`sessionStorage` Keying**: Alert IDs are persisted in browser `sessionStorage` under `lifelink_played_alerts`.
- **In-Memory Set**: An active `Set<string>` rejects identical alert IDs in the same tab lifecycle.
- **Preference Storage**: User mute preferences (`lifelink_audio_muted`) and volume (`lifelink_audio_volume`) are persisted in `localStorage`.

---

## 8. Multi-Tenant Authorization & Security Model

- **Organization Scoping**: All blood bank offer endpoints (`GET /api/blood-bank/offers`, `POST /api/blood-bank/offers/:id/respond`) strictly resolve the blood bank identity from `req.user.id` or `db.bloodBanks`.
- **Cross-Tenant Guard (HTTP 403)**: A blood bank attempting to accept, decline, or inspect an offer addressed to another blood bank ID is immediately blocked with `403 Forbidden`.
- **Hospital Requisition Scope**: Only the requesting hospital can confirm shipment receipt (`POST /api/hospitals/requests/:id/confirm-receipt`).
- **Admin Visibility**: LifeLink administrators have read-only diagnostic visibility over all active offers, expansion counts, and unacknowledged candidate queues (`GET /api/admin/smart-routing`).

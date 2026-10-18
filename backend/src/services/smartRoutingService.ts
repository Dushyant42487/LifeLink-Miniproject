import { db } from '../models/store';
import { 
  BloodRequest, 
  BloodBankOffer, 
  BloodUnit, 
  BloodGroup, 
  BloodComponent, 
  RequestUrgency, 
  SmartRoutingConfig,
  RoutingStatus 
} from '../models/types';
import { calcHaversineKm, isValidCoordinate } from '../utils/geo';
import { notificationService } from './notificationService';

// Authoritative Clinical Compatibility Maps
const RBC_DONOR_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+']
};

const PLASMA_DONOR_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'AB-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A+', 'A-', 'O+', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B+', 'B-', 'O+', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O+', 'O-']
};

export const checkClinicalCompatibility = (
  donorBloodGroup: BloodGroup,
  recipientBloodGroup: BloodGroup,
  component: BloodComponent
): { isCompatible: boolean; message: string } => {
  const comp = (component || 'RBC').toUpperCase();
  if (comp === 'WHOLE BLOOD') {
    const isMatch = donorBloodGroup === recipientBloodGroup || donorBloodGroup === 'O-';
    return {
      isCompatible: isMatch,
      message: isMatch
        ? `Compatible whole blood (${donorBloodGroup}) for patient (${recipientBloodGroup}).`
        : `Clinically INCOMPATIBLE: ${donorBloodGroup} whole blood cannot be given to ${recipientBloodGroup}.`
    };
  }

  if (comp === 'PLASMA' || comp === 'PLATELETS') {
    const allowed = PLASMA_DONOR_COMPATIBILITY[donorBloodGroup];
    const isMatch = allowed ? allowed.includes(recipientBloodGroup) : false;
    return {
      isCompatible: isMatch,
      message: isMatch
        ? `Compatible donor (${donorBloodGroup}) for patient (${recipientBloodGroup} ${component}).`
        : `Clinically INCOMPATIBLE: ${donorBloodGroup} ${component} cannot be given to ${recipientBloodGroup}.`
    };
  }

  const allowed = RBC_DONOR_COMPATIBILITY[donorBloodGroup];
  const isMatch = allowed ? allowed.includes(recipientBloodGroup) : false;
  return {
    isCompatible: isMatch,
    message: isMatch
      ? `Compatible red cells (${donorBloodGroup}) for patient (${recipientBloodGroup}).`
      : `Clinically INCOMPATIBLE: ${donorBloodGroup} red cells cannot be given to ${recipientBloodGroup}.`
  };
};

export const DEFAULT_ROUTING_CONFIG: SmartRoutingConfig = {
  initialRadiusKm: 25,
  expansionStepKm: 25,
  maxRadiusKm: 100,
  maxRecipients: 3,
  responseDeadlineMinutes: {
    Emergency: 15,
    Urgent: 60,
    Routine: 1440 // 24 hours
  }
};

export interface CandidateBankMatch {
  bankId: string;
  bankName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  eligibleUnitsCount: number;
  eligibleUnits: BloodUnit[];
  hasExactMatchGroup: boolean;
}

export class SmartRoutingService {
  private config: SmartRoutingConfig;

  constructor(customConfig?: Partial<SmartRoutingConfig>) {
    this.config = {
      ...DEFAULT_ROUTING_CONFIG,
      ...customConfig,
      responseDeadlineMinutes: {
        ...DEFAULT_ROUTING_CONFIG.responseDeadlineMinutes,
        ...(customConfig?.responseDeadlineMinutes || {})
      }
    };
  }

  /**
   * Authoritative check if a unit is genuinely released, compatible, and available.
   * Strict safety rules:
   * 1. component must match
   * 2. blood group must be clinically compatible
   * 3. testingStatus must be 'Passed' (no pending/quarantined/failed)
   * 4. availability must be 'Available' (or already reserved for this exact request)
   * 5. expiryDate must be in the future
   * 6. must not be reserved for another request
   */
  public isUnitEligible(
    unit: BloodUnit,
    requestedBloodGroup: BloodGroup,
    requestedComponent: BloodComponent,
    requestId?: string
  ): boolean {
    if (unit.component !== requestedComponent) return false;

    // Check clinical compatibility
    const compat = checkClinicalCompatibility(unit.bloodGroup, requestedBloodGroup, requestedComponent);
    if (!compat.isCompatible) return false;

    // Laboratory clearance validation
    if (unit.testingStatus !== 'Passed') return false;

    // Availability validation
    if (unit.availability !== 'Available' && !(requestId && unit.reservedForRequestId === requestId)) {
      return false;
    }

    // Expiry validation: must not be expired
    const exp = new Date(unit.expiryDate).getTime();
    if (isNaN(exp) || exp <= Date.now()) return false;

    // Concurrency reservation protection
    if (unit.reservedForRequestId && unit.reservedForRequestId !== requestId) {
      return false;
    }

    return true;
  }

  /**
   * Retrieves all genuine eligible units owned by a specific blood bank
   */
  public getEligibleStockForBank(
    bankId: string,
    requestedBloodGroup: BloodGroup,
    requestedComponent: BloodComponent,
    requestId?: string
  ): BloodUnit[] {
    return db.bloodUnits.filter(u => 
      u.bloodBankId === bankId && 
      this.isUnitEligible(u, requestedBloodGroup, requestedComponent, requestId)
    );
  }

  /**
   * Discovers and ranks candidate blood banks based on location and eligible stock.
   * Expands search radius if initial candidates cannot fulfill the requested quantity.
   */
  public findEligibleCandidateBanks(
    hospitalLat: number,
    hospitalLng: number,
    bloodGroup: BloodGroup,
    component: BloodComponent,
    neededUnits: number,
    customConfig?: Partial<SmartRoutingConfig>,
    excludedBankIds: string[] = []
  ): {
    candidates: CandidateBankMatch[];
    searchRadiusKm: number;
    totalAvailableStock: number;
    expansionCount: number;
  } {
    if (!isValidCoordinate(hospitalLat, hospitalLng)) {
      throw new Error(`Invalid hospital coordinates (${hospitalLat}, ${hospitalLng}). Coordinates must be valid geographic numbers.`);
    }

    const cfg = { ...this.config, ...customConfig };
    let currentRadius = cfg.initialRadiusKm;
    let expansionCount = 0;
    const maxRadius = cfg.maxRadiusKm;
    const step = cfg.expansionStepKm;

    const excludedSet = new Set(excludedBankIds);

    // Filter active, verified blood banks with valid coordinates
    const eligibleBanks = db.bloodBanks.filter(b => 
      !excludedSet.has(b.id) &&
      b.verificationStatus !== 'Rejected' &&
      b.isActive !== false &&
      b.latitude !== undefined &&
      b.longitude !== undefined &&
      isValidCoordinate(b.latitude, b.longitude)
    );

    let candidates: CandidateBankMatch[] = [];
    let totalStockAcrossCandidates = 0;

    // Dynamic radius expansion loop
    while (currentRadius <= maxRadius) {
      candidates = [];
      totalStockAcrossCandidates = 0;

      for (const bank of eligibleBanks) {
        const distanceKm = calcHaversineKm(
          hospitalLat,
          hospitalLng,
          bank.latitude!,
          bank.longitude!
        );

        if (distanceKm <= currentRadius) {
          const eligibleUnits = this.getEligibleStockForBank(bank.id, bloodGroup, component);
          if (eligibleUnits.length > 0) {
            const hasExactMatchGroup = eligibleUnits.some(u => u.bloodGroup === bloodGroup);
            candidates.push({
              bankId: bank.id,
              bankName: bank.bloodBankName || bank.name || 'Blood Bank',
              latitude: bank.latitude!,
              longitude: bank.longitude!,
              distanceKm: Number(distanceKm.toFixed(2)),
              eligibleUnitsCount: eligibleUnits.length,
              eligibleUnits,
              hasExactMatchGroup
            });
            totalStockAcrossCandidates += eligibleUnits.length;
          }
        }
      }

      // If we found enough stock to fulfill the needed units, or we've reached max radius, stop expanding
      if (totalStockAcrossCandidates >= neededUnits || currentRadius >= maxRadius) {
        break;
      }

      currentRadius = Math.min(maxRadius, currentRadius + step);
      expansionCount++;
    }

    // Candidate Ranking Algorithm:
    // 1. Distance ascending (closest first)
    // 2. Exact blood group match preference
    // 3. Eligible stock count descending (can contribute more units)
    candidates.sort((a, b) => {
      const distDiff = a.distanceKm - b.distanceKm;
      if (Math.abs(distDiff) > 0.1) {
        return distDiff;
      }
      if (a.hasExactMatchGroup && !b.hasExactMatchGroup) return -1;
      if (!a.hasExactMatchGroup && b.hasExactMatchGroup) return 1;
      return b.eligibleUnitsCount - a.eligibleUnitsCount;
    });

    const selectedCandidates = candidates.slice(0, cfg.maxRecipients);

    return {
      candidates: selectedCandidates,
      searchRadiusKm: currentRadius,
      totalAvailableStock: totalStockAcrossCandidates,
      expansionCount
    };
  }

  /**
   * Automatically routes an active hospital requisition to eligible candidate blood banks.
   * Generates per-bank offers, links them to the requisition, and sends SSE notifications.
   */
  public async dispatchRoutingOffers(
    request: BloodRequest,
    customConfig?: Partial<SmartRoutingConfig>
  ): Promise<{
    success: boolean;
    offersCreated: BloodBankOffer[];
    message: string;
    searchRadiusKm: number;
    noCandidates?: boolean;
  }> {
    const hosp = db.hospitals.find(h => h.id === request.hospitalId);
    if (!hosp || hosp.latitude === undefined || hosp.longitude === undefined || !isValidCoordinate(hosp.latitude, hosp.longitude)) {
      return {
        success: false,
        offersCreated: [],
        message: 'Hospital organization location is not configured or has invalid coordinates. Please configure hospital latitude/longitude in Hospital Profile.',
        searchRadiusKm: 0
      };
    }

    const neededUnits = request.remainingUnitsToFulfill !== undefined 
      ? request.remainingUnitsToFulfill 
      : Math.max(0, request.quantityUnits - (request.fulfilledUnits || 0));

    if (neededUnits <= 0) {
      return {
        success: true,
        offersCreated: [],
        message: 'Requisition is already fully fulfilled.',
        searchRadiusKm: 0
      };
    }

    // Exclude banks that already have an offer (active, accepted, partial, or declined) on this request
    const existingOffers = request.routedBankOffers || [];
    const alreadyInvitedBankIds = existingOffers.map(o => o.bloodBankId);

    const matchResult = this.findEligibleCandidateBanks(
      hosp.latitude,
      hosp.longitude,
      request.bloodGroup,
      request.component,
      neededUnits,
      customConfig,
      alreadyInvitedBankIds
    );

    const now = new Date().toISOString();
    request.routingLogs = request.routingLogs || [];

    if (matchResult.candidates.length === 0) {
      request.routingStatus = (request.fulfilledUnits || 0) > 0 ? 'Partially Committed' : 'No Candidates';
      request.routingSearchRadiusKm = matchResult.searchRadiusKm;
      request.routingExpansionCount = matchResult.expansionCount;
      request.routingLogs.push({
        timestamp: now,
        action: 'RoutingSearchCompleted',
        details: `No eligible blood banks with released ${request.bloodGroup} ${request.component} found within ${matchResult.searchRadiusKm} km.`
      });
      db.saveSnapshot();

      // Notify hospital staff of no immediate candidate match (honest manual review status, non-alarm)
      await notificationService.dispatchNotification({
        userId: request.hospitalId,
        title: `Routing Update: Requisition ${request.id}`,
        message: `No blood banks within ${matchResult.searchRadiusKm} km currently have released ${request.bloodGroup} ${request.component} in stock. Status updated for manual review.`,
        type: 'request_update',
        priority: 'medium',
        link: `/hospital/requests?requestId=${request.id}`,
        data: {
          requestId: request.id,
          urgency: request.urgency,
          bloodGroup: request.bloodGroup,
          component: request.component,
          quantityUnits: request.quantityUnits,
          routingStatus: 'No Candidates',
          noCandidates: true,
          searchRadiusKm: matchResult.searchRadiusKm
        }
      });

      return {
        success: false,
        noCandidates: true,
        offersCreated: [],
        message: `No eligible blood banks found within ${matchResult.searchRadiusKm} km with available released stock.`,
        searchRadiusKm: matchResult.searchRadiusKm
      };
    }

    const deadlineMinutes = this.config.responseDeadlineMinutes[request.urgency] || 60;
    const expiresAt = new Date(Date.now() + deadlineMinutes * 60 * 1000).toISOString();

    const createdOffers: BloodBankOffer[] = [];
    let allocatedRemainder = neededUnits;

    for (const candidate of matchResult.candidates) {
      if (allocatedRemainder <= 0) break;

      const offerUnits = Math.min(candidate.eligibleUnitsCount, allocatedRemainder);
      const offerId = `OFF-${request.id}-${candidate.bankId}-${Date.now().toString().slice(-4)}`;

      const offer: BloodBankOffer = {
        id: offerId,
        requestId: request.id,
        bloodBankId: candidate.bankId,
        bloodBankName: candidate.bankName,
        distanceKm: candidate.distanceKm,
        availableStockCount: candidate.eligibleUnitsCount,
        offeredUnits: offerUnits,
        status: 'Offered',
        expiresAt,
        createdAt: now
      };

      createdOffers.push(offer);
      existingOffers.push(offer);

      // Notify target blood bank via real-time SSE & persistent notification
      const notifPriority = request.urgency === 'Emergency' ? 'urgent' : request.urgency === 'Urgent' ? 'high' : 'medium';
      const notifType = request.urgency === 'Emergency' ? 'emergency' : 'request_update';

      await notificationService.dispatchNotification({
        userId: candidate.bankId,
        title: `[${request.urgency.toUpperCase()} ROUTED REQUEST] ${request.bloodGroup} ${request.component}`,
        message: `${request.hospitalName} submitted ${request.urgency} request for ${request.quantityUnits} unit(s). You are offered ${offerUnits} unit(s) (${candidate.distanceKm} km away). Response deadline: ${deadlineMinutes} min.`,
        type: notifType,
        priority: notifPriority,
        link: `/blood-bank/requests?tab=offers&requestId=${request.id}`,
        data: {
          requestId: request.id,
          offerId: offer.id,
          urgency: request.urgency,
          bloodGroup: request.bloodGroup,
          component: request.component,
          quantityUnits: request.quantityUnits,
          offeredUnits: offerUnits,
          hospitalName: request.hospitalName,
          distanceKm: candidate.distanceKm,
          deadlineMinutes,
          expiresAt
        }
      });

      allocatedRemainder -= offerUnits;
    }

    request.isAutoRouted = true;
    request.routedBankOffers = existingOffers;
    request.routingStatus = (request.fulfilledUnits || 0) > 0 ? 'Partially Committed' : 'Offers Dispatched';
    request.remainingUnitsToFulfill = neededUnits;
    request.routingSearchRadiusKm = matchResult.searchRadiusKm;
    request.routingExpansionCount = matchResult.expansionCount;
    request.updatedAt = now;

    // Set primary blood bank reference for backwards compatibility
    if (matchResult.candidates[0] && !request.bloodBankId) {
      request.bloodBankId = matchResult.candidates[0].bankId;
      request.bloodBankName = matchResult.candidates[0].bankName;
    }

    request.routingLogs.push({
      timestamp: now,
      action: 'OffersDispatched',
      details: `Dispatched ${createdOffers.length} routing offer(s) within ${matchResult.searchRadiusKm} km (Expansions: ${matchResult.expansionCount}). Response deadline: ${deadlineMinutes} min.`
    });

    request.timeline.push({
      status: request.status,
      updatedAt: now,
      note: `Smart routing dispatched offers to ${createdOffers.length} blood bank(s) (${createdOffers.map(o => `${o.bloodBankName} [${o.distanceKm}km, ${o.offeredUnits}u]`).join(', ')}).`,
      actor: 'LifeLink Smart Routing Engine'
    });

    // Notify hospital staff of successful routing dispatch (non-alarm confirmation)
    await notificationService.dispatchNotification({
      userId: request.hospitalId,
      title: `Requisition Submitted: ${request.id}`,
      message: `Your ${request.urgency.toLowerCase()} request for ${request.quantityUnits} unit(s) of ${request.bloodGroup} ${request.component} was routed to ${createdOffers.length} blood bank(s).`,
      type: 'request_update',
      priority: 'medium',
      link: `/hospital/requests?requestId=${request.id}`,
      data: {
        requestId: request.id,
        urgency: request.urgency,
        bloodGroup: request.bloodGroup,
        component: request.component,
        quantityUnits: request.quantityUnits,
        dispatchedBanksCount: createdOffers.length
      }
    });

    db.saveSnapshot();

    return {
      success: true,
      offersCreated: createdOffers,
      message: `Successfully dispatched offers to ${createdOffers.length} candidate blood bank(s).`,
      searchRadiusKm: matchResult.searchRadiusKm
    };
  }

  /**
   * Concurrency-safe response handling when a blood bank responds to an offer.
   * Actions: 'Accept' | 'Decline' | 'Partial'
   */
  public async handleOfferResponse(
    requestId: string,
    offerId: string,
    bankId: string,
    action: 'Accept' | 'Decline' | 'Partial',
    requestedQuantity?: number,
    reason?: string,
    actorName?: string
  ): Promise<{
    success: boolean;
    message: string;
    committedUnits?: number;
    remainingUnits?: number;
    offer?: BloodBankOffer;
    request?: BloodRequest;
  }> {
    const request = db.bloodRequests.find(r => r.id === requestId);
    if (!request) {
      throw new Error(`Requisition ${requestId} not found.`);
    }

    const offers = request.routedBankOffers || [];
    const offer = offers.find(o => o.id === offerId);
    if (!offer) {
      throw new Error(`Routing offer ${offerId} not found on requisition ${requestId}.`);
    }

    // Strict Tenant Isolation: Only the targeted blood bank can respond
    if (offer.bloodBankId !== bankId) {
      throw new Error(`Access denied: Offer belongs to blood bank ${offer.bloodBankId}, not ${bankId}.`);
    }

    if (offer.status !== 'Offered') {
      throw new Error(`Offer ${offerId} is already in '${offer.status}' status and cannot be modified.`);
    }

    const now = new Date().toISOString();
    request.routingLogs = request.routingLogs || [];

    // Expiry check
    if (new Date(offer.expiresAt).getTime() < Date.now()) {
      offer.status = 'Expired';
      offer.respondedAt = now;
      request.routingLogs.push({
        timestamp: now,
        action: 'OfferExpired',
        details: `Blood bank ${offer.bloodBankName} attempted to respond to expired offer ${offerId}.`
      });
      db.saveSnapshot();
      throw new Error(`Offer ${offerId} has expired (${offer.expiresAt}).`);
    }

    // Handle DECLINE
    if (action === 'Decline') {
      offer.status = 'Declined';
      offer.declineReason = reason || 'Blood center unable to fulfill request at this time.';
      offer.respondedAt = now;

      request.routingLogs.push({
        timestamp: now,
        action: 'OfferDeclined',
        details: `Blood bank ${offer.bloodBankName} declined offer for ${offer.offeredUnits} unit(s). Reason: ${offer.declineReason}`
      });

      request.timeline.push({
        status: request.status,
        updatedAt: now,
        note: `${offer.bloodBankName} declined offer for ${offer.offeredUnits} unit(s) (${offer.declineReason}).`,
        actor: actorName || offer.bloodBankName
      });

      // If units are still needed, trigger automated escalation to invite replacement bank
      const remaining = request.remainingUnitsToFulfill ?? Math.max(0, request.quantityUnits - (request.fulfilledUnits || 0));
      if (remaining > 0) {
        await this.dispatchRoutingOffers(request);
      }

      db.saveSnapshot();

      return {
        success: true,
        message: 'Offer declined. Routing engine updated.',
        remainingUnits: request.remainingUnitsToFulfill,
        offer,
        request
      };
    }

    // Handle ACCEPT or PARTIAL
    const remainingToFulfill = request.remainingUnitsToFulfill !== undefined
      ? request.remainingUnitsToFulfill
      : Math.max(0, request.quantityUnits - (request.fulfilledUnits || 0));

    if (remainingToFulfill <= 0) {
      offer.status = 'Superseded';
      offer.notes = 'Requisition already fulfilled by another facility.';
      offer.respondedAt = now;
      db.saveSnapshot();
      throw new Error('Requisition is already fully fulfilled by other regional facilities.');
    }

    // Determine target quantity to commit
    let desiredQuantity: number;
    if (action === 'Partial') {
      const parsed = Number(requestedQuantity);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('Partial fulfillment quantity must be a positive integer.');
      }
      if (parsed > offer.offeredUnits) {
        throw new Error(`Partial fulfillment quantity (${parsed}) cannot exceed offered quantity (${offer.offeredUnits}).`);
      }
      desiredQuantity = parsed;
    } else {
      desiredQuantity = offer.offeredUnits;
    }

    // Server-Authoritative Fulfillment Ledger: Never over-fulfill
    const commitQty = Math.min(desiredQuantity, remainingToFulfill);

    // Revalidate live inventory for this blood bank right now
    const eligibleStock = this.getEligibleStockForBank(bankId, request.bloodGroup, request.component);
    if (eligibleStock.length < commitQty) {
      throw new Error(
        `Inventory changed: Blood bank ${offer.bloodBankName} has only ${eligibleStock.length} eligible unit(s) available, but ${commitQty} was requested. Please refresh and try again.`
      );
    }

    // Pick and atomically reserve units
    const unitsToReserve = eligibleStock.slice(0, commitQty);
    const reservedUnitIds = unitsToReserve.map(u => u.id);

    for (const u of unitsToReserve) {
      u.availability = 'Reserved';
      u.reservedForRequestId = request.id;
    }

    // Update Requisition unit assignments
    request.assignedUnitIds = request.assignedUnitIds || [];
    for (const uId of reservedUnitIds) {
      if (!request.assignedUnitIds.includes(uId)) {
        request.assignedUnitIds.push(uId);
      }
    }

    // Update Offer
    offer.status = commitQty === offer.offeredUnits ? 'Accepted' : 'Partial';
    offer.acceptedUnits = commitQty;
    offer.respondedAt = now;
    offer.notes = `Committed ${commitQty} unit(s) (${reservedUnitIds.join(', ')}).`;

    // Update Requisition Counts & Status
    request.fulfilledUnits = (request.fulfilledUnits || 0) + commitQty;
    request.remainingUnitsToFulfill = Math.max(0, request.quantityUnits - request.fulfilledUnits);
    request.status = request.fulfilledUnits >= request.quantityUnits ? 'Reserved' : 'Partially Fulfilled';
    request.routingStatus = request.remainingUnitsToFulfill === 0 ? 'Fully Committed' : 'Partially Committed';
    request.bloodBankId = bankId;
    request.bloodBankName = offer.bloodBankName;
    request.updatedAt = now;

    request.routingLogs.push({
      timestamp: now,
      action: 'OfferAccepted',
      details: `${offer.bloodBankName} accepted offer and committed ${commitQty} unit(s). Remaining needed: ${request.remainingUnitsToFulfill} unit(s).`
    });

    request.timeline.push({
      status: request.status,
      updatedAt: now,
      note: `${offer.bloodBankName} accepted offer and reserved ${commitQty} unit(s) (${reservedUnitIds.join(', ')}).`,
      actor: actorName || offer.bloodBankName
    });

    // If fully fulfilled, supersede other pending offers
    if (request.remainingUnitsToFulfill === 0) {
      for (const otherOffer of offers) {
        if (otherOffer.id !== offer.id && otherOffer.status === 'Offered') {
          otherOffer.status = 'Superseded';
          otherOffer.notes = 'Requisition fully fulfilled by responding facilities.';
          otherOffer.respondedAt = now;
        }
      }
    } else {
      // If partially fulfilled and units still needed, automatically route remaining quantity
      await this.dispatchRoutingOffers(request);
    }

    // Authoritative in-app notification to requesting hospital (normal status update, non-alarm)
    await notificationService.dispatchNotification({
      userId: request.hospitalId,
      title: `Units Committed: Requisition ${request.id}`,
      message: `${offer.bloodBankName} committed ${commitQty} unit(s) of ${request.bloodGroup} ${request.component}. Total fulfilled: ${request.fulfilledUnits}/${request.quantityUnits} unit(s).`,
      type: 'request_update',
      priority: 'medium',
      link: `/hospital/requests?requestId=${request.id}`,
      data: {
        requestId: request.id,
        urgency: request.urgency,
        bloodGroup: request.bloodGroup,
        component: request.component,
        committedUnits: commitQty,
        fulfilledUnits: request.fulfilledUnits,
        quantityUnits: request.quantityUnits,
        bloodBankName: offer.bloodBankName
      }
    });

    db.saveSnapshot();

    return {
      success: true,
      message: `Successfully committed ${commitQty} unit(s) from ${offer.bloodBankName}.`,
      committedUnits: commitQty,
      remainingUnits: request.remainingUnitsToFulfill,
      offer,
      request
    };
  }

  /**
   * Sweeps expired unacknowledged offers and escalates routing for remaining needed units.
   */
  public async sweepExpiredOffers(): Promise<{
    expiredCount: number;
    escalatedCount: number;
  }> {
    const nowMs = Date.now();
    let expiredCount = 0;
    let escalatedCount = 0;

    for (const req of db.bloodRequests) {
      if (req.status === 'Fulfilled' || req.status === 'Cancelled' || req.status === 'Rejected') {
        continue;
      }

      const offers = req.routedBankOffers || [];
      let hadExpiration = false;

      for (const offer of offers) {
        if (offer.status === 'Offered' && new Date(offer.expiresAt).getTime() < nowMs) {
          offer.status = 'Expired';
          offer.respondedAt = new Date().toISOString();
          hadExpiration = true;
          expiredCount++;
        }
      }

      if (hadExpiration) {
        const remaining = req.remainingUnitsToFulfill ?? Math.max(0, req.quantityUnits - (req.fulfilledUnits || 0));
        if (remaining > 0) {
          await this.dispatchRoutingOffers(req);
          escalatedCount++;
        }
      }
    }

    if (expiredCount > 0) {
      db.saveSnapshot();
    }

    return { expiredCount, escalatedCount };
  }
}

export const smartRoutingService = new SmartRoutingService();

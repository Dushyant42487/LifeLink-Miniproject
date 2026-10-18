import { Response } from 'express';
import { db } from '../models/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { safeSupabaseSync, persistRecordDirect } from '../models/db';
import { notificationService } from '../services/notificationService';
import { syncDonorAuthoritativeEligibility } from '../services/donorEligibilityService';

/**
 * Administrative Overview of Donor Verification Requests
 * Returns pending, clarification-requested, unassigned and routed requests.
 */
export const getAdminVerificationRequests = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const requests = db.donors
    .filter(d => {
      const status = d.verificationStatus || d.bloodGroupVerificationStatus;
      return status === 'Pending Verification' || status === 'Needs More Info' || status === 'Pending Assignment' || d.assignedBloodBankId === 'unassigned_admin_review';
    })
    .map(d => {
      const eligibility = syncDonorAuthoritativeEligibility(d);
      return {
        id: d.id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        city: d.city,
        state: d.state,
        bloodGroup: d.bloodGroup,
        verificationStatus: d.verificationStatus || 'Pending Verification',
        assignedBloodBankId: d.assignedBloodBankId,
        assignedBloodBankName: d.assignedBloodBankName,
        preferredBloodBankId: d.preferredBloodBankId,
        preferredBloodBankName: d.preferredBloodBankName,
        verificationSubmittedAt: d.verificationSubmittedAt || d.createdAt,
        proofDocumentType: (d as any).proofDocumentType,
        bloodGroupProofDocUrl: d.bloodGroupProofDocUrl,
        verificationNotes: d.verificationNotes,
        rejectionReason: d.rejectionReason,
        assignmentAuditLog: d.assignmentAuditLog || [],
        isEligible: eligibility.isEligible
      };
    });

  res.json({
    success: true,
    count: requests.length,
    requests
  });
};

/**
 * Administrative Reassignment of Donor Verification Request
 * Assigns or reassigns an eligible, approved blood bank with an auditable reason.
 */
export const reassignDonorVerification = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { donorId, newBloodBankId, reason } = req.body;

  if (!donorId || !newBloodBankId) {
    return res.status(400).json({ success: false, error: 'donorId and newBloodBankId are required.' });
  }

  const donor = db.donors.find(d => d.id === donorId);
  if (!donor) {
    return res.status(404).json({ success: false, error: `Donor ${donorId} not found.` });
  }

  const newBank = db.bloodBanks.find(b => b.id === newBloodBankId && b.isActive !== false);
  if (!newBank) {
    return res.status(400).json({ success: false, error: 'Selected blood bank is invalid or inactive.' });
  }

  const fromBankId = donor.assignedBloodBankId;
  const fromBankName = donor.assignedBloodBankName;
  const toBankName = newBank.bloodBankName || newBank.name;

  // Update assignment
  donor.assignedBloodBankId = newBank.id;
  donor.assignedBloodBankName = toBankName;
  if (donor.verificationStatus === 'Pending Assignment') {
    donor.verificationStatus = 'Pending Verification';
    donor.bloodGroupVerificationStatus = 'Pending Verification';
  }

  // Audit record
  if (!donor.assignmentAuditLog) {
    donor.assignmentAuditLog = [];
  }

  const auditEntry = {
    assignedBy: req.user?.id || 'admin',
    assignedByName: req.user?.name || 'Administrator',
    fromBankId,
    toBankId: newBank.id,
    reason: reason || 'Administrative routing / locality optimization',
    timestamp: new Date().toISOString()
  };

  donor.assignmentAuditLog.push(auditEntry);

  db.saveSnapshot();
  await persistRecordDirect('donors', donor);

  // Notify newly assigned blood bank
  await notificationService.dispatchNotification({
    userId: newBank.id,
    title: 'Donor Verification Request Reassigned',
    message: `Donor ${donor.name} has been routed to your center for verification. Reason: ${auditEntry.reason}`,
    type: 'verification',
    priority: 'high',
    link: '/blood-bank/collections'
  });

  // Notify donor
  await notificationService.dispatchNotification({
    userId: donor.id,
    title: 'Verification Center Assigned',
    message: `Your verification request has been routed to ${toBankName} for review.`,
    type: 'verification',
    priority: 'medium',
    link: '/donor/profile'
  });

  res.json({
    success: true,
    message: `Donor ${donor.name} successfully reassigned to ${toBankName}.`,
    donor: {
      id: donor.id,
      name: donor.name,
      assignedBloodBankId: donor.assignedBloodBankId,
      assignedBloodBankName: donor.assignedBloodBankName,
      verificationStatus: donor.verificationStatus,
      assignmentAuditLog: donor.assignmentAuditLog
    }
  });
};

/**
 * Phase 7: Administrative Observability of Smart Emergency Blood Routing
 * Provides real-time metrics, configuration parameters, pending offers,
 * radius expansion logs, and facility location diagnostics.
 */
export const getAdminSmartRoutingOverview = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const nowMs = Date.now();

  // Active requisitions
  const activeRequests = db.bloodRequests.filter(r => 
    r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
  );

  // Requisitions requiring attention
  const noCandidateRequests = activeRequests.filter(r => r.routingStatus === 'No Candidates');
  const partiallyCommittedRequests = activeRequests.filter(r => r.routingStatus === 'Partially Committed');

  // Count unacknowledged offers and expired offers
  let totalPendingOffers = 0;
  let totalExpiredOffers = 0;
  let totalAcceptedOffers = 0;

  db.bloodRequests.forEach(r => {
    (r.routedBankOffers || []).forEach(o => {
      if (o.status === 'Offered') {
        if (new Date(o.expiresAt).getTime() < nowMs) {
          totalExpiredOffers++;
        } else {
          totalPendingOffers++;
        }
      } else if (o.status === 'Accepted' || o.status === 'Partial') {
        totalAcceptedOffers++;
      } else if (o.status === 'Expired') {
        totalExpiredOffers++;
      }
    });
  });

  // Diagnostic: Facilities with missing or invalid coordinates
  const hospitalsMissingCoords = db.hospitals
    .filter(h => h.latitude === undefined || h.longitude === undefined || isNaN(h.latitude) || isNaN(h.longitude))
    .map(h => ({
      id: h.id,
      name: h.hospitalName || h.name,
      city: h.city,
      state: h.state,
      issue: 'Missing geographic coordinates'
    }));

  const bloodBanksMissingCoords = db.bloodBanks
    .filter(b => b.latitude === undefined || b.longitude === undefined || isNaN(b.latitude) || isNaN(b.longitude))
    .map(b => ({
      id: b.id,
      name: b.bloodBankName || b.name,
      city: b.city,
      state: b.state,
      issue: 'Missing geographic coordinates'
    }));

  // Requisitions summary with routing details
  const requisitionsOverview = activeRequests.map(r => ({
    id: r.id,
    hospitalId: r.hospitalId,
    hospitalName: r.hospitalName,
    urgency: r.urgency,
    bloodGroup: r.bloodGroup,
    component: r.component,
    quantityUnits: r.quantityUnits,
    fulfilledUnits: r.fulfilledUnits || 0,
    remainingUnitsToFulfill: r.remainingUnitsToFulfill ?? Math.max(0, r.quantityUnits - (r.fulfilledUnits || 0)),
    routingStatus: r.routingStatus || (r.assignedUnitIds?.length ? 'Completed' : 'Pending Candidate'),
    searchRadiusKm: r.routingSearchRadiusKm,
    expansionCount: r.routingExpansionCount || 0,
    offersCount: r.routedBankOffers?.length || 0,
    offers: r.routedBankOffers || [],
    routingLogs: r.routingLogs || [],
    createdAt: r.createdAt
  }));

  const routingConfig = {
    initialRadiusKm: 25,
    expansionStepKm: 25,
    maxRadiusKm: 100,
    maxRecipients: 3,
    maxCandidatesPerOffer: 3,
    responseDeadlineMinutes: {
      Emergency: 15,
      Urgent: 60,
      Routine: 1440
    }
  };

  res.json({
    success: true,
    routingConfiguration: routingConfig,
    config: routingConfig,
    metrics: {
      totalAutoRoutedRequests: activeRequests.filter(r => r.isAutoRouted).length,
      totalActiveRequisitions: activeRequests.length,
      emergencyRequisitions: activeRequests.filter(r => (r.urgency || '').toLowerCase() === 'emergency').length,
      noCandidatesCount: noCandidateRequests.length,
      partiallyCommittedCount: partiallyCommittedRequests.length,
      pendingUnacknowledgedOffers: totalPendingOffers,
      expiredOffers: totalExpiredOffers,
      acceptedOffers: totalAcceptedOffers,
      facilitiesWithLocationGaps: hospitalsMissingCoords.length + bloodBanksMissingCoords.length
    },
    facilityDiagnostics: {
      hospitalsMissingCoords,
      bloodBanksMissingCoords
    },
    locationGaps: [...hospitalsMissingCoords, ...bloodBanksMissingCoords],
    activeRequisitions: requisitionsOverview,
    activeRequests: requisitionsOverview
  });
};

/**
 * Phase 7: Authorized Admin Reroute / Radius Escalation
 * Manually expands search radius or re-dispatches offers for unfulfilled requisitions
 */
export const escalateAdminRouting = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { requestId } = req.params;
  const { reason, radiusKm } = req.body;

  const request = db.bloodRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, error: `Requisition ${requestId} not found.` });
  }

  if (request.status === 'Fulfilled' || request.status === 'Cancelled' || request.status === 'Rejected') {
    return res.status(400).json({
      success: false,
      error: `Cannot escalate requisition in terminal status '${request.status}'.`
    });
  }

  const { smartRoutingService } = await import('../services/smartRoutingService');
  
  const customConfig = radiusKm ? { maxRadiusKm: Number(radiusKm), initialRadiusKm: Number(radiusKm) } : undefined;
  const result = await smartRoutingService.dispatchRoutingOffers(request, customConfig);

  const now = new Date().toISOString();
  request.routingLogs = request.routingLogs || [];
  request.routingLogs.push({
    timestamp: now,
    action: 'AdminManualEscalation',
    details: `Administrator ${req.user?.name || req.user?.id} escalated routing. Reason: ${reason || 'Manual administrative dispatch override'}. Offers created: ${result.offersCreated.length}.`
  });

  db.saveSnapshot();

  res.json({
    success: true,
    message: result.message,
    offersCreated: result.offersCreated,
    searchRadiusKm: result.searchRadiusKm,
    request
  });
};

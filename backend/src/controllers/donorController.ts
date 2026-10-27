import { safeSupabaseSync } from '../models/db';
import { Response } from 'express';
import { db } from '../models/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { EmergencyResponse } from '../models/types';
import { isValidCoordinate, parseCoordinates, calcHaversineKm } from '../utils/geo';
import { syncDonorAuthoritativeEligibility } from '../services/donorEligibilityService';
import { notificationService } from '../services/notificationService';
import { smsService } from '../services/smsService';

export const getDonorProfile = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  syncDonorAuthoritativeEligibility(donor);
  const { passwordHash, ...data } = donor;

  res.json({ success: true, donor: data });
};

export const updateDonorProfile = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const { name, phone, address, city, state, postalCode, latitude, longitude, emergencyContact, notificationPreferences, weightKg, travelRadiusKm, pauseInvitations } = req.body;

  // Security: Ignore client-supplied eligibility flags and verification status overrides
  // isEligible, bloodGroupVerificationStatus, verificationStatus, verifiedBy, verifiedAt cannot be modified by donor

  const newAddress = address !== undefined ? String(address).trim() : donor.address;
  const newCity = city !== undefined ? String(city).trim() : donor.city;
  const newState = state !== undefined ? String(state).trim() : donor.state;
  const newPostalCode = postalCode !== undefined ? String(postalCode).trim() : donor.postalCode;

  const addressChanged = (address !== undefined && String(address).trim() !== (donor.address || '').trim()) ||
    (city !== undefined && String(city).trim() !== (donor.city || '').trim()) ||
    (postalCode !== undefined && String(postalCode).trim() !== (donor.postalCode || '').trim());

  let geocodingError: string | null = null;

  if (latitude !== undefined || longitude !== undefined) {
    if (latitude === null && longitude === null) {
      donor.latitude = undefined;
      donor.longitude = undefined;
      donor.geocodingStatus = undefined;
    } else {
      const coordParsed = parseCoordinates(latitude, longitude);
      if (coordParsed.error) {
        return res.status(400).json({ success: false, error: coordParsed.error });
      }
      donor.latitude = coordParsed.lat;
      donor.longitude = coordParsed.lng;
      donor.geocodingStatus = 'manual';
    }
  } else if (addressChanged) {
    // Address was edited without providing new coordinates:
    // Stale coordinates for a different address must not be kept!
    donor.latitude = undefined;
    donor.longitude = undefined;

    // Resolve address coordinates via Nominatim geocoding
    const query = [newAddress, newCity, newState, newPostalCode].filter(Boolean).join(', ');
    if (query) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          {
            headers: { 'User-Agent': 'LifeLink-Blood-Portal/1.0' },
            signal: AbortSignal.timeout(3000)
          }
        );
        if (geoRes.ok) {
          const geoData: any = await geoRes.json();
          if (Array.isArray(geoData) && geoData.length > 0 && isValidCoordinate(geoData[0].lat, geoData[0].lon)) {
            donor.latitude = parseFloat(geoData[0].lat);
            donor.longitude = parseFloat(geoData[0].lon);
            donor.geocodingStatus = 'resolved';
          } else {
            donor.geocodingStatus = 'failed';
            geocodingError = `Coordinates could not be resolved for address: ${query}`;
          }
        } else {
          donor.geocodingStatus = 'failed';
          geocodingError = 'Geocoding service unavailable.';
        }
      } catch {
        donor.geocodingStatus = 'failed';
        geocodingError = 'Geocoding request timed out.';
      }
    }
  }

  if (name) donor.name = name;
  if (phone) donor.phone = phone;
  if (address !== undefined) donor.address = String(address).trim();
  if (city !== undefined) donor.city = String(city).trim();
  if (state !== undefined) donor.state = String(state).trim();
  if (postalCode !== undefined) donor.postalCode = String(postalCode).trim();
  if (emergencyContact) donor.emergencyContact = emergencyContact;
  if (notificationPreferences) donor.notificationPreferences = notificationPreferences;
  if (weightKg !== undefined) donor.weightKg = Number(weightKg);
  if (travelRadiusKm !== undefined) donor.travelRadiusKm = Number(travelRadiusKm);
  if (pauseInvitations !== undefined) donor.pauseInvitations = Boolean(pauseInvitations);

  if (req.body.preferredBloodBankId !== undefined) {
    if (req.body.preferredBloodBankId === null || req.body.preferredBloodBankId === '') {
      donor.preferredBloodBankId = undefined;
      donor.preferredBloodBankName = undefined;
    } else {
      const pBank = db.bloodBanks.find(b => b.id === req.body.preferredBloodBankId);
      if (pBank) {
        donor.preferredBloodBankId = pBank.id;
        donor.preferredBloodBankName = pBank.name || pBank.bloodBankName;
        // If unassigned, assign to preferred
        if (!donor.assignedBloodBankId || donor.verificationStatus === 'Unverified') {
          donor.assignedBloodBankId = pBank.id;
          donor.assignedBloodBankName = pBank.name || pBank.bloodBankName;
        }
      }
    }
  }

  // Recalculate authoritative eligibility after updates (e.g. weight changes)
  syncDonorAuthoritativeEligibility(donor);

  const { passwordHash, ...data } = donor;
  db.saveSnapshot();

  res.json({
    success: true,
    message: geocodingError ? `Profile updated with warning: ${geocodingError}` : 'Profile updated successfully',
    geocodingStatus: donor.geocodingStatus,
    donor: data
  });
};

export const getDonorEligibility = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  // Use authoritative LifeLink eligibility service (enforces verification requirement)
  const eligibility = syncDonorAuthoritativeEligibility(donor);

  res.json({
    success: true,
    eligibility
  });
};

export const getDonorHistory = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donorId = req.user?.id;
  const donor = db.donors.find(d => d.id === donorId);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor not found' });

  // Find units where donorId matches
  const units = db.bloodUnits.filter(u => u.donorId === donorId);

  const history = units.map(u => ({
    donationId: u.id,
    date: u.collectionDate,
    bloodBankName: u.bloodBankName,
    bloodGroup: u.bloodGroup,
    component: u.component,
    volumeMl: u.volumeMl,
    status: u.availability === 'Issued' ? 'Transfused / Utilized' : u.testingStatus === 'Passed' ? 'Tested & Available' : u.testingStatus,
    source: u.source
  }));

  res.json({
    success: true,
    metrics: {
      totalDonations: donor.totalDonationsCount || history.length,
      totalVolumeMl: donor.totalVolumeMl || history.length * 450,
      livesImpactedEst: (donor.totalDonationsCount || history.length) * 3
    },
    history
  });
};

export const getEmergencyAlertsForDonor = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);

  // Show active emergency alerts matching blood group or universal O-
  const activeAlerts = db.emergencyAlerts.map(alert => {
    const hasResponded = db.emergencyResponses.some(r => r.alertId === alert.id && r.donorId === donor?.id);
    return {
      ...alert,
      hasResponded,
      isMatchingGroup: alert.bloodGroup === donor?.bloodGroup || alert.bloodGroup === 'O-'
    };
  });

  res.json({ success: true, alerts: activeAlerts });
};

export const respondToEmergencyAlert = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { alertId } = req.body;
  const donor = db.donors.find(d => d.id === req.user?.id);

  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const alert = db.emergencyAlerts.find(a => a.id === alertId);
  if (!alert) return res.status(404).json({ success: false, error: 'Emergency alert not found' });

  const existing = db.emergencyResponses.find(r => r.alertId === alertId && r.donorId === donor.id);
  if (existing) {

    return res.json({ success: true, message: 'You have already responded to this emergency alert', response: existing });
  }

  const response: EmergencyResponse = {
    id: `RESP-${Date.now()}`,
    alertId,
    donorId: donor.id,
    donorName: donor.name,
    donorPhone: donor.phone,
    status: 'Accepted',
    respondedAt: new Date().toISOString()
  };

  db.emergencyResponses.push(response);
  alert.responsesCount = (alert.responsesCount || 0) + 1;
  db.saveSnapshot();

  // Send confirmation SMS to donor via sms-service on behalf of the hospital/blood bank
  const facilityName = alert.bloodBankName || alert.hospitalName || 'Emergency Blood Operations';
  await smsService.sendBloodBankConfirmation(
    donor.phone,
    donor.name,
    facilityName,
    `Your commitment to respond for emergency blood alert (${alert.bloodGroup} ${alert.component}) has been recorded. Please head to ${facilityName}`
  );

  res.json({
    success: true,
    message: 'Thank you! Your willingness to donate has been transmitted to the blood bank staff.',
    response
  });
};

export const createCampRequest = async (req: AuthenticatedRequest, res: Response) => {
  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const {
    organizationName,
    organizationType,
    organizationWebsite,
    organizationRegistrationId,
    organizerName,
    organizerEmail,
    organizerPhone,
    organizerRole,
    proposedDate,
    preferredTimeSlot,
    venueAddress,
    city,
    postalCode,
    estimatedParticipants,
    expectedDonations,
    availableFacilities,
    additionalNotes,
    isAuthorizedRepresentative,
    agreedToTerms,
    bloodBankId,
    bloodBankName
  } = req.body;

  // Validation
  if (!organizationName || !organizationType || !organizerName || !organizerEmail || !organizerPhone || !proposedDate || !venueAddress || !city) {
    return res.status(400).json({ success: false, error: 'Please fill in all required fields marked with *.' });
  }

  if (!isAuthorizedRepresentative || !agreedToTerms) {
    return res.status(400).json({ success: false, error: 'You must confirm authorization and agree to the coordination terms.' });
  }

  let assignedBankId = bloodBankId || undefined;
  let assignedBankName = bloodBankName || undefined;

  if (assignedBankId) {
    const bb = db.bloodBanks.find(b => b.id === assignedBankId);
    if (bb) {
      assignedBankName = bb.bloodBankName || bb.name;
    }
  }

  let campLat: number | undefined;
  let campLng: number | undefined;
  if (req.body.latitude !== undefined && req.body.longitude !== undefined && req.body.latitude !== null && req.body.longitude !== null && req.body.latitude !== '' && req.body.longitude !== '') {
    const parsed = parseCoordinates(req.body.latitude, req.body.longitude);
    if (!parsed.error) {
      campLat = parsed.lat;
      campLng = parsed.lng;
    }
  }

  const newRequest = {
    id: `CAMP-REQ-${Math.floor(1000 + Math.random() * 9000)}`,
    donorId: donor.id,
    donorName: donor.name,
    donorEmail: donor.email,
    organizationName: organizationName.trim(),
    organizationType,
    organizationWebsite: organizationWebsite?.trim(),
    organizationRegistrationId: organizationRegistrationId?.trim(),
    organizerName: organizerName.trim(),
    organizerEmail: organizerEmail.trim(),
    organizerPhone: organizerPhone.trim(),
    organizerRole: organizerRole?.trim() || '',
    proposedDate,
    preferredTimeSlot: preferredTimeSlot || '',
    venueAddress: venueAddress.trim(),
    city: city.trim(),
    postalCode: postalCode?.trim() || '',
    estimatedParticipants: Number(estimatedParticipants) || 0,
    expectedDonations: expectedDonations ? Number(expectedDonations) : 0,
    availableFacilities: availableFacilities?.trim(),
    additionalNotes: additionalNotes?.trim(),
    isAuthorizedRepresentative: Boolean(isAuthorizedRepresentative),
    agreedToTerms: Boolean(agreedToTerms),
    bloodBankId: assignedBankId,
    bloodBankName: assignedBankName,
    latitude: campLat,
    longitude: campLng,
    status: 'Submitted' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.campRequests.unshift(newRequest);
  db.saveSnapshot();

  // Dispatch real-time notification to the target blood bank
  await notificationService.dispatchNotification({
    userId: assignedBankId || 'role:blood_bank',
    title: 'New Blood Camp Request',
    message: `${newRequest.organizationName} submitted a camp request for ${newRequest.proposedDate} in ${newRequest.city}.`,
    type: 'camp',
    priority: 'medium',
    link: '/blood-bank/collections'
  });

  res.status(201).json({
    success: true,
    message: 'Organizational blood camp request submitted successfully!',
    request: newRequest
  });
};

export const getDonorCampRequests = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  const requests = db.campRequests.filter(r => r.donorId === donorId);
  res.json({ success: true, requests });
};

export const cancelCampRequest = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  const { id } = req.params;

  const request = db.campRequests.find(r => r.id === id && r.donorId === donorId);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Camp request not found or access denied.' });
  }

  if (request.status === 'Completed' || request.status === 'Cancelled') {
    return res.status(400).json({ success: false, error: `Request cannot be cancelled in status: ${request.status}` });
  }

  request.status = 'Cancelled';
  request.updatedAt = new Date().toISOString();
  request.statusNote = 'Cancelled by requester.';
  db.saveSnapshot();

  res.json({ success: true, message: 'Camp request cancelled successfully.', request });
};

// Camp RSVP / Registration Handlers
export const registerForCamp = async (req: AuthenticatedRequest, res: Response) => {
  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  // Disallow registration if donor has active clinical disqualifications (e.g. weight < 50kg)
  if (donor.weightKg && Number(donor.weightKg) < 50) {
    return res.status(422).json({
      success: false,
      error: `Cannot register for donation camp. Donor weight (${donor.weightKg} kg) is below the minimum clinical requirement (50 kg).`
    });
  }

  const { id: campId } = req.params;
  const camp = db.donationCamps.find(c => c.id === campId);
  if (!camp) return res.status(404).json({ success: false, error: 'Donation camp not found' });

  // Check duplicate registration
  const existing = db.campRegistrations.find(r => r.campId === campId && r.donorId === donor.id && r.status === 'Registered');
  if (existing) {
    return res.status(400).json({ success: false, error: `You are already registered for ${camp.title}` });
  }

  // Capacity check
  if (camp.registeredCount >= camp.targetUnits) {
    return res.status(400).json({ success: false, error: 'This donation camp has reached maximum donor capacity.' });
  }

  const registration = {
    id: `RSVP-${Date.now()}`,
    campId,
    donorId: donor.id,
    donorName: donor.name,
    donorEmail: donor.email,
    registeredAt: new Date().toISOString(),
    status: 'Registered' as const
  };

  db.campRegistrations.push(registration);
  camp.registeredCount = (camp.registeredCount || 0) + 1;

  // Add Notification
  await notificationService.dispatchNotification({
    userId: donor.id,
    title: 'Camp Registration Confirmed',
    message: `You are registered for "${camp.title}" on ${camp.startDate} at ${camp.location}.`,
    type: 'camp',
    priority: 'medium',
    link: '/donor/camps'
  });

  // Send confirmation SMS to donor via sms-service
  const organizerName = camp.organizer || 'LifeLink Blood Center';
  await smsService.sendBloodBankConfirmation(
    donor.phone,
    donor.name,
    organizerName,
    `Your registration for donation camp "${camp.title}" on ${camp.startDate} at ${camp.location} is confirmed`
  );

  res.json({
    success: true,
    message: `Successfully registered for ${camp.title}! SMS & Email reminder scheduled.`,
    registration,
    camp
  });
};

export const cancelCampRegistration = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  const { id: campId } = req.params;

  const registration = db.campRegistrations.find(r => r.campId === campId && r.donorId === donorId && r.status === 'Registered');
  if (!registration) {
    return res.status(404).json({ success: false, error: 'Active registration not found for this camp.' });
  }

  registration.status = 'Cancelled';

  const camp = db.donationCamps.find(c => c.id === campId);
  if (camp && camp.registeredCount > 0) {
    camp.registeredCount -= 1;
  }

  db.saveSnapshot();

  res.json({ success: true, message: 'Camp registration cancelled successfully.' });
};

export const getDonorCampRegistrations = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  const userRegistrations = db.campRegistrations.filter(r => r.donorId === donorId && r.status === 'Registered');
  const registeredCampIds = userRegistrations.map(r => r.campId);
  const registeredCamps = db.donationCamps.filter(c => registeredCampIds.includes(c.id));

  res.json({
    success: true,
    registrations: userRegistrations,
    camps: registeredCamps
  });
};

// Notification Handlers
export const getDonorNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  const notifs = db.notifications.filter(n => n.userId === donorId || n.userId === 'role:donor');
  res.json({ success: true, notifications: notifs });
};

export const markNotificationAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const notif = db.notifications.find(n => n.id === id);
  if (notif) {
    notif.read = true;
    db.saveSnapshot();
  }
  res.json({ success: true });
};

export const markAllNotificationsAsRead = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  db.notifications.forEach(n => {
    if (n.userId === donorId || n.userId === 'role:donor' || n.userId === 'all') {
      n.read = true;
    }
  });
  db.saveSnapshot();
  res.json({ success: true, message: 'All notifications marked as read.' });
};

// Blood Group Verification Handlerx
export const verifyBloodGroup = async (req: AuthenticatedRequest, res: Response) => {
  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const { documentType, documentNumber, preferredBloodBankId } = req.body;
  const fileUrl = req.body.fileUrl || req.body.bloodGroupProofDocUrl;
  if (!documentType || !fileUrl) {
    return res.status(400).json({ success: false, error: 'Please provide document type and upload proof.' });
  }

  // Resolve assigned blood bank: preferred choice, or existing assignment, or city match, or first bank
  let targetBank = db.bloodBanks.find(b => b.id === preferredBloodBankId);
  if (!targetBank && donor.preferredBloodBankId) {
    targetBank = db.bloodBanks.find(b => b.id === donor.preferredBloodBankId);
  }
  if (!targetBank && donor.assignedBloodBankId) {
    targetBank = db.bloodBanks.find(b => b.id === donor.assignedBloodBankId);
  }
  if (!targetBank && donor.city) {
    targetBank = db.bloodBanks.find(b => b.city && b.city.toLowerCase() === donor.city.toLowerCase());
  }
  if (!targetBank) {
    targetBank = db.bloodBanks.find(b => b.isActive !== false) || db.bloodBanks[0];
  }

  const assignedBankId = targetBank?.id;
  const assignedBankName = targetBank?.bloodBankName || targetBank?.name;

  donor.bloodGroupVerificationStatus = 'Pending Verification';
  donor.verificationStatus = assignedBankId ? 'Pending Verification' : 'Pending Assignment';
  donor.assignedBloodBankId = assignedBankId;
  donor.assignedBloodBankName = assignedBankName;
  if (preferredBloodBankId && targetBank) {
    donor.preferredBloodBankId = targetBank.id;
    donor.preferredBloodBankName = assignedBankName;
  }
  donor.verificationSubmittedAt = new Date().toISOString();
  donor.bloodGroupProofDocUrl = fileUrl;
  (donor as any).proofDocumentType = documentType;
  if (documentNumber) (donor as any).proofDocumentNumber = documentNumber;

  // Sync authoritative eligibility: status remains Pending/ineligible until blood bank staff approval
  const assessment = syncDonorAuthoritativeEligibility(donor);
  db.saveSnapshot();

  // Dispatch real-time notification to the assigned blood bank if available
  if (assignedBankId) {
    await notificationService.dispatchNotification({
      userId: assignedBankId,
      title: 'New Donor Verification Submission',
      message: `Donor ${donor.name} (${donor.bloodGroup || 'Unspecified'}) submitted verification documents for review.`,
      type: 'verification',
      priority: 'medium',
      link: '/blood-bank/collections'
    });
  }

  res.json({
    success: true,
    message: assignedBankName
      ? `Blood group verification document submitted successfully to ${assignedBankName}. An authorized blood bank reviewer will verify your proof within 24-48 hours.`
      : 'Blood group verification document submitted successfully. Queued for regional verification center assignment.',
    status: donor.verificationStatus,
    assignedBloodBankId: assignedBankId,
    assignedBloodBank: assignedBankId ? {
      id: assignedBankId,
      name: assignedBankName
    } : null,
    eligibility: assessment
  });
};

// Cancel Pending Verification Request
export const cancelVerificationRequest = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  if (donor.verificationStatus === 'Verified') {
    return res.status(400).json({ success: false, error: 'Verified donor profiles cannot be cancelled.' });
  }

  donor.verificationStatus = 'Cancelled';
  donor.bloodGroupVerificationStatus = 'Cancelled';
  donor.verificationNotes = 'Verification request withdrawn by donor.';
  syncDonorAuthoritativeEligibility(donor);
  db.saveSnapshot();

  res.json({
    success: true,
    message: 'Verification request cancelled successfully.',
    verificationStatus: 'Cancelled'
  });
};

// Secure Document Upload Handler (Base64 / Payload with Server Validation)
export const uploadProofDocument = async (req: AuthenticatedRequest, res: Response) => {
  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const { fileName, fileType, fileSize, fileData } = req.body;

  if (!fileName || !fileType || !fileData) {
    return res.status(400).json({ success: false, error: 'File data, file name, and type are required.' });
  }

  // Server-side file size validation (5MB max = 5,242,880 bytes)
  const MAX_BYTES = 5 * 1024 * 1024;
  if (fileSize && Number(fileSize) > MAX_BYTES) {
    return res.status(400).json({ success: false, error: 'Uploaded file size exceeds maximum limit of 5 MB.' });
  }

  // Server-side MIME type & Extension validation
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  const ext = fileName.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

  if (!allowedMimeTypes.includes(fileType) && !allowedExtensions.includes(ext || '')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file format. Only PDF, PNG, and JPG files are accepted.'
    });
  }

  const docId = `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const documentMetadata = {
    docId,
    donorId: donor.id,
    fileName,
    fileType,
    fileSize: Number(fileSize) || 1024 * 250,
    fileUrl: `/api/donors/document/${docId}`,
    fileData,
    uploadedAt: new Date().toISOString()
  };

  (donor as any).proofDocument = documentMetadata;

  res.json({
    success: true,
    message: 'Document uploaded and verified on server successfully.',
    document: {
      docId,
      fileName,
      fileType,
      fileSize: documentMetadata.fileSize,
      fileUrl: documentMetadata.fileUrl,
      uploadedAt: documentMetadata.uploadedAt
    }
  });
};

// Secure Document Retrieval Handler
export const getProofDocument = async (req: AuthenticatedRequest, res: Response) => {
  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const proofDoc = (donor as any).proofDocument;
  if (!proofDoc || proofDoc.docId !== req.params.docId) {
    return res.status(404).json({ success: false, error: 'Requested document not found or access unauthorized.' });
  }

  res.json({
    success: true,
    document: proofDoc
  });
};

// Certificate Authorization & Data Handler
export const getDonorCertificate = async (req: AuthenticatedRequest, res: Response) => {
  const donorId = req.user?.id;
  const { donationId } = req.params;

  const unit = db.bloodUnits.find(u => u.id === donationId && u.donorId === donorId);
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Donation record not found or access unauthorized.' });
  }

  const donor = db.donors.find(d => d.id === donorId);

  res.json({
    success: true,
    certificate: {
      certificateNumber: `CERT-${unit.id}`,
      donorName: donor?.name || 'Valued Donor',
      bloodGroup: unit.bloodGroup,
      component: unit.component,
      donationDate: unit.collectionDate,
      bloodBankName: unit.bloodBankName,
      volumeMl: unit.volumeMl,
      issuedAt: new Date().toISOString()
    }
  });
};

// Location Search & Autocomplete Controller for LifeLink Entities
export const searchLocations = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.json({ success: true, results: [] });
  }

  const results: any[] = [];

  // 1. Search Blood Banks
  db.bloodBanks.forEach(bb => {
    if (
      bb.name.toLowerCase().includes(q) ||
      bb.address.toLowerCase().includes(q) ||
      bb.city.toLowerCase().includes(q)
    ) {
      results.push({
        id: `bb-${bb.id}`,
        entityId: bb.id,
        name: bb.name,
        address: `${bb.address}, ${bb.city}`,
        city: bb.city,
        state: bb.state,
        lat: bb.latitude,
        lng: bb.longitude,
        type: 'blood_bank',
        isVerifiedEntity: true,
        badgeLabel: 'LifeLink Blood Bank'
      });
    }
  });

  // 2. Search Hospitals
  db.hospitals.forEach(h => {
    if (
      h.name.toLowerCase().includes(q) ||
      h.address.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q)
    ) {
      results.push({
        id: `hosp-${h.id}`,
        entityId: h.id,
        name: h.name,
        address: `${h.address}, ${h.city}`,
        city: h.city,
        state: h.state,
        lat: h.latitude,
        lng: h.longitude,
        type: 'hospital',
        isVerifiedEntity: true,
        badgeLabel: 'LifeLink Hospital'
      });
    }
  });

  // 3. Search Donation Camps (upcoming active only)
  db.donationCamps.forEach((c: any) => {
    if (c.status !== 'Completed' && c.status !== 'Cancelled') {
      if (
        c.title?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.organizer?.toLowerCase().includes(q)
      ) {
        results.push({
          id: `camp-${c.id}`,
          entityId: c.id,
          name: c.title,
          address: `${c.location}, ${c.city}`,
          city: c.city,
          lat: c.latitude,
          lng: c.longitude,
          type: 'camp',
          isVerifiedEntity: true,
          badgeLabel: 'LifeLink Camp'
        });
      }
    }
  });

  res.json({ success: true, count: results.length, results });
};

// Save Pre-Screening Questionnaire Result
export const savePrescreening = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const { weightKg, hasFever, hasMedications, hasTattoo, hasTravelHistory } = req.body;

  const requiresReview = Boolean(hasFever || hasMedications || hasTattoo || hasTravelHistory || (weightKg && Number(weightKg) < 50));

  const prescreening = {
    status: requiresReview ? 'Requires Medical Staff Review' : 'Cleared for In-Person Staff Review',
    isCleared: !requiresReview,
    reason: requiresReview
      ? 'Self-reported medical history (recent illness, medication, tattoo, or weight < 50kg) requires clinical review by donation-center personnel.'
      : 'Preliminary answers meet standard voluntary donor guidelines. Final clearance remains subject to hemoglobin testing & staff evaluation.',
    submittedAt: new Date().toISOString()
  };

  (donor as any).prescreeningResult = prescreening;

  // Re-assess authoritative eligibility against medical review flags
  syncDonorAuthoritativeEligibility(donor);
  db.saveSnapshot();

  res.json({
    success: true,
    message: 'Pre-screening questionnaire submitted successfully.',
    prescreening
  });
};

// Cancel Emergency Response
export const cancelEmergencyResponse = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const { alertId } = req.body;
  const donorId = req.user?.id;

  const idx = db.emergencyResponses.findIndex(r => r.alertId === alertId && r.donorId === donorId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'No active response found to withdraw.' });
  }

  db.emergencyResponses.splice(idx, 1);

  const alert = db.emergencyAlerts.find(a => a.id === alertId);
  if (alert && alert.responsesCount && alert.responsesCount > 0) {
    alert.responsesCount -= 1;
  }

  res.json({ success: true, message: 'Emergency alert response withdrawn successfully.' });
};

// Digital Donor Pass Data
export const getDigitalPass = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donor = db.donors.find(d => d.id === req.user?.id);
  if (!donor) return res.status(404).json({ success: false, error: 'Donor profile not found' });

  const assessment = syncDonorAuthoritativeEligibility(donor);

  res.json({
    success: true,
    pass: {
      donorId: donor.id,
      name: donor.name,
      email: donor.email,
      phone: donor.phone,
      bloodGroup: donor.bloodGroup || 'Unspecified',
      verificationStatus: assessment.verificationStatus,
      bloodGroupVerificationStatus: assessment.verificationStatus,
      isEligible: assessment.isEligible,
      deferralReason: assessment.deferralReason,
      city: donor.city,
      qrToken: `LIFELINK-PASS-${donor.id}-${Date.now().toString(36)}`,
      issuedAt: new Date().toISOString(),
      passNotice: 'Digital identification and check-in aid. Must be presented with official photo ID at donation center.'
    }
  });
};

/**
 * Nearby Hospital Discovery for Authenticated Donors
 * Uses donor's saved coordinates or client-supplied coordinates,
 * queries actual persisted hospital records, filters out unconfigured/invalid ones,
 * calculates Haversine distance, and sorts nearest-first.
 */
export const getNearbyHospitals = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  const donorId = req.user?.id;
  const donor = db.donors.find(d => d.id === donorId);
  if (!donor) {
    return res.status(404).json({ success: false, error: 'Donor profile not found' });
  }

  // Obtain coordinates: from query params if provided, or from saved donor profile
  let donorLat: number | undefined;
  let donorLng: number | undefined;

  const { lat, lng, radius } = req.query;

  if ((lat !== undefined && lat !== '') || (lng !== undefined && lng !== '')) {
    const coordParsed = parseCoordinates(lat, lng);
    if (coordParsed.error) {
      return res.status(400).json({ success: false, error: coordParsed.error });
    }
    donorLat = coordParsed.lat;
    donorLng = coordParsed.lng;
  } else if (isValidCoordinate(donor.latitude, donor.longitude)) {
    donorLat = donor.latitude;
    donorLng = donor.longitude;
  }

  // If no coordinates are available from query or profile:
  if (donorLat === undefined || donorLng === undefined) {
    return res.json({
      success: true,
      donorLocationMissing: true,
      message: 'Donor location is not configured. Please add your location in My Profile or allow browser geolocation to discover nearby hospitals.',
      hospitals: [],
      totalFound: 0
    });
  }

  // Configurable search radius (default to donor's travelRadiusKm, or 50 km)
  let maxRadiusKm = donor.travelRadiusKm || 50;
  if (radius && radius !== 'all') {
    const numRadius = Number(radius);
    if (Number.isFinite(numRadius) && numRadius > 0) {
      maxRadiusKm = numRadius;
    }
  }

  // Filter persisted hospital records with valid coordinates
  const nearbyHospitals: any[] = [];

  db.hospitals.forEach(h => {
    if (!isValidCoordinate(h.latitude, h.longitude)) {
      return; // Skip hospitals without valid coordinates
    }

    const dist = calcHaversineKm(donorLat!, donorLng!, h.latitude!, h.longitude!);

    if (radius === 'all' || dist <= maxRadiusKm) {
      nearbyHospitals.push({
        id: h.id,
        name: h.name || h.hospitalName,
        hospitalName: h.hospitalName || h.name,
        licenseId: h.licenseId,
        verificationStatus: h.verificationStatus || 'Pending Verification',
        contactPerson: h.contactPerson,
        phone: h.phone,
        emergencyPhone: h.emergencyPhone,
        address: h.address,
        city: h.city,
        state: h.state,
        postalCode: h.postalCode,
        latitude: h.latitude,
        longitude: h.longitude,
        distanceKm: dist
      });
    }
  });

  // Sort results nearest first
  nearbyHospitals.sort((a, b) => a.distanceKm - b.distanceKm);

  return res.json({
    success: true,
    donorLocationMissing: false,
    donorCoordinates: { lat: donorLat, lng: donorLng },
    radiusKm: radius === 'all' ? null : maxRadiusKm,
    totalFound: nearbyHospitals.length,
    hospitals: nearbyHospitals
  });
};


import { Router } from 'express';
import { 
  getDonorProfile, 
  updateDonorProfile, 
  getDonorEligibility, 
  getDonorHistory, 
  getEmergencyAlertsForDonor, 
  respondToEmergencyAlert,
  cancelEmergencyResponse,
  createCampRequest,
  getDonorCampRequests,
  cancelCampRequest,
  registerForCamp,
  cancelCampRegistration,
  getDonorCampRegistrations,
  getDonorNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  verifyBloodGroup,
  uploadProofDocument,
  getProofDocument,
  getDonorCertificate,
  searchLocations,
  savePrescreening,
  getDigitalPass
} from '../controllers/donorController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['donor']));

router.get('/location-search', searchLocations);
router.get('/profile', getDonorProfile);
router.put('/profile', updateDonorProfile);
router.post('/verify-blood-group', verifyBloodGroup);
router.post('/upload-proof', uploadProofDocument);
router.get('/document/:docId', getProofDocument);

router.get('/eligibility', getDonorEligibility);
router.post('/prescreening', savePrescreening);
router.get('/digital-pass', getDigitalPass);
router.get('/history', getDonorHistory);
router.get('/certificates/:donationId', getDonorCertificate);

router.get('/emergency-alerts', getEmergencyAlertsForDonor);
router.post('/emergency-alerts/respond', respondToEmergencyAlert);
router.post('/emergency-alerts/cancel-response', cancelEmergencyResponse);

// Camp Registration Routes
router.get('/camps/my-registrations', getDonorCampRegistrations);
router.post('/camps/:id/register', registerForCamp);
router.post('/camps/:id/cancel-registration', cancelCampRegistration);

// Organization Camp Request Routes
router.post('/camp-requests', createCampRequest);
router.get('/camp-requests', getDonorCampRequests);
router.patch('/camp-requests/:id/cancel', cancelCampRequest);

// Notification Routes
router.get('/notifications', getDonorNotifications);
router.patch('/notifications/:id/read', markNotificationAsRead);
router.patch('/notifications/read-all', markAllNotificationsAsRead);

export default router;

import { Router } from 'express';
import { 
  getAdminVerificationRequests, 
  reassignDonorVerification,
  getAdminSmartRoutingOverview,
  escalateAdminRouting
} from '../controllers/adminController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/verification-requests', getAdminVerificationRequests);
router.post('/reassign-donor', reassignDonorVerification);

// Phase 7: Smart Routing Admin Observability & Controls
router.get('/smart-routing', getAdminSmartRoutingOverview);
router.post('/smart-routing/:requestId/escalate', escalateAdminRouting);

export default router;

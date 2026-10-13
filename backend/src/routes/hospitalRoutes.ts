import { Router } from 'express';
import { 
  getHospitalDashboard, 
  getHospitalLogistics,
  searchBloodAvailability, 
  createBloodRequest, 
  getHospitalRequests, 
  cancelHospitalRequest,
  getPatientSamples, 
  submitPatientSample, 
  getRequestMessages, 
  sendRequestMessage,
  getHospitalStorageLedger,
  createHospitalStorageEntry,
  updateHospitalStorageEntry,
  deleteHospitalStorageEntry,
  confirmHospitalReceipt,
  reportHospitalDiscrepancy,
  getHospitalRequestDispatch
} from '../controllers/hospitalController';
import { authenticateToken, optionalAuthenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Public & hospital search blood availability (with optional auth)
router.get('/search-blood', optionalAuthenticateToken, searchBloodAvailability);

// Protected routes requiring authentication & hospital/blood_bank role
router.use(authenticateToken);
router.use(requireRole(['hospital', 'blood_bank']));

router.get('/dashboard', getHospitalDashboard);
router.get('/logistics', getHospitalLogistics);
router.post('/requests', createBloodRequest);
router.get('/requests', getHospitalRequests);
router.post('/requests/:id/cancel', cancelHospitalRequest);
router.patch('/requests/:id/cancel', cancelHospitalRequest);
router.post('/requests/:id/confirm-receipt', confirmHospitalReceipt);
router.post('/requests/:id/report-discrepancy', reportHospitalDiscrepancy);
router.get('/requests/:id/dispatch', getHospitalRequestDispatch);
router.get('/samples', getPatientSamples);
router.post('/samples', submitPatientSample);
router.get('/requests/:requestId/messages', getRequestMessages);
router.post('/requests/:requestId/messages', sendRequestMessage);

// Local OT Storage Ledger & Par Monitor (Phase 4A)
router.get('/storage-ledger', getHospitalStorageLedger);
router.post('/storage-ledger', createHospitalStorageEntry);
router.put('/storage-ledger/:entryId', updateHospitalStorageEntry);
router.delete('/storage-ledger/:entryId', deleteHospitalStorageEntry);

export default router;

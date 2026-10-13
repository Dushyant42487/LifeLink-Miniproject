import { Router } from 'express';
import { 
  getBloodBankDashboard, 
  getInventory, 
  getFefoPriority,
  reserveBloodUnit,
  releaseBloodUnit,
  issueBloodUnit,
  addBloodUnit, 
  getTestingRecords, 
  updateTestingStatus, 
  getExpiryMonitoring, 
  fulfillHospitalRequest, 
  getReports,
  getBloodBankCamps,
  getBloodBankCampById,
  createBloodBankCamp,
  updateBloodBankCamp,
  cancelBloodBankCamp,
  getCampCollections,
  searchDonors,
  getDonorDetails,
  recordBloodCollection,
  getBloodCollections,
  getBloodCollectionById,
  getFractionationRecords,
  getPendingFractionationCollections,
  processFractionation,
  getColdStorageEquipment,
  getColdStorageEquipmentById,
  registerColdStorageEquipment,
  recordTemperatureReading,
  getTemperatureReadings,
  getColdStorageAlarms,
  acknowledgeColdStorageAlarm,
  resolveColdStorageAlarm,
  getPotentiallyExposedInventory,
  getBloodBankRequests,
  getBloodBankRequestById,
  getEligibleUnitsForRequest,
  allocateUnitsToRequest,
  releaseAllocatedUnits,
  prepareDispatch,
  confirmDispatch,
  getDispatchSlip,
  getEmergencyAllocationMatrix
} from '../controllers/bloodBankController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['blood_bank']));

router.get('/dashboard', getBloodBankDashboard);
router.get('/inventory', getInventory);
router.get('/inventory/fefo-priority', getFefoPriority);
router.post('/inventory', addBloodUnit);
router.post('/inventory/:id/reserve', reserveBloodUnit);
router.post('/inventory/:id/release', releaseBloodUnit);
router.post('/inventory/:id/issue', issueBloodUnit);
router.get('/testing', getTestingRecords);
router.put('/testing/:id', updateTestingStatus);
router.get('/expiry', getExpiryMonitoring);
router.put('/requests/:id/fulfill', fulfillHospitalRequest);
router.get('/reports', getReports);

// Phase 5D: Hospital Requisitions Fulfillment & Dispatch Desk
router.get('/requests', getBloodBankRequests);
router.get('/requests/:id', getBloodBankRequestById);
router.get('/requests/:id/eligible-units', getEligibleUnitsForRequest);
router.post('/requests/:id/allocate', allocateUnitsToRequest);
router.post('/requests/:id/release-allocation', releaseAllocatedUnits);
router.post('/requests/:id/prepare-dispatch', prepareDispatch);
router.post('/requests/:id/confirm-dispatch', confirmDispatch);
router.get('/dispatches/:id/slip', getDispatchSlip);
router.get('/requests/:id/dispatch-slip', getDispatchSlip);
router.get('/allocation-matrix', getEmergencyAllocationMatrix);

// Mobile Camps
router.get('/camps', getBloodBankCamps);
router.get('/camps/:id', getBloodBankCampById);
router.post('/camps', createBloodBankCamp);
router.put('/camps/:id', updateBloodBankCamp);
router.post('/camps/:id/cancel', cancelBloodBankCamp);
router.get('/camps/:id/collections', getCampCollections);

// Donors & Collections
router.get('/donors/search', searchDonors);
router.get('/donors/:id', getDonorDetails);
router.get('/collections', getBloodCollections);
router.get('/collections/:id', getBloodCollectionById);
router.post('/collections', recordBloodCollection);

// Component Fractionation
router.get('/fractionation', getFractionationRecords);
router.get('/fractionation/pending', getPendingFractionationCollections);
router.post('/fractionation', processFractionation);

// Phase 5C: Cold-Storage Monitoring, Temperature Alarms & Audit Trail
router.get('/cold-storage/equipment', getColdStorageEquipment);
router.get('/cold-storage/equipment/:id', getColdStorageEquipmentById);
router.post('/cold-storage/equipment', registerColdStorageEquipment);
router.post('/cold-storage/readings', recordTemperatureReading);
router.get('/cold-storage/readings', getTemperatureReadings);
router.get('/cold-storage/alarms', getColdStorageAlarms);
router.post('/cold-storage/alarms/:id/acknowledge', acknowledgeColdStorageAlarm);
router.post('/cold-storage/alarms/:id/resolve', resolveColdStorageAlarm);
router.get('/cold-storage/equipment/:id/exposed-inventory', getPotentiallyExposedInventory);

export default router;


export type UserRole = 'donor' | 'hospital' | 'blood_bank' | 'admin';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type BloodComponent = 'RBC' | 'Plasma' | 'Platelets';

export type TestingStatus = 'Pending' | 'In Testing' | 'Passed' | 'Failed' | 'Quarantined';
export type AvailabilityStatus = 'Available' | 'Reserved' | 'Issued' | 'Expired' | 'Quarantined';
export type RequestUrgency = 'Routine' | 'Urgent' | 'Emergency';
export type RequestStatus = 
  | 'Pending' 
  | 'Under Review' 
  | 'Sample Submitted' 
  | 'Verified' 
  | 'Partially Fulfilled' 
  | 'Allocated'
  | 'Reserved' 
  | 'Prepared for Dispatch'
  | 'Dispatched' 
  | 'Received'
  | 'Issued' 
  | 'Fulfilled' 
  | 'Rejected' 
  | 'Cancelled';

export type DispatchStatus = 'Prepared' | 'In Transit' | 'Delivered' | 'Received' | 'Discrepancy Reported' | 'Cancelled';

export interface DispatchUnitItem {
  unitId: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  volumeMl: number;
  collectionDate: string;
  expiryDate: string;
  storageLocation: string;
  testingStatus: TestingStatus;
}

export interface BloodDispatch {
  id: string; // e.g. DSP-2026-001
  requestId: string;
  bloodBankId: string;
  bloodBankName: string;
  hospitalId: string;
  hospitalName: string;
  patientReferenceId: string;
  department?: string;
  component: BloodComponent;
  bloodGroup: BloodGroup;
  unitIds: string[];
  unitItems: DispatchUnitItem[];
  quantityUnits: number;
  status: DispatchStatus;

  // Authoritative courier & transport parameters
  courierType: 'Dedicated Hospital Courier' | 'Blood Bank Transport' | 'External Medical Courier';
  courierReference?: string; // vehicle / transport container ID or tag
  packagingType: 'Standard Passive Thermal Container with Ice Gel Packs' | 'Validated Cold-Chain Shipper' | 'Platelet Transit Agitator Box';
  targetTransportTemp: string; // e.g. "2°C to 6°C (Chilled)"
  coldChainMonitoring: 'Passive Temp Strips' | 'Unmonitored Passive Container';
  specialHandlingInstructions?: string;

  preparedAt: string;
  preparedBy: string;
  dispatchedAt?: string;
  dispatchedBy?: string;

  // Hospital Receipt confirmation
  receivedAt?: string;
  receivedBy?: string;
  discrepancyNotes?: string;
  discrepancyReportedAt?: string;
  discrepancyReportedBy?: string;

  auditHistory: {
    action: string;
    timestamp: string;
    operator: string;
    notes?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  hospitalName?: string;
  bloodBankName?: string;
  verificationStatus?: 'Pending Verification' | 'Verified' | 'Rejected';
  bloodGroup?: BloodGroup;
  address?: string;
  city?: string;
  state?: string;
}

export interface DonorProfile extends User {
  role: 'donor';
  bloodGroup: BloodGroup;
  dob: string;
  gender: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  lastDonationDate?: string;
  weightKg: number;
  notificationPreferences?: {
    emergencyAlerts: boolean;
    campReminders: boolean;
    eligibilityAlerts: boolean;
  };
  bloodGroupVerificationStatus?: 'Unverified' | 'Pending Verification' | 'Verified';
  bloodGroupProofDocUrl?: string;
  travelRadiusKm?: number;
  pauseInvitations?: boolean;
}

export interface BloodUnit {
  id: string;
  bloodBankId: string;
  bloodBankName: string;
  donorId?: string;
  donorCode?: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  volumeMl: number;
  collectionDate: string;
  expiryDate: string;
  testingStatus: TestingStatus;
  availability: AvailabilityStatus;
  storageLocation: string;
  source: string;
  notes?: string;
  daysRemaining?: number;
  reservedForRequestId?: string;
  sourceCollectionId?: string;
  fractionationBatchId?: string;
}

export interface BloodCollectionRecord {
  id: string;
  bloodBankId: string;
  bloodBankName: string;
  donorId: string;
  donorCode: string;
  donorName: string;
  bloodGroup: BloodGroup;
  collectionDate: string;
  collectionTime?: string;
  collectionType: 'In-House Phlebotomy' | 'Mobile Camp';
  campId?: string;
  campName?: string;
  volumeMl: number;
  unitOfMeasure: 'mL';
  phlebotomistStaffId?: string;
  phlebotomistName?: string;
  status: 'Collected' | 'Testing Quarantine' | 'Fractionated' | 'Discarded';
  fractionationStatus: 'Pending' | 'Fractionated' | 'Not Applicable';
  notes?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface ComponentFractionationRecord {
  id: string;
  bloodBankId: string;
  sourceCollectionId: string;
  donorBloodGroup: BloodGroup;
  sourceVolumeMl: number;
  processedAt: string;
  processedBy: string;
  processingMethod: string;
  notes?: string;
  producedComponents: {
    unitId: string;
    component: BloodComponent;
    volumeMl: number;
    storageLocation: string;
    testingStatus: TestingStatus;
    availability: AvailabilityStatus;
  }[];
}


export interface TestingRecord {
  id: string;
  unitId: string;
  bloodBankId: string;
  bloodGroup: BloodGroup;
  hivTest: string;
  hbvTest: string;
  hcvTest: string;
  syphilisTest: string;
  malariaTest: string;
  status: TestingStatus;
  testedBy: string;
  testingDate: string;
  notes?: string;
}

export interface BloodRequest {
  id: string;
  hospitalId: string;
  hospitalName: string;
  bloodBankId?: string;
  bloodBankName?: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  quantityUnits: number;
  fulfilledUnits: number;
  urgency: RequestUrgency;
  patientReferenceId: string;
  department: string;
  requiredByDate: string;
  status: RequestStatus;
  assignedUnitIds?: string[];
  dispatchId?: string;
  dispatchStatus?: DispatchStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  timeline: {
    status: RequestStatus;
    updatedAt: string;
    note: string;
    actor: string;
  }[];
}

export interface PatientSample {
  id: string;
  requestId: string;
  hospitalId: string;
  patientReferenceId: string;
  sampleType: string;
  submittedAt: string;
  status: string;
  verifiedBy?: string;
  verificationNotes?: string;
}

export interface RequestMessage {
  id: string;
  requestId: string;
  senderRole: UserRole;
  senderName: string;
  message: string;
  timestamp: string;
}

export interface DonationCamp {
  id: string;
  title: string;
  organizer: string;
  bloodBankId: string;
  location: string;
  city: string;
  address: string;
  startDate: string;
  endDate: string;
  timeSlot: string;
  targetUnits: number;
  registeredCount: number;
  targetBloodGroups?: BloodGroup[];
  contactPhone: string;
  description: string;
  isUrgent?: boolean;
  latitude?: number;
  longitude?: number;
  isRegistered?: boolean;
  status?: string;
}

export interface CampRegistration {
  id: string;
  campId: string;
  donorId: string;
  donorName: string;
  donorEmail: string;
  registeredAt: string;
  status: 'Registered' | 'Cancelled';
}

export interface EmergencyAlert {
  id: string;
  bloodBankId: string;
  bloodBankName: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsRequired: number;
  hospitalName: string;
  city: string;
  urgency: RequestUrgency;
  issuedAt: string;
  expiresAt: string;
  distanceKmApprox: number;
  responsesCount: number;
  description: string;
  hasResponded?: boolean;
  isMatchingGroup?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface DemandPrediction {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  predictionPeriod: string;
  predictedDemandUnits: number;
  currentInventoryUnits: number;
  historicalDemandAvg: number;
  shortageRisk: RiskLevel;
  wastageRisk: RiskLevel;
  confidenceScore: number;
  generatedAt: string;
  recommendation: string;
}

export type CampRequestStatus = 
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Scheduled'
  | 'Completed'
  | 'Cancelled';

export type OrganizationType = 
  | 'College/University'
  | 'Company/Office'
  | 'Residential Society'
  | 'NGO/Community Organization'
  | 'Other';

export interface CampRequest {
  id: string;
  donorId: string;
  donorName: string;
  donorEmail: string;
  organizationName: string;
  organizationType: OrganizationType;
  organizationWebsite?: string;
  organizationRegistrationId?: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  organizerRole: string;
  proposedDate: string;
  preferredTimeSlot: string;
  venueAddress: string;
  city: string;
  postalCode: string;
  estimatedParticipants: number;
  expectedDonations?: number;
  availableFacilities?: string;
  additionalNotes?: string;
  isAuthorizedRepresentative: boolean;
  agreedToTerms: boolean;
  status: CampRequestStatus;
  statusNote?: string;
  createdAt: string;
  updatedAt: string;
}

// =========================================================
// PHASE 5C: COLD-STORAGE MONITORING, TEMPERATURE ALARMS & AUDIT TRAIL
// =========================================================

export type StorageEquipmentType = 
  | 'Refrigerated Storage (RBC)'
  | 'Ultra-Low Freezer (FFP)'
  | 'Platelet Incubator & Agitator'
  | 'Intake Holding Cooler';

export type EquipmentStatus = 
  | 'Operational'
  | 'Warning'
  | 'Alarm Excursion'
  | 'Maintenance'
  | 'Offline';

export type SensorConnectivityStatus = 
  | 'Connected'
  | 'Disconnected'
  | 'Stale'
  | 'Manual Log Only';

export type TemperatureReadingSource = 
  | 'manual_log'
  | 'sensor_telemetry'
  | 'simulated_dev';

export type AlarmSeverity = 'Warning' | 'Critical';
export type AlarmStatus = 'Active' | 'Acknowledged' | 'Resolved';

export interface ColdStorageEquipment {
  id: string;
  bloodBankId: string;
  name: string;
  equipmentType: StorageEquipmentType;
  locationName: string;
  mappedStorageLocations: string[];
  minTempCelsius: number;
  maxTempCelsius: number;
  targetTempCelsius: number;
  temperatureUnit: '°C';
  authoritativeStandard: string;
  requiresAgitation: boolean;
  agitationStatus?: 'Active' | 'Fault' | 'Standby' | 'Not Applicable';
  status: EquipmentStatus;
  sensorId?: string;
  sensorConnectivity: SensorConnectivityStatus;
  lastReadingTempCelsius?: number;
  lastReadingTimestamp?: string;
  lastReadingSource?: TemperatureReadingSource;
  lastReadingRecordedBy?: string;
  staleThresholdMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureReading {
  id: string;
  bloodBankId: string;
  equipmentId: string;
  equipmentName: string;
  temperatureCelsius: number;
  temperatureUnit: '°C';
  readingSource: TemperatureReadingSource;
  timestamp: string;
  isOutOfRange: boolean;
  minTempCelsius: number;
  maxTempCelsius: number;
  agitationOperational?: boolean;
  operatorId?: string;
  operatorName?: string;
  notes?: string;
  isSimulated?: boolean;
  createdAt: string;
}

export interface AlarmAuditEntry {
  id: string;
  action: 'Triggered' | 'Repeated Excursion' | 'Acknowledged' | 'Resolved';
  operatorId?: string;
  operatorName: string;
  timestamp: string;
  notes?: string;
}

export interface ColdStorageAlarm {
  id: string;
  bloodBankId: string;
  equipmentId: string;
  equipmentName: string;
  severity: AlarmSeverity;
  triggeringReadingCelsius: number;
  thresholdViolated: string;
  triggeredAt: string;
  peakTemperatureCelsius: number;
  status: AlarmStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgementNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  correctiveAction?: string;
  auditHistory: AlarmAuditEntry[];
  affectedInventoryCount?: number;
}


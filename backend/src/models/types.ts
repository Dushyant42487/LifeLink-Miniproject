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
  passwordHash: string;
  role: UserRole;
  name: string;
  phone: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface DonorProfile extends User {
  role: 'donor';
  bloodGroup: BloodGroup;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  city: string;
  state: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  lastDonationDate?: string; // YYYY-MM-DD
  weightKg: number;
  isEligible: boolean;
  deferralReason?: string;
  totalDonationsCount: number;
  totalVolumeMl: number;
  notificationPreferences: {
    emergencyAlerts: boolean;
    campReminders: boolean;
    eligibilityAlerts: boolean;
  };
  bloodGroupVerificationStatus?: 'Unverified' | 'Pending Verification' | 'Verified';
  bloodGroupProofDocUrl?: string;
  travelRadiusKm?: number;
  pauseInvitations?: boolean;
}

export interface HospitalProfile extends User {
  role: 'hospital';
  hospitalName: string;
  licenseId: string;
  verificationStatus: 'Pending Verification' | 'Verified' | 'Rejected';
  address: string;
  city: string;
  state: string;
  contactPerson: string;
  emergencyPhone: string;
  latitude: number;
  longitude: number;
}

export interface BloodBankProfile extends User {
  role: 'blood_bank';
  bloodBankName: string;
  registrationId: string;
  contactPerson: string;
  address: string;
  city: string;
  state: string;
  emergencyPhone: string;
  latitude: number;
  longitude: number;
}

export interface BloodUnit {
  id: string; // e.g. UNIT-2026-8801
  bloodBankId: string;
  bloodBankName: string;
  donorId?: string;
  donorCode?: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  volumeMl: number;
  collectionDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  testingStatus: TestingStatus;
  availability: AvailabilityStatus;
  storageLocation: string; // e.g., "Fridge A2 - Shelf 3"
  source: 'Voluntary Donation' | 'Donation Camp' | 'Replacement Donation';
  reservedForRequestId?: string;
  sourceCollectionId?: string;
  fractionationBatchId?: string;
  notes?: string;
  createdAt: string;
}

export interface TestingRecord {
  id: string;
  unitId: string;
  bloodBankId: string;
  bloodGroup: BloodGroup;
  hivTest: 'Negative' | 'Positive' | 'Pending';
  hbvTest: 'Negative' | 'Positive' | 'Pending';
  hcvTest: 'Negative' | 'Positive' | 'Pending';
  syphilisTest: 'Negative' | 'Positive' | 'Pending';
  malariaTest: 'Negative' | 'Positive' | 'Pending';
  status: TestingStatus;
  testedBy: string;
  testingDate: string;
  notes?: string;
}

export interface BloodRequest {
  id: string; // REQ-1002
  hospitalId: string;
  hospitalName: string;
  bloodBankId?: string;
  bloodBankName?: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  quantityUnits: number;
  fulfilledUnits: number;
  urgency: RequestUrgency;
  patientReferenceId: string; // Anonymized e.g. PAT-9482
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
  id: string; // SMP-501
  requestId: string;
  hospitalId: string;
  patientReferenceId: string;
  sampleType: 'Cross-Match Sample' | 'Blood Typing Sample';
  submittedAt: string;
  status: 'Received' | 'In Verification' | 'Verified Compatible' | 'Incompatible';
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

export interface HospitalStorageLocation {
  id: string;
  hospitalId: string;
  name: string;
  department: string;
  description?: string;
}

export type StorageEntryStatus = 'Usable' | 'Reserved' | 'Quarantined' | 'Expired';

export interface HospitalStorageEntry {
  id: string; // e.g. HLE-101
  hospitalId: string;
  locationId?: string;
  storageLocation: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  quantityUnits: number;
  status: StorageEntryStatus;
  expiryDate: string;
  minThreshold?: number;
  notes?: string;
  source: 'manual_hospital_entry';
  recordedBy?: string;
  createdAt: string;
  updatedAt: string;
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
  status?: 'Planned' | 'Active' | 'Completed' | 'Cancelled';
  isDevFixture?: boolean;
}

export type CollectionStatus = 'Collected' | 'Testing Quarantine' | 'Fractionated' | 'Discarded';

export interface BloodCollectionRecord {
  id: string; // e.g. COL-2026-8001
  bloodBankId: string;
  bloodBankName: string;
  donorId: string;
  donorCode: string;
  donorName: string;
  bloodGroup: BloodGroup;
  collectionType: 'Whole Blood' | 'Apheresis Platelets' | 'Apheresis Plasma';
  volumeMl: number;
  collectionDate: string; // YYYY-MM-DD
  collectionTime?: string; // HH:mm
  locationType: 'In-House Phlebotomy' | 'Mobile Camp';
  campId?: string;
  campTitle?: string;
  phlebotomistName?: string;
  status: CollectionStatus;
  fractionationStatus: 'Pending' | 'Fractionated' | 'Not Applicable';
  fractionationBatchId?: string;
  notes?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentFractionationRecord {
  id: string; // e.g. FRAC-BATCH-2026-8001
  sourceCollectionId: string;
  bloodBankId: string;
  donorId: string;
  bloodGroup: BloodGroup;
  processedAt: string;
  operatorName: string;
  method: 'Centrifugation' | 'Automated Component Separation';
  inputVolumeMl: number;
  producedComponents: {
    unitId: string;
    component: BloodComponent;
    volumeMl: number;
    storageLocation: string;
    testingStatus: TestingStatus;
    availability: AvailabilityStatus;
  }[];
  notes?: string;
  createdAt: string;
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
  latitude?: number;
  longitude?: number;
}

export interface EmergencyResponse {
  id: string;
  alertId: string;
  donorId: string;
  donorName: string;
  donorPhone: string;
  status: 'Accepted' | 'Completed' | 'Cancelled';
  respondedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string; // or 'role:donor', 'role:hospital', 'role:blood_bank'
  title: string;
  message: string;
  type: 'emergency' | 'expiry' | 'eligibility' | 'request_update' | 'ai_alert' | 'camp';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface DemandPrediction {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  predictionPeriod: '7 days' | '30 days' | '90 days';
  predictedDemandUnits: number;
  currentInventoryUnits: number;
  historicalDemandAvg: number;
  shortageRisk: RiskLevel;
  wastageRisk: RiskLevel;
  confidenceScore: number; // e.g. 0.91
  generatedAt: string;
  recommendation: string;
}

export interface ExpiryRiskItem {
  unitId: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  ageDays: number;
  daysToExpiry: number;
  expiryDate: string;
  consumptionRateAvg: number;
  predictedUsageNext3Days: number;
  riskLevel: RiskLevel;
  recommendedAction: string;
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
  id: string; // e.g. CAMP-REQ-1001
  donorId: string;
  donorName: string;
  donorEmail: string;
  
  // Organization Info
  organizationName: string;
  organizationType: OrganizationType;
  organizationWebsite?: string;
  organizationRegistrationId?: string;

  // Organizer Info
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  organizerRole: string;

  // Proposed Details
  proposedDate: string; // YYYY-MM-DD
  preferredTimeSlot: string;
  venueAddress: string;
  city: string;
  postalCode: string;
  estimatedParticipants: number;
  expectedDonations?: number;
  availableFacilities?: string;
  additionalNotes?: string;

  // Consent
  isAuthorizedRepresentative: boolean;
  agreedToTerms: boolean;

  // Status
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
  id: string; // e.g. EQ-RBC-REF-01
  bloodBankId: string; // e.g. bb-1
  name: string; // e.g. "RBC Main Refrigerator #1"
  equipmentType: StorageEquipmentType;
  locationName: string; // e.g. "Main Cold Storage Bay A"
  mappedStorageLocations: string[]; // e.g. ["RBC Main Storage Bay", "Quarantine Bay RBC-1"]
  minTempCelsius: number; // e.g. 2.0
  maxTempCelsius: number; // e.g. 6.0
  targetTempCelsius: number; // e.g. 4.0
  temperatureUnit: '°C';
  authoritativeStandard: string; // e.g. "WHO/AABB Blood Storage Standard (2°C to 6°C)"
  requiresAgitation: boolean; // true for Platelet Incubators
  agitationStatus?: 'Active' | 'Fault' | 'Standby' | 'Not Applicable';
  status: EquipmentStatus;
  sensorId?: string; // e.g. "SENS-RBC-01" or undefined if manual
  sensorConnectivity: SensorConnectivityStatus;
  lastReadingTempCelsius?: number;
  lastReadingTimestamp?: string;
  lastReadingSource?: TemperatureReadingSource;
  lastReadingRecordedBy?: string;
  staleThresholdMinutes: number; // e.g. 30 minutes
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureReading {
  id: string; // e.g. TMP-2026-9001
  bloodBankId: string;
  equipmentId: string;
  equipmentName: string;
  temperatureCelsius: number;
  temperatureUnit: '°C';
  readingSource: TemperatureReadingSource;
  timestamp: string; // ISO
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
  id: string; // e.g. ALM-2026-001
  bloodBankId: string;
  equipmentId: string;
  equipmentName: string;
  severity: AlarmSeverity;
  triggeringReadingCelsius: number;
  thresholdViolated: string; // e.g. "Exceeded upper threshold +6.0°C (Recorded +8.4°C)"
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


import { 
  DonorProfile, 
  HospitalProfile, 
  BloodBankProfile, 
  BloodUnit, 
  TestingRecord, 
  BloodRequest, 
  PatientSample, 
  RequestMessage,
  DonationCamp, 
  EmergencyAlert, 
  EmergencyResponse,
  AppNotification, 
  DemandPrediction,
  ExpiryRiskItem,
  BloodGroup,
  BloodComponent,
  CampRequest,
  CampRegistration,
  HospitalStorageEntry,
  HospitalStorageLocation,
  BloodCollectionRecord,
  ComponentFractionationRecord,
  ColdStorageEquipment,
  TemperatureReading,
  ColdStorageAlarm,
  AlarmAuditEntry,
  BloodDispatch,
  DispatchUnitItem
} from './types';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const SNAPSHOT_FILE = path.resolve(__dirname, '../../data/datastore.json');

class DataStore {
  donors: DonorProfile[] = [];
  hospitals: HospitalProfile[] = [];
  bloodBanks: BloodBankProfile[] = [];
  bloodUnits: BloodUnit[] = [];
  testingRecords: TestingRecord[] = [];
  bloodRequests: BloodRequest[] = [];
  patientSamples: PatientSample[] = [];
  requestMessages: RequestMessage[] = [];
  donationCamps: DonationCamp[] = [];
  emergencyAlerts: EmergencyAlert[] = [];
  emergencyResponses: EmergencyResponse[] = [];
  notifications: AppNotification[] = [];
  campRequests: CampRequest[] = [];
  campRegistrations: CampRegistration[] = [];
  hospitalStorageEntries: HospitalStorageEntry[] = [];
  hospitalStorageLocations: HospitalStorageLocation[] = [];
  bloodCollections: BloodCollectionRecord[] = [];
  fractionationRecords: ComponentFractionationRecord[] = [];
  coldStorageEquipment: ColdStorageEquipment[] = [];
  temperatureReadings: TemperatureReading[] = [];
  coldStorageAlarms: ColdStorageAlarm[] = [];
  bloodDispatches: BloodDispatch[] = [];

  constructor() {
    if (process.env.SEED_DEV_FIXTURES === 'true') {
      this.seedInitialData();
    } else {
      this.loadSnapshot();
    }
  }

  public loadSnapshot(): boolean {
    try {
      if (fs.existsSync(SNAPSHOT_FILE)) {
        const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          this.donors = data.donors || [];
          this.hospitals = data.hospitals || [];
          this.bloodBanks = data.bloodBanks || [];
          this.bloodUnits = data.bloodUnits || [];
          this.testingRecords = data.testingRecords || [];
          this.bloodRequests = data.bloodRequests || [];
          this.patientSamples = data.patientSamples || [];
          this.requestMessages = data.requestMessages || [];
          this.donationCamps = data.donationCamps || [];
          this.emergencyAlerts = data.emergencyAlerts || [];
          this.emergencyResponses = data.emergencyResponses || [];
          this.notifications = data.notifications || [];
          this.campRequests = data.campRequests || [];
          this.campRegistrations = data.campRegistrations || [];
          this.hospitalStorageEntries = data.hospitalStorageEntries || [];
          this.hospitalStorageLocations = data.hospitalStorageLocations || [];
          this.bloodCollections = data.bloodCollections || [];
          this.fractionationRecords = data.fractionationRecords || [];
          this.coldStorageEquipment = data.coldStorageEquipment || [];
          this.temperatureReadings = data.temperatureReadings || [];
          this.coldStorageAlarms = data.coldStorageAlarms || [];
          this.bloodDispatches = data.bloodDispatches || [];

          // Ensure active and authorized verification flags on blood banks if loaded
          this.bloodBanks.forEach(b => {
            if (b.isActive === undefined) b.isActive = true;
            if (b.isAuthorizedForVerification === undefined) b.isAuthorizedForVerification = true;
          });

          return true;
        }
      }
    } catch (err) {
      console.warn('[DataStore] Failed to load snapshot file:', err);
    }
    return false;
  }

  public saveSnapshot() {
    try {
      const dir = path.dirname(SNAPSHOT_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        donors: this.donors,
        hospitals: this.hospitals,
        bloodBanks: this.bloodBanks,
        bloodUnits: this.bloodUnits,
        testingRecords: this.testingRecords,
        bloodRequests: this.bloodRequests,
        patientSamples: this.patientSamples,
        requestMessages: this.requestMessages,
        donationCamps: this.donationCamps,
        emergencyAlerts: this.emergencyAlerts,
        emergencyResponses: this.emergencyResponses,
        notifications: this.notifications,
        campRequests: this.campRequests,
        campRegistrations: this.campRegistrations,
        hospitalStorageEntries: this.hospitalStorageEntries,
        hospitalStorageLocations: this.hospitalStorageLocations,
        bloodCollections: this.bloodCollections,
        fractionationRecords: this.fractionationRecords,
        coldStorageEquipment: this.coldStorageEquipment,
        temperatureReadings: this.temperatureReadings,
        coldStorageAlarms: this.coldStorageAlarms,
        bloodDispatches: this.bloodDispatches
      };
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DataStore] Failed to write snapshot file:', err);
    }
  }

  public seedTestFixtures() {
    this.seedInitialData();
    this.saveSnapshot();
  }

  public clearAllData() {
    this.donors = [];
    this.hospitals = [];
    this.bloodBanks = [];
    this.bloodUnits = [];
    this.testingRecords = [];
    this.bloodRequests = [];
    this.patientSamples = [];
    this.requestMessages = [];
    this.donationCamps = [];
    this.emergencyAlerts = [];
    this.emergencyResponses = [];
    this.notifications = [];
    this.campRequests = [];
    this.campRegistrations = [];
    this.hospitalStorageEntries = [];
    this.hospitalStorageLocations = [];
    this.bloodCollections = [];
    this.fractionationRecords = [];
    this.coldStorageEquipment = [];
    this.temperatureReadings = [];
    this.coldStorageAlarms = [];
    this.bloodDispatches = [];

    try {
      if (fs.existsSync(SNAPSHOT_FILE)) {
        fs.unlinkSync(SNAPSHOT_FILE);
      }
    } catch {
      // Ignore unlink errors
    }
  }

  public getRecordCounts() {
    return {
      donors: this.donors.length,
      hospitals: this.hospitals.length,
      bloodBanks: this.bloodBanks.length,
      bloodUnits: this.bloodUnits.length,
      testingRecords: this.testingRecords.length,
      bloodRequests: this.bloodRequests.length,
      patientSamples: this.patientSamples.length,
      requestMessages: this.requestMessages.length,
      donationCamps: this.donationCamps.length,
      emergencyAlerts: this.emergencyAlerts.length,
      emergencyResponses: this.emergencyResponses.length,
      notifications: this.notifications.length,
      campRequests: this.campRequests.length,
      campRegistrations: this.campRegistrations.length,
      hospitalStorageEntries: this.hospitalStorageEntries.length,
      bloodCollections: this.bloodCollections.length,
      fractionationRecords: this.fractionationRecords.length,
      coldStorageEquipment: this.coldStorageEquipment.length,
      temperatureReadings: this.temperatureReadings.length,
      coldStorageAlarms: this.coldStorageAlarms.length,
      bloodDispatches: this.bloodDispatches.length
    };
  }

  private seedInitialData() {
    const passwordHash = bcrypt.hashSync('password123', 8);

    // 1. Seed Blood Banks
    this.bloodBanks = [
      {
        id: 'bb-1',
        email: 'central@citybloodbank.org',
        passwordHash,
        role: 'blood_bank',
        name: 'City Central Blood Bank',
        bloodBankName: 'City Central Blood Center',
        registrationId: 'BB-LIC-2024-001',
        contactPerson: 'Dr. Sarah Jenkins',
        phone: '+1 (555) 234-5678',
        emergencyPhone: '+1 (555) 999-1122',
        address: '742 Healthcare Ave, Medical District',
        city: 'Metro City',
        state: 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
        isActive: true,
        verificationStatus: 'Verified',
        isAuthorizedForVerification: true,
        serviceArea: 'Metro City Downtown & Medical District',
        createdAt: '2024-01-15T08:00:00Z'
      },
      {
        id: 'bb-2',
        email: 'redcross@regionalblood.org',
        passwordHash,
        role: 'blood_bank',
        name: 'Red Cross Regional Center',
        bloodBankName: 'Red Cross Regional Center',
        registrationId: 'BB-LIC-2024-008',
        contactPerson: 'Marcus Vance',
        phone: '+1 (555) 345-6789',
        emergencyPhone: '+1 (555) 999-3344',
        address: '108 Relief Drive, Westside',
        city: 'Metro City',
        state: 'NY',
        latitude: 40.7306,
        longitude: -73.9352,
        isActive: true,
        verificationStatus: 'Verified',
        isAuthorizedForVerification: true,
        serviceArea: 'Metro City West & Tri-County',
        createdAt: '2024-02-10T08:00:00Z'
      },
      {
        id: 'bb-3',
        email: 'stjude@bloodservices.org',
        passwordHash,
        role: 'blood_bank',
        name: 'St. Jude Memorial Blood Bank',
        bloodBankName: 'St. Jude Memorial Blood Bank',
        registrationId: 'BB-LIC-2024-015',
        contactPerson: 'Elena Rostova',
        phone: '+1 (555) 456-7890',
        emergencyPhone: '+1 (555) 999-5566',
        address: '520 St. Jude Parkway',
        city: 'Metro City',
        state: 'NY',
        latitude: 40.7589,
        longitude: -73.9851,
        isActive: true,
        verificationStatus: 'Verified',
        isAuthorizedForVerification: true,
        serviceArea: 'Metro City North & Midtown',
        createdAt: '2024-03-01T08:00:00Z'
      },
      {
        id: 'user-1792415991634',
        email: 'wcebb@test.org',
        passwordHash,
        role: 'blood_bank',
        name: 'WCE Sangli Blood Center',
        bloodBankName: 'WCE Sangli Blood Center',
        registrationId: 'BB-LIC-2024-WCE',
        contactPerson: 'Dr. S. Kulkarni',
        phone: '+91 233 230 2200',
        emergencyPhone: '+91 233 230 2299',
        address: 'Vishrambag, Sangli-Miraj Road',
        city: 'Sangli',
        state: 'Maharashtra',
        latitude: 16.8440,
        longitude: 74.6018,
        isActive: true,
        verificationStatus: 'Verified',
        isAuthorizedForVerification: true,
        serviceArea: 'Sangli-Miraj-Kupwad Municipal Corporation',
        createdAt: '2024-01-15T08:00:00Z'
      }
    ];

    // 2. Seed Hospitals
    this.hospitals = [
      {
        id: 'hosp-1',
        email: 'emergency@apellogeneral.org',
        passwordHash,
        role: 'hospital',
        name: 'Apollo General Hospital',
        hospitalName: 'Apollo General Hospital',
        licenseId: 'HOSP-NY-9021',
        verificationStatus: 'Verified',
        contactPerson: 'Dr. Robert Chen (Chief Surgeon)',
        phone: '+1 (555) 678-9012',
        emergencyPhone: '+1 (555) 911-0001',
        address: '100 Hospital Plaza, Midtown',
        city: 'Metro City',
        state: 'NY',
        latitude: 40.7484,
        longitude: -73.9857,
        createdAt: '2024-01-20T08:00:00Z'
      },
      {
        id: 'hosp-2',
        email: 'trauma@metrolifecare.org',
        passwordHash,
        role: 'hospital',
        name: 'Metro LifeCare Hospital',
        hospitalName: 'Metro LifeCare Medical Center',
        licenseId: 'HOSP-NY-9088',
        verificationStatus: 'Verified',
        contactPerson: 'Nurse Manager Brenda Walsh',
        phone: '+1 (555) 789-0123',
        emergencyPhone: '+1 (555) 911-0002',
        address: '450 University Blvd',
        city: 'Metro City',
        state: 'NY',
        latitude: 40.7282,
        longitude: -73.9942,
        createdAt: '2024-02-15T08:00:00Z'
      },
      {
        id: 'hosp-3',
        email: 'requests@stmaryshealth.org',
        passwordHash,
        role: 'hospital',
        name: 'St. Mary Specialized Hospital',
        hospitalName: 'St. Mary Specialized Hospital',
        licenseId: 'HOSP-NY-9104',
        verificationStatus: 'Pending Verification',
        contactPerson: 'Dr. Anita Desai',
        phone: '+1 (555) 890-1234',
        emergencyPhone: '+1 (555) 911-0003',
        address: '312 Northside Ave',
        city: 'Metro City',
        state: 'NY',
        latitude: 40.7829,
        longitude: -73.9654,
        createdAt: '2026-08-01T08:00:00Z'
      },
      {
        id: 'hosp-unconfigured',
        email: 'rural@clinic.org',
        passwordHash,
        role: 'hospital',
        name: 'Rural Outreach Clinic',
        hospitalName: 'Rural Outreach Clinic',
        licenseId: 'HOSP-NY-9999',
        verificationStatus: 'Verified',
        contactPerson: 'Dr. Sarah Connor',
        phone: '+1 (555) 000-1111',
        emergencyPhone: '+1 (555) 911-0000',
        address: 'Remote County Road 5',
        city: 'Outreach',
        state: 'NY',
        latitude: undefined,
        longitude: undefined,
        createdAt: '2026-09-01T08:00:00Z'
      },
      {
        id: 'user-1792574656930',
        email: 'wcehosp@test.org',
        passwordHash,
        role: 'hospital',
        name: 'WCE Memorial Hospital Sangli',
        hospitalName: 'WCE Memorial Hospital Sangli',
        licenseId: 'HOSP-MH-2024-WCE',
        verificationStatus: 'Verified',
        contactPerson: 'Dr. A. Patil',
        phone: '+91 233 230 1100',
        emergencyPhone: '+91 233 230 1199',
        address: 'Vishrambag, Sangli-Miraj Road',
        city: 'Sangli',
        state: 'Maharashtra',
        latitude: 16.8438,
        longitude: 74.6015,
        createdAt: '2024-01-10T08:00:00Z'
      }
    ];

    // 3. Seed 20 Donors
    const bloodGroupsList: BloodGroup[] = ['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const names = [
      'Alex Mercer', 'Sophia Martinez', 'David Kim', 'Emma Watson', 'James Wilson',
      'Olivia Taylor', 'Liam Neeson', 'Ava Johnson', 'Ethan Brown', 'Isabella Davis',
      'Noah Miller', 'Mia Garcia', 'Lucas Rodriguez', 'Charlotte Martinez', 'Benjamin Lee',
      'Harper Anderson', 'Mason Thomas', 'Evelyn Jackson', 'Logan White', 'Amelia Harris'
    ];

    this.donors = names.map((name, index) => {
      const bg = index === 0 ? ('O+' as BloodGroup) : bloodGroupsList[index % bloodGroupsList.length];
      const isEligible = index % 4 !== 0;
      const daysAgo = index === 0 ? 20 : (index % 4 === 0 ? 15 : 60 + index * 5);
      const lastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      return {
        id: `donor-${index + 1}`,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        passwordHash,
        role: 'donor',
        name,
        bloodGroup: bg,
        dob: `199${index % 9}-0${(index % 9) + 1}-15`,
        gender: index % 2 === 0 ? 'Male' : 'Female',
        phone: `+1 (555) 123-${4500 + index}`,
        address: `${100 + index * 12} Maple Street`,
        city: 'Metro City',
        state: 'NY',
        postalCode: `${10001 + (index % 10)}`,
        latitude: 40.7295 + ((index % 5) * 0.008) - 0.016,
        longitude: -73.9937 + ((index % 5) * 0.007) - 0.014,
        travelRadiusKm: 25,
        emergencyContact: {
          name: `Emergency Contact ${index + 1}`,
          phone: `+1 (555) 987-${6500 + index}`,
          relation: index % 2 === 0 ? 'Spouse' : 'Parent'
        },
        lastDonationDate: lastDate,
        weightKg: 68 + (index % 15),
        isEligible,
        deferralReason: isEligible ? undefined : 'Recent whole blood donation within 56-day cool-off window.',
        bloodGroupVerificationStatus: 'Verified',
        verificationStatus: 'Verified',
        verifiedAt: '2024-01-01T08:00:00Z',
        verifiedBy: 'bb-1',
        verifiedByName: 'City Central Blood Bank',
        totalDonationsCount: (index % 5) + 1,
        totalVolumeMl: ((index % 5) + 1) * 450,
        notificationPreferences: {
          emergencyAlerts: true,
          campReminders: true,
          eligibilityAlerts: true
        },
        createdAt: '2024-01-01T08:00:00Z'
      };
    });

    // Seed dedicated integration test fixture donor
    this.donors.push({
      id: 'donor-test-integ',
      email: 'integ-donor@lifelink.org',
      passwordHash,
      role: 'donor',
      name: 'Integration Donor',
      bloodGroup: 'O+',
      dob: '1995-05-15',
      gender: 'Male',
      phone: '+1 555-0199',
      address: '700 Broadway',
      city: 'Metro City',
      state: 'NY',
      postalCode: '10003',
      latitude: 40.7295,
      longitude: -73.9937,
      travelRadiusKm: 25,
      emergencyContact: {
        name: 'Jane Doe',
        phone: '+1 555-0198',
        relation: 'Spouse'
      },
      lastDonationDate: undefined,
      weightKg: 68,
      isEligible: false,
      bloodGroupVerificationStatus: 'Unverified',
      verificationStatus: 'Unverified',
      totalDonationsCount: 0,
      totalVolumeMl: 0,
      notificationPreferences: {
        emergencyAlerts: true,
        campReminders: true,
        eligibilityAlerts: true
      },
      createdAt: '2024-01-01T08:00:00Z'
    });

    // 4. Seed Blood Units (Unit-level tracking)
    // Make O- RBC inventory VERY LOW (Demo scenario requirement)
    let unitCounter = 8000;
    const now = new Date();

    const addUnit = (
      bg: BloodGroup, 
      comp: BloodComponent, 
      status: 'Available' | 'Reserved' | 'Quarantined' | 'Expired', 
      testing: 'Passed' | 'Pending' | 'In Testing', 
      daysToExpiry: number,
      bbId: string = 'bb-1'
    ) => {
      unitCounter++;
      const shelfLifeDays = comp === 'RBC' ? 42 : comp === 'Platelets' ? 5 : comp === 'Whole Blood' ? 35 : 365;
      const daysAgo = Math.max(1, Math.min(60, shelfLifeDays - daysToExpiry));
      const colDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const expDate = new Date(now.getTime() + daysToExpiry * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const unitId = `UNIT-2026-${unitCounter}`;

      const bb = this.bloodBanks.find(b => b.id === bbId) || this.bloodBanks[0];

      const unit: BloodUnit = {
        id: unitId,
        bloodBankId: bb.id,
        bloodBankName: bb.bloodBankName,
        donorId: `donor-${(unitCounter % 20) + 1}`,
        donorCode: `DON-${1000 + (unitCounter % 20)}`,
        bloodGroup: bg,
        component: comp,
        volumeMl: comp === 'RBC' ? 350 : comp === 'Plasma' ? 250 : comp === 'Whole Blood' ? 450 : 200,
        collectionDate: colDate,
        expiryDate: expDate,
        testingStatus: testing,
        availability: status,
        storageLocation: `${comp} Locker ${bg.replace('+', 'P').replace('-', 'N')}-${(unitCounter % 4) + 1}`,
        source: 'Voluntary Donation',
        createdAt: new Date().toISOString()
      };

      this.bloodUnits.push(unit);

      // Create matching testing record
      this.testingRecords.push({
        id: `TST-${unitCounter}`,
        unitId,
        bloodBankId: bb.id,
        bloodGroup: bg,
        hivTest: testing === 'Passed' ? 'Negative' : 'Pending',
        hbvTest: testing === 'Passed' ? 'Negative' : 'Pending',
        hcvTest: testing === 'Passed' ? 'Negative' : 'Pending',
        syphilisTest: testing === 'Passed' ? 'Negative' : 'Pending',
        malariaTest: testing === 'Passed' ? 'Negative' : 'Pending',
        status: testing,
        testedBy: 'Lab Spec. Sarah Jenkins',
        testingDate: colDate,
        notes: testing === 'Passed' ? 'All viral markers negative. Cleared for transfusion.' : 'Screening in progress.'
      });
    };

    // O- units (Critical shortage scenario: only 2 available units of RBC!)
    addUnit('O-', 'RBC', 'Available', 'Passed', 4, 'bb-1');
    addUnit('O-', 'RBC', 'Available', 'Passed', 18, 'bb-1');
    addUnit('O-', 'Plasma', 'Available', 'Passed', 120, 'bb-1');
    addUnit('O-', 'Platelets', 'Available', 'Passed', 2, 'bb-1');
    addUnit('O-', 'Whole Blood', 'Available', 'Passed', 15, 'bb-1');

    // Other Blood groups with rich stock
    const groups: BloodGroup[] = ['O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    groups.forEach(bg => {
      // RBC
      addUnit(bg, 'RBC', 'Available', 'Passed', 15);
      addUnit(bg, 'RBC', 'Available', 'Passed', 22);
      addUnit(bg, 'RBC', 'Available', 'Passed', 2); // Expiring soon!
      addUnit(bg, 'RBC', 'Reserved', 'Passed', 12);
      // Plasma
      addUnit(bg, 'Plasma', 'Available', 'Passed', 90);
      addUnit(bg, 'Plasma', 'Available', 'Passed', 180);
      // Platelets
      addUnit(bg, 'Platelets', 'Available', 'Passed', 3);
      addUnit(bg, 'Platelets', 'Available', 'Passed', 1); // Expiring tomorrow!
      // Whole Blood
      addUnit(bg, 'Whole Blood', 'Available', 'Passed', 20, 'bb-1');
      addUnit(bg, 'Whole Blood', 'Available', 'Passed', 22, 'bb-2');
      addUnit(bg, 'Whole Blood', 'Available', 'Passed', 18, 'bb-3');
    });

    // Seed verified units for Red Cross Regional Center (bb-2)
    addUnit('O+', 'RBC', 'Available', 'Passed', 18, 'bb-2');
    addUnit('A+', 'RBC', 'Available', 'Passed', 14, 'bb-2');
    addUnit('B+', 'RBC', 'Available', 'Passed', 12, 'bb-2');
    addUnit('O-', 'RBC', 'Available', 'Passed', 2, 'bb-2');
    addUnit('O+', 'Plasma', 'Available', 'Passed', 45, 'bb-2');
    addUnit('A+', 'Platelets', 'Available', 'Passed', 4, 'bb-2');
    addUnit('O+', 'Whole Blood', 'Available', 'Passed', 25, 'bb-2');

    // Seed verified units for WCE Sangli Blood Center (user-1792415991634)
    addUnit('A+', 'RBC', 'Available', 'Passed', 20, 'user-1792415991634');
    addUnit('O+', 'RBC', 'Available', 'Passed', 25, 'user-1792415991634');
    addUnit('B+', 'RBC', 'Available', 'Passed', 15, 'user-1792415991634');
    addUnit('O-', 'RBC', 'Available', 'Passed', 10, 'user-1792415991634');
    addUnit('A+', 'Plasma', 'Available', 'Passed', 45, 'user-1792415991634');
    addUnit('A+', 'Platelets', 'Available', 'Passed', 4, 'user-1792415991634');
    addUnit('A+', 'Whole Blood', 'Available', 'Passed', 25, 'user-1792415991634');

    // Units pending testing
    addUnit('A+', 'RBC', 'Quarantined', 'Pending', 30);
    addUnit('B+', 'Plasma', 'Quarantined', 'In Testing', 32);

    // Link units reserved for REQ-1327
    const u1327_1 = this.bloodUnits.find(u => u.id === 'UNIT-2026-8016');
    if (u1327_1) {
      u1327_1.availability = 'Reserved';
      u1327_1.bloodBankId = 'bb-1';
      u1327_1.bloodBankName = 'City Central Blood Center';
      u1327_1.reservedForRequestId = 'REQ-1327';
      u1327_1.component = 'RBC';
      u1327_1.bloodGroup = 'A+';
    }
    const u1327_2 = this.bloodUnits.find(u => u.id === 'UNIT-2026-8015');
    if (u1327_2) {
      u1327_2.availability = 'Reserved';
      u1327_2.bloodBankId = 'bb-1';
      u1327_2.bloodBankName = 'City Central Blood Center';
      u1327_2.reservedForRequestId = 'REQ-1327';
      u1327_2.component = 'RBC';
      u1327_2.bloodGroup = 'A+';
    }

    // 5. Seed Blood Requests & Patient Samples
    this.bloodRequests = [
      {
        id: 'REQ-1327',
        hospitalId: 'hosp-1',
        hospitalName: 'Apollo General Hospital',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        bloodGroup: 'A+',
        component: 'RBC',
        quantityUnits: 2,
        fulfilledUnits: 0,
        urgency: 'Urgent',
        patientReferenceId: 'PAT-4402 (OR-2)',
        department: 'Orthopedic Surgery',
        requiredByDate: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        status: 'Reserved',
        assignedUnitIds: ['UNIT-2026-8015', 'UNIT-2026-8016'],
        notes: 'Pre-op reservation for scheduled joint reconstruction in OR-2.',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        timeline: [
          {
            status: 'Pending',
            updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            note: 'Urgent requisition submitted for patient PAT-4402 (OR-2)',
            actor: 'Apollo General Hospital'
          },
          {
            status: 'Sample Submitted',
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            note: 'EDTA Cross-match sample SMP-503 delivered for antibody screening',
            actor: 'Hospital Phlebotomy'
          },
          {
            status: 'Reserved',
            updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            note: '2 units A+ RBC (UNIT-2026-8015, UNIT-2026-8016) cross-matched and reserved at regional center.',
            actor: 'City Central Blood Center'
          }
        ]
      },
      {
        id: 'REQ-2148',
        hospitalId: 'hosp-1',
        hospitalName: 'Apollo General Hospital',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        bloodGroup: 'B+',
        component: 'Platelets',
        quantityUnits: 4,
        fulfilledUnits: 0,
        urgency: 'Emergency',
        patientReferenceId: 'TRAUMA-PAT-901',
        department: 'Emergency & Trauma Surgery',
        requiredByDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        status: 'Sample Submitted',
        notes: 'STAT requisition for acute trauma resuscitation.',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        timeline: [
          {
            status: 'Pending',
            updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            note: 'Emergency trauma requisition initiated',
            actor: 'Apollo Emergency & Trauma Surgery'
          },
          {
            status: 'Sample Submitted',
            updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            note: 'Screening sample SMP-504 dispatched to regional lab',
            actor: 'Hospital Courier'
          }
        ]
      },
      {
        id: 'REQ-1001',
        hospitalId: 'hosp-1',
        hospitalName: 'Apollo General Hospital',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        bloodGroup: 'O-',
        component: 'RBC',
        quantityUnits: 5,
        fulfilledUnits: 2,
        urgency: 'Emergency',
        patientReferenceId: 'PAT-8812 (Trauma Unit)',
        department: 'Emergency & Trauma Surgery',
        requiredByDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        status: 'Sample Submitted',
        notes: 'Critical surgical bleeding. Universal O Negative RBC required urgently.',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        timeline: [
          {
            status: 'Pending',
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            note: 'Emergency request submitted by Dr. Robert Chen',
            actor: 'Apollo General Hospital'
          },
          {
            status: 'Sample Submitted',
            updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            note: 'Blood cross-match sample SMP-501 delivered to blood bank lab.',
            actor: 'Hospital Courier'
          }
        ]
      },
      {
        id: 'REQ-1002',
        hospitalId: 'hosp-2',
        hospitalName: 'Metro LifeCare Hospital',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        bloodGroup: 'A+',
        component: 'RBC',
        quantityUnits: 2,
        fulfilledUnits: 2,
        urgency: 'Urgent',
        patientReferenceId: 'PAT-9041 (Cardiology)',
        department: 'Cardiothoracic Surgery',
        requiredByDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'Fulfilled',
        assignedUnitIds: ['UNIT-2026-8005', 'UNIT-2026-8006'],
        dispatchId: 'DSP-2026-001',
        dispatchStatus: 'Received',
        notes: 'Pre-op elective bypass procedure.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        timeline: [
          { status: 'Pending', updatedAt: '2026-08-15T09:00:00Z', note: 'Request initiated', actor: 'Metro LifeCare' },
          { status: 'Verified', updatedAt: '2026-08-15T11:00:00Z', note: 'Sample compatibility verified', actor: 'Blood Bank Lab' },
          { status: 'Fulfilled', updatedAt: '2026-08-15T14:00:00Z', note: '2 Units A+ RBC issued to courier', actor: 'Blood Bank Dispatch' }
        ]
      },
      {
        id: 'REQ-1003',
        hospitalId: 'hosp-1',
        hospitalName: 'Apollo General Hospital',
        bloodBankId: 'bb-2',
        bloodBankName: 'Red Cross Regional Center',
        bloodGroup: 'B+',
        component: 'Platelets',
        quantityUnits: 3,
        fulfilledUnits: 0,
        urgency: 'Routine',
        patientReferenceId: 'PAT-9110 (Oncology)',
        department: 'Hematology-Oncology',
        requiredByDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        status: 'Pending',
        notes: 'Chemotherapy-induced thrombocytopenia management.',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        timeline: [
          { status: 'Pending', updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), note: 'Request placed', actor: 'Apollo Hospital' }
        ]
      }
    ];

    // Patient Samples (Clean synthetic records linked to supported hospital requisitions)
    this.patientSamples = [
      {
        id: 'SMP-501',
        requestId: 'REQ-1001',
        hospitalId: 'hosp-1',
        patientReferenceId: 'PAT-8812',
        sampleType: 'Cross-Match Sample',
        submittedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        status: 'Received',
        verifiedBy: 'Dr. Sarah Jenkins',
        verificationNotes: 'Sample received in cold chain container. Major cross-match testing in progress.'
      },
      {
        id: 'SMP-502',
        requestId: 'REQ-1001',
        hospitalId: 'hosp-1',
        patientReferenceId: 'PAT-8812',
        sampleType: 'Blood Typing Sample',
        submittedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        status: 'Verified Compatible',
        verifiedBy: 'Dr. Sarah Jenkins',
        verificationNotes: 'ABO and Rh factor re-check confirmed O- Negative.'
      },
      {
        id: 'SMP-503',
        requestId: 'REQ-1327',
        hospitalId: 'hosp-1',
        patientReferenceId: 'PAT-4402',
        sampleType: 'Cross-Match Sample',
        submittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: 'Verified Compatible',
        verifiedBy: 'Lab Spec. Alex Rivera',
        verificationNotes: 'Pre-op cross-match cleared. Units UNIT-2026-8015 and UNIT-2026-8016 reserved.'
      },
      {
        id: 'SMP-504',
        requestId: 'REQ-2148',
        hospitalId: 'hosp-1',
        patientReferenceId: 'TRAUMA-PAT-901',
        sampleType: 'Cross-Match Sample',
        submittedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        status: 'Received',
        verifiedBy: 'Dr. Sarah Jenkins',
        verificationNotes: 'STAT trauma cross-match tube accessioned.'
      }
    ];

    // Request Messages
    this.requestMessages = [
      {
        id: 'MSG-1',
        requestId: 'REQ-1001',
        senderRole: 'hospital',
        senderName: 'Dr. Robert Chen (Apollo General)',
        message: 'Patient in OR-3 has high blood loss. We need 5 units of O- RBC as fast as possible.',
        timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString()
      },
      {
        id: 'MSG-2',
        requestId: 'REQ-1001',
        senderRole: 'blood_bank',
        senderName: 'Dr. Sarah Jenkins (City Central)',
        message: 'We currently have 2 O- RBC units in stock. We are reserving them immediately and triggering emergency donor notifications for remaining units.',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString()
      }
    ];

    // 6. Seed Donation Camps
    this.donationCamps = [
      {
        id: 'CAMP-101',
        title: 'Metro Tech Park Community Blood Drive',
        organizer: 'City Central Blood Center & Tech Corp',
        bloodBankId: 'bb-1',
        location: 'Tech Park Auditorium, Gate 3',
        city: 'Metro City',
        address: '100 Innovation Way, Cyber City',
        startDate: '2026-08-20',
        endDate: '2026-08-21',
        timeSlot: '09:00 AM - 05:00 PM',
        targetUnits: 150,
        registeredCount: 42,
        targetBloodGroups: ['O-', 'O+', 'A-', 'B-'],
        contactPhone: '+1 (555) 234-5678',
        description: 'Annual corporate voluntary blood donation drive. Refreshments, donor certificates, and health checkups provided.',
        isUrgent: true,
        status: 'Active',
        isDevFixture: false,
        latitude: 40.7128,
        longitude: -74.0060
      },
      {
        id: 'CAMP-102',
        title: 'City University Campus Blood Camp',
        organizer: 'Red Cross Youth Wing',
        bloodBankId: 'bb-2',
        location: 'Student Union Center',
        city: 'Metro City',
        address: '500 University Ave',
        startDate: '2026-08-25',
        endDate: '2026-08-25',
        timeSlot: '10:00 AM - 04:00 PM',
        targetUnits: 100,
        registeredCount: 88,
        contactPhone: '+1 (555) 345-6789',
        description: 'Join fellow students and faculty to save lives. Special focus on first-time voluntary donors.',
        status: 'Planned',
        isDevFixture: false,
        latitude: 40.7306,
        longitude: -73.9352
      },
      {
        id: 'CAMP-103',
        title: 'Emergency O-Negative Targeted Mobilization Drive',
        organizer: 'St. Jude Memorial & LifeLink Emergency Network',
        bloodBankId: 'bb-3',
        location: 'Central Plaza Mobile Blood Van',
        city: 'Metro City',
        address: 'Downtown Main Square',
        startDate: '2026-08-18',
        endDate: '2026-08-18',
        timeSlot: '08:00 AM - 06:00 PM',
        targetUnits: 30,
        registeredCount: 14,
        targetBloodGroups: ['O-'],
        contactPhone: '+1 (555) 456-7890',
        description: 'Urgent call for universal donor O-Negative whole blood donors due to low regional safety reserves.',
        isUrgent: true,
        status: 'Planned',
        isDevFixture: false,
        latitude: 40.7589,
        longitude: -73.9851
      },
      // Development Test Fixtures: Sangli & Miraj Regional Network
      {
        id: 'CAMP-SANGLI-01',
        title: 'Sangli Civil Hospital Voluntary Blood Drive [Dev Fixture]',
        organizer: 'Sangli Civil Hospital & Red Cross',
        bloodBankId: 'bb-1',
        location: 'Blood Bank Hall, Main Building',
        city: 'Sangli',
        address: 'Station Road, Near Railway Station',
        startDate: '2026-11-05',
        endDate: '2026-11-05',
        timeSlot: '09:00 AM - 04:00 PM',
        targetUnits: 100,
        registeredCount: 25,
        targetBloodGroups: ['O+', 'O-', 'A+', 'B+'],
        contactPhone: '+91 233 267 1122',
        description: 'Development Test Fixture: Community voluntary blood drive serving Sangli municipal region.',
        isUrgent: false,
        status: 'Planned',
        isDevFixture: true,
        latitude: 16.8524,
        longitude: 74.5815
      },
      {
        id: 'CAMP-SANGLI-02',
        title: 'Vishrambag Tech Campus Blood Drive [Dev Fixture]',
        organizer: 'Willingdon College & LifeLink Youth Club',
        bloodBankId: 'bb-1',
        location: 'Student Recreation Center',
        city: 'Sangli',
        address: 'Vishrambag, Sangli-Miraj Road',
        startDate: '2026-11-12',
        endDate: '2026-11-12',
        timeSlot: '10:00 AM - 05:00 PM',
        targetUnits: 80,
        registeredCount: 18,
        targetBloodGroups: ['O+', 'A+', 'B+', 'AB+'],
        contactPhone: '+91 233 267 3344',
        description: 'Development Test Fixture: Youth student voluntary donation drive at Vishrambag.',
        isUrgent: false,
        status: 'Planned',
        isDevFixture: true,
        latitude: 16.8450,
        longitude: 74.6020
      },
      {
        id: 'CAMP-MIRAJ-01',
        title: 'Miraj Medical College Blood Drive [Dev Fixture]',
        organizer: 'Government Medical College Miraj',
        bloodBankId: 'bb-2',
        location: 'Auditorium Complex',
        city: 'Miraj',
        address: 'Pandharpur Road, Miraj',
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        timeSlot: '08:30 AM - 04:30 PM',
        targetUnits: 120,
        registeredCount: 40,
        targetBloodGroups: ['O-', 'B-', 'A-', 'O+'],
        contactPhone: '+91 233 222 5566',
        description: 'Development Test Fixture: Medical campus voluntary donor drive in Miraj.',
        isUrgent: true,
        status: 'Planned',
        isDevFixture: true,
        latitude: 16.8281,
        longitude: 74.6470
      },
      {
        id: 'CAMP-KUPWAD-01',
        title: 'Kupwad MIDC Industrial Blood Camp [Dev Fixture]',
        organizer: 'Sangli Manufacturers Association',
        bloodBankId: 'bb-2',
        location: 'MIDC Manufacturers Hall',
        city: 'Sangli',
        address: 'Kupwad MIDC Area, Sangli-Kupwad Road',
        startDate: '2026-11-18',
        endDate: '2026-11-18',
        timeSlot: '09:30 AM - 05:00 PM',
        targetUnits: 60,
        registeredCount: 12,
        targetBloodGroups: ['O+', 'B+', 'A+'],
        contactPhone: '+91 233 264 8899',
        description: 'Development Test Fixture: Industrial locality donation drive in Kupwad area.',
        isUrgent: false,
        status: 'Planned',
        isDevFixture: true,
        latitude: 16.8833,
        longitude: 74.6167
      }
    ];

    // Seed Initial Blood Collections
    this.bloodCollections = [
      {
        id: 'COL-2026-8001',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        donorId: 'donor-1',
        donorCode: 'DON-1001',
        donorName: 'Alex Mercer',
        bloodGroup: 'O+',
        collectionType: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        collectionTime: '10:30',
        locationType: 'In-House Phlebotomy',
        phlebotomistName: 'Dr. Sarah Jenkins',
        status: 'Collected',
        fractionationStatus: 'Pending',
        notes: 'Standard voluntary whole blood collection. Donor tolerated well.',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'COL-2026-8002',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        donorId: 'donor-2',
        donorCode: 'DON-1002',
        donorName: 'Sophia Martinez',
        bloodGroup: 'A+',
        collectionType: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date().toISOString().split('T')[0],
        collectionTime: '11:15',
        locationType: 'Mobile Camp',
        campId: 'CAMP-101',
        campTitle: 'Metro Tech Park Community Blood Drive',
        phlebotomistName: 'Nurse Lead Marcus Vance',
        status: 'Collected',
        fractionationStatus: 'Pending',
        notes: 'Collected during mobile community blood drive at Tech Park.',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'COL-2026-8003',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        donorId: 'donor-3',
        donorCode: 'DON-1003',
        donorName: 'David Kim',
        bloodGroup: 'A+',
        collectionType: 'Whole Blood',
        volumeMl: 450,
        collectionDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        collectionTime: '09:00',
        locationType: 'In-House Phlebotomy',
        phlebotomistName: 'Dr. Sarah Jenkins',
        status: 'Fractionated',
        fractionationStatus: 'Fractionated',
        fractionationBatchId: 'FRAC-2026-8001',
        notes: 'Pre-op voluntary whole blood collection processed into clinical components.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Seed Initial Fractionation Batch
    this.fractionationRecords = [
      {
        id: 'FRAC-2026-8001',
        sourceCollectionId: 'COL-2026-8003',
        bloodBankId: 'bb-1',
        donorId: 'donor-3',
        bloodGroup: 'A+',
        processedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        operatorName: 'Dr. Sarah Jenkins',
        method: 'Centrifugation',
        inputVolumeMl: 450,
        producedComponents: [
          {
            unitId: 'UNIT-2026-8015',
            component: 'RBC',
            volumeMl: 280,
            storageLocation: 'RBC Main Storage Bay',
            testingStatus: 'Passed',
            availability: 'Reserved'
          },
          {
            unitId: 'UNIT-2026-8016',
            component: 'RBC',
            volumeMl: 280,
            storageLocation: 'RBC Main Storage Bay',
            testingStatus: 'Passed',
            availability: 'Reserved'
          }
        ],
        notes: 'A+ whole blood separated into clinical RBC components cross-matched for REQ-1327.',
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ];

    // 7. Seed Emergency Alerts
    this.emergencyAlerts = [
      {
        id: 'ALERT-901',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        bloodGroup: 'O-',
        component: 'RBC',
        unitsRequired: 5,
        hospitalName: 'Apollo General Hospital',
        city: 'Metro City',
        urgency: 'Emergency',
        issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        distanceKmApprox: 3.2,
        responsesCount: 3,
        description: 'URGENT: Emergency Trauma Surgery requires 5 units of O- Negative Packed Red Blood Cells. Eligible O- donors requested to report immediately.',
        latitude: 40.7484,
        longitude: -73.9857
      }
    ];

    // 8. Seed Emergency Responses
    this.emergencyResponses = [
      {
        id: 'RESP-1',
        alertId: 'ALERT-901',
        donorId: 'donor-1',
        donorName: 'Alex Mercer',
        donorPhone: '+1 (555) 123-4500',
        status: 'Accepted',
        respondedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      }
    ];

    // 9. Seed Notifications
    this.notifications = [
      {
        id: 'NOTIF-1',
        userId: 'donor-1',
        title: 'Emergency Blood Requirement: O- Negative',
        message: 'Apollo General Hospital urgently requires O- RBC. Click to respond if eligible.',
        type: 'emergency',
        priority: 'urgent',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        link: '/donor/emergency-alerts'
      },
      {
        id: 'NOTIF-2',
        userId: 'bb-1',
        title: 'AI Alert: Critical Shortage Predicted for O-',
        message: 'AI Forecast predicts demand for O- RBC will exceed stock by 9 units over the next 7 days.',
        type: 'ai_alert',
        priority: 'high',
        read: false,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        link: '/blood-bank/ai-insights'
      },
      {
        id: 'NOTIF-3',
        userId: 'hosp-1',
        title: 'Hospital Request REQ-1001 Status Update',
        message: 'Sample SMP-501 received at City Central lab. Cross-match testing underway.',
        type: 'request_update',
        priority: 'medium',
        read: true,
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        link: '/hospital/requests'
      }
    ];

    // Seed Hospital Internal Storage Locations & Local Ledger (Phase 4A)
    this.hospitalStorageLocations = [
      {
        id: 'loc-1',
        hospitalId: 'hosp-1',
        name: 'OT-1 Emergency Cold Box (Trauma Suite)',
        department: 'Trauma & Emergency Surgery',
        description: 'Rapid-access 4°C blood cooler inside operating theater 1'
      },
      {
        id: 'loc-2',
        hospitalId: 'hosp-1',
        name: 'Main Satellite Refrigerator (Level 2 ICU)',
        department: 'Intensive Care Unit',
        description: 'Monitored temperature-controlled cold storage cabinet'
      },
      {
        id: 'loc-3',
        hospitalId: 'hosp-1',
        name: 'Emergency Department Reserve Bin',
        department: 'Emergency Medicine',
        description: 'STAT transfusion holding cooler'
      }
    ];

    this.hospitalStorageEntries = [
      {
        id: 'HLE-101',
        hospitalId: 'hosp-1',
        locationId: 'loc-1',
        storageLocation: 'OT-1 Emergency Cold Box (Trauma Suite)',
        bloodGroup: 'O-',
        component: 'RBC',
        quantityUnits: 2,
        status: 'Usable',
        expiryDate: '2026-10-28',
        minThreshold: 4,
        notes: 'STAT Trauma Reserve',
        source: 'manual_hospital_entry',
        recordedBy: 'Nurse Supervisor M. Davis',
        createdAt: '2026-10-10T08:00:00Z',
        updatedAt: '2026-10-10T08:00:00Z'
      },
      {
        id: 'HLE-102',
        hospitalId: 'hosp-1',
        locationId: 'loc-1',
        storageLocation: 'OT-1 Emergency Cold Box (Trauma Suite)',
        bloodGroup: 'A+',
        component: 'RBC',
        quantityUnits: 1,
        status: 'Reserved',
        expiryDate: '2026-10-30',
        minThreshold: 2,
        notes: 'Reserved for PAT-4402 pre-op surgical protocol',
        source: 'manual_hospital_entry',
        recordedBy: 'Dr. C. Vance',
        createdAt: '2026-10-10T09:30:00Z',
        updatedAt: '2026-10-10T09:30:00Z'
      },
      {
        id: 'HLE-103',
        hospitalId: 'hosp-1',
        locationId: 'loc-2',
        storageLocation: 'Main Satellite Refrigerator (Level 2 ICU)',
        bloodGroup: 'O+',
        component: 'RBC',
        quantityUnits: 3,
        status: 'Usable',
        expiryDate: '2026-11-04',
        minThreshold: 3,
        notes: 'ICU Routine Buffer',
        source: 'manual_hospital_entry',
        recordedBy: 'Nurse Supervisor M. Davis',
        createdAt: '2026-10-10T11:00:00Z',
        updatedAt: '2026-10-10T11:00:00Z'
      }
    ];

    // Seed Cold Storage Equipment (Phase 5C)
    const nowMs = Date.now();
    const isoNow = new Date(nowMs).toISOString();
    const minsAgo = (m: number) => new Date(nowMs - m * 60 * 1000).toISOString();
    const hoursAgo = (h: number) => new Date(nowMs - h * 3600 * 1000).toISOString();

    this.coldStorageEquipment = [
      {
        id: 'EQ-RBC-REF-01',
        bloodBankId: 'bb-1',
        name: 'RBC Main Cold Refrigerator #1',
        equipmentType: 'Refrigerated Storage (RBC)',
        locationName: 'Central Cold Storage - Bay A',
        mappedStorageLocations: ['RBC Main Storage Bay', 'Quarantine Bay RBC-1', 'RBC Locker'],
        minTempCelsius: 2.0,
        maxTempCelsius: 6.0,
        targetTempCelsius: 4.0,
        temperatureUnit: '°C',
        authoritativeStandard: 'WHO / AABB Blood Storage Standard (2°C to 6°C)',
        requiresAgitation: false,
        status: 'Operational',
        sensorId: 'SENS-RBC-01',
        sensorConnectivity: 'Connected',
        lastReadingTempCelsius: 3.8,
        lastReadingTimestamp: minsAgo(5),
        lastReadingSource: 'sensor_telemetry',
        lastReadingRecordedBy: 'IoT Gateway SENS-RBC-01',
        staleThresholdMinutes: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: isoNow
      },
      {
        id: 'EQ-FFP-FRZ-01',
        bloodBankId: 'bb-1',
        name: 'Plasma Deep Freezer #1',
        equipmentType: 'Ultra-Low Freezer (FFP)',
        locationName: 'Cryo Vault - Bay B',
        mappedStorageLocations: ['Quarantine Bay FFP-1', 'Plasma Locker'],
        minTempCelsius: -35.0,
        maxTempCelsius: -18.0,
        targetTempCelsius: -30.0,
        temperatureUnit: '°C',
        authoritativeStandard: 'AABB Standards for Blood Banks (≤ -18°C)',
        requiresAgitation: false,
        status: 'Operational',
        sensorId: 'SENS-FFP-01',
        sensorConnectivity: 'Connected',
        lastReadingTempCelsius: -28.5,
        lastReadingTimestamp: minsAgo(8),
        lastReadingSource: 'sensor_telemetry',
        lastReadingRecordedBy: 'IoT Gateway SENS-FFP-01',
        staleThresholdMinutes: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: isoNow
      },
      {
        id: 'EQ-PLT-INC-01',
        bloodBankId: 'bb-1',
        name: 'Platelet Incubator & Agitator #1',
        equipmentType: 'Platelet Incubator & Agitator',
        locationName: 'Component Processing Lab - Suite C',
        mappedStorageLocations: ['Quarantine Bay PLT-1', 'Platelets Locker'],
        minTempCelsius: 20.0,
        maxTempCelsius: 24.0,
        targetTempCelsius: 22.0,
        temperatureUnit: '°C',
        authoritativeStandard: 'WHO Technical Report Series (20°C to 24°C continuous agitation)',
        requiresAgitation: true,
        agitationStatus: 'Active',
        status: 'Operational',
        sensorId: 'SENS-PLT-01',
        sensorConnectivity: 'Connected',
        lastReadingTempCelsius: 22.1,
        lastReadingTimestamp: minsAgo(4),
        lastReadingSource: 'sensor_telemetry',
        lastReadingRecordedBy: 'IoT Gateway SENS-PLT-01',
        staleThresholdMinutes: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: isoNow
      },
      {
        id: 'EQ-QC-HOLD-01',
        bloodBankId: 'bb-1',
        name: 'Intake Holding Refrigerator #1',
        equipmentType: 'Intake Holding Cooler',
        locationName: 'Phlebotomy Intake Bay',
        mappedStorageLocations: ['Quarantine Bay RBC-1', 'In-House Phlebotomy Intake'],
        minTempCelsius: 2.0,
        maxTempCelsius: 6.0,
        targetTempCelsius: 4.0,
        temperatureUnit: '°C',
        authoritativeStandard: 'AABB Quality Guidelines (2°C to 6°C)',
        requiresAgitation: false,
        status: 'Operational',
        sensorId: undefined,
        sensorConnectivity: 'Manual Log Only',
        lastReadingTempCelsius: 4.2,
        lastReadingTimestamp: hoursAgo(6),
        lastReadingSource: 'manual_log',
        lastReadingRecordedBy: 'Dr. Sarah Jenkins',
        staleThresholdMinutes: 240,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: isoNow
      },
      {
        id: 'EQ-BB2-REF-01',
        bloodBankId: 'bb-2',
        name: 'Red Cross Regional Refrigerator A',
        equipmentType: 'Refrigerated Storage (RBC)',
        locationName: 'Regional Bay 1',
        mappedStorageLocations: ['RBC Bay 1'],
        minTempCelsius: 2.0,
        maxTempCelsius: 6.0,
        targetTempCelsius: 4.0,
        temperatureUnit: '°C',
        authoritativeStandard: 'WHO / AABB Blood Storage Standard (2°C to 6°C)',
        requiresAgitation: false,
        status: 'Operational',
        sensorId: 'SENS-BB2-01',
        sensorConnectivity: 'Connected',
        lastReadingTempCelsius: 3.9,
        lastReadingTimestamp: minsAgo(10),
        lastReadingSource: 'sensor_telemetry',
        staleThresholdMinutes: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: isoNow
      }
    ];

    // Seed Real Historical Temperature Readings for bb-1
    this.temperatureReadings = [
      // RBC Refrigerator readings (last 6 hours)
      { id: 'TMP-RBC-01', bloodBankId: 'bb-1', equipmentId: 'EQ-RBC-REF-01', equipmentName: 'RBC Main Cold Refrigerator #1', temperatureCelsius: 3.9, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(6), isOutOfRange: false, minTempCelsius: 2.0, maxTempCelsius: 6.0, createdAt: hoursAgo(6) },
      { id: 'TMP-RBC-02', bloodBankId: 'bb-1', equipmentId: 'EQ-RBC-REF-01', equipmentName: 'RBC Main Cold Refrigerator #1', temperatureCelsius: 4.1, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(4), isOutOfRange: false, minTempCelsius: 2.0, maxTempCelsius: 6.0, createdAt: hoursAgo(4) },
      { id: 'TMP-RBC-03', bloodBankId: 'bb-1', equipmentId: 'EQ-RBC-REF-01', equipmentName: 'RBC Main Cold Refrigerator #1', temperatureCelsius: 4.3, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(2), isOutOfRange: false, minTempCelsius: 2.0, maxTempCelsius: 6.0, createdAt: hoursAgo(2) },
      { id: 'TMP-RBC-04', bloodBankId: 'bb-1', equipmentId: 'EQ-RBC-REF-01', equipmentName: 'RBC Main Cold Refrigerator #1', temperatureCelsius: 3.8, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: minsAgo(5), isOutOfRange: false, minTempCelsius: 2.0, maxTempCelsius: 6.0, createdAt: minsAgo(5) },

      // FFP Deep Freezer readings
      { id: 'TMP-FFP-01', bloodBankId: 'bb-1', equipmentId: 'EQ-FFP-FRZ-01', equipmentName: 'Plasma Deep Freezer #1', temperatureCelsius: -29.2, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(6), isOutOfRange: false, minTempCelsius: -35.0, maxTempCelsius: -18.0, createdAt: hoursAgo(6) },
      { id: 'TMP-FFP-02', bloodBankId: 'bb-1', equipmentId: 'EQ-FFP-FRZ-01', equipmentName: 'Plasma Deep Freezer #1', temperatureCelsius: -28.9, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(3), isOutOfRange: false, minTempCelsius: -35.0, maxTempCelsius: -18.0, createdAt: hoursAgo(3) },
      { id: 'TMP-FFP-03', bloodBankId: 'bb-1', equipmentId: 'EQ-FFP-FRZ-01', equipmentName: 'Plasma Deep Freezer #1', temperatureCelsius: -28.5, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: minsAgo(8), isOutOfRange: false, minTempCelsius: -35.0, maxTempCelsius: -18.0, createdAt: minsAgo(8) },

      // Platelet Incubator readings
      { id: 'TMP-PLT-01', bloodBankId: 'bb-1', equipmentId: 'EQ-PLT-INC-01', equipmentName: 'Platelet Incubator & Agitator #1', temperatureCelsius: 22.0, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(6), isOutOfRange: false, minTempCelsius: 20.0, maxTempCelsius: 24.0, agitationOperational: true, createdAt: hoursAgo(6) },
      { id: 'TMP-PLT-02', bloodBankId: 'bb-1', equipmentId: 'EQ-PLT-INC-01', equipmentName: 'Platelet Incubator & Agitator #1', temperatureCelsius: 22.3, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: hoursAgo(3), isOutOfRange: false, minTempCelsius: 20.0, maxTempCelsius: 24.0, agitationOperational: true, createdAt: hoursAgo(3) },
      { id: 'TMP-PLT-03', bloodBankId: 'bb-1', equipmentId: 'EQ-PLT-INC-01', equipmentName: 'Platelet Incubator & Agitator #1', temperatureCelsius: 22.1, temperatureUnit: '°C', readingSource: 'sensor_telemetry', timestamp: minsAgo(4), isOutOfRange: false, minTempCelsius: 20.0, maxTempCelsius: 24.0, agitationOperational: true, createdAt: minsAgo(4) },

      // Intake Holding Refrigerator (Manual readings)
      { id: 'TMP-QC-01', bloodBankId: 'bb-1', equipmentId: 'EQ-QC-HOLD-01', equipmentName: 'Intake Holding Refrigerator #1', temperatureCelsius: 4.5, temperatureUnit: '°C', readingSource: 'manual_log', operatorName: 'Dr. Sarah Jenkins', timestamp: hoursAgo(4), isOutOfRange: false, minTempCelsius: 2.0, maxTempCelsius: 6.0, notes: 'Morning shift physical thermometer log', createdAt: hoursAgo(4) },
      { id: 'TMP-QC-02', bloodBankId: 'bb-1', equipmentId: 'EQ-QC-HOLD-01', equipmentName: 'Intake Holding Refrigerator #1', temperatureCelsius: 4.2, temperatureUnit: '°C', readingSource: 'manual_log', operatorName: 'Dr. Sarah Jenkins', timestamp: hoursAgo(1), isOutOfRange: false, minTempCelsius: 2.0, maxTempCelsius: 6.0, notes: 'Midday verification log', createdAt: hoursAgo(1) }
    ];

    // Seed Cold Storage Alarms (1 Historical Resolved Alarm)
    this.coldStorageAlarms = [
      {
        id: 'ALM-2026-001',
        bloodBankId: 'bb-1',
        equipmentId: 'EQ-RBC-REF-01',
        equipmentName: 'RBC Main Cold Refrigerator #1',
        severity: 'Warning',
        triggeringReadingCelsius: 6.8,
        thresholdViolated: 'Exceeded upper threshold +6.0°C (Recorded +6.8°C)',
        triggeredAt: hoursAgo(48),
        peakTemperatureCelsius: 7.1,
        status: 'Resolved',
        acknowledgedAt: hoursAgo(47),
        acknowledgedBy: 'Dr. Sarah Jenkins',
        acknowledgementNotes: 'Compressor defrost cycle active. Door verified sealed.',
        resolvedAt: hoursAgo(46),
        resolvedBy: 'Dr. Sarah Jenkins',
        resolutionNotes: 'Temperature returned to 3.9°C. Storage verified within range.',
        correctiveAction: 'Defrost cycle timing re-calibrated. Units verified within acceptable exposure bounds.',
        affectedInventoryCount: 8,
        auditHistory: [
          { id: 'AUD-01', action: 'Triggered', operatorName: 'Automated Monitor', timestamp: hoursAgo(48), notes: 'Temperature +6.8°C exceeded upper limit +6.0°C' },
          { id: 'AUD-02', action: 'Acknowledged', operatorName: 'Dr. Sarah Jenkins', timestamp: hoursAgo(47), notes: 'Compressor defrost cycle active. Door verified sealed.' },
          { id: 'AUD-03', action: 'Resolved', operatorName: 'Dr. Sarah Jenkins', timestamp: hoursAgo(46), notes: 'Temperature returned to 3.9°C. Storage verified within range.' }
        ]
      }
    ];

    // Seed Blood Dispatches (1 Historical Completed Dispatch for REQ-1002)
    this.bloodDispatches = [
      {
        id: 'DSP-2026-001',
        requestId: 'REQ-1002',
        bloodBankId: 'bb-1',
        bloodBankName: 'City Central Blood Center',
        hospitalId: 'hosp-2',
        hospitalName: 'Metro LifeCare Hospital',
        patientReferenceId: 'PAT-9041 (Cardiology)',
        department: 'Cardiothoracic Surgery',
        component: 'RBC',
        bloodGroup: 'A+',
        unitIds: ['UNIT-2026-8005', 'UNIT-2026-8006'],
        unitItems: [
          {
            unitId: 'UNIT-2026-8005',
            bloodGroup: 'A+',
            component: 'RBC',
            volumeMl: 450,
            collectionDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            expiryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            storageLocation: 'Shelf A-1 (Main Cold Storage)',
            testingStatus: 'Passed'
          },
          {
            unitId: 'UNIT-2026-8006',
            bloodGroup: 'A+',
            component: 'RBC',
            volumeMl: 450,
            collectionDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            expiryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            storageLocation: 'Shelf A-1 (Main Cold Storage)',
            testingStatus: 'Passed'
          }
        ],
        quantityUnits: 2,
        status: 'Received',
        courierType: 'Dedicated Hospital Courier',
        courierReference: 'HOSP-VAN-04',
        packagingType: 'Standard Passive Thermal Container with Ice Gel Packs',
        targetTransportTemp: '2°C to 6°C (Chilled)',
        coldChainMonitoring: 'Passive Temp Strips',
        specialHandlingInstructions: 'Maintain upright at 2-6°C. Do not freeze.',
        preparedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
        preparedBy: 'Marcus Vance (Blood Center Logistics)',
        dispatchedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        dispatchedBy: 'Marcus Vance',
        receivedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        receivedBy: 'Nurse Supervisor Karen Diaz (Metro LifeCare)',
        auditHistory: [
          { action: 'Prepared', timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(), operator: 'Marcus Vance', notes: 'Packed 2 units A+ RBC into thermal container' },
          { action: 'Dispatched', timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), operator: 'Marcus Vance', notes: 'Handed off to Metro LifeCare courier HOSP-VAN-04' },
          { action: 'Received', timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), operator: 'Karen Diaz', notes: 'Confirmed receipt. Cold chain verified intact.' }
        ],
        createdAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
      }
    ];

  }

  // --- Helper Methods ---

  getAvailableInventoryByGroup(bloodBankId?: string) {
    const summary: Record<BloodGroup, { availableUnits: number; rbc: number; plasma: number; platelets: number; status: 'Normal' | 'Low' | 'Critical' }> = {
      'A+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'A-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'B+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'B-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'AB+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'AB-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'O+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
      'O-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Critical' },
    };

    this.bloodUnits.forEach(u => {
      if (bloodBankId && u.bloodBankId !== bloodBankId) return;
      if (u.availability === 'Available' && u.testingStatus === 'Passed') {
        const bg = u.bloodGroup;
        if (summary[bg]) {
          summary[bg].availableUnits++;
          if (u.component === 'RBC') summary[bg].rbc++;
          if (u.component === 'Plasma') summary[bg].plasma++;
          if (u.component === 'Platelets') summary[bg].platelets++;
        }
      }
    });

    Object.keys(summary).forEach(key => {
      const bg = key as BloodGroup;
      if (summary[bg].rbc <= 2) summary[bg].status = 'Critical';
      else if (summary[bg].rbc <= 5) summary[bg].status = 'Low';
      else summary[bg].status = 'Normal';
    });

    return summary;
  }
}

export const db = new DataStore();

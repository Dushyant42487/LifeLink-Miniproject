import { supabase, safeSupabaseSync } from '../models/db';
import { Request, Response } from 'express';
import { db } from '../models/store';
import { isValidCoordinate } from '../utils/geo';

const normalizeBloodGroup = (bg?: any): string | undefined => {
  if (!bg || bg === 'all') return undefined;
  let str = String(bg).trim();
  if (str.endsWith(' ')) str = str.trim() + '+';
  if (['A', 'B', 'AB', 'O'].includes(str)) {
    // Keep as is if without sign
  } else if (str.includes(' ')) {
    str = str.replace(' ', '+');
  }
  return str;
};

const getActiveAvailableUnits = (bloodGroupFilter?: string) => {
  const normalizedGroup = normalizeBloodGroup(bloodGroupFilter);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let units = db.bloodUnits.filter(u => {
    if (u.availability !== 'Available' || u.testingStatus !== 'Passed') return false;
    const exp = new Date(u.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp.getTime() >= now.getTime();
  });

  if (normalizedGroup) {
    units = units.filter(u => u.bloodGroup === normalizedGroup);
  }

  // Sort by earliest expiry date first (FEFO)
  units.sort((a, b) => {
    const diff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    return diff !== 0 ? diff : new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime();
  });

  return units;
};

export const getPublicStats = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  const { bloodGroup } = req.query;
  const totalDonors = db.donors.length;
  const totalHospitals = db.hospitals.length;
  const totalBloodBanks = db.bloodBanks.length;
  
  const allAvailableUnits = getActiveAvailableUnits();
  const totalUnitsAvailable = allAvailableUnits.length;
  const totalRequestsFulfilled = db.bloodRequests.filter(r => r.status === 'Fulfilled').length;

  const filteredUnits = bloodGroup && bloodGroup !== 'all' 
    ? getActiveAvailableUnits(String(bloodGroup))
    : allAvailableUnits;



  res.json({
    success: true,
    stats: {
      totalDonors,
      totalHospitals,
      totalBloodBanks,
      totalUnitsAvailable,
      totalRequestsFulfilled,
      livesSavedEstimate: totalRequestsFulfilled * 3
    },
    bloodGroupAvailability: db.getAvailableInventoryByGroup(),
    availableUnits: filteredUnits
  });
};

export const getPublicAvailability = async (req: Request, res: Response) => {

  await safeSupabaseSync();

  const { bloodGroup } = req.query;
  const units = getActiveAvailableUnits(bloodGroup ? String(bloodGroup) : undefined);



  res.json({
    success: true,
    bloodGroup: bloodGroup || 'all',
    count: units.length,
    units
  });
};

export const getPublicCamps = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  const { city, search } = req.query;
  let camps = [...db.donationCamps];

  if (city && city !== 'all') {
    camps = camps.filter(c => c.city.toLowerCase() === String(city).toLowerCase());
  }
  if (search) {
    const q = String(search).toLowerCase();
    camps = camps.filter(c => c.title.toLowerCase().includes(q) || c.location.toLowerCase().includes(q));
  }



  res.json({ success: true, count: camps.length, camps });
};

export const rsvpCamp = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  const { id } = req.params;
  const camp = db.donationCamps.find(c => c.id === id);
  if (!camp)  return res.status(404).json({ success: false, error: 'Donation camp not found' });

  camp.registeredCount = (camp.registeredCount || 0) + 1;

  res.json({
    success: true,
    message: `Successfully registered for ${camp.title}! A confirmation SMS/Email reminder will be sent before the event.`,
    camp
  });
};

export const getNotifications = async (req: Request, res: Response) => {
  await safeSupabaseSync();
  res.json({ success: true, notifications: db.notifications });
};

export const getPublicLocations = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  // Deduplicate and filter active blood banks by normalized name and city
  const seenBankKeys = new Set<string>();
  const bloodBanks: any[] = [];

  // Sort to prioritize canonical IDs (bb-*) and records with valid coordinates first
  const sortedBanks = [...db.bloodBanks].sort((a, b) => {
    const aValid = isValidCoordinate(a.latitude, a.longitude) ? 1 : 0;
    const bValid = isValidCoordinate(b.latitude, b.longitude) ? 1 : 0;
    if (aValid !== bValid) return bValid - aValid;
    const aCanonical = a.id?.startsWith('bb-') ? 1 : 0;
    const bCanonical = b.id?.startsWith('bb-') ? 1 : 0;
    return bCanonical - aCanonical;
  });

  for (const b of sortedBanks) {
    if (!b.id || b.isActive === false || b.verificationStatus === 'Rejected') continue;
    const name = b.name || b.bloodBankName;
    if (!name) continue;
    const normName = name.trim().toLowerCase();
    const normCity = (b.city || '').trim().toLowerCase();
    const dedupeKey = `${normName}:::${normCity}`;
    if (seenBankKeys.has(dedupeKey)) continue;
    seenBankKeys.add(dedupeKey);

    bloodBanks.push({
      id: b.id,
      name,
      bloodBankName: b.bloodBankName || b.name,
      address: b.address,
      city: b.city,
      state: b.state,
      lat: b.latitude,
      lng: b.longitude,
      phone: b.phone,
      emergencyPhone: b.emergencyPhone,
      hasValidLocation: isValidCoordinate(b.latitude, b.longitude),
      type: 'blood_bank'
    });
  }

  const seenHospKeys = new Set<string>();
  const hospitals: any[] = [];

  const sortedHosps = [...db.hospitals].sort((a, b) => {
    const aValid = isValidCoordinate(a.latitude, a.longitude) ? 1 : 0;
    const bValid = isValidCoordinate(b.latitude, b.longitude) ? 1 : 0;
    if (aValid !== bValid) return bValid - aValid;
    const aCanonical = a.id?.startsWith('hosp-') ? 1 : 0;
    const bCanonical = b.id?.startsWith('hosp-') ? 1 : 0;
    return bCanonical - aCanonical;
  });

  for (const h of sortedHosps) {
    if (!h.id) continue;
    const name = h.hospitalName || h.name;
    if (!name) continue;
    const normName = name.trim().toLowerCase();
    const normCity = (h.city || '').trim().toLowerCase();
    const dedupeKey = `${normName}:::${normCity}`;
    if (seenHospKeys.has(dedupeKey)) continue;
    seenHospKeys.add(dedupeKey);

    hospitals.push({
      id: h.id,
      name,
      hospitalName: h.hospitalName || h.name,
      address: h.address,
      city: h.city,
      state: h.state,
      lat: h.latitude,
      lng: h.longitude,
      phone: h.phone,
      hasValidLocation: isValidCoordinate(h.latitude, h.longitude),
      type: 'hospital'
    });
  }

  res.json({ success: true, bloodBanks, hospitals });
};


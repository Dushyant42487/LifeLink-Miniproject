import { supabase, safeSupabaseSync } from '../models/db';
import { Request, Response } from 'express';
import { db } from '../models/store';

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

  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
  const { data: __don } = await supabase.from('donors').select('*');
  if (__don) db.donors = __don;
  const { data: __hosp } = await supabase.from('hospitals').select('*');
  if (__hosp) db.hospitals = __hosp;
  const { data: __bb } = await supabase.from('blood_banks').select('*');
  if (__bb) db.bloodBanks = __bb;

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

  const bloodBanks = db.bloodBanks.map(b => ({
    id: b.id,
    name: b.name || b.bloodBankName,
    address: b.address,
    city: b.city,
    state: b.state,
    lat: b.latitude,
    lng: b.longitude,
    phone: b.phone,
    type: 'blood_bank'
  }));

  const hospitals = db.hospitals.map(h => ({
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    state: h.state,
    lat: h.latitude,
    lng: h.longitude,
    phone: h.phone,
    type: 'hospital'
  }));

  res.json({ success: true, bloodBanks, hospitals });
};

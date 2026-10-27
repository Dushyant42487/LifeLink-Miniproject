import { safeSupabaseSync, persistRecordDirect, supabase, isSupabaseReal } from '../models/db';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../models/store';
import { JWT_SECRET, AuthenticatedRequest } from '../middleware/auth';
import { DonorProfile, HospitalProfile, BloodBankProfile, UserRole } from '../models/types';
import { parseCoordinates } from '../utils/geo';
import { syncDonorAuthoritativeEligibility } from '../services/donorEligibilityService';

export const login = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
    
      return res.status(400).json({ success: false, error: 'Email, password, and role are required' });
    }

    let user: any = null;

    if (role === 'donor') {
      user = db.donors.find(d => d.email.toLowerCase() === email.toLowerCase());
      if (!user && isSupabaseReal) {
        const { data } = await supabase.from('donors').select('*').ilike('email', email.trim()).maybeSingle();
        if (data) {
          user = data;
          db.donors.push(user);
        }
      }
    } else if (role === 'hospital') {
      user = db.hospitals.find(h => h.email.toLowerCase() === email.toLowerCase());
      if (!user && isSupabaseReal) {
        const { data } = await supabase.from('hospitals').select('*').ilike('email', email.trim()).maybeSingle();
        if (data) {
          user = data;
          db.hospitals.push(user);
        }
      }
    } else if (role === 'blood_bank') {
      user = db.bloodBanks.find(b => b.email.toLowerCase() === email.toLowerCase());
      if (!user && isSupabaseReal) {
        const { data } = await supabase.from('blood_banks').select('*').ilike('email', email.trim()).maybeSingle();
        if (data) {
          user = data;
          db.bloodBanks.push(user);
        }
      }
    }

    if (!user) {
    
      return res.status(401).json({ success: false, error: 'Invalid email or password for selected role' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
    
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name || user.hospitalName || user.bloodBankName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    if (user.role === 'donor') {
      syncDonorAuthoritativeEligibility(user);
    }

    const { passwordHash, ...userWithoutPassword } = user;

  

    return res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (err: any) {
    console.error('Error during login:', err);
  
    return res.status(500).json({ success: false, error: 'Internal authentication server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  try {
    const { role, email, password } = req.body;

    if (!role || !email || !password) {
    
      return res.status(400).json({ success: false, error: 'Role, email, and password are required' });
    }

    // Check duplicate
    const existingDonor = db.donors.find(d => d.email.toLowerCase() === email.toLowerCase());
    const existingHosp = db.hospitals.find(h => h.email.toLowerCase() === email.toLowerCase());
    const existingBB = db.bloodBanks.find(b => b.email.toLowerCase() === email.toLowerCase());

    if (existingDonor || existingHosp || existingBB) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    if (isSupabaseReal) {
      const [dCheck, hCheck, bCheck] = await Promise.all([
        supabase.from('donors').select('id').ilike('email', email.trim()).maybeSingle(),
        supabase.from('hospitals').select('id').ilike('email', email.trim()).maybeSingle(),
        supabase.from('blood_banks').select('id').ilike('email', email.trim()).maybeSingle()
      ]);
      if (dCheck.data || hCheck.data || bCheck.data) {
        return res.status(400).json({ success: false, error: 'User with this email already exists' });
      }
    }

    const passwordHash = bcrypt.hashSync(password, 8);
    const id = `user-${Date.now()}`;
    const createdAt = new Date().toISOString();

    if (role === 'donor') {
      const { name, bloodGroup, dob, gender, phone, address, city, state, postalCode, emergencyContact, weightKg } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Full name is required for donor registration' });
      }

      let donorCoords: { lat?: number; lng?: number } = {};
      if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
        const coordRes = parseCoordinates(req.body.latitude, req.body.longitude);
        if (coordRes.error) {
          return res.status(400).json({ success: false, error: coordRes.error });
        }
        donorCoords = coordRes;
      }
      
      const newDonor: DonorProfile = {
        id,
        email: email.trim(),
        passwordHash,
        role: 'donor',
        name: name.trim(),
        bloodGroup: bloodGroup || 'Unspecified',
        dob: dob || '',
        gender: gender || 'Unspecified',
        phone: phone ? phone.trim() : '',
        address: address ? address.trim() : '',
        city: city ? city.trim() : '',
        state: state ? state.trim() : '',
        postalCode: postalCode ? String(postalCode).trim() : '',
        latitude: donorCoords.lat,
        longitude: donorCoords.lng,
        emergencyContact: emergencyContact || { name: '', phone: '', relation: '' },
        weightKg: Number(weightKg) || 0,
        isEligible: false,
        bloodGroupVerificationStatus: 'Unverified',
        verificationStatus: 'Unverified',
        deferralReason: 'Donor verification required. Please submit blood group verification proof to confirm eligibility.',
        totalDonationsCount: 0,
        totalVolumeMl: 0,
        notificationPreferences: {
          emergencyAlerts: true,
          campReminders: true,
          eligibilityAlerts: true
        },
        createdAt
      };

      // Run authoritative eligibility sync
      syncDonorAuthoritativeEligibility(newDonor);

      db.donors.push(newDonor);
      await persistRecordDirect('donors', newDonor);
      db.saveSnapshot();
      const token = jwt.sign({ id, email, role: 'donor', name: newDonor.name }, JWT_SECRET, { expiresIn: '24h' });
      const { passwordHash: _, ...donorData } = newDonor;

      return res.status(201).json({ success: true, token, user: donorData });
    } 
    
    if (role === 'hospital') {
      const { hospitalName, licenseId, contactPerson, phone, emergencyPhone, address, city, state, postalCode } = req.body;
      const hospName = (hospitalName || req.body.name || '').trim();
      if (!hospName) {
        return res.status(400).json({ success: false, error: 'Hospital name is required' });
      }

      let hospCoords: { lat?: number; lng?: number } = {};
      if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
        const coordRes = parseCoordinates(req.body.latitude, req.body.longitude);
        if (coordRes.error) {
          return res.status(400).json({ success: false, error: coordRes.error });
        }
        hospCoords = coordRes;
      }

      const newHospital: HospitalProfile = {
        id,
        email: email.trim(),
        passwordHash,
        role: 'hospital',
        name: hospName,
        hospitalName: hospName,
        licenseId: (licenseId || req.body.registrationId || '').trim(),
        verificationStatus: 'Pending Verification',
        contactPerson: contactPerson ? contactPerson.trim() : '',
        phone: phone ? phone.trim() : '',
        emergencyPhone: emergencyPhone ? emergencyPhone.trim() : '',
        address: address ? address.trim() : '',
        city: city ? city.trim() : '',
        state: state ? state.trim() : '',
        postalCode: postalCode ? String(postalCode).trim() : '',
        latitude: hospCoords.lat,
        longitude: hospCoords.lng,
        createdAt
      };

      db.hospitals.push(newHospital);
      await persistRecordDirect('hospitals', newHospital);
      db.saveSnapshot();
      const token = jwt.sign({ id, email, role: 'hospital', name: newHospital.hospitalName }, JWT_SECRET, { expiresIn: '24h' });
      const { passwordHash: _, ...hospData } = newHospital;

      return res.status(201).json({ success: true, token, user: hospData });
    }

    if (role === 'blood_bank') {
      const { bloodBankName, registrationId, contactPerson, phone, emergencyPhone, address, city, state, postalCode } = req.body;
      const bankName = (bloodBankName || req.body.name || '').trim();
      if (!bankName) {
        return res.status(400).json({ success: false, error: 'Blood bank name is required' });
      }

      let bbCoords: { lat?: number; lng?: number } = {};
      if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
        const coordRes = parseCoordinates(req.body.latitude, req.body.longitude);
        if (coordRes.error) {
          return res.status(400).json({ success: false, error: coordRes.error });
        }
        bbCoords = coordRes;
      }

      const newBloodBank: BloodBankProfile = {
        id,
        email: email.trim(),
        passwordHash,
        role: 'blood_bank',
        name: bankName,
        bloodBankName: bankName,
        registrationId: (registrationId || req.body.licenseId || '').trim(),
        contactPerson: contactPerson ? contactPerson.trim() : '',
        phone: phone ? phone.trim() : '',
        emergencyPhone: emergencyPhone ? emergencyPhone.trim() : '',
        address: address ? address.trim() : '',
        city: city ? city.trim() : '',
        state: state ? state.trim() : '',
        postalCode: postalCode ? String(postalCode).trim() : '',
        latitude: bbCoords.lat,
        longitude: bbCoords.lng,
        createdAt
      };

      db.bloodBanks.push(newBloodBank);
      await persistRecordDirect('blood_banks', newBloodBank);
      db.saveSnapshot();
      const token = jwt.sign({ id, email, role: 'blood_bank', name: newBloodBank.bloodBankName }, JWT_SECRET, { expiresIn: '24h' });
      const { passwordHash: _, ...bbData } = newBloodBank;

      return res.status(201).json({ success: true, token, user: bbData });
    }

  

    return res.status(400).json({ success: false, error: 'Invalid role specified' });
  } catch (err: any) {
    console.error('Error during registration:', err);
  
    return res.status(500).json({ success: false, error: 'Internal registration server error' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();

  try {
    if (!req.user) {
    
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { id, role } = req.user;
    let user: any = null;

    if (role === 'donor') {
      user = db.donors.find(d => d.id === id);
      if (!user && isSupabaseReal) {
        const { data } = await supabase.from('donors').select('*').eq('id', id).maybeSingle();
        if (data) {
          user = data;
          db.donors.push(user);
        }
      }
    } else if (role === 'hospital') {
      user = db.hospitals.find(h => h.id === id);
      if (!user && isSupabaseReal) {
        const { data } = await supabase.from('hospitals').select('*').eq('id', id).maybeSingle();
        if (data) {
          user = data;
          db.hospitals.push(user);
        }
      }
    } else if (role === 'blood_bank') {
      user = db.bloodBanks.find(b => b.id === id);
      if (!user && isSupabaseReal) {
        const { data } = await supabase.from('blood_banks').select('*').eq('id', id).maybeSingle();
        if (data) {
          user = data;
          db.bloodBanks.push(user);
        }
      }
    }

    if (!user) {
    
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    if (role === 'donor') {
      syncDonorAuthoritativeEligibility(user);
    }

    const { passwordHash, ...userWithoutPassword } = user;
  
    return res.json({ success: true, user: userWithoutPassword });
  } catch (err: any) {
    console.error('Error in getMe:', err);
  
    return res.status(500).json({ success: false, error: 'Internal server error fetching profile' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  await safeSupabaseSync();

  try {
    const { email } = req.body;
    if (!email) {
    
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
  
    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been dispatched to your inbox.'
    });
  } catch (err: any) {
  
    return res.status(500).json({ success: false, error: 'Internal server error processing password reset' });
  }
};

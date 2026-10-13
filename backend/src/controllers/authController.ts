import { safeSupabaseSync } from '../models/db';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../models/store';
import { JWT_SECRET, AuthenticatedRequest } from '../middleware/auth';
import { DonorProfile, HospitalProfile, BloodBankProfile, UserRole } from '../models/types';

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
    } else if (role === 'hospital') {
      user = db.hospitals.find(h => h.email.toLowerCase() === email.toLowerCase());
    } else if (role === 'blood_bank') {
      user = db.bloodBanks.find(b => b.email.toLowerCase() === email.toLowerCase());
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

    const passwordHash = bcrypt.hashSync(password, 8);
    const id = `user-${Date.now()}`;
    const createdAt = new Date().toISOString();

    if (role === 'donor') {
      const { name, bloodGroup, dob, gender, phone, address, city, state, emergencyContact, weightKg } = req.body;
      
      const newDonor: DonorProfile = {
        id,
        email,
        passwordHash,
        role: 'donor',
        name: name || 'Voluntary Donor',
        bloodGroup: bloodGroup || 'O+',
        dob: dob || '1995-01-01',
        gender: gender || 'Male',
        phone: phone || '+1 (555) 000-0000',
        address: address || '123 Main St',
        city: city || 'Metro City',
        state: state || 'NY',
        emergencyContact: emergencyContact || { name: 'Emergency Contact', phone: '+1 (555) 000-9999', relation: 'Family' },
        weightKg: Number(weightKg) || 70,
        isEligible: true,
        totalDonationsCount: 0,
        totalVolumeMl: 0,
        notificationPreferences: {
          emergencyAlerts: true,
          campReminders: true,
          eligibilityAlerts: true
        },
        createdAt
      };

      db.donors.push(newDonor);
      const token = jwt.sign({ id, email, role: 'donor', name: newDonor.name }, JWT_SECRET, { expiresIn: '24h' });
      const { passwordHash: _, ...donorData } = newDonor;

    

      return res.status(201).json({ success: true, token, user: donorData });
    } 
    
    if (role === 'hospital') {
      const { hospitalName, licenseId, contactPerson, phone, emergencyPhone, address, city, state } = req.body;

      const newHospital: HospitalProfile = {
        id,
        email,
        passwordHash,
        role: 'hospital',
        name: hospitalName || 'General Hospital',
        hospitalName: hospitalName || 'General Hospital',
        licenseId: licenseId || `LIC-${Date.now()}`,
        verificationStatus: 'Pending Verification',
        contactPerson: contactPerson || 'Duty Officer',
        phone: phone || '+1 (555) 000-1111',
        emergencyPhone: emergencyPhone || '+1 (555) 911-0000',
        address: address || '456 Care Blvd',
        city: city || 'Metro City',
        state: state || 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
        createdAt
      };

      db.hospitals.push(newHospital);
      const token = jwt.sign({ id, email, role: 'hospital', name: newHospital.hospitalName }, JWT_SECRET, { expiresIn: '24h' });
      const { passwordHash: _, ...hospData } = newHospital;

    

      return res.status(201).json({ success: true, token, user: hospData });
    }

    if (role === 'blood_bank') {
      const { bloodBankName, registrationId, contactPerson, phone, emergencyPhone, address, city, state } = req.body;

      const newBloodBank: BloodBankProfile = {
        id,
        email,
        passwordHash,
        role: 'blood_bank',
        name: bloodBankName || 'Regional Blood Center',
        bloodBankName: bloodBankName || 'Regional Blood Center',
        registrationId: registrationId || `BB-LIC-${Date.now()}`,
        contactPerson: contactPerson || 'Lab Director',
        phone: phone || '+1 (555) 000-2222',
        emergencyPhone: emergencyPhone || '+1 (555) 999-0000',
        address: address || '789 Life St',
        city: city || 'Metro City',
        state: state || 'NY',
        latitude: 40.7306,
        longitude: -73.9352,
        createdAt
      };

      db.bloodBanks.push(newBloodBank);
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
    } else if (role === 'hospital') {
      user = db.hospitals.find(h => h.id === id);
    } else if (role === 'blood_bank') {
      user = db.bloodBanks.find(b => b.id === id);
    }

    if (!user) {
    
      return res.status(404).json({ success: false, error: 'User profile not found' });
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

import React, { useState, useEffect, useMemo } from 'react';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { DigitalDonorPassModal } from '../../components/common/DigitalDonorPassModal';
import { Save, CheckCircle2, AlertCircle, RefreshCw, User, Phone, MapPin, FileCheck, Bell, Upload, QrCode, ExternalLink, RefreshCcw } from 'lucide-react';
import { evaluateProfileCompleteness } from '../../utils/profileCompleteness';

export const DonorProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [showDigitalPassModal, setShowDigitalPassModal] = useState(false);
  const [digitalPassData, setDigitalPassData] = useState<any>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [weightKg, setWeightKg] = useState('70');
  const [travelRadiusKm, setTravelRadiusKm] = useState('25');
  const [pauseInvitations, setPauseInvitations] = useState(false);
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [emergRelation, setEmergRelation] = useState('Family');

  const [emergAlertsPref, setEmergAlertsPref] = useState(true);
  const [campRemindersPref, setCampRemindersPref] = useState(true);
  const [eligibilityAlertsPref, setEligibilityAlertsPref] = useState(true);

  // Baseline state for dirty-tracking
  const [initialBaseline, setInitialBaseline] = useState<string>('');

  // Verification Document & File Upload State
  const [verifyDocType, setVerifyDocType] = useState('Lab Blood Report');
  const [verifyDocNumber, setVerifyDocNumber] = useState('');
  const [uploadState, setUploadState] = useState<'ready' | 'uploading' | 'uploaded' | 'error'>('ready');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; url: string; docId?: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await donorApi.getProfile();
      if (res.success && res.donor) {
        const d = res.donor;
        setProfile(d);
        const nameVal = d.name || user?.name || '';
        const phoneVal = d.phone || '';
        const addressVal = d.address || '';
        const cityVal = d.city || '';
        const stateVal = d.state || '';
        const weightVal = String(d.weightKg || 70);
        const radiusVal = String(d.travelRadiusKm || 25);
        const pauseVal = Boolean(d.pauseInvitations);
        const emergNameVal = d.emergencyContact?.name || '';
        const emergPhoneVal = d.emergencyContact?.phone || '';
        const emergRelVal = d.emergencyContact?.relation || 'Family';

        const emPref = d.notificationPreferences?.emergencyAlerts !== false;
        const campPref = d.notificationPreferences?.campReminders !== false;
        const elPref = d.notificationPreferences?.eligibilityAlerts !== false;

        setName(nameVal);
        setPhone(phoneVal);
        setAddress(addressVal);
        setCity(cityVal);
        setState(stateVal);
        setWeightKg(weightVal);
        setTravelRadiusKm(radiusVal);
        setPauseInvitations(pauseVal);
        setEmergName(emergNameVal);
        setEmergPhone(emergPhoneVal);
        setEmergRelation(emergRelVal);
        setEmergAlertsPref(emPref);
        setCampRemindersPref(campPref);
        setEligibilityAlertsPref(elPref);

        // Record initial baseline
        const baseline = JSON.stringify({
          name: nameVal,
          phone: phoneVal,
          address: addressVal,
          city: cityVal,
          state: stateVal,
          weightKg: weightVal,
          travelRadiusKm: radiusVal,
          pauseInvitations: pauseVal,
          emergName: emergNameVal,
          emergPhone: emergPhoneVal,
          emergRelation: emergRelVal,
          emergAlertsPref: emPref,
          campRemindersPref: campPref,
          eligibilityAlertsPref: elPref
        });
        setInitialBaseline(baseline);

        // Check if proof document already uploaded
        if (d.proofDocument) {
          setUploadedFile({
            name: d.proofDocument.fileName,
            size: d.proofDocument.fileSize,
            url: d.proofDocument.fileUrl,
            docId: d.proofDocument.docId
          });
          setUploadState('uploaded');
        }
      }
    };
    fetchProfile();
  }, [user]);

  // Compute dirty state
  const currentFormState = JSON.stringify({
    name,
    phone,
    address,
    city,
    state,
    weightKg,
    travelRadiusKm,
    pauseInvitations,
    emergName,
    emergPhone,
    emergRelation,
    emergAlertsPref,
    campRemindersPref,
    eligibilityAlertsPref
  });

  const isDirty = Boolean(initialBaseline && initialBaseline !== currentFormState);

  // Unsaved changes window listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your profile. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Calculate Profile Completeness using centralized evaluator
  const completeness = useMemo(() => {
    return evaluateProfileCompleteness({
      name,
      phone,
      address,
      city,
      state,
      weightKg,
      travelRadiusKm,
      emergencyContact: {
        name: emergName,
        phone: emergPhone,
        relation: emergRelation
      }
    });
  }, [name, phone, address, city, state, weightKg, travelRadiusKm, emergName, emergPhone, emergRelation]);

  const completenessScore = completeness.score;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || saving) return;

    setMsg(null);

    // Validation
    if (!name.trim()) {
      setMsg({ type: 'error', text: 'Full name is required.' });
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setMsg({ type: 'error', text: 'Please enter a valid contact phone number.' });
      return;
    }
    if (Number(weightKg) < 30 || Number(weightKg) > 200) {
      setMsg({ type: 'error', text: 'Please enter a valid body weight in kg (30-200).' });
      return;
    }

    setSaving(true);

    const res = await donorApi.updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      weightKg: Number(weightKg),
      travelRadiusKm: Number(travelRadiusKm),
      pauseInvitations,
      emergencyContact: {
        name: emergName.trim(),
        phone: emergPhone.trim(),
        relation: emergRelation
      },
      notificationPreferences: {
        emergencyAlerts: emergAlertsPref,
        campReminders: campRemindersPref,
        eligibilityAlerts: eligibilityAlertsPref
      }
    });

    setSaving(false);

    if (res.success) {
      setProfile(res.donor);
      setInitialBaseline(currentFormState); // Update saved baseline
      setMsg({ type: 'success', text: 'Donor profile and preferences saved successfully!' });
    } else {
      setMsg({ type: 'error', text: res.error || 'Failed to update profile.' });
    }
  };

  // Client and Server File Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side validation: Max 5MB (5,242,880 bytes)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds maximum limit of 5 MB.');
      setUploadState('error');
      return;
    }

    // Client-side validation: Extensions & MIME types
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedMime = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

    if (!allowedExtensions.includes(ext) && !allowedMime.includes(file.type)) {
      setUploadError('Invalid file format. Only PDF, PNG, and JPG files are accepted.');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');

    // Read as Base64 payload for reliable persistence
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const res = await donorApi.uploadProofDocument({
        fileName: file.name,
        fileType: file.type || 'application/pdf',
        fileSize: file.size,
        fileData: base64Data
      });

      if (res.success && res.document) {
        setUploadedFile({
          name: res.document.fileName,
          size: res.document.fileSize,
          url: res.document.fileUrl,
          docId: res.document.docId
        });
        setUploadState('uploaded');
      } else {
        setUploadError(res.error || 'Failed to upload document.');
        setUploadState('error');
      }
    };
    reader.onerror = () => {
      setUploadError('Error reading selected file.');
      setUploadState('error');
    };
    reader.readAsDataURL(file);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) {
      setVerifyMsg('Please select and upload a proof document before submitting.');
      return;
    }

    setVerifying(true);
    setVerifyMsg(null);

    const res = await donorApi.verifyBloodGroup({
      documentType: verifyDocType,
      documentNumber: verifyDocNumber,
      fileUrl: uploadedFile.url
    });

    setVerifying(false);

    if (res.success) {
      setVerifyMsg(res.message);
      setProfile((prev: any) => ({ ...prev, bloodGroupVerificationStatus: 'Pending Verification' }));
    } else {
      setVerifyMsg(res.error || 'Verification submission failed.');
    }
  };

  const verificationStatus = profile?.bloodGroupVerificationStatus || 'Verified';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Donor Profile & Preferences</h1>
          <p className="text-xs text-slate-500 mt-1">Manage your voluntary donor information, verification proof, and alert preferences.</p>
        </div>

        {/* Profile Completeness Gauge */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-xs flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold text-xs border border-rose-100 shrink-0">
            {completenessScore}%
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 gap-2">
              <span>Profile Completeness</span>
              <span className="text-[10px] text-slate-500 font-medium">{completeness.completedCount}/{completeness.totalFields} Fields</span>
            </div>
            <div 
              className="w-36 h-2 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200/80"
              role="progressbar"
              aria-valuenow={completenessScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completeness progress"
            >
              <div 
                className="h-full bg-rose-600 rounded-full transition-all duration-500" 
                style={{ width: `${completenessScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Missing Fields Checklist (Agrees with percentage gauge) */}
      {completenessScore < 100 && (
        <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">
              Checklist to Reach 100% Profile Completeness:
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {completeness.missingFields.length} field(s) remaining
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {completeness.missingFields.map((field) => (
              <span
                key={field.id}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-[11px] flex items-center space-x-1.5 shadow-2xs"
                title={field.hint}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                <span>{field.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Read-Only Account Identity Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-rose-600/30 shrink-0">
              {profile?.bloodGroup || 'O+'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-lg text-slate-900">{name || user?.name}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  verificationStatus === 'Verified' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : verificationStatus === 'Pending Verification'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {verificationStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email} • Donor ID: <strong className="text-slate-800 font-mono">{profile?.id || 'donor-1'}</strong></p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-xs text-slate-500 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <button
              type="button"
              onClick={async () => {
                const res = await donorApi.getDigitalPass();
                if (res.success && res.pass) {
                  setDigitalPassData(res.pass);
                  setShowDigitalPassModal(true);
                }
              }}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Digital Donor Pass</span>
            </button>
            <p className="text-[11px]">Gender: <strong className="text-slate-800">{profile?.gender || 'Male'}</strong> • DOB: <strong className="text-slate-800">{profile?.dob || '1995-08-12'}</strong></p>
          </div>
        </div>

        {/* Digital Donor Pass Modal */}
        <DigitalDonorPassModal
          isOpen={showDigitalPassModal}
          onClose={() => setShowDigitalPassModal(false)}
          passData={digitalPassData}
        />

        {/* Section 1: Personal & Physical Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-rose-600" />
            <h3 className="font-bold text-sm text-slate-900">Personal & Physical Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={name}
                placeholder="e.g. Alex Mercer"
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="text"
                value={phone}
                placeholder="e.g. +1 (555) 123-4500"
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Body Weight (kg) *</label>
              <input
                type="number"
                value={weightKg}
                placeholder="e.g. 70"
                onChange={(e) => setWeightKg(e.target.value)}
                required
                min="30"
                max="200"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Minimum 50 kg required for whole blood donation.</span>
            </div>
          </div>
        </div>

        {/* Section 2: Address & Travel Radius */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-rose-600" />
            <h3 className="font-bold text-sm text-slate-900">Location & Travel Radius Preferences</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={address}
                placeholder="e.g. 100 Maple Street"
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                placeholder="e.g. Metro City"
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State / Region</label>
              <input
                type="text"
                value={state}
                placeholder="e.g. NY"
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Travel Radius (km)</label>
              <input
                type="number"
                value={travelRadiusKm}
                placeholder="e.g. 25"
                onChange={(e) => setTravelRadiusKm(e.target.value)}
                min="1"
                max="100"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Maximum travel distance for emergency alerts.</span>
            </div>
          </div>
        </div>

        {/* Section 3: Blood Group Verification Workflow & Standard File Upload */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Blood Group Verification Evidence</h3>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
            <p>
              Current Status: <strong className="text-slate-900">{verificationStatus}</strong>
            </p>
            <p className="text-[11px] text-slate-500">
              Submit an official lab report, donor card, or medical certificate to verify your blood group with LifeLink partner blood centers.
            </p>
          </div>

          {verifyMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold">
              {verifyMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
              <select
                value={verifyDocType}
                onChange={(e) => setVerifyDocType(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
              >
                <option value="Lab Blood Report">Lab Blood Report</option>
                <option value="Government Donor Card">Government Donor Card</option>
                <option value="Hospital Medical Report">Hospital Medical Report</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Reg / Lab ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. LAB-8801"
                value={verifyDocNumber}
                onChange={(e) => setVerifyDocNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Standard HTML5 File Input Component with 4 Visible States */}
          <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50/60 space-y-3">
            <label className="block text-xs font-bold text-slate-900 mb-1">Upload Verification Proof Document *</label>

            {uploadState === 'ready' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-semibold">Accepted: PDF, PNG, JPG (Max 5 MB)</p>
              </div>
            )}

            {uploadState === 'uploading' && (
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center space-x-3 text-xs text-slate-700 font-semibold">
                <RefreshCw className="w-4 h-4 text-rose-600 animate-spin" />
                <span>Uploading document to server & validating file contents...</span>
              </div>
            )}

            {uploadState === 'uploaded' && uploadedFile && (
              <div className="p-4 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block truncate max-w-[220px]">{uploadedFile.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {Math.round(uploadedFile.size / 1024)} KB • Status: <strong className="text-emerald-600 font-bold">Uploaded</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={uploadedFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadState('ready');
                      setUploadedFile(null);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                </div>
              </div>
            )}

            {uploadState === 'error' && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-rose-800 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Upload Failed</span>
                </div>
                <p className="text-rose-700">{uploadError || 'File validation failed.'}</p>
                <div className="flex items-center space-x-3 pt-1">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-rose-600 file:text-white hover:file:bg-rose-700 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 font-semibold">Accepted: PDF, PNG, JPG (Max 5 MB)</p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleVerifySubmit}
                disabled={verifying || uploadState !== 'uploaded'}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{verifying ? 'Submitting Proof...' : 'Submit Proof Document for Verification'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Privacy & Notification Preferences */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Bell className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900">Notification Channels & Availability Privacy</h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded-xl">
              <input
                type="checkbox"
                checked={emergAlertsPref}
                onChange={(e) => setEmergAlertsPref(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <div>
                <span className="font-bold text-slate-900 block">Emergency Blood Deficit Alerts</span>
                <span className="text-[11px] text-slate-500">Receive high-urgency notifications for critical hospital shortages matching your blood group.</span>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded-xl">
              <input
                type="checkbox"
                checked={campRemindersPref}
                onChange={(e) => setCampRemindersPref(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <div>
                <span className="font-bold text-slate-900 block">Upcoming Blood Camp Reminders</span>
                <span className="text-[11px] text-slate-500">Get SMS & Email reminders for registered community donation drives.</span>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded-xl">
              <input
                type="checkbox"
                checked={pauseInvitations}
                onChange={(e) => setPauseInvitations(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="font-bold text-amber-900 block">Pause Routine Donation Invitations</span>
                <span className="text-[11px] text-slate-500">Temporarily pause non-emergency donation reminders while maintaining account active status.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 5: Emergency Contact Person */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Phone className="w-4 h-4 text-rose-600" />
            <h3 className="font-bold text-sm text-slate-900">Emergency Contact Person</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                value={emergName}
                placeholder="e.g. Jane Mercer"
                onChange={(e) => setEmergName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
              <input
                type="text"
                value={emergPhone}
                placeholder="e.g. +1 (555) 987-6500"
                onChange={(e) => setEmergPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
              <select
                value={emergRelation}
                onChange={(e) => setEmergRelation(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
              >
                <option value="Family">Family</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Friend">Friend</option>
                <option value="Colleague">Colleague</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Actions Bar with Compact Status & Single Save Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs font-semibold">
            {saving ? (
              <span className="text-rose-600 flex items-center space-x-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : isDirty ? (
              <span className="text-amber-600 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Unsaved changes</span>
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All changes saved</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!isDirty || saving}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};

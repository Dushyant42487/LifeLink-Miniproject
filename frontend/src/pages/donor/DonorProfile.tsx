import React, { useState, useEffect, useMemo } from 'react';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { DigitalDonorPassModal } from '../../components/common/DigitalDonorPassModal';
import { Save, CheckCircle2, AlertCircle, RefreshCw, User, Phone, MapPin, FileCheck, Bell, Upload, QrCode, ExternalLink, RefreshCcw, Navigation, Compass, MapPinOff, Globe, Building2, HelpCircle, ShieldAlert, Ban, ShieldCheck, Info, Check, ArrowRight, X, Clock } from 'lucide-react';
import { evaluateProfileCompleteness } from '../../utils/profileCompleteness';
import { LocationSearchInput, LocationSuggestion } from '../../components/common/LocationSearchInput';
import { OSMMap } from '../../components/common/OSMMap';
import { isValidCoordinate, parseCoordinates } from '../../utils/geo';

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
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [geoLocating, setGeoLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [weightKg, setWeightKg] = useState('70');
  const [travelRadiusKm, setTravelRadiusKm] = useState('25');
  const [pauseInvitations, setPauseInvitations] = useState(false);
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [emergRelation, setEmergRelation] = useState('Family');

  const [emergAlertsPref, setEmergAlertsPref] = useState(true);
  const [campRemindersPref, setCampRemindersPref] = useState(true);
  const [eligibilityAlertsPref, setEligibilityAlertsPref] = useState(true);

  // Form state machine: 'loading' | 'up_to_date' | 'unsaved_changes' | 'saving' | 'saved_successfully' | 'save_failed'
  const [formState, setFormState] = useState<'loading' | 'up_to_date' | 'unsaved_changes' | 'saving' | 'saved_successfully' | 'save_failed'>('loading');
  const [geocodingStatus, setGeocodingStatus] = useState<string | null>(null);

  // Eligible Blood Bank directory & routing selection
  interface EligibleBloodBank {
    id: string;
    name: string;
    city?: string;
    state?: string;
    address?: string;
    distanceKm?: number;
    phone?: string;
    email?: string;
    verificationStatus?: string;
    active?: boolean;
  }
  const [bloodBanks, setBloodBanks] = useState<EligibleBloodBank[]>([]);
  const [loadingBloodBanks, setLoadingBloodBanks] = useState(false);
  const [showAllBloodBanks, setShowAllBloodBanks] = useState(false);
  const [preferredBloodBankId, setPreferredBloodBankId] = useState<string>('');
  const [cancellingVerification, setCancellingVerification] = useState(false);

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

  const loadEligibleBloodBanks = async (lat?: number | null, lng?: number | null, rad?: string, all?: boolean) => {
    setLoadingBloodBanks(true);
    try {
      const params: any = {};
      if (isValidCoordinate(lat, lng)) {
        params.lat = Number(lat);
        params.lng = Number(lng);
      }
      if (!all && rad && rad !== 'all') {
        params.radius = rad;
      }
      const res = await donorApi.getEligibleBloodBanks(params);
      if (res.success && res.bloodBanks) {
        setBloodBanks(res.bloodBanks);
      }
    } catch (err) {
      console.error('Failed to load eligible blood banks:', err);
    } finally {
      setLoadingBloodBanks(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setFormState('loading');
      try {
        const res = await donorApi.getProfile();
        if (res.success && res.donor) {
          const d = res.donor;
          setProfile(d);
          const nameVal = d.name || user?.name || '';
          const phoneVal = d.phone || '';
          const addressVal = d.address || '';
          const cityVal = d.city || '';
          const stateVal = d.state || '';
          const postalCodeVal = d.postalCode || '';
          const latVal = (d.latitude !== undefined && d.latitude !== null && Number.isFinite(Number(d.latitude))) ? Number(d.latitude) : null;
          const lngVal = (d.longitude !== undefined && d.longitude !== null && Number.isFinite(Number(d.longitude))) ? Number(d.longitude) : null;
          const weightVal = String(d.weightKg || 70);
          const radiusVal = String(d.travelRadiusKm || 25);
          const pauseVal = Boolean(d.pauseInvitations);
          const emergNameVal = d.emergencyContact?.name || '';
          const emergPhoneVal = d.emergencyContact?.phone || '';
          const emergRelVal = d.emergencyContact?.relation || 'Family';

          const emPref = d.notificationPreferences?.emergencyAlerts !== false;
          const campPref = d.notificationPreferences?.campReminders !== false;
          const elPref = d.notificationPreferences?.eligibilityAlerts !== false;

          const pBankId = d.preferredBloodBankId || d.assignedBloodBankId || '';
          setPreferredBloodBankId(pBankId);

          setName(nameVal);
          setPhone(phoneVal);
          setAddress(addressVal);
          setCity(cityVal);
          setState(stateVal);
          setPostalCode(postalCodeVal);
          setLatitude(latVal);
          setLongitude(lngVal);
          setLatitudeStr(latVal !== null ? String(latVal) : '');
          setLongitudeStr(lngVal !== null ? String(lngVal) : '');

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
            postalCode: postalCodeVal,
            latitude: latVal,
            longitude: lngVal,
            weightKg: weightVal,
            travelRadiusKm: radiusVal,
            pauseInvitations: pauseVal,
            emergName: emergNameVal,
            emergPhone: emergPhoneVal,
            emergRelation: emergRelVal,
            emergAlertsPref: emPref,
            campRemindersPref: campPref,
            eligibilityAlertsPref: elPref,
            preferredBloodBankId: pBankId
          });
          setInitialBaseline(baseline);
          setFormState('up_to_date');

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

          // Fetch eligible blood banks prioritized by donor coordinates & radius
          await loadEligibleBloodBanks(latVal, lngVal, radiusVal, false);
        } else {
          setFormState('save_failed');
        }
      } catch {
        setFormState('save_failed');
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
    postalCode,
    latitude,
    longitude,
    weightKg,
    travelRadiusKm,
    pauseInvitations,
    emergName,
    emergPhone,
    emergRelation,
    emergAlertsPref,
    campRemindersPref,
    eligibilityAlertsPref,
    preferredBloodBankId
  });

  const isDirty = Boolean(initialBaseline && initialBaseline !== currentFormState);

  const isAddressDirty = useMemo(() => {
    if (!initialBaseline) return false;
    try {
      const base = JSON.parse(initialBaseline);
      return (
        base.address !== address ||
        base.city !== city ||
        base.state !== state ||
        base.postalCode !== postalCode
      );
    } catch {
      return false;
    }
  }, [initialBaseline, address, city, state, postalCode]);

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

  // Geolocation & Address Selection Handlers
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Please enter coordinates manually.');
      return;
    }
    setGeoLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setLatitudeStr(String(lat));
        setLongitudeStr(String(lng));
      },
      (err) => {
        setGeoLocating(false);
        let errorMsg = 'Unable to acquire location.';
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. You can manually enter your address and coordinates below.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = 'Location position is unavailable. Please enter coordinates manually.';
        } else if (err.code === err.TIMEOUT) {
          errorMsg = 'Location request timed out. Please try again or enter coordinates manually.';
        }
        setGeoError(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleGeocodeAddress = async () => {
    const parts = [address.trim(), city.trim(), state.trim(), postalCode.trim()].filter(Boolean);
    if (parts.length === 0) {
      setGeoError('Please enter at least an address or city to geocode.');
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    try {
      const q = parts.join(', ');
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`
      );
      const data = await geoRes.json();
      if (data && data.length > 0 && isValidCoordinate(data[0].lat, data[0].lon)) {
        const lat = Number(Number(data[0].lat).toFixed(6));
        const lng = Number(Number(data[0].lon).toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setLatitudeStr(String(lat));
        setLongitudeStr(String(lng));
        setMsg({ type: 'success', text: `Geocoded "${q}" to (${lat}, ${lng}). Remember to save changes.` });
      } else {
        setGeoError(`Unable to geocode "${q}". Please check the address or search in the location box.`);
      }
    } catch {
      setGeoError('Geocoding service unavailable. Please enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSelectLocationSuggestion = (item: LocationSuggestion) => {
    if (item.address) setAddress(item.address);
    if (item.city) setCity(item.city);
    if (item.state) setState(item.state);
    if (item.lat !== undefined && item.lng !== undefined && isValidCoordinate(item.lat, item.lng)) {
      const lat = Number(Number(item.lat).toFixed(6));
      const lng = Number(Number(item.lng).toFixed(6));
      setLatitude(lat);
      setLongitude(lng);
      setLatitudeStr(String(lat));
      setLongitudeStr(String(lng));
    }
  };

  const handleManualCoordChange = (newLatStr: string, newLngStr: string) => {
    setLatitudeStr(newLatStr);
    setLongitudeStr(newLngStr);
    if (newLatStr.trim() === '' && newLngStr.trim() === '') {
      setLatitude(null);
      setLongitude(null);
      return;
    }
    const numLat = Number(newLatStr);
    const numLng = Number(newLngStr);
    if (isValidCoordinate(numLat, numLng)) {
      setLatitude(numLat);
      setLongitude(numLng);
    }
  };

  const handleClearCoordinates = () => {
    setLatitude(null);
    setLongitude(null);
    setLatitudeStr('');
    setLongitudeStr('');
  };

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

    // Coordinates validation & fallback geocoding
    let finalLat: number | null = null;
    let finalLng: number | null = null;
    if (latitudeStr.trim() !== '' || longitudeStr.trim() !== '') {
      const parsed = parseCoordinates(latitudeStr.trim(), longitudeStr.trim());
      if (parsed.error) {
        setMsg({ type: 'error', text: parsed.error });
        return;
      }
      finalLat = parsed.lat!;
      finalLng = parsed.lng!;
    } else if (address.trim() || city.trim()) {
      // Auto-geocode fallback if coordinates are missing but address is provided
      try {
        const query = [address.trim(), city.trim(), state.trim(), postalCode.trim()].filter(Boolean).join(', ');
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0 && isValidCoordinate(geoData[0].lat, geoData[0].lon)) {
          finalLat = Number(Number(geoData[0].lat).toFixed(6));
          finalLng = Number(Number(geoData[0].lon).toFixed(6));
          setLatitude(finalLat);
          setLongitude(finalLng);
          setLatitudeStr(String(finalLat));
          setLongitudeStr(String(finalLng));
        }
      } catch (e) {
        // Continue saving text even if network geocoding failed
      }
    }

    setSaving(true);
    setFormState('saving');

    try {
      const res = await donorApi.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        latitude: finalLat,
        longitude: finalLng,
        weightKg: Number(weightKg),
        travelRadiusKm: Number(travelRadiusKm),
        pauseInvitations,
        preferredBloodBankId: preferredBloodBankId || undefined,
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
        const d = res.donor;
        setProfile(d);
        setGeocodingStatus(res.geocodingStatus || null);
        const latVal = (d?.latitude !== undefined && d?.latitude !== null) ? Number(d.latitude) : null;
        const lngVal = (d?.longitude !== undefined && d?.longitude !== null) ? Number(d.longitude) : null;
        setLatitude(latVal);
        setLongitude(lngVal);
        setLatitudeStr(latVal !== null ? String(latVal) : '');
        setLongitudeStr(lngVal !== null ? String(lngVal) : '');

        const pBankId = d.preferredBloodBankId || d.assignedBloodBankId || '';
        setPreferredBloodBankId(pBankId);

        const savedState = JSON.stringify({
          name: d.name || name.trim(),
          phone: d.phone || phone.trim(),
          address: d.address || address.trim(),
          city: d.city || city.trim(),
          state: d.state || state.trim(),
          postalCode: d.postalCode || postalCode.trim(),
          latitude: latVal,
          longitude: lngVal,
          weightKg: String(d.weightKg || weightKg),
          travelRadiusKm: String(d.travelRadiusKm || travelRadiusKm),
          pauseInvitations: Boolean(d.pauseInvitations),
          emergName: d.emergencyContact?.name || emergName.trim(),
          emergPhone: d.emergencyContact?.phone || emergPhone.trim(),
          emergRelation: d.emergencyContact?.relation || emergRelation,
          emergAlertsPref,
          campRemindersPref,
          eligibilityAlertsPref,
          preferredBloodBankId: pBankId
        });
        setInitialBaseline(savedState);
        setFormState('saved_successfully');
        setMsg({ type: 'success', text: 'Donor profile and location saved successfully!' });

        // Refresh eligible blood banks with latest coordinates
        loadEligibleBloodBanks(latVal, lngVal, String(d.travelRadiusKm || travelRadiusKm), showAllBloodBanks);

        // Reset to up_to_date after 4 seconds
        setTimeout(() => {
          setFormState((curr) => (curr === 'saved_successfully' ? 'up_to_date' : curr));
        }, 4000);
      } else {
        setFormState('save_failed');
        setMsg({ type: 'error', text: res.error || 'Failed to update profile.' });
      }
    } catch {
      setSaving(false);
      setFormState('save_failed');
      setMsg({ type: 'error', text: 'Connection failed while updating profile. Please retry.' });
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
      fileUrl: uploadedFile.url,
      preferredBloodBankId: preferredBloodBankId || undefined
    });

    setVerifying(false);

    if (res.success) {
      setVerifyMsg(res.message);
      setProfile((prev: any) => ({
        ...prev,
        bloodGroupVerificationStatus: 'Pending Verification',
        verificationStatus: 'Pending Verification',
        assignedBloodBankId: res.assignedBloodBankId || prev?.assignedBloodBankId,
        assignedBloodBankName: res.assignedBloodBankName || prev?.assignedBloodBankName
      }));
    } else {
      setVerifyMsg(res.error || 'Verification submission failed.');
    }
  };

  const handleCancelVerification = async () => {
    if (!window.confirm('Are you sure you want to cancel your active verification request? You can select another blood bank and submit updated proof anytime.')) {
      return;
    }
    setCancellingVerification(true);
    setVerifyMsg(null);
    try {
      const res = await donorApi.cancelVerification();
      if (res.success) {
        setProfile((prev: any) => ({
          ...prev,
          verificationStatus: 'Cancelled',
          bloodGroupVerificationStatus: 'Cancelled',
          assignedBloodBankId: null,
          assignedBloodBankName: null,
          preferredBloodBankId: null
        }));
        setPreferredBloodBankId('');
        setVerifyMsg('Verification request has been cancelled. You may choose a new blood bank and submit proof.');
      } else {
        setVerifyMsg(res.error || 'Failed to cancel verification request.');
      }
    } catch {
      setVerifyMsg('Network error while cancelling verification.');
    } finally {
      setCancellingVerification(false);
    }
  };

  const verificationStatus = profile?.bloodGroupVerificationStatus || profile?.verificationStatus || (user as any)?.bloodGroupVerificationStatus || user?.verificationStatus || 'Unverified';

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

        {/* Section 2: Address, Coordinates & Travel Radius */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-sm text-slate-900">Location & Nearby Hospital Settings</h3>
            </div>
            <div>
              {isValidCoordinate(latitude, longitude) ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Location Configured ({latitude}, {longitude})</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold inline-flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Location Not Configured</span>
                </span>
              )}
            </div>
          </div>

          {/* Missing Location Guidance Banner */}
          {!isValidCoordinate(latitude, longitude) && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
              <Compass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Add your location to discover nearby partner hospitals</p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  You can search an address below to auto-fill coordinates, click <strong>"Use My Current Location"</strong> with browser permission, or type your GPS coordinates manually.
                </p>
              </div>
            </div>
          )}

          {/* Address Modified / Stale Coordinates Notice */}
          {isAddressDirty && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2.5 shadow-2xs">
              <Compass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Address modified</p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Your address fields have changed. Coordinates will be automatically recalculated upon saving, or click <strong>"Geocode Address"</strong> below to preview.
                </p>
              </div>
            </div>
          )}

          {/* Geocoding Status Alert */}
          {geocodingStatus === 'failed' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Street address could not be resolved to GPS coordinates. Please refine your street address or choose from search suggestions.</span>
            </div>
          )}

          {/* Geolocation Feedback & Actions */}
          {geoError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{geoError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGeoError(null)}
                className="text-[11px] font-bold text-rose-600 hover:underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Search Autocomplete & Quick Geolocation Controls */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Search Address / Locality (Auto-fills location & coordinates)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
                  title="Geocode entered address using OpenStreetMap"
                >
                  <MapPin className={`w-3.5 h-3.5 text-rose-600 ${geocoding ? 'animate-spin' : ''}`} />
                  <span>{geocoding ? 'Geocoding...' : 'Geocode Address'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={geoLocating}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
                  title="Acquires your browser coordinates with explicit permission"
                >
                  <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
                  <span>{geoLocating ? 'Locating...' : 'Use My Current Location'}</span>
                </button>
                {isValidCoordinate(latitude, longitude) && (
                  <button
                    type="button"
                    onClick={handleClearCoordinates}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium hover:underline"
                  >
                    Clear Pin
                  </button>
                )}
              </div>
            </div>

            <LocationSearchInput
              placeholder="Search street, locality, landmark, or city..."
              onSelectLocation={handleSelectLocationSuggestion}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address / Locality</label>
              <input
                type="text"
                value={address}
                placeholder="e.g. 100 Maple Street"
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Postal / ZIP Code</label>
              <input
                type="text"
                value={postalCode}
                placeholder="e.g. 10001"
                onChange={(e) => setPostalCode(e.target.value)}
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
                max="200"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden placeholder:text-slate-400 placeholder:italic text-slate-900 font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Radius for hospital discovery & emergency alerts.</span>
            </div>
          </div>

          {/* Coordinate Inputs & Fallback */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-600" />
                <span>Geographic GPS Coordinates (Required for Distance Calculation)</span>
              </span>
              <span className="text-[10px] text-slate-500">Lat: -90 to 90 • Lng: -180 to 180</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                <input
                  type="text"
                  value={latitudeStr}
                  placeholder="e.g. 40.7128"
                  onChange={(e) => handleManualCoordChange(e.target.value, longitudeStr)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                <input
                  type="text"
                  value={longitudeStr}
                  placeholder="e.g. -74.0060"
                  onChange={(e) => handleManualCoordChange(latitudeStr, e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Map Preview when coordinates are present */}
            {isValidCoordinate(latitude, longitude) ? (
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                <OSMMap
                  markers={[{
                    id: 'saved-donor-location',
                    lat: latitude!,
                    lng: longitude!,
                    title: 'Your Donor Location',
                    address: address || 'Saved Location',
                    city: city || undefined,
                    type: 'user'
                  }]}
                  center={[latitude!, longitude!]}
                  zoom={13}
                  height="220px"
                />
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-2 text-center bg-white rounded-lg border border-dashed border-slate-200">
                Map preview will appear here once valid coordinates are selected or entered.
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Blood Group Verification Workflow & Standard File Upload */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Blood Group Verification Evidence</h3>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <p>
                Current Status: <strong className="text-slate-900">{verificationStatus}</strong>
              </p>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  verificationStatus === 'Verified'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : verificationStatus === 'Pending Verification'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : verificationStatus === 'Needs More Info'
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold'
                    : verificationStatus === 'Rejected'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {verificationStatus}
                </span>

                {(verificationStatus === 'Pending Verification' || verificationStatus === 'Needs More Info') && (
                  <button
                    type="button"
                    onClick={handleCancelVerification}
                    disabled={cancellingVerification}
                    className="px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 border border-rose-300 rounded cursor-pointer transition-colors disabled:opacity-50"
                    title="Cancel active verification request"
                  >
                    {cancellingVerification ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                )}
              </div>
            </div>

            {verificationStatus === 'Needs More Info' && (
              <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center space-x-1.5 font-bold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Action Required: Reviewer Requested Additional Documentation</span>
                </div>
                <p className="text-amber-900 font-medium">
                  {profile?.verificationNotes || 'The reviewing blood bank requested clearer documentation. Please review the notes and upload revised proof below.'}
                </p>
                {profile?.assignedBloodBankName && (
                  <p className="text-[11px] text-amber-800">
                    Reviewing Facility: <strong>{profile.assignedBloodBankName}</strong>
                  </p>
                )}
              </div>
            )}

            {verificationStatus === 'Pending Verification' && profile?.assignedBloodBankName && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Your verification proof is under clinical review at <strong>{profile.assignedBloodBankName}</strong>.
                  </span>
                </div>
              </div>
            )}

            {verificationStatus === 'Verified' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Confirmed Blood Group: <strong>{profile.bloodGroup}</strong> • Clinically verified {profile.verifiedAt ? `on ${new Date(profile.verifiedAt).toLocaleDateString()}` : ''} {profile.verifiedByName ? `by ${profile.verifiedByName}` : ''}.
                </span>
              </div>
            )}

            {profile?.rejectionReason && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                <strong>Rejection Reason:</strong> {profile.rejectionReason}. Please upload valid supporting documentation to re-apply.
              </div>
            )}

            {verificationStatus === 'Cancelled' && (
              <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs">
                Your previous verification request was cancelled. You may choose an authorized blood bank below and submit updated proof documents.
              </div>
            )}

            {/* Medical Eligibility vs Identity Verification Separation Notice */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Clinical Verification Policy:</strong> Blood group and donor identity verification confirms clinical documentation issued by certified laboratories.
                Physical medical eligibility (hemoglobin, weight, blood pressure, and donation intervals) is evaluated independently prior to every donation session.
              </p>
            </div>
          </div>

          {verifyMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold flex items-center justify-between">
              <span>{verifyMsg}</span>
              <button onClick={() => setVerifyMsg(null)} className="text-[11px] text-emerald-700 underline font-bold ml-2 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Reviewing Blood Bank (Authorized)</label>
                {loadingBloodBanks && <RefreshCw className="w-3 h-3 text-rose-600 animate-spin" />}
              </div>
              <select
                value={preferredBloodBankId}
                onChange={(e) => setPreferredBloodBankId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white font-medium"
              >
                <option value="">Auto-Assign (Nearest Authorized Blood Bank)</option>
                {bloodBanks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.distanceKm !== undefined ? ` • ${b.distanceKm} km away` : (b.city ? ` (${b.city})` : '')}
                  </option>
                ))}
              </select>
            </div>

            {bloodBanks.length === 0 && !loadingBloodBanks && (
              <div className="sm:col-span-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-amber-900 font-medium">
                  No verified blood centers found within your {travelRadiusKm} km radius.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAllBloodBanks(true);
                    loadEligibleBloodBanks(latitude, longitude, travelRadiusKm, true);
                  }}
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Show All Blood Banks
                </button>
              </div>
            )}
          </div>

          {/* Selected Blood Bank Preview Card */}
          {(() => {
            const selectedBank = bloodBanks.find(b => b.id === preferredBloodBankId);
            if (!selectedBank) return null;
            return (
              <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{selectedBank.name}</span>
                  {selectedBank.distanceKm !== undefined && (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                      {selectedBank.distanceKm} km away
                    </span>
                  )}
                </div>
                <p className="text-slate-600 text-[11px]">{selectedBank.address}{selectedBank.city ? `, ${selectedBank.city}` : ''}</p>
                {selectedBank.phone && (
                  <p className="text-slate-500 text-[11px]">Contact: {selectedBank.phone}</p>
                )}
              </div>
            );
          })()}

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

        {/* Form Actions Bar with Comprehensive State Machine */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold">
            {formState === 'loading' ? (
              <span className="text-slate-500 flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                <span>Loading donor profile data...</span>
              </span>
            ) : formState === 'saving' || saving ? (
              <span className="text-rose-600 font-bold flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving profile changes to database...</span>
              </span>
            ) : formState === 'saved_successfully' && !isDirty ? (
              <span className="text-emerald-700 font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saved successfully • Profile baseline synchronized</span>
              </span>
            ) : formState === 'save_failed' ? (
              <span className="text-rose-700 font-bold flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Save failed • Edits retained, please retry</span>
              </span>
            ) : isDirty ? (
              <span className="text-amber-700 font-bold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Unsaved changes • Ready to save</span>
              </span>
            ) : (
              <span className="text-slate-600 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Saved / Up to date • No unsaved changes</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="submit"
              disabled={!isDirty || saving || formState === 'saving'}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving || formState === 'saving' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

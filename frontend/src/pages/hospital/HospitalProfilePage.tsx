import React, { useState, useEffect } from 'react';
import { hospitalApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Building2, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  Phone, 
  ShieldCheck, 
  Navigation, 
  Globe, 
  Compass, 
  AlertTriangle 
} from 'lucide-react';
import { LocationSearchInput, LocationSuggestion } from '../../components/common/LocationSearchInput';
import { OSMMap } from '../../components/common/OSMMap';
import { isValidCoordinate, parseCoordinates } from '../../utils/geo';

export const HospitalProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Fields
  const [hospitalName, setHospitalName] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('Pending Verification');

  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Baseline for dirty-tracking
  const [initialBaseline, setInitialBaseline] = useState<string>('');

  useEffect(() => {
    fetchHospitalProfile();
  }, [user]);

  const fetchHospitalProfile = async () => {
    setLoading(true);
    try {
      const res = await hospitalApi.getProfile();
      if (res.success && res.hospital) {
        const h = res.hospital;
        setProfile(h);
        const nameVal = h.hospitalName || h.name || user?.name || '';
        const licVal = h.licenseId || '';
        const contactVal = h.contactPerson || '';
        const phoneVal = h.phone || '';
        const emPhoneVal = h.emergencyPhone || '';
        const addrVal = h.address || '';
        const cityVal = h.city || '';
        const stateVal = h.state || '';
        const postalVal = h.postalCode || '';
        const latVal = (h.latitude !== undefined && h.latitude !== null && Number.isFinite(Number(h.latitude))) ? Number(h.latitude) : null;
        const lngVal = (h.longitude !== undefined && h.longitude !== null && Number.isFinite(Number(h.longitude))) ? Number(h.longitude) : null;
        const statusVal = h.verificationStatus || 'Verified';

        setHospitalName(nameVal);
        setLicenseId(licVal);
        setContactPerson(contactVal);
        setPhone(phoneVal);
        setEmergencyPhone(emPhoneVal);
        setAddress(addrVal);
        setCity(cityVal);
        setState(stateVal);
        setPostalCode(postalVal);
        setLatitude(latVal);
        setLongitude(lngVal);
        setLatitudeStr(latVal !== null ? String(latVal) : '');
        setLongitudeStr(lngVal !== null ? String(lngVal) : '');
        setVerificationStatus(statusVal);

        const baseline = JSON.stringify({
          hospitalName: nameVal,
          contactPerson: contactVal,
          phone: phoneVal,
          emergencyPhone: emPhoneVal,
          address: addrVal,
          city: cityVal,
          state: stateVal,
          postalCode: postalVal,
          latitude: latVal,
          longitude: lngVal
        });
        setInitialBaseline(baseline);
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to load hospital profile.' });
    } finally {
      setLoading(false);
    }
  };

  const currentFormState = JSON.stringify({
    hospitalName,
    contactPerson,
    phone,
    emergencyPhone,
    address,
    city,
    state,
    postalCode,
    latitude,
    longitude
  });

  const isDirty = Boolean(initialBaseline && initialBaseline !== currentFormState);

  // Explicit user action for organization location using browser geolocation
  const handleUseCurrentLocationForHospital = () => {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setMsg(null);

    if (!hospitalName.trim()) {
      setMsg({ type: 'error', text: 'Hospital organization name is required.' });
      return;
    }
    if (!phone.trim()) {
      setMsg({ type: 'error', text: 'Contact phone number is required.' });
      return;
    }

    // Coordinates validation
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
    }

    setSaving(true);

    try {
      const res = await hospitalApi.updateProfile({
        hospitalName: hospitalName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        emergencyPhone: emergencyPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        latitude: finalLat,
        longitude: finalLng
      });

      setSaving(false);

      if (res.success && res.hospital) {
        const h = res.hospital;
        setProfile(h);
        const latVal = (h.latitude !== undefined && h.latitude !== null) ? Number(h.latitude) : null;
        const lngVal = (h.longitude !== undefined && h.longitude !== null) ? Number(h.longitude) : null;
        setLatitude(latVal);
        setLongitude(lngVal);
        setLatitudeStr(latVal !== null ? String(latVal) : '');
        setLongitudeStr(lngVal !== null ? String(lngVal) : '');

        const savedBaseline = JSON.stringify({
          hospitalName: h.hospitalName || hospitalName.trim(),
          contactPerson: h.contactPerson || contactPerson.trim(),
          phone: h.phone || phone.trim(),
          emergencyPhone: h.emergencyPhone || emergencyPhone.trim(),
          address: h.address || address.trim(),
          city: h.city || city.trim(),
          state: h.state || state.trim(),
          postalCode: h.postalCode || postalCode.trim(),
          latitude: latVal,
          longitude: lngVal
        });
        setInitialBaseline(savedBaseline);
        setMsg({ type: 'success', text: 'Hospital organization profile and location saved successfully!' });
      } else {
        setMsg({ type: 'error', text: res.error || 'Failed to update hospital profile.' });
      }
    } catch {
      setSaving(false);
      setMsg({ type: 'error', text: 'An unexpected network error occurred while updating profile.' });
    }
  };

  const isLocationConfigured = isValidCoordinate(latitude, longitude);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <Building2 className="w-6 h-6 text-rose-600" />
            <span>Hospital Profile & Organization Location</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure your hospital facility address and geographic coordinates for blood requisitions, logistics routing, and donor discovery.
          </p>
        </div>

        <div>
          {isLocationConfigured ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Location Configured ({latitude}, {longitude})</span>
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Location Not Configured</span>
            </span>
          )}
        </div>
      </div>

      {/* Advisory callout when location is missing */}
      {!isLocationConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-950">Hospital Coordinates Missing</h4>
            <p className="text-amber-800 leading-relaxed">
              Voluntary donors searching for nearby partner hospitals will not be able to find or measure distance to your hospital until valid coordinates are configured.
              Use the location search bar or enter latitude/longitude below to make your facility discoverable.
            </p>
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Hospital Entity Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-2xl border border-blue-100 shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-lg text-slate-900">{hospitalName || 'Hospital Organization'}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  verificationStatus === 'Verified' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {verificationStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                License / Registration ID: <strong className="text-slate-800 font-mono">{licenseId || profile?.id || 'HOSP-ORG'}</strong>
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 text-left sm:text-right">
            <p>Account Email: <strong className="text-slate-800">{user?.email}</strong></p>
            <p className="mt-0.5">Tenant Isolation: <strong className="text-slate-800 font-mono">{user?.id}</strong></p>
          </div>
        </div>

        {/* Section 1: Facility & Contact Information */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Hospital Facility & Contact Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital Organization Name *</label>
              <input
                type="text"
                value={hospitalName}
                placeholder="e.g. City General Hospital"
                onChange={(e) => setHospitalName(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                placeholder="e.g. Dr. Sarah Jenkins (Head of Transfusion)"
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Hospital Phone *</label>
              <input
                type="text"
                value={phone}
                placeholder="e.g. +1 (555) 234-5678"
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency / Blood Bank Hotline</label>
              <input
                type="text"
                value={emergencyPhone}
                placeholder="e.g. +1 (555) 911-BLOOD"
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Address, Coordinates & Map Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Hospital Facility Address & Geographic Location</h3>
            </div>
            <div>
              {isLocationConfigured ? (
                <span className="text-xs text-emerald-700 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>GPS Pins Active</span>
                </span>
              ) : (
                <span className="text-xs text-amber-700 font-bold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Missing Coordinates</span>
                </span>
              )}
            </div>
          </div>

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

          {/* Autocomplete and GPS helper */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Search Hospital Address or Landmark (Auto-fills location & coordinates)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForHospital}
                  disabled={geoLocating}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
                  title="Explicitly sets the hospital location to the authorized staff browser location"
                >
                  <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
                  <span>{geoLocating ? 'Acquiring GPS...' : 'Use Facility Location via GPS'}</span>
                </button>
                {isLocationConfigured && (
                  <button
                    type="button"
                    onClick={handleClearCoordinates}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-rose-600 font-medium hover:underline"
                  >
                    Clear Pin
                  </button>
                )}
              </div>
            </div>

            <LocationSearchInput
              placeholder="Search hospital name, campus street address, or city..."
              onSelectLocation={handleSelectLocationSuggestion}
            />
          </div>

          {/* Address Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Facility Street Address / Campus</label>
              <input
                type="text"
                value={address}
                placeholder="e.g. 500 Medical Center Blvd, Building B"
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Postal / ZIP Code</label>
              <input
                type="text"
                value={postalCode}
                placeholder="e.g. 10021"
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                placeholder="e.g. Metro City"
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">State / Province / Region</label>
              <input
                type="text"
                value={state}
                placeholder="e.g. NY"
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 font-semibold"
              />
            </div>
          </div>

          {/* Coordinates Box */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Geographic GPS Coordinates (Used for Donor Search & Dispatch Distance)</span>
              </span>
              <span className="text-[10px] text-slate-500">Lat: -90 to 90 • Lng: -180 to 180</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                <input
                  type="text"
                  value={latitudeStr}
                  placeholder="e.g. 40.7306"
                  onChange={(e) => handleManualCoordChange(e.target.value, longitudeStr)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                <input
                  type="text"
                  value={longitudeStr}
                  placeholder="e.g. -73.9352"
                  onChange={(e) => handleManualCoordChange(latitudeStr, e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Map Preview */}
            {isLocationConfigured ? (
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                <OSMMap
                  markers={[{
                    id: 'saved-hospital-location',
                    lat: latitude!,
                    lng: longitude!,
                    title: hospitalName || 'Hospital Organization',
                    address: address || 'Configured Location',
                    city: city || undefined,
                    type: 'hospital'
                  }]}
                  center={[latitude!, longitude!]}
                  zoom={14}
                  height="220px"
                />
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-3 text-center bg-white rounded-lg border border-dashed border-slate-200">
                Hospital location map preview will display here once valid coordinates are selected or entered.
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Organization Profile & Location'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

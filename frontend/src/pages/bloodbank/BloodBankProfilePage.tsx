import React, { useState, useEffect } from 'react';
import { bloodBankApi } from '../../services/api';
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

export const BloodBankProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Fields
  const [bloodBankName, setBloodBankName] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');
  const [serviceArea, setServiceArea] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('Verified');

  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Baseline for dirty-tracking
  const [initialBaseline, setInitialBaseline] = useState<string>('');

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await bloodBankApi.getProfile();
      if (res.success && res.profile) {
        const b = res.profile;
        setProfile(b);
        const nameVal = b.bloodBankName || b.name || user?.name || '';
        const regVal = b.registrationId || '';
        const contactVal = b.contactPerson || '';
        const phoneVal = b.phone || '';
        const emPhoneVal = b.emergencyPhone || '';
        const addrVal = b.address || '';
        const cityVal = b.city || '';
        const stateVal = b.state || '';
        const postalVal = b.postalCode || '';
        const countryVal = b.country || 'United States';
        const serviceVal = b.serviceArea || '';
        const latVal = (b.latitude !== undefined && b.latitude !== null && Number.isFinite(Number(b.latitude))) ? Number(b.latitude) : null;
        const lngVal = (b.longitude !== undefined && b.longitude !== null && Number.isFinite(Number(b.longitude))) ? Number(b.longitude) : null;
        const statusVal = b.verificationStatus || 'Verified';

        setBloodBankName(nameVal);
        setRegistrationId(regVal);
        setContactPerson(contactVal);
        setPhone(phoneVal);
        setEmergencyPhone(emPhoneVal);
        setAddress(addrVal);
        setCity(cityVal);
        setState(stateVal);
        setPostalCode(postalVal);
        setCountry(countryVal);
        setServiceArea(serviceVal);
        setLatitude(latVal);
        setLongitude(lngVal);
        setLatitudeStr(latVal !== null ? String(latVal) : '');
        setLongitudeStr(lngVal !== null ? String(lngVal) : '');
        setVerificationStatus(statusVal);

        const baseline = JSON.stringify({
          bloodBankName: nameVal,
          contactPerson: contactVal,
          phone: phoneVal,
          emergencyPhone: emPhoneVal,
          address: addrVal,
          city: cityVal,
          state: stateVal,
          postalCode: postalVal,
          country: countryVal,
          serviceArea: serviceVal,
          latitude: latVal,
          longitude: lngVal
        });
        setInitialBaseline(baseline);
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to load blood bank profile.' });
    } finally {
      setLoading(false);
    }
  };

  const currentFormState = JSON.stringify({
    bloodBankName,
    contactPerson,
    phone,
    emergencyPhone,
    address,
    city,
    state,
    postalCode,
    country,
    serviceArea,
    latitude,
    longitude
  });

  const isDirty = Boolean(initialBaseline && initialBaseline !== currentFormState);

  // Explicit user action for organization location using browser geolocation
  const handleUseCurrentLocationForFacility = () => {
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
        } else {
          errorMsg = 'Location request timed out. Please enter coordinates manually.';
        }
        setGeoError(errorMsg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    setAddress(suggestion.address);
    if (suggestion.city) setCity(suggestion.city);
    if (suggestion.state) setState(suggestion.state);
    if (suggestion.postalCode) setPostalCode(suggestion.postalCode);
    if (suggestion.lat && suggestion.lon) {
      const lat = Number(suggestion.lat.toFixed(6));
      const lng = Number(suggestion.lon.toFixed(6));
      setLatitude(lat);
      setLongitude(lng);
      setLatitudeStr(String(lat));
      setLongitudeStr(String(lng));
    }
  };

  const handleCoordinateChange = (latInput: string, lngInput: string) => {
    setLatitudeStr(latInput);
    setLongitudeStr(lngInput);

    if (!latInput.trim() && !lngInput.trim()) {
      setLatitude(null);
      setLongitude(null);
      return;
    }

    const parsed = parseCoordinates(latInput, lngInput);
    if (!parsed.error && parsed.lat !== undefined && parsed.lng !== undefined) {
      setLatitude(parsed.lat);
      setLongitude(parsed.lng);
    }
  };

  const handleMapMarkerDrag = (newLat: number, newLng: number) => {
    const lat = Number(newLat.toFixed(6));
    const lng = Number(newLng.toFixed(6));
    setLatitude(lat);
    setLongitude(lng);
    setLatitudeStr(String(lat));
    setLongitudeStr(String(lng));
  };

  const handleClearCoordinates = () => {
    setLatitude(null);
    setLongitude(null);
    setLatitudeStr('');
    setLongitudeStr('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!bloodBankName.trim()) {
      setMsg({ type: 'error', text: 'Blood bank facility name cannot be blank.' });
      return;
    }

    let parsedLat: number | null = null;
    let parsedLng: number | null = null;

    if (latitudeStr.trim() || longitudeStr.trim()) {
      const parsed = parseCoordinates(latitudeStr, longitudeStr);
      if (parsed.error) {
        setMsg({ type: 'error', text: parsed.error });
        return;
      }
      parsedLat = parsed.lat ?? null;
      parsedLng = parsed.lng ?? null;
    }

    setSaving(true);
    try {
      const res = await bloodBankApi.updateProfile({
        bloodBankName: bloodBankName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        emergencyPhone: emergencyPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        serviceArea: serviceArea.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        geocodingStatus: parsedLat !== null ? 'resolved' : 'failed'
      });

      if (res.success && res.profile) {
        setMsg({ type: 'success', text: 'Blood bank facility profile and verified coordinates updated successfully!' });
        const b = res.profile;
        setProfile(b);
        const baseline = JSON.stringify({
          bloodBankName: b.bloodBankName || b.name,
          contactPerson: b.contactPerson || '',
          phone: b.phone || '',
          emergencyPhone: b.emergencyPhone || '',
          address: b.address || '',
          city: b.city || '',
          state: b.state || '',
          postalCode: b.postalCode || '',
          country: b.country || 'United States',
          serviceArea: b.serviceArea || '',
          latitude: b.latitude ?? null,
          longitude: b.longitude ?? null
        });
        setInitialBaseline(baseline);
      } else {
        setMsg({ type: 'error', text: res.error || 'Failed to update organization profile.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Server connection error.' });
    } finally {
      setSaving(false);
    }
  };

  const hasValidCoords = latitude !== null && longitude !== null && isValidCoordinate(latitude, longitude);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-semibold text-sm">Loading blood center organization profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-blood-50 rounded-2xl flex items-center justify-center border border-blood-100 shadow-xs shrink-0">
            <Building2 className="w-7 h-7 text-blood-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {bloodBankName || 'Blood Bank Facility Profile'}
              </h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                verificationStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {verificationStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
              <span>License / Reg: <strong className="font-mono text-slate-700">{registrationId || 'BB-LIC-2024'}</strong></span>
              <span>•</span>
              <span>Role: <strong className="capitalize text-slate-700">{user?.role?.replace('_', ' ')}</strong></span>
            </p>
          </div>
        </div>

        {/* Location Status Pill */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className={`px-3 py-2 rounded-xl border flex items-center space-x-2 text-xs font-bold ${
            hasValidCoords
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {hasValidCoords ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>GPS Location Configured</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Location Coordinates Missing</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {msg && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs font-semibold ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Workspace Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Organization Details */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blood-600" />
              <span>Facility Registration & Contact</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Blood Bank Organization Name *
              </label>
              <input
                type="text"
                required
                value={bloodBankName}
                onChange={(e) => setBloodBankName(e.target.value)}
                placeholder="e.g. City Central Blood Center"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-blood-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  License / Registration Number
                </label>
                <input
                  type="text"
                  disabled
                  value={registrationId}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Designated Medical Officer / Contact
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Dr. Sarah Jenkins"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Direct Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1 text-rose-700">
                  <Phone className="w-3.5 h-3.5" />
                  <span>24/7 Emergency Line</span>
                </label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+1 (555) 999-1122"
                  className="w-full px-3 py-2 text-xs border border-rose-300 rounded-xl text-rose-950 font-bold focus:ring-rose-500 bg-rose-50/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Regional Service Area
              </label>
              <input
                type="text"
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                placeholder="e.g. Metro City Downtown & Medical District"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
              />
            </div>
          </div>

          {/* Postal Address */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-blood-600" />
              <span>Registered Physical Address</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Address Search & Geocoding
              </label>
              <LocationSearchInput
                placeholder="Search facility address or locality..."
                onSelect={handleSelectSuggestion}
                initialValue={address}
                className="w-full"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Selecting an address suggestion automatically updates postal details and coordinates.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City / Locality
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Metro City"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  State / Province
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. NY"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Postal / ZIP Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 10001"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United States"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Geographic Coordinates & Map Preview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <Compass className="w-4 h-4 text-blood-600" />
                <span>Geographic Position & Routing Coordinates</span>
              </h2>
              {hasValidCoords && (
                <button
                  type="button"
                  onClick={handleClearCoordinates}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800"
                >
                  Clear Coordinates
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Precise coordinates are required for hospitals to discover your blood center on regional inventory maps and for automated smart routing of emergency requisitions.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Latitude (-90 to +90)
                </label>
                <input
                  type="text"
                  value={latitudeStr}
                  onChange={(e) => handleCoordinateChange(e.target.value, longitudeStr)}
                  placeholder="e.g. 40.7128"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-blood-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Longitude (-180 to +180)
                </label>
                <input
                  type="text"
                  value={longitudeStr}
                  onChange={(e) => handleCoordinateChange(latitudeStr, e.target.value)}
                  placeholder="e.g. -74.0060"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-blood-500"
                />
              </div>
            </div>

            {/* Quick Geolocation Trigger */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleUseCurrentLocationForFacility}
                disabled={geoLocating}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                <Navigation className={`w-3.5 h-3.5 text-blood-600 ${geoLocating ? 'animate-spin' : ''}`} />
                <span>{geoLocating ? 'Acquiring GPS...' : 'Use Facility Browser GPS'}</span>
              </button>

              <span className="text-[11px] text-slate-400 text-center sm:text-right">
                {hasValidCoords ? '✓ Coordinates verified' : 'No coordinates configured'}
              </span>
            </div>

            {geoError && (
              <p className="text-xs text-rose-600 font-medium">{geoError}</p>
            )}

            {/* Interactive OpenStreetMap preview */}
            <div className="rounded-xl overflow-hidden border border-slate-200 h-[280px]">
              {hasValidCoords ? (
                <OSMMap
                  center={[latitude!, longitude!]}
                  zoom={14}
                  markers={[
                    {
                      id: 'facility-marker',
                      lat: latitude!,
                      lng: longitude!,
                      title: bloodBankName || 'Blood Bank Location',
                      draggable: true,
                      onDragEnd: handleMapMarkerDrag
                    }
                  ]}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
                  <Globe className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">Map Marker Preview Inactive</p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Enter valid latitude and longitude or search your physical address to render your facility on the interactive logistics map.
                  </p>
                </div>
              )}
            </div>
            {hasValidCoords && (
              <span className="text-[10px] text-slate-400 block text-center">
                Tip: You can drag the red map pin to fine-tune your blood center's dispatch gate or reception position.
              </span>
            )}
          </div>

          {/* Sticky Save Actions */}
          <div className="flex items-center justify-end space-x-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={fetchProfile}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Reset Changes
            </button>
            <button
              type="submit"
              disabled={saving || !isDirty}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer ${
                isDirty 
                  ? 'bg-blood-600 hover:bg-blood-700 text-white shadow-blood-600/30' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Organization Location'}</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

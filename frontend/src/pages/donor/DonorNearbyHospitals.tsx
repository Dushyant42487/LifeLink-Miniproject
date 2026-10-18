import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { NearbyHospital } from '../../types';
import { OSMMap, MapMarker } from '../../components/common/OSMMap';
import { LocationSearchInput, LocationSuggestion } from '../../components/common/LocationSearchInput';
import { isValidCoordinate } from '../../utils/geo';
import { 
  Building2, 
  MapPin, 
  Navigation, 
  Phone, 
  Compass, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  X,
  Edit3,
  Save
} from 'lucide-react';

export const DonorNearbyHospitals: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  // Three explicit location modes:
  // - 'saved': Uses donor's persisted profile coordinates (never asks GPS)
  // - 'search': User searches another city/address without modifying profile
  // - 'gps': Browser geolocation with explicit button press
  const [locationMode, setLocationMode] = useState<'saved' | 'search' | 'gps'>('saved');

  // Resolved coordinates per mode
  const [savedLocation, setSavedLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const [radius, setRadius] = useState<string>('50');
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline Location Editor Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalAddress, setModalAddress] = useState('');
  const [modalCity, setModalCity] = useState('');
  const [modalState, setModalState] = useState('');
  const [modalPostalCode, setModalPostalCode] = useState('');
  const [modalLat, setModalLat] = useState<number | null>(null);
  const [modalLng, setModalLng] = useState<number | null>(null);
  const [modalGeocoding, setModalGeocoding] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const openLocationModal = () => {
    if (profile) {
      setModalAddress(profile.address || '');
      setModalCity(profile.city || '');
      setModalState(profile.state || '');
      setModalPostalCode(profile.postalCode || '');
      const validCoords = isValidCoordinate(profile.latitude, profile.longitude);
      setModalLat(validCoords ? Number(profile.latitude) : null);
      setModalLng(validCoords ? Number(profile.longitude) : null);
    }
    setModalError(null);
    setIsLocationModalOpen(true);
  };

  const handleModalSuggestion = (s: LocationSuggestion) => {
    if (s.address) setModalAddress(s.address);
    if (s.city) setModalCity(s.city);
    if (s.state) setModalState(s.state);
    if (s.lat !== undefined && s.lng !== undefined && isValidCoordinate(s.lat, s.lng)) {
      setModalLat(Number(Number(s.lat).toFixed(6)));
      setModalLng(Number(Number(s.lng).toFixed(6)));
    }
  };

  const handleModalGeocode = async () => {
    const parts = [modalAddress.trim(), modalCity.trim(), modalState.trim(), modalPostalCode.trim()].filter(Boolean);
    if (parts.length === 0) {
      setModalError('Please enter at least an address or city to geocode.');
      return;
    }
    setModalGeocoding(true);
    setModalError(null);
    try {
      const q = parts.join(', ');
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await geoRes.json();
      if (data && data.length > 0 && isValidCoordinate(data[0].lat, data[0].lon)) {
        setModalLat(Number(Number(data[0].lat).toFixed(6)));
        setModalLng(Number(Number(data[0].lon).toFixed(6)));
      } else {
        setModalError(`Unable to geocode "${q}". You can save anyway and the server will attempt resolution.`);
      }
    } catch {
      setModalError('Geocoding service unavailable. You can save anyway.');
    } finally {
      setModalGeocoding(false);
    }
  };

  const handleSaveModalLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAddress.trim() && !modalCity.trim()) {
      setModalError('Please provide an address or city.');
      return;
    }

    setSavingLocation(true);
    setModalError(null);
    try {
      const res = await donorApi.updateProfile({
        address: modalAddress.trim(),
        city: modalCity.trim(),
        state: modalState.trim(),
        postalCode: modalPostalCode.trim(),
        latitude: modalLat,
        longitude: modalLng
      });

      if (res.success && res.donor) {
        const d = res.donor;
        setProfile(d);
        if (isValidCoordinate(d.latitude, d.longitude)) {
          const loc = {
            lat: Number(d.latitude),
            lng: Number(d.longitude),
            label: [d.address, d.city, d.state].filter(Boolean).join(', ') || 'Saved Profile Location'
          };
          setSavedLocation(loc);
          setLocationMode('saved');
          setIsLocationModalOpen(false);
          setSuccessToast('Saved location updated and applied to discovery search!');
          setTimeout(() => setSuccessToast(null), 4000);

          await fetchHospitals({
            lat: loc.lat,
            lng: loc.lng,
            radius
          });
        } else {
          setModalError('Address saved, but valid coordinates could not be resolved. Please use the search box above to choose an exact location pin.');
        }
      } else {
        setModalError(res.error || 'Failed to update location.');
      }
    } catch {
      setModalError('Connection failed. Please check network and retry.');
    } finally {
      setSavingLocation(false);
    }
  };

  useEffect(() => {
    initDonorDiscovery();
  }, [user]);

  const initDonorDiscovery = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const pRes = await donorApi.getProfile();
      if (pRes.success && pRes.donor) {
        const d = pRes.donor;
        setProfile(d);
        if (d.travelRadiusKm) {
          setRadius(String(d.travelRadiusKm));
        }

        if (isValidCoordinate(d.latitude, d.longitude)) {
          const loc = {
            lat: Number(d.latitude),
            lng: Number(d.longitude),
            label: [d.address, d.city, d.state].filter(Boolean).join(', ') || 'Saved Profile Location'
          };
          setSavedLocation(loc);
          setLocationMode('saved');
          await fetchHospitals({
            lat: loc.lat,
            lng: loc.lng,
            radius: String(d.travelRadiusKm || '50')
          });
        } else {
          setSavedLocation(null);
          setLocationMode('saved');
          setHospitals([]);
        }
      } else {
        setSavedLocation(null);
      }
    } catch {
      setErrorMsg('Failed to initialize nearby hospital search.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitals = async (params: { lat?: number; lng?: number; radius?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await donorApi.getNearbyHospitals(params);
      if (res.success) {
        setHospitals(res.hospitals || []);
        if (res.hospitals && res.hospitals.length > 0) {
          setSelectedHospitalId(res.hospitals[0].id);
        } else {
          setSelectedHospitalId(null);
        }
      } else {
        setErrorMsg(res.error || 'Unable to fetch nearby hospitals.');
      }
    } catch {
      setErrorMsg('Failed to connect to LifeLink server.');
    } finally {
      setLoading(false);
    }
  };

  // Mode 1: Saved Profile Location (No GPS prompt, functions even if GPS permission was denied)
  const handleSelectSavedMode = async () => {
    setLocationMode('saved');
    setGeoError(null);
    if (savedLocation) {
      await fetchHospitals({
        lat: savedLocation.lat,
        lng: savedLocation.lng,
        radius
      });
    } else {
      setHospitals([]);
    }
  };

  // Mode 2: Search Another Location (Does not alter profile or GPS state)
  const handleSelectCustomLocation = async (suggestion: LocationSuggestion) => {
    if (suggestion.lat && suggestion.lng) {
      const loc = {
        lat: suggestion.lat,
        lng: suggestion.lng,
        label: suggestion.address || suggestion.name || `${suggestion.city || 'Custom Location'}`
      };
      setSearchLocation(loc);
      setLocationMode('search');
      setGeoError(null);
      await fetchHospitals({
        lat: loc.lat,
        lng: loc.lng,
        radius
      });
    }
  };

  // Mode 3: Use Current Location (Explicit GPS button click only)
  const handleSelectGpsMode = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const loc = {
          lat,
          lng,
          label: 'Current GPS Coordinates'
        };
        setGpsLocation(loc);
        setLocationMode('gps');
        await fetchHospitals({ lat, lng, radius });
      },
      (err) => {
        setGeoLocating(false);
        let msg = 'Unable to determine GPS location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Browser GPS permission was denied. You can continue using your Saved Profile Location or Search Another Location without GPS.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location position unavailable. Please check your device location settings.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again or search manually.';
        }
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRadiusChange = async (newRadius: string) => {
    setRadius(newRadius);
    const active = getActiveCoordinates();
    if (active) {
      await fetchHospitals({
        lat: active.lat,
        lng: active.lng,
        radius: newRadius
      });
    }
  };

  // Resolve current active coordinates & display label
  const getActiveCoordinates = () => {
    if (locationMode === 'saved') return savedLocation;
    if (locationMode === 'search') return searchLocation;
    if (locationMode === 'gps') return gpsLocation;
    return null;
  };

  const activeCoord = getActiveCoordinates();
  const activeLat = activeCoord?.lat;
  const activeLng = activeCoord?.lng;
  const hasActiveCoords = activeCoord !== null && isValidCoordinate(activeLat, activeLng);

  // Build map markers
  const mapMarkers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [];

    // Donor radar marker
    if (hasActiveCoords) {
      const modeLabel = 
        locationMode === 'saved' ? 'Saved Profile Location' :
        locationMode === 'search' ? `Searched: ${searchLocation?.label || 'Custom Search'}` :
        'Current GPS Location';

      list.push({
        id: 'donor-marker',
        lat: Number(activeLat),
        lng: Number(activeLng),
        title: 'Search Origin Point',
        address: `${modeLabel} (${activeCoord?.label || ''})`,
        type: 'user'
      });
    }

    // Hospital shield markers
    hospitals.forEach(h => {
      if (isValidCoordinate(h.latitude, h.longitude)) {
        list.push({
          id: h.id,
          lat: Number(h.latitude),
          lng: Number(h.longitude),
          title: h.name || h.hospitalName,
          address: `${h.address || ''} (${h.distanceKm} km away)`,
          city: h.city,
          type: 'hospital',
          onMarkerClick: () => setSelectedHospitalId(h.id)
        });
      }
    });

    return list;
  }, [hasActiveCoords, activeLat, activeLng, hospitals, locationMode, activeCoord, searchLocation]);

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
          <Building2 className="w-6 h-6 text-rose-600" />
          <span>Nearby Partner Hospitals</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Discover verified healthcare institutions and blood transfusion centers near your location, ordered by real-world geographic distance.
        </p>
      </div>

      {/* Location Origin Controls: 3 Explicit Modes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold text-slate-800">Select Search Location Mode</span>
          </div>

          {/* 3 Explicit Location Mode Switchers */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {/* Mode 1: Saved Profile Location */}
            <button
              onClick={handleSelectSavedMode}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                locationMode === 'saved'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              <span>Saved Profile Location</span>
            </button>

            {/* Mode 2: Search Another Location */}
            <button
              onClick={() => setLocationMode('search')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                locationMode === 'search'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Search Another Location</span>
            </button>

            {/* Mode 3: Use Current Location (GPS) */}
            <button
              onClick={handleSelectGpsMode}
              disabled={geoLocating}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 ${
                locationMode === 'gps'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Explicit browser GPS geolocation request"
            >
              <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
              <span>{geoLocating ? 'Acquiring GPS...' : 'Use Current Location'}</span>
            </button>
          </div>
        </div>

        {/* Mode-specific Sub-controls */}
        {locationMode === 'search' && (
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
            <label className="block text-xs font-bold text-blue-950">
              Enter City, Locality, Postal Code, or Hospital Name:
            </label>
            <div className="max-w-xl">
              <LocationSearchInput
                placeholder="Search an address or city without altering your saved profile..."
                onSelectLocation={handleSelectCustomLocation}
              />
            </div>
            {searchLocation && (
              <p className="text-[11px] text-blue-800">
                Active custom search: <strong>{searchLocation.label}</strong> ({searchLocation.lat.toFixed(4)}, {searchLocation.lng.toFixed(4)})
              </p>
            )}
          </div>
        )}

        {/* Active Origin Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-semibold">Active Origin:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
              locationMode === 'saved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : locationMode === 'search'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>
              {locationMode === 'saved' ? 'Saved Profile' : locationMode === 'search' ? 'Searched Location' : 'Current GPS'}
            </span>
            <span className="text-slate-900 font-bold truncate max-w-sm">
              {activeCoord?.label || (locationMode === 'saved' ? 'No saved location' : 'Pending selection')}
            </span>
            {hasActiveCoords ? (
              <span className="text-slate-400 font-mono text-[11px]">
                ({activeLat?.toFixed(4)}, {activeLng?.toFixed(4)})
              </span>
            ) : (
              <span className="text-amber-600 font-semibold text-[11px]">
                (Coordinates unavailable)
              </span>
            )}
            {locationMode === 'saved' && (
              <button
                type="button"
                onClick={openLocationModal}
                className="px-2 py-0.5 rounded-md text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer flex items-center space-x-1 transition-colors"
                title="Edit saved profile location"
              >
                <Edit3 className="w-3 h-3" />
                <span>{savedLocation ? 'Edit Saved Location' : 'Set Saved Location'}</span>
              </button>
            )}
          </div>

          {/* Radius Filter Pills */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Radius:</span>
            </span>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              {[
                { label: '10 km', val: '10' },
                { label: '25 km', val: '25' },
                { label: '50 km', val: '50' },
                { label: '100 km', val: '100' },
                { label: 'All', val: 'all' }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => handleRadiusChange(opt.val)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    radius === opt.val
                      ? 'bg-white text-rose-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Geolocation Error Alert */}
      {geoError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{geoError}</span>
          </div>
          <button
            onClick={() => setGeoError(null)}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Missing Location Callout when active mode has no coordinates */}
      {!hasActiveCoords && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-amber-950">
                {locationMode === 'saved' ? 'Saved Profile Location Not Configured' : 'Location Not Selected'}
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {locationMode === 'saved'
                  ? 'Your profile does not have saved coordinates yet. Configure your location inline below or in My Profile, or choose "Search Another Location" or "Use Current Location" above.'
                  : 'Please search for a city, address, or locality in the search bar above to calculate distances to nearby hospitals.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={openLocationModal}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Configure Saved Location in My Profile</span>
            </button>

            <button
              onClick={() => setLocationMode('search')}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-amber-700" />
              <span>Search Another Location Instead</span>
            </button>

            <Link
              to="/donor/profile"
              className="text-xs text-amber-900 hover:text-slate-900 font-semibold underline px-2 py-1"
            >
              Go to Full Profile Page
            </Link>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
          <span className="ml-2 text-xs font-semibold text-slate-600">Calculating distance to partner hospitals...</span>
        </div>
      )}

      {/* Main Content: Split List and Map */}
      {!loading && hasActiveCoords && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Hospitals List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700">
                {hospitals.length} Hospital{hospitals.length !== 1 ? 's' : ''} in Range
              </span>
              <span className="text-[11px] text-slate-400">Sorted nearest first</span>
            </div>

            {hospitals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Building2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">No Hospitals Found Nearby</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  No verified partner hospitals with saved coordinates were found within {radius === 'all' ? 'any' : `${radius} km`} of your current search location.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => handleRadiusChange('all')}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Expand Search Radius (Show All Hospitals)
                  </button>
                  <Link
                    to="/donor/profile"
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    Update saved profile location
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {hospitals.map(h => {
                  const isSelected = h.id === selectedHospitalId;
                  const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${activeLat},${activeLng};${h.latitude},${h.longitude}`;
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${activeLat},${activeLng}&destination=${h.latitude},${h.longitude}`;

                  return (
                    <div
                      key={h.id}
                      onClick={() => setSelectedHospitalId(h.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h3 className="font-bold text-sm text-slate-900">{h.name || h.hospitalName}</h3>
                            {h.verificationStatus === 'Verified' && (
                              <span title="Verified Hospital Partner">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{h.address}{h.city ? `, ${h.city}` : ''}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 shrink-0">
                          {h.distanceKm} km
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        {h.phone && (
                          <div className="flex items-center space-x-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{h.phone}</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-2 text-[11px] font-bold">
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline flex items-center space-x-1"
                          >
                            <span>Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-slate-300">|</span>
                          <a
                            href={osmDirectionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-emerald-600 hover:underline flex items-center space-x-1"
                          >
                            <span>OpenStreetMap</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive OSM Map (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center space-x-1.5">
                <Compass className="w-4 h-4 text-rose-600" />
                <span>Geographic Map View</span>
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                Bullseye: You • Shield: Hospitals
              </span>
            </div>

            <div className="w-full">
              <OSMMap
                markers={mapMarkers}
                center={
                  selectedHospital?.latitude && selectedHospital?.longitude
                    ? [selectedHospital.latitude, selectedHospital.longitude]
                    : hasActiveCoords
                    ? [Number(activeLat), Number(activeLng)]
                    : [40.7128, -74.0060]
                }
                zoom={12}
                height="580px"
                selectedMarkerId={selectedHospitalId || undefined}
              />
            </div>
          </div>

        </div>
      )}

      {/* Hospital Coordinate Configuration Notice */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 flex items-start space-x-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong>Data Integrity & Privacy Guarantee:</strong> LifeLink only returns active, persisted hospital organizations with calibrated GPS coordinates.
          Distances are calculated in real time using the Haversine formula based on actual geographic coordinates.
          Your private donor location is never shared with other donors or third-party advertisers.
        </p>
      </div>

      {/* Inline Location Configuration Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Configure Saved Profile Location</h3>
                  <p className="text-[11px] text-slate-500">Save your primary donor location to automatically discover nearby hospitals</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModalLocation} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Fast Autocomplete Search */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Search Address / Locality
                </label>
                <LocationSearchInput
                  placeholder="Type an address or city to auto-fill..."
                  onSelectLocation={handleModalSuggestion}
                />
                <p className="text-[11px] text-slate-400">Selecting a suggestion auto-fills address and coordinates below.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={modalAddress}
                    onChange={(e) => setModalAddress(e.target.value)}
                    placeholder="e.g. 100 Maple St"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={modalCity}
                    onChange={(e) => setModalCity(e.target.value)}
                    placeholder="e.g. New York"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">State / Province</label>
                  <input
                    type="text"
                    value={modalState}
                    onChange={(e) => setModalState(e.target.value)}
                    placeholder="e.g. NY"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Postal / ZIP Code</label>
                  <input
                    type="text"
                    value={modalPostalCode}
                    onChange={(e) => setModalPostalCode(e.target.value)}
                    placeholder="e.g. 10001"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Coordinates Preview</label>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-mono px-2 py-1 bg-slate-100 rounded-md text-slate-700 flex-1 truncate">
                      {isValidCoordinate(modalLat, modalLng) ? `${modalLat?.toFixed(4)}, ${modalLng?.toFixed(4)}` : 'Not pinned yet'}
                    </span>
                    <button
                      type="button"
                      onClick={handleModalGeocode}
                      disabled={modalGeocoding}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer transition-colors disabled:opacity-50"
                      title="Geocode address"
                    >
                      {modalGeocoding ? '...' : 'Geocode'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <Link
                  to="/donor/profile"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  Manage Full Profile
                </Link>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingLocation}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingLocation ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving & Resolving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save & Discover Hospitals</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

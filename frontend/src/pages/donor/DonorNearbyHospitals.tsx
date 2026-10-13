import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { NearbyHospital } from '../../types';
import { OSMMap, MapMarker } from '../../components/common/OSMMap';
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
  AlertTriangle
} from 'lucide-react';

export const DonorNearbyHospitals: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  // Location mode: 'profile' (saved location) vs 'current' (browser GPS)
  const [locationSource, setLocationSource] = useState<'profile' | 'current'>('profile');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [donorLocationMissing, setDonorLocationMissing] = useState(false);
  const [radius, setRadius] = useState<string>('50');

  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
          setLocationSource('profile');
          setDonorLocationMissing(false);
          await fetchHospitals({
            lat: Number(d.latitude),
            lng: Number(d.longitude),
            radius: String(d.travelRadiusKm || '50')
          });
        } else {
          setDonorLocationMissing(true);
          setHospitals([]);
        }
      } else {
        setDonorLocationMissing(true);
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
        if (res.donorLocationMissing) {
          setDonorLocationMissing(true);
          setHospitals([]);
        } else {
          setDonorLocationMissing(false);
          setHospitals(res.hospitals || []);
          if (res.hospitals && res.hospitals.length > 0) {
            setSelectedHospitalId(res.hospitals[0].id);
          }
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

  const handleUseCurrentLocation = () => {
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
        setCurrentCoords({ lat, lng });
        setLocationSource('current');
        setDonorLocationMissing(false);
        await fetchHospitals({ lat, lng, radius });
      },
      (err) => {
        setGeoLocating(false);
        let msg = 'Unable to determine GPS location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Browser location permission denied. You can save your location in My Profile or configure manual coordinates.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location position unavailable. Please check your device location settings.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleUseSavedProfile = async () => {
    if (!isValidCoordinate(profile?.latitude, profile?.longitude)) {
      setDonorLocationMissing(true);
      return;
    }
    setLocationSource('profile');
    setCurrentCoords(null);
    await fetchHospitals({
      lat: Number(profile.latitude),
      lng: Number(profile.longitude),
      radius
    });
  };

  const handleRadiusChange = async (newRadius: string) => {
    setRadius(newRadius);
    const activeLat = locationSource === 'current' ? currentCoords?.lat : profile?.latitude;
    const activeLng = locationSource === 'current' ? currentCoords?.lng : profile?.longitude;
    if (isValidCoordinate(activeLat, activeLng)) {
      await fetchHospitals({
        lat: Number(activeLat),
        lng: Number(activeLng),
        radius: newRadius
      });
    }
  };

  // Active coordinates for map centering and bullseye marker
  const activeLat = locationSource === 'current' ? currentCoords?.lat : profile?.latitude;
  const activeLng = locationSource === 'current' ? currentCoords?.lng : profile?.longitude;
  const hasActiveCoords = isValidCoordinate(activeLat, activeLng);

  // Build map markers
  const mapMarkers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [];

    // Donor radar marker
    if (hasActiveCoords) {
      list.push({
        id: 'donor-marker',
        lat: Number(activeLat),
        lng: Number(activeLng),
        title: 'Your Donor Location',
        address: locationSource === 'current' ? 'Current GPS Location' : (profile?.address || 'Saved Profile Location'),
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
  }, [hasActiveCoords, activeLat, activeLng, hospitals, locationSource, profile]);

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <Building2 className="w-6 h-6 text-rose-600" />
            <span>Nearby Partner Hospitals</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Discover verified healthcare institutions and blood transfusion centers near your location, ordered by geographic distance.
          </p>
        </div>

        {/* Location Origin Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isValidCoordinate(profile?.latitude, profile?.longitude) && (
            <button
              onClick={handleUseSavedProfile}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center space-x-1.5 cursor-pointer ${
                locationSource === 'profile'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Saved Profile Location</span>
            </button>
          )}

          <button
            onClick={handleUseCurrentLocation}
            disabled={geoLocating}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${
              locationSource === 'current'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Locate via browser GPS with explicit user permission"
          >
            <Navigation className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
            <span>{geoLocating ? 'Locating...' : 'Use Current Location'}</span>
          </button>
        </div>
      </div>

      {/* Geolocation Error Alert */}
      {geoError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{geoError}</span>
          </div>
          <button
            onClick={() => setGeoError(null)}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-2"
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

      {/* Missing Location Callout */}
      {donorLocationMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-amber-950">Donor Location Not Configured</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                LifeLink calculates real-world distance from your saved home/work coordinates or current GPS position to partner hospitals.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/donor/profile"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <MapPin className="w-4 h-4" />
              <span>Configure Saved Location in My Profile</span>
            </Link>

            <button
              onClick={handleUseCurrentLocation}
              disabled={geoLocating}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5"
            >
              <Navigation className="w-4 h-4 text-amber-700" />
              <span>{geoLocating ? 'Acquiring GPS...' : 'Use My Current Location Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Discovery Active Controls Bar */}
      {!donorLocationMissing && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-700">
            <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Searching from:{' '}
              <strong className="text-slate-900 font-bold">
                {locationSource === 'current' ? 'Current GPS Location' : (profile?.city ? `${profile.city}, ${profile.state}` : 'Saved Profile Location')}
              </strong>{' '}
              <span className="text-slate-400 font-mono text-[11px]">
                ({activeLat?.toFixed(4)}, {activeLng?.toFixed(4)})
              </span>
            </span>
          </div>

          {/* Radius Filter Pills */}
          <div className="flex items-center space-x-2">
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
                  className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
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
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
          <span className="ml-2 text-xs font-semibold text-slate-600">Calculating distance to partner hospitals...</span>
        </div>
      )}

      {/* Main Content: Split List and Map */}
      {!loading && !donorLocationMissing && (
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
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="Verified Hospital Partner" />
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
    </div>
  );
};

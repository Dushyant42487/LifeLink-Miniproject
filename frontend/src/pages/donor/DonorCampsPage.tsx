import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { OSMMap, MapMarker } from '../../components/common/OSMMap';
import { LocationSearchInput, LocationSuggestion } from '../../components/common/LocationSearchInput';
import { 
  Compass, 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  Building2, 
  FileText, 
  Send, 
  RefreshCw, 
  XCircle, 
  ShieldCheck, 
  Map,
  List,
  Columns,
  Navigation,
  Crosshair
} from 'lucide-react';
import { CampRequest, OrganizationType, DonationCamp } from '../../types';
import { generateGoogleCalendarUrl, downloadIcsCalendarFile } from '../../utils/calendar';

const calculateHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

export const DonorCampsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Read URL query parameter for tab selection (?tab=request or ?tab=my-requests)
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') === 'request' 
    ? 'request' 
    : searchParams.get('tab') === 'my-requests' 
    ? 'my-requests' 
    : 'camps';

  const [activeTab, setActiveTab] = useState<'camps' | 'request' | 'my-requests'>(initialTab as any);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'split'>('split');

  // Camps list state
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [loadingCamps, setLoadingCamps] = useState(false);
  const [registeredCampIds, setRegisteredCampIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [actionCampId, setActionCampId] = useState<string | null>(null);
  const [selectedMapMarkerId, setSelectedMapMarkerId] = useState<string | undefined>(undefined);
  const [eligibility, setEligibility] = useState<any>(null);
  const requestedDonationType = searchParams.get('type');

  useEffect(() => {
    donorApi.getEligibility().then((res: any) => {
      if (res.success && res.eligibility) setEligibility(res.eligibility);
    });
  }, []);

  // User Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [maxRadiusKm, setMaxRadiusKm] = useState<string>('all');

  // Enforce Saved Profile Location as primary priority
  useEffect(() => {
    if ((user as any)?.latitude && (user as any)?.longitude && !userLocation) {
      setUserLocation({
        lat: Number((user as any).latitude),
        lng: Number((user as any).longitude)
      });
      setLocationMsg(`Sorted by your saved profile location (${(user as any).city || 'Home City'}).`);
    } else if ((user as any)?.city && selectedCity === 'all') {
      setSelectedCity((user as any).city);
    }
  }, [user]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocationMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setLocating(false);
        setLocationMsg('Location updated! Distance calculated from your coordinates.');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationMsg('Location permission denied. Please enable browser location permissions.');
        } else if (err.code === err.TIMEOUT) {
          setLocationMsg('Location request timed out. Please try again.');
        } else {
          setLocationMsg('Unable to determine location coordinates.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Organization Camp Request Form state
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('Company/Office');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgRegId, setOrgRegId] = useState('');

  const [organizerName, setOrganizerName] = useState(user?.name || '');
  const [organizerEmail, setOrganizerEmail] = useState(user?.email || '');
  const [organizerPhone, setOrganizerPhone] = useState(user?.phone || '');
  const [organizerRole, setOrganizerRole] = useState('');

  const [proposedDate, setProposedDate] = useState('');
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [city, setCity] = useState(user?.city || '');
  const [postalCode, setPostalCode] = useState('');
  const [estimatedParticipants, setEstimatedParticipants] = useState('');
  const [expectedDonations, setExpectedDonations] = useState('');
  const [availableFacilities, setAvailableFacilities] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<CampRequest | null>(null);

  // My Camp Requests List
  const [myRequests, setMyRequests] = useState<CampRequest[]>([]);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<CampRequest | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCamps();
    fetchMyRegistrations();
    fetchMyRequests();
  }, []);

  const fetchCamps = async () => {
    setLoadingCamps(true);
    const res = await donorApi.getPublicCamps(selectedCity, search);
    if (res.success && res.camps) {
      setCamps(res.camps);
    }
    setLoadingCamps(false);
  };

  const fetchMyRegistrations = async () => {
    const res = await donorApi.getMyCampRegistrations();
    if (res.success && res.registrations) {
      setRegisteredCampIds(res.registrations.map((r: any) => r.campId));
    }
  };

  const fetchMyRequests = async () => {
    const res = await donorApi.getCampRequests();
    if (res.success && res.requests) {
      setMyRequests(res.requests);
    }
  };

  useEffect(() => {
    fetchCamps();
  }, [selectedCity, search]);

  const handleRegisterCamp = async (campId: string, campTitle: string) => {
    setActionCampId(campId);
    setRegisterError(null);
    setRegisterSuccess(null);

    const res = await donorApi.registerForCamp(campId);
    if (res.success) {
      setRegisterSuccess(res.message || `Successfully registered for ${campTitle}`);
      setRegisteredCampIds(prev => [...prev, campId]);
      setCamps(prev => prev.map(c => c.id === campId ? { ...c, registeredCount: (c.registeredCount || 0) + 1 } : c));
    } else {
      setRegisterError(res.error || 'Failed to register for camp');
    }
    setActionCampId(null);
  };

  const handleCancelRegistration = async (campId: string) => {
    setActionCampId(campId);
    setRegisterError(null);

    const res = await donorApi.cancelCampRegistration(campId);
    if (res.success) {
      setRegisteredCampIds(prev => prev.filter(id => id !== campId));
      setCamps(prev => prev.map(c => c.id === campId ? { ...c, registeredCount: Math.max(0, (c.registeredCount || 1) - 1) } : c));
    } else {
      setRegisterError(res.error || 'Failed to cancel registration');
    }
    setActionCampId(null);
  };

  const handleOrgFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!isAuthorized || !agreedTerms) {
      setSubmitError('You must confirm authorization and agree to coordination terms.');
      return;
    }

    setSubmitting(true);

    const payload = {
      organizationName: orgName,
      organizationType: orgType,
      organizationWebsite: orgWebsite,
      organizationRegistrationId: orgRegId,
      organizerName,
      organizerEmail,
      organizerPhone,
      organizerRole,
      proposedDate,
      preferredTimeSlot,
      venueAddress,
      city,
      postalCode,
      estimatedParticipants: Number(estimatedParticipants) || 50,
      expectedDonations: expectedDonations ? Number(expectedDonations) : undefined,
      availableFacilities,
      additionalNotes,
      isAuthorizedRepresentative: isAuthorized,
      agreedToTerms: agreedTerms
    };

    const res = await donorApi.createCampRequest(payload);
    setSubmitting(false);

    if (res.success && res.request) {
      setSubmitSuccess(res.request);
      setMyRequests(prev => [res.request, ...prev]);
    } else {
      setSubmitError(res.error || 'Submission failed. Please check required fields.');
    }
  };

  const handleCancelRequest = async (id: string) => {
    setCancellingId(id);
    const res = await donorApi.cancelCampRequest(id);
    if (res.success) {
      setMyRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Cancelled', statusNote: 'Cancelled by requester.' } : r));
    }
    setCancellingId(null);
  };

  const filteredCamps = camps
    .map(camp => {
      const hasValidCoords = typeof camp.latitude === 'number' && typeof camp.longitude === 'number' && !isNaN(camp.latitude) && !isNaN(camp.longitude);
      let distanceKm: number | null = null;
      if (userLocation && hasValidCoords) {
        distanceKm = calculateHaversineDistanceKm(userLocation.lat, userLocation.lng, camp.latitude!, camp.longitude!);
      }
      return { ...camp, hasValidCoords, distanceKm };
    })
    .filter(camp => {
      const matchesSearch = !search || 
        camp.title?.toLowerCase().includes(search.toLowerCase()) ||
        camp.location?.toLowerCase().includes(search.toLowerCase()) ||
        camp.organizer?.toLowerCase().includes(search.toLowerCase());

      const matchesCity = selectedCity === 'all' || camp.city?.toLowerCase() === selectedCity.toLowerCase();
      
      let matchesRadius = true;
      if (maxRadiusKm !== 'all' && camp.distanceKm !== null) {
        matchesRadius = camp.distanceKm <= Number(maxRadiusKm);
      }

      return matchesSearch && matchesCity && matchesRadius;
    })
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });

  // Convert filtered camps with valid coordinates to Map Markers (no fake coordinate fallbacks)
  const mapMarkers: MapMarker[] = filteredCamps
    .filter(camp => camp.hasValidCoords && typeof camp.latitude === 'number' && typeof camp.longitude === 'number')
    .map(camp => ({
      id: camp.id,
      lat: camp.latitude!,
      lng: camp.longitude!,
      title: camp.title,
      address: `${camp.location} (${camp.address})${camp.distanceKm !== null ? ` • ${camp.distanceKm} km away` : ''}`,
      city: camp.city,
      type: 'camp',
      isUrgent: camp.isUrgent,
      onMarkerClick: () => setSelectedMapMarkerId(camp.id)
    }));

  if (userLocation) {
    mapMarkers.unshift({
      id: 'user-location-pin',
      lat: userLocation.lat,
      lng: userLocation.lng,
      title: '📍 Your Current Location',
      address: 'Consented Device Coordinates',
      type: 'user'
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
              Community Blood Mobilization
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Verified Drives</span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Blood Donation Camps & Org Requests
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Discover accredited upcoming blood drives near you, register to donate, or request a blood camp for your organization.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('request')}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 flex items-center space-x-2 shrink-0 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Building2 className="w-4 h-4" />
          <span>Request Camp for Org</span>
        </button>
      </div>

      {/* 3 Main View Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('camps')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === 'camps'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Upcoming Blood Camps</span>
        </button>

        <button
          onClick={() => setActiveTab('request')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === 'request'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-rose-600" />
          <span>Request Camp for Organization</span>
        </button>

        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
            activeTab === 'my-requests'
              ? 'border-rose-600 text-rose-600 font-extrabold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span>My Camp Requests ({myRequests.length})</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: UPCOMING BLOOD CAMPS WITH OPENSTREETMAP                       */}
      {/* ==================================================================== */}
      {activeTab === 'camps' && (
        <div className="space-y-6">
          
          {registerSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{registerSuccess}</span>
              </div>
              <button onClick={() => setRegisterSuccess(null)} className="text-emerald-600 font-bold hover:underline">Dismiss</button>
            </div>
          )}

          {registerError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{registerError}</span>
              </div>
              <button onClick={() => setRegisterError(null)} className="text-rose-600 font-bold hover:underline">Dismiss</button>
            </div>
          )}

          {locationMsg && (
            <div className="bg-slate-900 text-white rounded-2xl p-3 px-4 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>{locationMsg}</span>
              </div>
              <button onClick={() => setLocationMsg(null)} className="text-slate-400 hover:text-white font-bold text-xs">Dismiss</button>
            </div>
          )}

          {/* Filter & Search Bar with View Switcher */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
            
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto flex-1">
              <div className="flex-1 min-w-[240px]">
                <LocationSearchInput
                  placeholder="Search city, locality, hospital, or camp..."
                  value={search}
                  onSelectLocation={(suggestion: LocationSuggestion) => {
                    setSearch(suggestion.name);
                    if (suggestion.lat && suggestion.lng) {
                      setUserLocation({ lat: suggestion.lat, lng: suggestion.lng });
                      setLocationMsg(`Map centered near ${suggestion.name}`);
                    }
                  }}
                  onClear={() => setSearch('')}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                >
                  <option value="all">All Cities</option>
                  <option value="Metro City">Metro City</option>
                  <option value="Downtown Metro">Downtown Metro</option>
                  <option value="Sangli">Sangli (Dev Fixture)</option>
                  <option value="Miraj">Miraj (Dev Fixture)</option>
                </select>

                {userLocation && (
                  <select
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-emerald-50 text-emerald-900 border-emerald-300 font-bold focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="all">Any Radius</option>
                    <option value="5">Within 5 km</option>
                    <option value="10">Within 10 km</option>
                    <option value="25">Within 25 km</option>
                    <option value="50">Within 50 km</option>
                  </select>
                )}
              </div>

              {/* Geolocation Button */}
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locating}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                  userLocation 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Request device location to sort camps by proximity"
              >
                <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin text-rose-600' : userLocation ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span>{locating ? 'Locating...' : userLocation ? 'Location Active' : 'Use My Location'}</span>
              </button>
            </div>

            {/* View Switcher: List / Split / Map */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-end sm:self-center">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>

              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'split' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>

              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'map' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Map View</span>
              </button>
            </div>

          </div>

          {/* Eligibility-Aware Requested Donation Mode Banner */}
          {requestedDonationType === 'platelets' && (
            <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-4 text-xs text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 text-sm">🩸</span>
                <div>
                  <p className="font-extrabold text-purple-900">Booking Mode: Platelet Apheresis Donation</p>
                  <p className="text-[11px] text-purple-700">
                    Showing community donation camps. While Whole Blood cool-off is active, you are verified eligible for Platelets under the 14-day policy.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState(null, '', window.location.pathname);
                  window.location.reload();
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-purple-800 font-bold hover:bg-purple-100/50 transition-colors shrink-0 text-xs cursor-pointer"
              >
                Show All Camps
              </button>
            </div>
          )}

          {/* Interactive OpenStreetMap Container */}
          {(viewMode === 'map' || viewMode === 'split') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                <span className="font-bold flex items-center space-x-1">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  <span>Interactive Camp Locations Map (OpenStreetMap)</span>
                </span>
                <span className="text-slate-400">Click pins to view camp venue & details</span>
              </div>
              <OSMMap 
                markers={mapMarkers} 
                height={viewMode === 'map' ? '500px' : '320px'} 
                selectedMarkerId={selectedMapMarkerId}
              />
            </div>
          )}

          {/* Camps Cards Grid (Shown in List or Split View) */}
          {(viewMode === 'list' || viewMode === 'split') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingCamps ? (
                <div className="col-span-full py-12 text-center text-slate-400">Loading nearby blood donation camps...</div>
              ) : filteredCamps.length === 0 ? (
                <div className="col-span-full bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
                  <Compass className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-900 text-base">No blood camps found</p>
                  <p className="text-xs text-slate-500">Try adjusting your search query or location filter.</p>
                </div>
              ) : (
                filteredCamps.map((camp) => {
                  const isRegistered = registeredCampIds.includes(camp.id);
                  const isFull = (camp.registeredCount || 0) >= (camp.targetUnits || 100);
                  const isActioning = actionCampId === camp.id;

                  return (
                    <div
                      key={camp.id}
                      onClick={() => setSelectedMapMarkerId(camp.id)}
                      className={`bg-white rounded-2xl border transition-all flex flex-col justify-between space-y-4 p-6 shadow-xs ${
                        selectedMapMarkerId === camp.id ? 'ring-2 ring-rose-500 border-rose-300' : 'border-slate-200 hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            camp.isUrgent ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {camp.isUrgent ? 'Urgent Mobilization' : 'Upcoming Camp'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{camp.id}</span>
                        </div>

                        <h3 className="font-extrabold text-base text-slate-900 leading-snug">{camp.title}</h3>
                        <p className="text-xs text-slate-500">Organized by <strong className="text-slate-700">{camp.organizer}</strong></p>

                        <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
                            <span><strong>{camp.startDate}</strong> {camp.endDate && camp.endDate !== camp.startDate ? ` to ${camp.endDate}` : ''}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{camp.timeSlot}</span>
                          </div>
                          <div className="flex items-start space-x-2">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span>
                              {camp.location} ({camp.address}), {camp.city}
                              {camp.distanceKm !== null ? (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-extrabold text-[10px] border border-emerald-200">
                                  ~{camp.distanceKm} km away
                                </span>
                              ) : !camp.hasValidCoords ? (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium text-[10px] border border-slate-200">
                                  Map pin unconfigured
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-purple-600 shrink-0" />
                            <span><strong>{camp.registeredCount || 0}</strong> / {camp.targetUnits} Donors Registered</span>
                          </div>
                        </div>

                        {/* Description & Target Blood Groups */}
                        <p className="text-xs text-slate-600 line-clamp-2">{camp.description}</p>
                        
                        {camp.targetBloodGroups && camp.targetBloodGroups.length > 0 && (
                          <div className="pt-1 flex items-center space-x-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Priority Groups:</span>
                            {camp.targetBloodGroups.map(bg => (
                              <span key={bg} className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                {bg}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Whole Blood Deferral / Apheresis Suitability Notice */}
                        {(() => {
                          const isBeforeWbDate = Boolean(
                            eligibility?.wholeBlood?.nextEligibleDate &&
                            camp.startDate &&
                            new Date(camp.startDate) < new Date(eligibility.wholeBlood.nextEligibleDate) &&
                            !eligibility?.wholeBlood?.isEligible
                          );
                          if (isBeforeWbDate) {
                            return (
                              <div className="pt-1">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                  <span>⚠️ Whole Blood Cool-off active until {eligibility.wholeBlood.nextEligibleDate}. Platelet Apheresis eligible.</span>
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
                          <span>Phone: {camp.contactPhone}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Calendar Export Actions for Active Camps */}
                          {camp.status !== 'Cancelled' && (
                            <div className="flex items-center space-x-1.5">
                              <a
                                href={generateGoogleCalendarUrl(camp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                                title="Add event to your Google Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                <span>Google Cal</span>
                              </a>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadIcsCalendarFile(camp);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                                title="Download .ics calendar file"
                              >
                                <span>.iCS</span>
                              </button>
                            </div>
                          )}

                          {isRegistered ? (
                            <div className="flex items-center space-x-2">
                              <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Registered</span>
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelRegistration(camp.id); }}
                                disabled={isActioning}
                                className="px-2.5 py-1.5 text-xs text-rose-600 hover:underline font-semibold"
                              >
                                {isActioning ? '...' : 'Cancel'}
                              </button>
                            </div>
                          ) : isFull ? (
                            <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100">
                              Capacity Full
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRegisterCamp(camp.id, camp.title); }}
                              disabled={isActioning}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isActioning ? 'Registering...' : 'Register to Donate'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: REQUEST CAMP FOR ORGANIZATION                                 */}
      {/* ==================================================================== */}
      {activeTab === 'request' && (
        <div className="space-y-6">
          
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 text-xs text-slate-700 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-rose-900 text-sm">
              <Building2 className="w-5 h-5 text-rose-600" />
              <span>Organization & Society Blood Donation Drive Request</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              This form is for authorized representatives of companies, colleges, universities, residential societies, or community organizations seeking to host an accredited voluntary blood drive. LifeLink coordinates medical team dispatch, blood bank logistics, and donor verification.
            </p>
          </div>

          {submitSuccess ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center space-y-4 max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h2 className="text-2xl font-extrabold text-slate-900">Request Submitted Successfully!</h2>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 space-y-2 text-left">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Request Reference Code:</span>
                  <span className="font-mono font-extrabold text-rose-600 text-sm">{submitSuccess.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Organization Name:</span>
                  <span className="font-bold text-slate-900">{submitSuccess.organizationName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proposed Date:</span>
                  <span className="font-bold text-slate-900">{submitSuccess.proposedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Venue Address:</span>
                  <span className="font-bold text-slate-900">{submitSuccess.venueAddress}, {submitSuccess.city}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center space-x-3">
                <button
                  onClick={() => { setSubmitSuccess(null); setActiveTab('my-requests'); }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md"
                >
                  Track Request Status
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleOrgFormSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
              
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Section 1: Organization Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Building2 className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-base text-slate-900">1. Organization Details</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Society Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., Tech Corp Inc. / Green Valley Society"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Type *</label>
                    <select
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value as OrganizationType)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white font-medium text-slate-800"
                    >
                      <option value="College/University">College / University</option>
                      <option value="Company/Office">Company / Corporate Office</option>
                      <option value="Residential Society">Residential Society / Apartment Complex</option>
                      <option value="NGO/Community Organization">NGO / Community Organization</option>
                      <option value="Other">Other Community Group</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Website (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://example.org"
                      value={orgWebsite}
                      onChange={(e) => setOrgWebsite(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Registration / Identification Details (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., REG-2024-9902"
                      value={orgRegId}
                      onChange={(e) => setOrgRegId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Organizer Contact Person */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Users className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-base text-slate-900">2. Designated Organizer Information</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Organizer Full Name *</label>
                    <input
                      type="text"
                      value={organizerName}
                      onChange={(e) => setOrganizerName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Role in Organization</label>
                    <input
                      type="text"
                      placeholder="e.g., HR Manager / NSS Student Lead"
                      value={organizerRole}
                      onChange={(e) => setOrganizerRole(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email Address *</label>
                    <input
                      type="email"
                      value={organizerEmail}
                      onChange={(e) => setOrganizerEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone Number *</label>
                    <input
                      type="text"
                      value={organizerPhone}
                      onChange={(e) => setOrganizerPhone(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Proposed Camp Logistics */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Calendar className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-base text-slate-900">3. Proposed Camp Date & Venue Logistics</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Proposed Date *</label>
                    <input
                      type="date"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Time Slot</label>
                    <select
                      value={preferredTimeSlot}
                      onChange={(e) => setPreferredTimeSlot(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white font-medium text-slate-800"
                    >
                      <option value="09:00 AM - 04:00 PM">09:00 AM - 04:00 PM (Full Day)</option>
                      <option value="09:00 AM - 01:00 PM">09:00 AM - 01:00 PM (Morning Slot)</option>
                      <option value="01:00 PM - 05:00 PM">01:00 PM - 05:00 PM (Afternoon Slot)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Potential Donors *</label>
                    <input
                      type="number"
                      placeholder="e.g., 50"
                      value={estimatedParticipants}
                      onChange={(e) => setEstimatedParticipants(e.target.value)}
                      required
                      min="10"
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Venue Address *</label>
                    <input
                      type="text"
                      placeholder="e.g., Auditorium Hall, Block B, Gate 2"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      placeholder="e.g., Metro City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Available Venue Facilities & Logistics</label>
                    <textarea
                      placeholder="Specify available facilities (e.g. Air-conditioned hall, power sockets, tables/chairs, elevator access)..."
                      value={availableFacilities}
                      onChange={(e) => setAvailableFacilities(e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Authorization & Consent */}
              <div className="space-y-3 pt-4 border-t border-slate-100 bg-slate-50/80 rounded-2xl p-5 border border-slate-200">
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="authCheck"
                    checked={isAuthorized}
                    onChange={(e) => setIsAuthorized(e.target.checked)}
                    required
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="authCheck" className="text-xs text-slate-700 leading-snug cursor-pointer">
                    <strong className="text-slate-900">Authorization Confirmation:</strong> I confirm that I am an authorized representative submitting this blood camp request on behalf of the designated organization/community. *
                  </label>
                </div>

                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="termsCheck"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    required
                    className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="termsCheck" className="text-xs text-slate-700 leading-snug cursor-pointer">
                    <strong className="text-slate-900">Coordination Agreement:</strong> I agree to be contacted by LifeLink regional blood coordination officers for venue inspection. Submission does not guarantee final booking until medical team availability is confirmed. *
                  </label>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-3 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02]"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{submitting ? 'Submitting Request...' : 'Submit Organization Camp Request'}</span>
                </button>
              </div>

            </form>
          )}

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MY SUBMITTED CAMP REQUESTS                                    */}
      {/* ==================================================================== */}
      {activeTab === 'my-requests' && (
        <div className="space-y-6">
          
          <div className="flex justify-between items-center bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Organization Camp Requests History</h3>
              <p className="text-xs text-slate-500">Track status updates and review feedback from regional blood coordination staff.</p>
            </div>
            
            <button
              onClick={fetchMyRequests}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </button>
          </div>

          {myRequests.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900">No Organization Camp Requests Submitted Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                You haven't requested any organizational blood donation drives. Want to host a drive for your company, university, or residential society?
              </p>
              <button
                onClick={() => setActiveTab('request')}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Submit Organization Camp Request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myRequests.map((req) => {
                const isCancellable = req.status === 'Submitted' || req.status === 'Under Review';
                return (
                  <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          req.status === 'Approved' || req.status === 'Scheduled'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : req.status === 'Submitted' || req.status === 'Under Review'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : req.status === 'Cancelled'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {req.status}
                        </span>
                        <span className="text-xs font-mono text-slate-500">{req.id}</span>
                      </div>

                      <h4 className="font-extrabold text-base text-slate-900">{req.organizationName}</h4>
                      <p className="text-xs text-slate-500">{req.organizationType} • Requested by <strong className="text-slate-800">{req.organizerName}</strong> ({req.organizerRole})</p>

                      <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Proposed Date: <strong>{req.proposedDate}</strong> ({req.preferredTimeSlot})</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span>{req.venueAddress}, {req.city}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Estimated Participants: <strong>{req.estimatedParticipants} donors</strong></span>
                        </div>
                      </div>

                      {req.statusNote && (
                        <div className="p-3 rounded-xl bg-slate-50 text-[11px] text-slate-600 border border-slate-200">
                          <span className="font-bold text-slate-900 block mb-0.5">Coordination Note:</span>
                          <p>{req.statusNote}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">Submitted: {new Date(req.createdAt).toLocaleDateString()}</span>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedRequestDetail(req)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        >
                          View Details
                        </button>

                        {isCancellable && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={cancellingId === req.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                          >
                            {cancellingId === req.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Detail Modal for Camp Request */}
      {selectedRequestDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-400">{selectedRequestDetail.id}</span>
                <h3 className="font-extrabold text-lg text-slate-900">{selectedRequestDetail.organizationName}</h3>
                <p className="text-xs text-slate-500">{selectedRequestDetail.organizationType}</p>
              </div>
              <button 
                onClick={() => setSelectedRequestDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p><strong>Organizer:</strong> {selectedRequestDetail.organizerName} ({selectedRequestDetail.organizerRole})</p>
                <p><strong>Email:</strong> {selectedRequestDetail.organizerEmail}</p>
                <p><strong>Phone:</strong> {selectedRequestDetail.organizerPhone}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p><strong>Proposed Date:</strong> {selectedRequestDetail.proposedDate}</p>
                <p><strong>Time Slot:</strong> {selectedRequestDetail.preferredTimeSlot}</p>
                <p><strong>Venue:</strong> {selectedRequestDetail.venueAddress}, {selectedRequestDetail.city}</p>
                <p><strong>Estimated Participants:</strong> {selectedRequestDetail.estimatedParticipants} donors</p>
              </div>

              {selectedRequestDetail.availableFacilities && (
                <p><strong>Facilities:</strong> {selectedRequestDetail.availableFacilities}</p>
              )}

              {selectedRequestDetail.additionalNotes && (
                <p><strong>Notes:</strong> {selectedRequestDetail.additionalNotes}</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRequestDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      <DisclaimerBanner />
    </div>
  );
};

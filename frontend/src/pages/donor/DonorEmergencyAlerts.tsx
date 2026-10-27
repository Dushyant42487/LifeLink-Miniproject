import React, { useState, useEffect } from 'react';
import { donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EmergencyAlert } from '../../types';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { OSMMap, MapMarker } from '../../components/common/OSMMap';
import { LocationSearchInput, LocationSuggestion } from '../../components/common/LocationSearchInput';
import { AlertTriangle, MapPin, Clock, CheckCircle2, Shield, BellOff, Map, Crosshair, Navigation, Share2 } from 'lucide-react';
import { checkAlertCompatibility } from '../../utils/bloodCompatibility';

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

export const DonorEmergencyAlerts: React.FC = () => {
  const { user } = useAuth();
  const donorBloodGroup = user?.bloodGroup || 'Unspecified';
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  // User Geolocation & Search Location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [searchLocationQuery, setSearchLocationQuery] = useState('');

  useEffect(() => {
    const fetchAlerts = async () => {
      const res = await donorApi.getEmergencyAlerts();
      if (res.success && res.alerts) {
        setAlerts(res.alerts);
      }
    };
    fetchAlerts();
  }, []);

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
        setLocationMsg('Location active! Real distance calculated from your coordinates.');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationMsg('Location permission denied. Please enable location permissions in browser settings.');
        } else if (err.code === err.TIMEOUT) {
          setLocationMsg('Location request timed out. Please try again.');
        } else {
          setLocationMsg('Unable to retrieve device location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    setSearchLocationQuery(suggestion.name);
    if (suggestion.lat && suggestion.lng) {
      setUserLocation({ lat: suggestion.lat, lng: suggestion.lng });
      setLocationMsg(`Showing emergency alerts centered near ${suggestion.name}`);
    }
  };

  const handleRespond = async (alertId: string) => {
    setLoadingId(alertId);
    const res = await donorApi.respondEmergencyAlert(alertId);
    if (res.success) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, hasResponded: true } : a));
    }
    setLoadingId(null);
  };

  // Map markers & calculated distances
  const mapMarkers: MapMarker[] = alerts
    .filter(alert => typeof alert.latitude === 'number' && typeof alert.longitude === 'number')
    .map(alert => {
      const lat = alert.latitude!;
      const lng = alert.longitude!;
      const distance = userLocation 
        ? calculateHaversineDistanceKm(userLocation.lat, userLocation.lng, lat, lng)
        : alert.distanceKmApprox;

      return {
        id: alert.id,
        lat,
        lng,
        title: `${alert.bloodGroup} ${alert.component} - ${alert.hospitalName}`,
        address: `${alert.unitsRequired} Units needed in ${alert.city}${distance !== undefined ? ` (~${distance} km away)` : ''}`,
        type: 'hospital',
        isUrgent: true
      };
    });

  if (userLocation) {
    mapMarkers.unshift({
      id: 'user-emergency-pin',
      lat: userLocation.lat,
      lng: userLocation.lng,
      title: '📍 Selected Search Location',
      address: 'Calculated Proximity Center',
      type: 'user'
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
              Emergency Matching Active
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Emergency Blood Alerts</h1>
          <p className="text-xs text-slate-500 mt-1">
            High-priority blood requirement notifications matched by your blood group, eligibility, and geographic proximity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="w-56 sm:w-64">
            <LocationSearchInput
              placeholder="Search area, hospital, or city..."
              value={searchLocationQuery}
              onSelectLocation={handleSelectLocation}
              onClear={() => {
                setSearchLocationQuery('');
                setUserLocation(null);
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              userLocation 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Request device location to sort emergency alerts by proximity"
          >
            <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin text-rose-600' : userLocation ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>{locating ? 'Locating...' : userLocation ? 'Location Active' : 'Use My Location'}</span>
          </button>

          <button
            onClick={() => setShowMap(!showMap)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center space-x-1.5 cursor-pointer"
          >
            <Map className="w-4 h-4 text-rose-600" />
            <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
          </button>
        </div>
      </div>

      {locationMsg && (
        <div className="bg-slate-900 text-white rounded-2xl p-3 px-4 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>{locationMsg}</span>
          </div>
          <button onClick={() => setLocationMsg(null)} className="text-slate-400 hover:text-white font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* OpenStreetMap Facility Map */}
      {showMap && alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <span className="font-bold flex items-center space-x-1">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>Emergency Facility Locations Map (OpenStreetMap)</span>
            </span>
            <span className="text-slate-400">Requesting medical centers shown with markers</span>
          </div>
          <OSMMap markers={mapMarkers} height="340px" />
        </div>
      )}

      {/* Notification Throttling Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex items-start space-x-3 text-xs shadow-md">
        <BellOff className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-white mb-0.5">Notification Throttling & Donor Privacy Active</h4>
          <p className="text-slate-300 leading-relaxed">
            LifeLink caps emergency alerts to prevent notification fatigue. Your exact home location is never exposed publicly; distance calculations use anonymized city grid proximity.
          </p>
        </div>
      </div>

      {/* Emergency Alerts List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <p className="font-bold text-slate-900 text-base">No active emergency alerts right now</p>
            <p className="text-xs text-slate-500">Regional inventory is currently stable. Thank you for staying ready!</p>
          </div>
        ) : (
          alerts.map(alert => {
            const hasCoords = typeof alert.latitude === 'number' && typeof alert.longitude === 'number';
            const distKm = userLocation && hasCoords
              ? calculateHaversineDistanceKm(userLocation.lat, userLocation.lng, alert.latitude!, alert.longitude!)
              : alert.distanceKmApprox;

            return (
              <div 
                key={alert.id}
                className={`bg-white rounded-2xl border p-6 shadow-xs transition-all ${
                  alert.urgency === 'Emergency' ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-xl shadow-inner">
                      {alert.bloodGroup}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          {alert.urgency} REQUIREMENT
                        </span>
                        <span className="text-xs font-bold text-slate-900">{alert.hospitalName}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Issued by {alert.bloodBankName}</p>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-500">
                    <p className="font-semibold text-slate-900">{alert.unitsRequired} Unit(s) {alert.component} Needed</p>
                    <p className="text-[11px] text-slate-400">Urgency: Critical Response</p>
                  </div>
                </div>

                {/* Alert Body Details */}
                <div className="py-4 space-y-3">
                  <p className="text-xs text-slate-700 leading-relaxed">{alert.description}</p>

                  {/* Clinical Compatibility Status Notice */}
                  {(() => {
                    const compResult = checkAlertCompatibility(donorBloodGroup, alert.bloodGroup, alert.component);
                    const isIncompatible = compResult.status === 'confirmed_incompatible';
                    const isCompatible = compResult.status === 'confirmed_compatible';

                    return (
                      <div className={`p-2.5 rounded-xl text-xs font-medium border ${
                        isIncompatible 
                          ? 'bg-amber-50/90 text-amber-900 border-amber-300' 
                          : isCompatible 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        <div className="flex items-center space-x-1.5">
                          {isIncompatible ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-bold">
                            {isIncompatible ? 'Compatibility Restriction:' : isCompatible ? 'Clinical Match:' : 'Notice:'}
                          </span>
                        </div>
                        <p className="text-[11px] mt-1 leading-relaxed">
                          {compResult.message}
                        </p>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{distKm !== undefined ? `~${distKm} km away in ${alert.city}` : alert.city ? `Located in ${alert.city}` : 'Regional Center'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>Issued: {new Date(alert.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>{alert.responsesCount} Donors Responded</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                  {(() => {
                    const compResult = checkAlertCompatibility(donorBloodGroup, alert.bloodGroup, alert.component);
                    const isIncompatible = compResult.status === 'confirmed_incompatible';

                    if (alert.hasResponded) {
                      return (
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Response Registered</span>
                          </div>
                          <button
                            onClick={async () => {
                              setLoadingId(alert.id);
                              const res = await donorApi.cancelEmergencyResponse(alert.id);
                              if (res.success) {
                                setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, hasResponded: false, responsesCount: Math.max(0, (a.responsesCount || 1) - 1) } : a));
                              }
                              setLoadingId(null);
                            }}
                            disabled={loadingId === alert.id}
                            className="px-3 py-2 rounded-xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                          >
                            {loadingId === alert.id ? 'Updating...' : 'Withdraw Response'}
                          </button>
                        </div>
                      );
                    }

                    if (isIncompatible) {
                      return (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              const shareText = `URGENT BLOOD REQUIREMENT: ${alert.hospitalName} in ${alert.city} urgently requires ${alert.bloodGroup} ${alert.component}. Share to help coordinate voluntary donors!`;
                              if (navigator.share) {
                                navigator.share({
                                  title: `LifeLink Urgent Alert: ${alert.bloodGroup} ${alert.component}`,
                                  text: shareText,
                                  url: window.location.origin
                                }).catch(() => {});
                              } else {
                                navigator.clipboard?.writeText(shareText);
                                window.alert('Alert details copied to clipboard!');
                              }
                            }}
                            className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Share Alert</span>
                          </button>
                          <button
                            type="button"
                            disabled
                            className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed"
                            title="You cannot respond directly as this blood request is incompatible with your blood group"
                          >
                            Incompatible Blood Group
                          </button>
                        </div>
                      );
                    }

                    return (
                      <button
                        onClick={() => handleRespond(alert.id)}
                        disabled={loadingId === alert.id}
                        className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>{loadingId === alert.id ? 'Sending Response...' : 'Respond / I Can Donate'}</span>
                      </button>
                    );
                  })()}
                </div>

              </div>
            );
          })
        )}
      </div>

      <DisclaimerBanner />
    </div>
  );
};

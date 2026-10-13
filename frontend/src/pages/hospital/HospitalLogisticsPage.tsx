import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { hospitalApi } from '../../services/api';
import { OSMMap, MapMarker, MapPolyline } from '../../components/common/OSMMap';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { 
  Navigation, 
  MapPin, 
  Building2, 
  Phone, 
  Truck, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Clock, 
  Package, 
  CheckCircle2, 
  Layers,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const HospitalLogisticsPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>(undefined);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'banks' | 'dispatches'>('banks');
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7484, -73.9857]);
  const [mapZoom, setMapZoom] = useState<number>(12);

  const loadLogistics = async () => {
    setLoading(true);
    setError(null);
    const res = await hospitalApi.getLogistics();
    if (res.success) {
      setData(res);
      if (res.facility?.latitude && res.facility?.longitude) {
        setMapCenter([res.facility.latitude, res.facility.longitude]);
      }
    } else {
      setError(res.error || 'Failed to retrieve regional logistics data.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogistics();
  }, [user]);

  const facility = data?.facility || {
    id: user?.id || 'hosp-1',
    hospitalName: (user as any)?.hospitalName || user?.name || 'Apollo General Hospital',
    address: (user as any)?.address || '100 Hospital Plaza, Midtown',
    city: (user as any)?.city || 'Metro City',
    latitude: 40.7484,
    longitude: -73.9857
  };

  const bloodBanks: any[] = data?.bloodBanks || [];
  const activeDispatches: any[] = data?.activeDispatches || [];

  const handleSelectBank = (bank: any) => {
    setSelectedBankId(bank.bloodBankId);
    setSelectedDispatchId(null);
    setSelectedMarkerId(`bb-${bank.bloodBankId}`);
    if (bank.latitude && bank.longitude) {
      setMapCenter([bank.latitude, bank.longitude]);
      setMapZoom(13);
    }
  };

  const handleSelectDispatch = (disp: any) => {
    setSelectedDispatchId(disp.requestId);
    setSelectedBankId(disp.bloodBankId);
    setSelectedMarkerId(`bb-${disp.bloodBankId}`);
    if (disp.originCoordinates?.lat && disp.originCoordinates?.lng) {
      setMapCenter([disp.originCoordinates.lat, disp.originCoordinates.lng]);
      setMapZoom(13);
    }
  };

  // Generate Map Markers
  const markers: MapMarker[] = [];

  // 1. Hospital Facility Marker
  if (facility.latitude && facility.longitude) {
    markers.push({
      id: `hosp-${facility.id}`,
      lat: facility.latitude,
      lng: facility.longitude,
      title: facility.hospitalName,
      address: facility.address,
      city: facility.city,
      type: 'hospital',
      popupHtml: `
        <div style="font-family: sans-serif; padding: 4px; min-width: 190px;">
          <span style="font-size: 10px; font-weight: 800; color: #dc2626; text-transform: uppercase;">Your Hospital Facility</span>
          <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${facility.hospitalName}</h4>
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">${facility.address}</p>
          <div style="font-size: 10px; color: #059669; font-weight: 700; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; display: inline-block;">
            Verified Stored Coordinates
          </div>
        </div>
      `,
      onMarkerClick: () => {
        setSelectedMarkerId(`hosp-${facility.id}`);
        setMapCenter([facility.latitude, facility.longitude]);
      }
    });
  }

  // 2. Connected Regional Blood Banks Markers
  bloodBanks.forEach(bb => {
    if (bb.latitude && bb.longitude) {
      const summary = bb.inventorySummary;
      const stockHtml = !summary
        ? '<em>Inventory Data Unavailable</em>'
        : summary.totalAvailable === 0
        ? '<span style="color: #64748b; font-weight: bold;">0 Available (Confirmed Zero Balance)</span>'
        : `<strong>Verified Stock:</strong> ${summary.totalAvailable} Units (${summary.rbcCount} RBC, ${summary.plasmaCount} Plasma, ${summary.plateletsCount} Plt)`;

      markers.push({
        id: `bb-${bb.bloodBankId}`,
        lat: bb.latitude,
        lng: bb.longitude,
        title: bb.bloodBankName,
        address: bb.address,
        type: 'blood_bank',
        popupHtml: `
          <div style="font-family: sans-serif; padding: 4px; min-width: 210px;">
            <span style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Regional Blood Center</span>
            <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${bb.bloodBankName}</h4>
            <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">${bb.address}</p>
            <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #0f172a;">~${bb.distanceKm} km verified transit corridor</p>
            <div style="background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 10px; margin-bottom: 6px;">
              ${stockHtml}
            </div>
            <a href="/hospital/availability?bloodBankId=${encodeURIComponent(bb.bloodBankId)}" style="font-size: 11px; color: #dc2626; font-weight: 700; text-decoration: none;">
              Search Bank Inventory &rarr;
            </a>
          </div>
        `,
        onMarkerClick: () => {
          handleSelectBank(bb);
          setActiveTab('banks');
        }
      });
    }
  });

  // 3. Transit Polylines between Connected Blood Banks and Hospital Facility
  const polylines: MapPolyline[] = [];
  if (facility.latitude && facility.longitude) {
    bloodBanks.forEach(bb => {
      if (bb.latitude && bb.longitude) {
        const isDispatchSelected = selectedDispatchId && activeDispatches.some(
          d => d.requestId === selectedDispatchId && d.bloodBankId === bb.bloodBankId
        );
        const isBankSelected = selectedBankId === bb.bloodBankId;

        const color = isDispatchSelected ? '#ea580c' : isBankSelected ? '#2563eb' : '#3b82f6';
        const weight = isDispatchSelected ? 5 : isBankSelected ? 4 : 3;
        const dashArray = (isDispatchSelected || isBankSelected) ? undefined : '6, 8';

        polylines.push({
          points: [
            [facility.latitude, facility.longitude],
            [bb.latitude, bb.longitude]
          ],
          color,
          weight,
          dashArray,
          title: `Transit Corridor: ${facility.hospitalName} ↔ ${bb.bloodBankName} (~${bb.distanceKm} km)`
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Hospital Logistics</span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-[11px] text-slate-300 font-medium">{facility.city}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1 flex items-center space-x-2">
            <span>Regional Cold-Chain Transit & Facility Network</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Visual geospatial transit corridors connecting {facility.hospitalName} with authorized regional blood centers.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadLogistics}
            title="Refresh logistics and transit status"
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <Link
            to="/hospital/availability"
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center space-x-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>Search Regional Stock</span>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadLogistics}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Telematics & Integration Notice */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start space-x-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold block">Logistics Data Integration Notice</span>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Distances and transit corridors are calculated using verified facility coordinates. Live GPS telematics tracking is not integrated with local courier vehicles. Active dispatch statuses are derived directly from blood bank laboratory hand-off timestamps and cold-chain logs.
          </p>
        </div>
      </div>

      {/* Responsive Split View: Map & Interactive Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Top: Interactive Map View */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Navigation className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Regional Network Geospatial Map</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {markers.length} Verified Facilities
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200">
            {loading ? (
              <div className="h-[460px] bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading regional geospatial transit map...</span>
                </div>
              </div>
            ) : markers.length === 0 ? (
              <div className="h-[460px] bg-slate-50 flex items-center justify-center text-slate-400 text-xs text-center p-6">
                <div>
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">No verified facility coordinates available</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Facility addresses require geocoding verification in system settings.
                  </p>
                </div>
              </div>
            ) : (
              <OSMMap
                markers={markers}
                polylines={polylines}
                center={mapCenter}
                zoom={mapZoom}
                height="460px"
                selectedMarkerId={selectedMarkerId}
              />
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            Select any regional center to focus coordinates and check inventory, or click an active dispatch to highlight its verified transit corridor.
          </p>
        </div>

        {/* Right / Bottom: Connected Centers & Active Dispatches Panel */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          
          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <button
              onClick={() => setActiveTab('banks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'banks'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Connected Centers ({bloodBanks.length})
            </button>

            <button
              onClick={() => setActiveTab('dispatches')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dispatches'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Active Dispatches ({activeDispatches.length})
            </button>
          </div>

          {/* TAB 1: Connected Regional Blood Centers */}
          {activeTab === 'banks' && (
            <div className="space-y-3">
              {bloodBanks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No regional blood centers currently connected to this facility.
                </div>
              ) : (
                bloodBanks.map(bank => {
                  const summary = bank.inventorySummary;
                  const isSelected = selectedBankId === bank.bloodBankId || selectedMarkerId === `bb-${bank.bloodBankId}`;

                  return (
                    <div 
                      key={bank.bloodBankId}
                      onClick={() => handleSelectBank(bank)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-400 shadow-md' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold uppercase text-blue-600">
                              {bank.distanceKm != null ? `~${bank.distanceKm} km verified corridor` : 'Distance unavailable'}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.2 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 mt-0.5">{bank.bloodBankName}</h3>
                          <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{bank.address}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleSelectBank(bank); }}
                          className="p-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Center on map"
                        >
                          <Navigation className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Inventory Summary Distinction */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {loading ? (
                          <div className="text-[11px] text-slate-400 italic">Loading inventory...</div>
                        ) : !summary ? (
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center text-[10px] text-slate-500 font-semibold">
                            Inventory Data Unavailable from Center
                          </div>
                        ) : summary.totalAvailable === 0 ? (
                          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-center text-[10px] text-slate-600 font-bold">
                            0 Units Available (Confirmed Zero Balance Across Components)
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                            <div className="bg-rose-50/70 p-1.5 rounded-lg border border-rose-100">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">RBC</span>
                              <span className="font-extrabold text-blood-700">{summary.rbcCount} Units</span>
                            </div>
                            <div className="bg-amber-50/70 p-1.5 rounded-lg border border-amber-100">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Plasma</span>
                              <span className="font-extrabold text-amber-700">{summary.plasmaCount} Units</span>
                            </div>
                            <div className="bg-purple-50/70 p-1.5 rounded-lg border border-purple-100">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Platelets</span>
                              <span className="font-extrabold text-purple-700">{summary.plateletsCount} Units</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center justify-between text-xs pt-1 border-t border-slate-100/60">
                        <a 
                          href={`tel:${bank.emergencyPhone}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-500 hover:text-slate-800 font-medium flex items-center space-x-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{bank.emergencyPhone}</span>
                        </a>

                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/hospital/availability?bloodBankId=${encodeURIComponent(bank.bloodBankId)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-600 hover:text-slate-900 text-[11px] underline"
                          >
                            Browse Stock
                          </Link>
                          <Link
                            to={`/hospital/requests/new?bloodBankId=${encodeURIComponent(bank.bloodBankId)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-blood-600 hover:underline flex items-center space-x-1"
                          >
                            <span>Request Units</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Active Authorized Dispatches */}
          {activeTab === 'dispatches' && (
            <div className="space-y-3">
              {activeDispatches.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <Package className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-700">No active dispatches currently in transit</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When requisitions are dispatched by regional blood banks, cold-chain courier tracking logs will appear here.
                  </p>
                </div>
              ) : (
                activeDispatches.map(disp => {
                  const isSelected = selectedDispatchId === disp.requestId;

                  return (
                    <div 
                      key={disp.requestId}
                      onClick={() => handleSelectDispatch(disp)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                        isSelected 
                          ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-400 shadow-md' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {disp.requestId}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-bold uppercase bg-amber-600 text-white px-1.5 py-0.2 rounded">
                              Route Highlighted
                            </span>
                          )}
                        </div>
                        <StatusBadge status={disp.status} />
                      </div>

                      <div className="text-xs">
                        <span className="font-extrabold text-blood-700 block">
                          {disp.quantityUnits} Units • {disp.bloodGroup} {disp.component}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Source Center: <strong>{disp.bloodBankName}</strong>
                        </span>
                      </div>

                      {/* Verified Laboratory Event Notice */}
                      {disp.latestTimelineEvent && (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700 block mb-0.5">
                            Verified Dispatch Log Event ({disp.latestTimelineEvent.actor}):
                          </span>
                          <span>{disp.latestTimelineEvent.note}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                        <div className="flex items-center space-x-1.5 text-amber-800">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Live courier GPS tracking unavailable</span>
                        </div>
                        <Link 
                          to={`/hospital/requests?selected=${disp.requestId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blood-600 font-bold hover:underline shrink-0"
                        >
                          View Requisition Ticket &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};

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
  Info,
  TestTube,
  Thermometer,
  Radio
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { isValidCoordinate } from '../../utils/geo';

export const HospitalLogisticsPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>(undefined);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dispatches' | 'samples' | 'banks'>('dispatches');
  const [mapCenter, setMapCenter] = useState<[number, number]>([16.8458, 74.6020]);
  const [mapZoom, setMapZoom] = useState<number>(12);

  const loadLogistics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hospitalApi.getLogistics();
      if (res.success) {
        setData(res);
        if (isValidCoordinate(res.facility?.latitude, res.facility?.longitude)) {
          setMapCenter([res.facility.latitude, res.facility.longitude]);
        }
      } else {
        setError(res.error || 'Failed to retrieve regional logistics data.');
      }
    } catch (e: any) {
      setError(e.message || 'Error communicating with logistics service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogistics();
  }, [user]);

  const facility = data?.facility || {
    id: user?.id || '',
    hospitalName: (user as any)?.hospitalName || user?.name || 'Hospital',
    address: (user as any)?.address || '',
    city: (user as any)?.city || '',
    latitude: (user as any)?.latitude,
    longitude: (user as any)?.longitude,
    hasValidCoordinates: isValidCoordinate((user as any)?.latitude, (user as any)?.longitude)
  };

  const bloodBanks: any[] = data?.bloodBanks || [];
  const bloodDispatches: any[] = data?.bloodDispatches || [];
  const sampleShipments: any[] = data?.sampleShipments || [];

  const handleSelectBank = (bank: any) => {
    setSelectedBankId(bank.bloodBankId);
    setSelectedDispatchId(null);
    setSelectedSampleId(null);
    setSelectedMarkerId(`bb-${bank.bloodBankId}`);
    if (isValidCoordinate(bank.latitude, bank.longitude)) {
      setMapCenter([bank.latitude, bank.longitude]);
      setMapZoom(13);
    }
  };

  const handleSelectDispatch = (disp: any) => {
    setSelectedDispatchId(disp.dispatchId);
    setSelectedSampleId(null);
    setSelectedBankId(disp.origin?.facilityId);
    setSelectedMarkerId(`disp-bb-${disp.dispatchId}`);
    if (isValidCoordinate(disp.origin?.latitude, disp.origin?.longitude)) {
      setMapCenter([disp.origin.latitude, disp.origin.longitude]);
      setMapZoom(12);
    }
  };

  const handleSelectSample = (sample: any) => {
    setSelectedSampleId(sample.sampleId);
    setSelectedDispatchId(null);
    setSelectedBankId(sample.destination?.facilityId);
    setSelectedMarkerId(`smp-hosp-${sample.sampleId}`);
    if (isValidCoordinate(sample.origin?.latitude, sample.origin?.longitude)) {
      setMapCenter([sample.origin.latitude, sample.origin.longitude]);
      setMapZoom(12);
    }
  };

  // Generate Map Markers & Polylines
  const markers: MapMarker[] = [];
  const polylines: MapPolyline[] = [];

  const hasHospCoords = isValidCoordinate(facility.latitude, facility.longitude);

  if (activeTab === 'dispatches') {
    // Render Active Blood Dispatches (Blood Bank -> Hospital)
    bloodDispatches.forEach(disp => {
      const isSelected = selectedDispatchId === disp.dispatchId;
      const originLat = disp.origin?.latitude;
      const originLng = disp.origin?.longitude;
      const destLat = disp.destination?.latitude;
      const destLng = disp.destination?.longitude;

      if (isValidCoordinate(originLat, originLng)) {
        markers.push({
          id: `disp-bb-${disp.dispatchId}`,
          lat: originLat,
          lng: originLng,
          title: `Dispatch Origin: ${disp.origin.facilityName}`,
          address: disp.origin.address,
          city: disp.origin.city,
          type: 'blood_bank',
          popupHtml: `
            <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
              <span style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">Dispatch Origin (Blood Bank)</span>
              <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${disp.origin.facilityName}</h4>
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">${disp.origin.address || disp.origin.city}</p>
              <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 6px; font-size: 11px; margin-top: 4px;">
                <strong>Manifest:</strong> ${disp.dispatchId}<br/>
                <strong>Payload:</strong> ${disp.quantityUnits} unit(s) ${disp.bloodGroup} ${disp.component}<br/>
                <strong>Courier:</strong> ${disp.courierType} (${disp.courierReference || 'Tag assigned'})<br/>
                <strong>Target Temp:</strong> ${disp.targetTransportTemp}
              </div>
            </div>
          `,
          onMarkerClick: () => handleSelectDispatch(disp)
        });
      }

      if (isValidCoordinate(destLat, destLng)) {
        markers.push({
          id: `disp-hosp-${disp.dispatchId}`,
          lat: destLat,
          lng: destLng,
          title: `Destination: ${disp.destination.facilityName}`,
          address: disp.destination.address,
          city: disp.destination.city,
          type: 'hospital',
          popupHtml: `
            <div style="font-family: sans-serif; padding: 4px; min-width: 190px;">
              <span style="font-size: 10px; font-weight: 800; color: #dc2626; text-transform: uppercase;">Receiving Hospital</span>
              <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${disp.destination.facilityName}</h4>
              <p style="margin: 0; font-size: 11px; color: #64748b;">${disp.destination.address || disp.destination.city}</p>
              <div style="font-size: 10px; font-weight: 700; color: #7c3aed; margin-top: 4px;">
                Blood Product Hand-off Desk
              </div>
            </div>
          `
        });
      }

      if (isValidCoordinate(originLat, originLng) && isValidCoordinate(destLat, destLng)) {
        polylines.push({
          points: [
            [originLat, originLng],
            [destLat, destLng]
          ],
          color: isSelected ? '#7c3aed' : '#a855f7',
          weight: isSelected ? 5 : 3,
          dashArray: isSelected ? undefined : '6, 6',
          title: `Blood Dispatch: ${disp.origin.facilityName} → ${disp.destination.facilityName} (~${disp.corridorDistanceKm ?? 'N/A'} km)`
        });
      }
    });

  } else if (activeTab === 'samples') {
    // Render Patient Sample Shipments (Hospital -> Blood Bank)
    sampleShipments.forEach(smp => {
      const isSelected = selectedSampleId === smp.sampleId;
      const originLat = smp.origin?.latitude;
      const originLng = smp.origin?.longitude;
      const destLat = smp.destination?.latitude;
      const destLng = smp.destination?.longitude;

      if (isValidCoordinate(originLat, originLng)) {
        markers.push({
          id: `smp-hosp-${smp.sampleId}`,
          lat: originLat,
          lng: originLng,
          title: `Sample Source: ${smp.origin.facilityName}`,
          address: smp.origin.address,
          city: smp.origin.city,
          type: 'hospital',
          popupHtml: `
            <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
              <span style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase;">Sample Origin (Hospital)</span>
              <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${smp.origin.facilityName}</h4>
              <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 6px; font-size: 11px; margin-top: 4px;">
                <strong>Sample ID:</strong> ${smp.sampleId}<br/>
                <strong>Type:</strong> ${smp.sampleType}<br/>
                <strong>Patient Ref:</strong> ${smp.patientReferenceId}<br/>
                <strong>Submitted:</strong> ${new Date(smp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          `,
          onMarkerClick: () => handleSelectSample(smp)
        });
      }

      if (destLat && destLng && isValidCoordinate(destLat, destLng)) {
        markers.push({
          id: `smp-dest-${smp.sampleId}`,
          lat: destLat,
          lng: destLng,
          title: `Testing Lab: ${smp.destination.facilityName}`,
          address: smp.destination.address,
          city: smp.destination.city,
          type: 'blood_bank',
          popupHtml: `
            <div style="font-family: sans-serif; padding: 4px; min-width: 190px;">
              <span style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Receiving Blood Center Lab</span>
              <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${smp.destination.facilityName}</h4>
              <p style="margin: 0; font-size: 11px; color: #64748b;">${smp.destination.address || smp.destination.city}</p>
              <div style="font-size: 10px; font-weight: 700; color: #0284c7; margin-top: 4px;">
                Cross-Match Testing Laboratory
              </div>
            </div>
          `
        });
      }

      if (isValidCoordinate(originLat, originLng) && destLat && destLng && isValidCoordinate(destLat, destLng)) {
        polylines.push({
          points: [
            [originLat, originLng],
            [destLat, destLng]
          ],
          color: isSelected ? '#0284c7' : '#38bdf8',
          weight: isSelected ? 5 : 3,
          dashArray: isSelected ? undefined : '5, 5',
          title: `Sample Transport: ${smp.origin.facilityName} → ${smp.destination.facilityName} (~${smp.corridorDistanceKm ?? 'N/A'} km)`
        });
      }
    });

  } else {
    // Render Connected Regional Blood Banks Network
    if (hasHospCoords) {
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
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">${facility.address || facility.city}</p>
            <div style="font-size: 10px; color: #059669; font-weight: 700; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; display: inline-block;">
              Authoritative Facility Origin
            </div>
          </div>
        `,
        onMarkerClick: () => {
          setSelectedMarkerId(`hosp-${facility.id}`);
          setMapCenter([facility.latitude, facility.longitude]);
        }
      });
    }

    bloodBanks.forEach(bb => {
      if (isValidCoordinate(bb.latitude, bb.longitude)) {
        const summary = bb.inventorySummary;
        const stockHtml = !summary
          ? '<em>Inventory Data Unavailable</em>'
          : summary.totalAvailable === 0
          ? '<span style="color: #64748b; font-weight: bold;">0 Available</span>'
          : `<strong>Verified Stock:</strong> ${summary.totalAvailable} Units (${summary.rbcCount} RBC, ${summary.plasmaCount} Plasma, ${summary.plateletsCount} Plt)`;

        markers.push({
          id: `bb-${bb.bloodBankId}`,
          lat: bb.latitude,
          lng: bb.longitude,
          title: bb.bloodBankName,
          address: bb.address,
          city: bb.city,
          type: 'blood_bank',
          popupHtml: `
            <div style="font-family: sans-serif; padding: 4px; min-width: 210px;">
              <span style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Regional Blood Center</span>
              <h4 style="margin: 2px 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${bb.bloodBankName}</h4>
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">${bb.address}</p>
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #0f172a;">${bb.distanceKm ? `~${bb.distanceKm} km geographic corridor` : 'Distance unavailable'}</p>
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
          }
        });

        if (hasHospCoords) {
          polylines.push({
            points: [
              [facility.latitude, facility.longitude],
              [bb.latitude, bb.longitude]
            ],
            color: selectedBankId === bb.bloodBankId ? '#2563eb' : '#64748b',
            weight: selectedBankId === bb.bloodBankId ? 4 : 2,
            dashArray: '6, 8',
            title: `Corridor: ${facility.hospitalName} ↔ ${bb.bloodBankName} (${bb.distanceKm ?? 'N/A'} km)`
          });
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Hospital Logistics</span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-[11px] text-slate-300 font-medium">{facility.city || 'Regional Hub'}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1 flex items-center space-x-2">
            <span>Cold-Chain Transit & Route Corridors</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Visualizes authenticated transport routes: Patient Samples (Hospital → Bank) and Allocated Blood Dispatches (Bank → Hospital).
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

      {/* Route & Telematics Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 flex items-start space-x-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-slate-900 block">Authentic Physical Movement & Route Representation</span>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Routes display straight-line geographic corridors connecting verified facility addresses. 
            <strong> Blood dispatches</strong> travel from the preparing Blood Bank to the receiving Hospital. 
            <strong> Patient samples</strong> travel from the Hospital to the testing Blood Center Laboratory. 
            Statuses are updated from verified barcode and cold-chain hand-off records.
          </p>
        </div>
      </div>

      {/* Responsive Split View: Map & Interactive Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Top: Interactive Map View */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Navigation className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {activeTab === 'dispatches' 
                  ? 'Blood Dispatch Routes (Blood Bank → Hospital)' 
                  : activeTab === 'samples'
                  ? 'Patient Sample Transport Routes (Hospital → Lab)'
                  : 'Connected Regional Centers Network'}
              </h2>
            </div>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {markers.length} Map Markers
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200">
            {loading ? (
              <div className="h-[460px] bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading geospatial routes...</span>
                </div>
              </div>
            ) : markers.length === 0 ? (
              <div className="h-[460px] bg-slate-50 flex items-center justify-center text-slate-400 text-xs text-center p-6">
                <div>
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">No active routes in this category</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {activeTab === 'dispatches'
                      ? 'No blood products currently in transit to this hospital.'
                      : activeTab === 'samples'
                      ? 'No patient cross-match samples currently logged.'
                      : 'Hospital or blood bank facility coordinates require verification in profile settings.'}
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
            Straight-line corridor represents verified geographic distance between facility locations. Live courier vehicle GPS telemetry is not integrated.
          </p>
        </div>

        {/* Right / Bottom: Interactive Route Cards Panel */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          
          {/* Movement Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
            <button
              onClick={() => {
                setActiveTab('dispatches');
                setSelectedSampleId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dispatches'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Blood Dispatches ({bloodDispatches.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('samples');
                setSelectedDispatchId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'samples'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sample Routes ({sampleShipments.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('banks');
                setSelectedDispatchId(null);
                setSelectedSampleId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'banks'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Centers Network ({bloodBanks.length})
            </button>
          </div>

          {/* TAB 1: Authoritative Blood Dispatches (Blood Bank -> Hospital) */}
          {activeTab === 'dispatches' && (
            <div className="space-y-3">
              {bloodDispatches.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <Truck className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-700">No active blood dispatches</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When an allocated blood order is released and dispatched by a regional blood center, its authenticated courier route appears here.
                  </p>
                </div>
              ) : (
                bloodDispatches.map(disp => {
                  const isSelected = selectedDispatchId === disp.dispatchId;

                  return (
                    <div 
                      key={disp.dispatchId}
                      onClick={() => handleSelectDispatch(disp)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-400 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
                            {disp.dispatchId}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Requisition: #{disp.requestId}
                          </span>
                        </div>
                        <StatusBadge status={disp.status} />
                      </div>

                      <div className="text-xs">
                        <span className="font-extrabold text-blood-700 block">
                          {disp.quantityUnits} Unit(s) • {disp.bloodGroup} {disp.component}
                        </span>
                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 mt-1">
                          <span className="font-semibold">{disp.origin.facilityName}</span>
                          <span className="text-purple-600 font-bold">&rarr;</span>
                          <span className="font-semibold">{disp.destination.facilityName}</span>
                        </div>
                      </div>

                      {/* Corridor distance & cold chain specs */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Corridor Distance:</span>
                          <strong className="text-slate-800">{disp.corridorDistanceKm ? `~${disp.corridorDistanceKm} km` : 'Geographic coordinates required'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Cold-Chain Spec:</span>
                          <strong className="text-slate-800">{disp.targetTransportTemp}</strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Courier: <strong>{disp.courierType}</strong></span>
                        <Link 
                          to={`/hospital/requests?requestId=${disp.requestId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blood-600 font-bold hover:underline shrink-0"
                        >
                          View Requisition &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Authoritative Patient Sample Shipments (Hospital -> Blood Bank) */}
          {activeTab === 'samples' && (
            <div className="space-y-3">
              {sampleShipments.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <TestTube className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-700">No patient sample shipments logged</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When cross-match or typing samples are sent to regional laboratories, their physical transit corridors appear here.
                  </p>
                </div>
              ) : (
                sampleShipments.map(smp => {
                  const isSelected = selectedSampleId === smp.sampleId;

                  return (
                    <div 
                      key={smp.sampleId}
                      onClick={() => handleSelectSample(smp)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                        isSelected 
                          ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-400 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-sky-900 bg-sky-100 px-2 py-0.5 rounded">
                            {smp.sampleId}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Requisition: #{smp.requestId}
                          </span>
                        </div>
                        <StatusBadge status={smp.status} />
                      </div>

                      <div className="text-xs">
                        <span className="font-extrabold text-slate-900 block">
                          {smp.sampleType} • Ref: {smp.patientReferenceId}
                        </span>
                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 mt-1">
                          <span className="font-semibold">{smp.origin.facilityName}</span>
                          <span className="text-sky-600 font-bold">&rarr;</span>
                          <span className="font-semibold">{smp.destination?.facilityName || 'Regional Center'}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 flex justify-between items-center">
                        <span>Corridor: <strong>{smp.corridorDistanceKm ? `~${smp.corridorDistanceKm} km` : 'Coordinates pending'}</strong></span>
                        <span>Logged: <strong>{new Date(smp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate max-w-[200px] italic">{smp.verificationNotes || 'Sample in transit to lab'}</span>
                        <Link 
                          to={`/hospital/samples`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blood-600 font-bold hover:underline shrink-0"
                        >
                          Samples Log &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: Connected Regional Centers */}
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
                          ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-400 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900">{bank.bloodBankName}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{bank.address}</p>
                        </div>
                        {bank.distanceKm !== null ? (
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                            ~{bank.distanceKm} km
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                            Unconfigured Coordinates
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {!summary || summary.totalAvailable === 0 ? (
                          <div className="p-2 rounded-lg bg-slate-100 text-center text-[10px] text-slate-600 font-bold">
                            0 Units Available in Inventory
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                            <div className="bg-rose-50/70 p-1.5 rounded-lg border border-rose-100">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">RBC</span>
                              <span className="font-extrabold text-blood-700">{summary.rbcCount} u</span>
                            </div>
                            <div className="bg-amber-50/70 p-1.5 rounded-lg border border-amber-100">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">FFP</span>
                              <span className="font-extrabold text-amber-700">{summary.plasmaCount} u</span>
                            </div>
                            <div className="bg-purple-50/70 p-1.5 rounded-lg border border-purple-100">
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Platelets</span>
                              <span className="font-extrabold text-purple-700">{summary.plateletsCount} u</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs pt-1 border-t border-slate-100/60">
                        {bank.emergencyPhone ? (
                          <a 
                            href={`tel:${bank.emergencyPhone}`} 
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 hover:text-slate-800 font-medium flex items-center space-x-1"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{bank.emergencyPhone}</span>
                          </a>
                        ) : <span />}

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

        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, Navigation } from 'lucide-react';

// Fix Leaflet's default icon path issues in Vite/Webpack build
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  address: string;
  city?: string;
  type?: 'camp' | 'hospital' | 'blood_bank' | 'donor' | 'user' | 'dispatch';
  isUrgent?: boolean;
  popupHtml?: string;
  onMarkerClick?: () => void;
}

export interface MapPolyline {
  points: [number, number][];
  color?: string;
  weight?: number;
  dashArray?: string;
  title?: string;
}

interface OSMMapProps {
  markers: MapMarker[];
  polylines?: MapPolyline[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedMarkerId?: string;
  className?: string;
  onSearchArea?: (center: { lat: number; lng: number }) => void;
}

export const OSMMap: React.FC<OSMMapProps> = ({
  markers,
  polylines = [],
  center = [40.7128, -74.0060], // Default Metro City / NYC approx
  zoom = 12,
  height = '400px',
  selectedMarkerId,
  className = '',
  onSearchArea
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [showSearchAreaBtn, setShowSearchAreaBtn] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
        scrollWheelZoom: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      map.on('moveend', () => {
        if (onSearchArea) {
          setShowSearchAreaBtn(true);
        }
      });

      mapInstanceRef.current = map;

      // Invalidate size after map container mounts/resizes to prevent grey tiles
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.panTo(center, { animate: true });
    }
  }, [center[0], center[1]]);

  // Trigger Leaflet size invalidation when height or visibility changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [height, markers.length]);

  // Custom Icon Generator with Accessible Distinct Shapes
  const createCustomIcon = (type?: string, isUrgent?: boolean) => {
    let html = '';
    let iconSize: [number, number] = [36, 36];
    let iconAnchor: [number, number] = [18, 34];

    if (type === 'camp') {
      // 1. Red Droplet Marker for Donation Camps
      html = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(225,29,72,0.35));" title="Active Donation Camp">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#E11D48" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.5C7.5 7.5 4 12 4 15.5 4 19.1 7.6 22 12 22s8-2.9 8-6.5C20 12 16.5 7.5 12 2.5z"/>
            <circle cx="12" cy="15" r="3.2" fill="#ffffff"/>
          </svg>
        </div>
      `;
    } else if (type === 'hospital') {
      // 2. Hospital Deficit Shield Marker with Medical Cross
      const pulseHtml = isUrgent ? `
        <span class="urgent-beacon" style="position: absolute; inset: -4px; border-radius: 12px; background: rgba(220, 38, 38, 0.4); z-index: -1;"></span>
      ` : '';
      html = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(153,27,27,0.45));" title="Hospital Emergency Deficit">
          ${pulseHtml}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="#991B1B" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L4 5v6.5C4 17.5 7.4 22.3 12 24c4.6-1.7 8-6.5 8-12.5V5l-8-3z"/>
            <path d="M12 8v8M8 12h8" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
      `;
    } else if (type === 'blood_bank') {
      // 4. Blue Landmark Marker for Regional Blood Centers
      html = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(29,78,216,0.45));" title="Regional Blood Center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="#1D4ED8" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M14 10v11M12 2L2 7h20L12 2z"/>
          </svg>
        </div>
      `;
    } else if (type === 'dispatch') {
      // 5. Amber Cold-Chain Transit Marker
      const pulseHtml = isUrgent ? `
        <span class="urgent-beacon" style="position: absolute; inset: -4px; border-radius: 12px; background: rgba(217, 119, 6, 0.4); z-index: -1;"></span>
      ` : '';
      html = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(217,119,6,0.45));" title="Cold-Chain Dispatch Corridor">
          ${pulseHtml}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="#D97706" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2" fill="#D97706"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" fill="#B45309"/>
            <circle cx="5.5" cy="18.5" r="2.5" fill="#ffffff" stroke="#D97706" stroke-width="2"/>
            <circle cx="18.5" cy="18.5" r="2.5" fill="#ffffff" stroke="#D97706" stroke-width="2"/>
          </svg>
        </div>
      `;
    } else if (type === 'user') {
      // 3. Distinct Radar Bullseye for Current Location
      iconSize = [32, 32];
      iconAnchor = [16, 16];
      html = `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(13,148,136,0.4));" title="Your Location">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="12" r="10" fill="#0D9488" fill-opacity="0.25" stroke="#0D9488" stroke-width="2"/>
            <circle cx="12" cy="12" r="5.5" fill="#0D9488" stroke="#ffffff" stroke-width="2"/>
            <circle cx="12" cy="12" r="2" fill="#ffffff"/>
          </svg>
        </div>
      `;
    } else {
      // Generic fallback pin
      html = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#475569" width="34" height="34" stroke="#ffffff" stroke-width="1.8">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="3" fill="#ffffff"/>
          </svg>
        </div>
      `;
    }

    return L.divIcon({
      html,
      className: 'custom-leaflet-marker',
      iconSize,
      iconAnchor,
      popupAnchor: [0, -iconAnchor[1] + 4]
    });
  };

  // Check categories present for dynamic legend
  const hasUser = markers.some(m => m.type === 'user');
  const hasCamp = markers.some(m => m.type === 'camp');
  const hasHospital = markers.some(m => m.type === 'hospital');
  const hasBloodBank = markers.some(m => m.type === 'blood_bank');
  const hasDispatch = markers.some(m => m.type === 'dispatch');
  const hasCategories = hasUser || hasCamp || hasHospital || hasBloodBank || hasDispatch;

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    const validMarkers = markers.filter(m => m.lat !== undefined && m.lng !== undefined && !isNaN(m.lat) && !isNaN(m.lng));

    if (validMarkers.length === 0) return;

    const bounds = L.latLngBounds([]);

    validMarkers.forEach(m => {
      const icon = createCustomIcon(m.type, m.isUrgent);
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);

      const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${m.lat},${m.lng}`;
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`;

      const popupContent = m.popupHtml || `
        <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
          <h4 style="margin: 0 0 4px 0; font-weight: 700; color: #1e293b; font-size: 13px;">${m.title}</h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b;">${m.address}${m.city ? `, ${m.city}` : ''}</p>
          <div style="display: flex; gap: 8px; font-size: 11px;">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 700; text-decoration: none;">
              🗺️ Google Maps
            </a>
            <span style="color: #cbd5e1;">|</span>
            <a href="${osmDirectionsUrl}" target="_blank" rel="noopener noreferrer" style="color: #059669; font-weight: 700; text-decoration: none;">
              📍 OpenStreetMap
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      if (m.onMarkerClick) {
        marker.on('click', () => m.onMarkerClick!());
      }

      markersRef.current[m.id] = marker;
      bounds.extend([m.lat, m.lng]);
    });

    if (validMarkers.length > 0 && !selectedMarkerId) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [markers]);

  // Handle selectedMarkerId pan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedMarkerId) return;

    const targetMarker = markersRef.current[selectedMarkerId];
    if (targetMarker) {
      targetMarker.openPopup();
      map.panTo(targetMarker.getLatLng(), { animate: true, duration: 0.8 });
    }
  }, [selectedMarkerId]);

  // Render Polylines
  const polylinesLayerRef = useRef<L.Polyline[]>([]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    polylinesLayerRef.current.forEach(l => l.remove());
    polylinesLayerRef.current = [];

    if (polylines && polylines.length > 0) {
      polylines.forEach(p => {
        const line = L.polyline(p.points, {
          color: p.color || '#3b82f6',
          weight: p.weight || 3,
          dashArray: p.dashArray || '6, 8',
          opacity: 0.85
        }).addTo(map);

        if (p.title) {
          line.bindTooltip(p.title, { sticky: true });
        }

        polylinesLayerRef.current.push(line);
      });
    }
  }, [polylines]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm ${className}`} style={{ height }}>
      
      {/* CSS Pulse animation with prefers-reduced-motion */}
      <style>{`
        @keyframes urgentBeaconPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .urgent-beacon {
          animation: urgentBeaconPulse 2s infinite ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .urgent-beacon {
            animation: none !important;
            opacity: 0.5;
          }
        }
      `}</style>

      {showSearchAreaBtn && onSearchArea && (
        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              const c = mapInstanceRef.current.getCenter();
              onSearchArea({ lat: c.lat, lng: c.lng });
              setShowSearchAreaBtn(false);
            }
          }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] px-4 py-1.5 bg-white/95 backdrop-blur-md border border-slate-300 text-slate-800 font-bold text-xs rounded-full shadow-lg hover:bg-slate-50 transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
          <span>Search this map area</span>
        </button>
      )}

      {/* Dynamic Map Legend: Shows only categories actually rendered on the map */}
      {hasCategories && markers.length > 0 && (
        <div 
          className="absolute bottom-3 left-3 z-[500] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-2 px-3 shadow-md flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-700"
          role="region"
          aria-label="Map marker categories legend"
        >
          <span className="text-[10px] font-extrabold uppercase text-slate-400 border-r border-slate-200 pr-2">Legend</span>
          {hasUser && (
            <div className="flex items-center space-x-1.5" title="Selected or device location">
              <span className="w-3 h-3 rounded-full border-2 border-teal-600 bg-teal-500 inline-block shrink-0"></span>
              <span>Current Location</span>
            </div>
          )}
          {hasCamp && (
            <div className="flex items-center space-x-1.5" title="Accredited donation camp site">
              <span className="text-rose-600 text-xs font-black">💧</span>
              <span>Active Camp</span>
            </div>
          )}
          {hasHospital && (
            <div className="flex items-center space-x-1.5" title="Hospital facility location">
              <span className="w-3 h-3 rounded bg-red-700 text-white text-[9px] flex items-center justify-center font-bold leading-none shrink-0">+</span>
              <span>Hospital Facility</span>
            </div>
          )}
          {hasBloodBank && (
            <div className="flex items-center space-x-1.5" title="Regional Blood Bank Center">
              <span className="w-3 h-3 rounded bg-blue-700 text-white text-[9px] flex items-center justify-center font-bold leading-none shrink-0">🏛</span>
              <span>Regional Blood Center</span>
            </div>
          )}
          {hasDispatch && (
            <div className="flex items-center space-x-1.5" title="Active Requisition Dispatch Corridor">
              <span className="w-3 h-3 rounded bg-amber-600 text-white text-[9px] flex items-center justify-center font-bold leading-none shrink-0">🚚</span>
              <span>Transit Dispatch</span>
            </div>
          )}
        </div>
      )}

      {markers.length === 0 && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center z-[500] text-slate-500 text-sm">
          No location coordinates available to display on map.
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full z-10" />
    </div>
  );
};

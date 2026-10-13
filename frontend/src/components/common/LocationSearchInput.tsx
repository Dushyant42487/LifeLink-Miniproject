import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { Search, MapPin, Building2, Compass, Loader2, X, ShieldCheck } from 'lucide-react';

export interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  type: 'camp' | 'blood_bank' | 'hospital' | 'locality' | 'city';
  isVerifiedEntity?: boolean;
  badgeLabel?: string;
}

interface LocationSearchInputProps {
  placeholder?: string;
  value?: string;
  onSelectLocation: (suggestion: LocationSuggestion) => void;
  onClear?: () => void;
  className?: string;
}

export const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  placeholder = 'Search city, locality, blood bank, hospital, or camp...',
  value = '',
  onSelectLocation,
  onClear,
  className = ''
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside & Escape key handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        // 1. Fetch LifeLink DB entity matches from backend
        const res = await apiFetch(`/donors/location-search?q=${encodeURIComponent(val.trim())}`);
        let dbResults: LocationSuggestion[] = [];
        if (res.success && res.results) {
          dbResults = res.results;
        }

        // 2. Fetch generic OpenStreetMap geocoding suggestions via Nominatim
        let geoResults: LocationSuggestion[] = [];
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}&limit=4`,
            { headers: { 'User-Agent': 'LifeLink-Blood-Portal/1.0' } }
          );
          if (geoRes.ok) {
            const geoJson = await geoRes.json();
            geoResults = geoJson.map((item: any) => ({
              id: `geo-${item.place_id}`,
              name: item.display_name.split(',')[0],
              address: item.display_name,
              city: item.address?.city || item.address?.town || item.address?.state,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              type: item.type === 'city' ? 'city' : 'locality',
              isVerifiedEntity: false,
              badgeLabel: 'Location'
            }));
          }
        } catch {
          // Ignore geocoding network errors
        }

        // Combine verified LifeLink entities first, followed by geocoded locations
        const combined = [...dbResults, ...geoResults];
        setSuggestions(combined);
        setIsOpen(combined.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (item: LocationSuggestion) => {
    setQuery(item.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelectLocation(item);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (onClear) onClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex]);
      }
    }
  };

  const getIcon = (type: string, isVerified?: boolean) => {
    if (isVerified) {
      if (type === 'blood_bank') return <Building2 className="w-4 h-4 text-purple-600" />;
      if (type === 'hospital') return <Building2 className="w-4 h-4 text-rose-600" />;
      if (type === 'camp') return <Compass className="w-4 h-4 text-blue-600" />;
    }
    return <MapPin className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all shadow-xs"
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-rose-600 animate-spin absolute right-3" />
        ) : query ? (
          <button
            onClick={handleClear}
            className="absolute right-3 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-[1000] max-h-72 overflow-y-auto text-xs">
          <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
            <span>Location Suggestions</span>
            <span className="text-slate-400 text-[9px] font-normal">Use ↑ ↓ & Enter</span>
          </div>

          {suggestions.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`px-3.5 py-2.5 cursor-pointer flex items-start justify-between space-x-3 transition-colors ${
                highlightedIndex === idx ? 'bg-rose-50 text-rose-900' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {getIcon(item.type, item.isVerifiedEntity)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    {item.isVerifiedEntity && (
                      <span title="Verified LifeLink Entity"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /></span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.address}</p>
                </div>
              </div>

              {item.badgeLabel && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider border ${
                  item.isVerifiedEntity
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {item.badgeLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { publicApi } from '../../services/api';
import { DonationCamp } from '../../types';
import { Calendar, MapPin, Clock, Users, CheckCircle, Search, AlertCircle, Compass } from 'lucide-react';

export const LandingCamps: React.FC = () => {
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchCamps = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getCamps(
        selectedCity !== 'all' ? selectedCity : undefined,
        searchQuery ? searchQuery : undefined
      );

      if (res.success && Array.isArray(res.camps)) {
        setCamps(res.camps);
        // Extract unique cities
        const cities = Array.from(new Set(res.camps.map((c: DonationCamp) => c.city).filter(Boolean))) as string[];
        setAvailableCities(cities);
      } else {
        setError(res.error || 'Unable to load scheduled donation camps.');
      }
    } catch (err) {
      setError('Connection error while fetching donation drives.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps();
  }, [selectedCity]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCamps();
  };

  const handleRSVP = async (campId: string) => {
    setLoadingId(campId);
    try {
      const res = await publicApi.rsvpCamp(campId);
      if (res.success && res.camp) {
        setCamps(prev => prev.map(c => c.id === campId ? res.camp : c));
        setRegisteredIds(prev => [...prev, campId]);
      }
    } catch (err) {
      console.warn('RSVP failed:', err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="py-20 sm:py-24 bg-slate-50/70 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Compass className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Community Outreach</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Find a Blood Donation Camp Near You
          </h2>
          <p className="mt-3.5 text-slate-600 text-sm sm:text-base leading-relaxed">
            Support voluntary blood collection drives organized by accredited hospitals, blood centers, and community partners.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="max-w-3xl mx-auto mb-10">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search camp by name, organizer, or venue..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600 transition-all shadow-2xs"
              />
            </div>

            {availableCities.length > 0 && (
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600 transition-all shadow-2xs"
              >
                <option value="all">All Cities</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 bg-lifelink-600 hover:bg-lifelink-700 text-white font-bold text-xs rounded-xl shadow-xs shadow-lifelink-600/25 transition-all cursor-pointer shrink-0"
            >
              Filter Drives
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl max-w-xl mx-auto shadow-xs">
            <div className="w-6 h-6 border-2 border-lifelink-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-semibold text-slate-600">Retrieving scheduled donation camps...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-8 text-center bg-white border border-rose-200 rounded-3xl max-w-xl mx-auto shadow-xs">
            <AlertCircle className="w-8 h-8 text-lifelink-600 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-900 mb-1">Notice</h4>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <button
              onClick={fetchCamps}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : camps.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 border border-slate-200/70 flex items-center justify-center mx-auto mb-3.5">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1.5">No Upcoming Camps Scheduled</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Blood donation drives organized by accredited healthcare institutions and centers will appear here as soon as they are scheduled.
            </p>
          </div>
        ) : (
          /* Camp Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {camps.map(camp => {
              const isRegistered = registeredIds.includes(camp.id);
              const isUrgent = Boolean(camp.isUrgent);

              return (
                <div 
                  key={camp.id} 
                  className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-lifelink-200 hover:-translate-y-0.5 transition-all duration-300 relative group"
                >
                  {/* Status / Urgency Tag */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Organized Drive
                    </span>
                    {isUrgent ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lifelink-50 text-lifelink-700 border border-lifelink-200">
                        Urgent Need
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Upcoming
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-lifelink-600 transition-colors">
                      {camp.title}
                    </h3>
                    <p className="text-xs text-lifelink-600 font-semibold mb-4">
                      {camp.organizer}
                    </p>

                    {/* Logistics Metadata */}
                    <div className="space-y-2.5 text-xs text-slate-600 mb-5 pb-4 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{camp.startDate} {camp.endDate && camp.endDate !== camp.startDate ? `to ${camp.endDate}` : ''}</span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{camp.timeSlot || '09:00 AM – 04:00 PM'}</span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{camp.location}{camp.city ? `, ${camp.city}` : ''}</span>
                      </div>
                      {typeof camp.registeredCount === 'number' && (
                        <div className="flex items-center space-x-2.5">
                          <Users className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>
                            {camp.registeredCount} Donors Registered {camp.targetUnits ? `(Target: ${camp.targetUnits} units)` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {camp.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-6">
                        {camp.description}
                      </p>
                    )}
                  </div>

                  {/* RSVP / Registration Action */}
                  <button
                    onClick={() => handleRSVP(camp.id)}
                    disabled={isRegistered || loadingId === camp.id}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600 ${
                      isRegistered
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : 'bg-lifelink-600 hover:bg-lifelink-700 text-white shadow-xs shadow-lifelink-600/20 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isRegistered ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Registered (Slot Confirmed)</span>
                      </>
                    ) : loadingId === camp.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>Register for Camp</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};

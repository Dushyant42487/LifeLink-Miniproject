import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { DonationCamp } from '../../types';
import { Calendar, MapPin, Clock, Users, CheckCircle } from 'lucide-react';

export const LandingCamps: React.FC = () => {
  const [camps, setCamps] = useState<DonationCamp[]>([]);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCamps = async () => {
      const res = await apiFetch('/public/camps');
      if (res.success && res.camps) {
        setCamps(res.camps);
      }
    };
    fetchCamps();
  }, []);

  const handleRSVP = async (campId: string) => {
    setLoadingId(campId);
    const res = await apiFetch(`/public/camps/${campId}/rsvp`, { method: 'POST' });
    if (res.success && res.camp) {
      setCamps(prev => prev.map(c => c.id === campId ? res.camp : c));
      setRegisteredIds(prev => [...prev, campId]);
    }
    setLoadingId(null);
  };

  return (
    <section className="py-16 bg-slate-50/80 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Stats Strip */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 mb-16 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="pt-2 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">3,200+</span>
              <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">Active Donors</p>
            </div>
            <div className="pt-4 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">127</span>
              <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">Partner Hospitals</p>
            </div>
            <div className="pt-4 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">98%+</span>
              <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">Successful Fulfillments</p>
            </div>
            <div className="pt-4 md:pt-0">
              <span className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">24/7</span>
              <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">AI Supply Forecasts</p>
            </div>
          </div>
        </div>

        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 mb-3">
            Community Mobilization
          </span>
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Upcoming Blood Donation Camps</h3>
          <p className="mt-3 text-slate-600 text-sm">
            Join voluntary blood drives organized by accredited regional centers and healthcare partners.
          </p>
        </div>

        {camps.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-900 mb-1">No Upcoming Camps Scheduled</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Blood donation drives and mobile collection camps organized by accredited centers will appear here once scheduled.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {camps.map(camp => {
              const isRegistered = registeredIds.includes(camp.id);

              return (
                <div key={camp.id} className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-rose-200 transition-all relative">
                  {camp.isUrgent && (
                    <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      Urgent Need
                    </span>
                  )}

                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{camp.title}</h4>
                    <p className="text-xs text-rose-600 font-semibold mb-4">{camp.organizer}</p>

                    <div className="space-y-2.5 text-xs text-slate-600 mb-6">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{camp.startDate} {camp.endDate !== camp.startDate ? `to ${camp.endDate}` : ''}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{camp.timeSlot}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{camp.location}, {camp.city}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{camp.registeredCount} Donors Registered (Target: {camp.targetUnits} units)</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mb-6">{camp.description}</p>
                  </div>

                  <button
                    onClick={() => handleRSVP(camp.id)}
                    disabled={isRegistered || loadingId === camp.id}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                      isRegistered
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20'
                    }`}
                  >
                    {isRegistered ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Registered (Slot Confirmed)</span>
                      </>
                    ) : (
                      <span>Register to Donate</span>
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

import React, { useState, useEffect } from 'react';
import { publicApi } from '../../services/api';
import { Users, Building2, CheckCircle2, Droplet, ShieldCheck } from 'lucide-react';

interface PublicStats {
  totalDonors: number;
  totalHospitals: number;
  totalBloodBanks: number;
  totalUnitsAvailable: number;
  totalRequestsFulfilled: number;
}

export const LandingStatsStrip: React.FC = () => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await publicApi.getStats();
        if (isMounted && res.success && res.stats) {
          setStats({
            totalDonors: Number(res.stats.totalDonors) || 0,
            totalHospitals: Number(res.stats.totalHospitals) || 0,
            totalBloodBanks: Number(res.stats.totalBloodBanks) || 0,
            totalUnitsAvailable: Number(res.stats.totalUnitsAvailable) || 0,
            totalRequestsFulfilled: Number(res.stats.totalRequestsFulfilled) || 0,
          });
        }
      } catch (err) {
        console.warn('Failed to load public stats:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-white border-b border-slate-200/80 py-6 sm:py-8 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {loading ? (
          <div className="flex items-center justify-center space-x-3 text-xs text-slate-400 py-3">
            <div className="w-3.5 h-3.5 border-2 border-lifelink-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Syncing regional coordination metrics...</span>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            
            {/* Metric 1: Registered Donors */}
            <div className="flex items-center space-x-3.5 sm:justify-center pt-3 sm:pt-0">
              <div className="w-10 h-10 rounded-xl bg-lifelink-50 border border-lifelink-200/60 flex items-center justify-center text-lifelink-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {stats.totalDonors}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">donors</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Registered Donors
                </p>
              </div>
            </div>

            {/* Metric 2: Partner Facilities */}
            <div className="flex items-center space-x-3.5 sm:justify-center pt-3 sm:pt-0 sm:pl-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {stats.totalHospitals + stats.totalBloodBanks}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">centers</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Connected Hospitals & Hubs
                </p>
              </div>
            </div>

            {/* Metric 3: Units Available */}
            <div className="flex items-center space-x-3.5 sm:justify-center pt-3 sm:pt-0 sm:pl-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
                <Droplet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {stats.totalUnitsAvailable}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">units</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Tested Units Available
                </p>
              </div>
            </div>

            {/* Metric 4: Completed Requests */}
            <div className="flex items-center space-x-3.5 sm:justify-center pt-3 sm:pt-0 sm:pl-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {stats.totalRequestsFulfilled}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">fulfilled</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Requisitions Completed
                </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-slate-500 py-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Coordinating Verified Donors, Hospitals, and Blood Banks in Real Time</span>
          </div>
        )}

      </div>
    </div>
  );
};

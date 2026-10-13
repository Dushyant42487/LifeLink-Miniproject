import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { Droplet, RefreshCw, Sparkles, HeartHandshake, ShieldCheck } from 'lucide-react';

export const LandingBloodGroupMatrix: React.FC = () => {
  const [matrix, setMatrix] = useState<Record<string, any>>({
    'O-': { availableUnits: 2, rbc: 2, plasma: 1, platelets: 1, status: 'Critical' },
    'O+': { availableUnits: 14, rbc: 6, plasma: 5, platelets: 3, status: 'Normal' },
    'A+': { availableUnits: 11, rbc: 5, plasma: 4, platelets: 2, status: 'Normal' },
    'A-': { availableUnits: 4, rbc: 2, plasma: 1, platelets: 1, status: 'Low' },
    'B+': { availableUnits: 9, rbc: 4, plasma: 3, platelets: 2, status: 'Normal' },
    'B-': { availableUnits: 3, rbc: 1, plasma: 1, platelets: 1, status: 'Low' },
    'AB+': { availableUnits: 8, rbc: 3, plasma: 3, platelets: 2, status: 'Normal' },
    'AB-': { availableUnits: 3, rbc: 1, plasma: 1, platelets: 1, status: 'Low' },
  });
  const [selectedGroup, setSelectedGroup] = useState<string>('A+');
  const [loading, setLoading] = useState(false);

  // Blood compatibility data for public education
  const compatibilityMap: Record<string, { canDonateTo: string[]; canReceiveFrom: string[]; summary: string }> = {
    'O-': {
      canDonateTo: ['All Blood Groups (Universal Donor)'],
      canReceiveFrom: ['O-'],
      summary: 'Universal Red Blood Cell Donor. Critically needed for emergency trauma cases.'
    },
    'O+': {
      canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
      canReceiveFrom: ['O+', 'O-'],
      summary: 'Most frequently transfused blood type. Vital for daily clinical operations.'
    },
    'A+': {
      canDonateTo: ['A+', 'AB+'],
      canReceiveFrom: ['A+', 'A-', 'O+', 'O-'],
      summary: 'One of the most common blood types in the general population.'
    },
    'A-': {
      canDonateTo: ['A+', 'A-', 'AB+', 'AB-'],
      canReceiveFrom: ['A-', 'O-'],
      summary: 'Rare blood group. Highly valuable for Rh-negative recipients.'
    },
    'B+': {
      canDonateTo: ['B+', 'AB+'],
      canReceiveFrom: ['B+', 'B-', 'O+', 'O-'],
      summary: 'Essential blood group with strong regional demand for elective surgeries.'
    },
    'B-': {
      canDonateTo: ['B+', 'B-', 'AB+', 'AB-'],
      canReceiveFrom: ['B-', 'O-'],
      summary: 'Rare blood type. Regularly monitored for regional safety reserves.'
    },
    'AB+': {
      canDonateTo: ['AB+'],
      canReceiveFrom: ['All Blood Groups (Universal Recipient)'],
      summary: 'Universal Recipient for red blood cells, and Universal Plasma Donor.'
    },
    'AB-': {
      canDonateTo: ['AB+', 'AB-'],
      canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'],
      summary: 'The rarest blood type in the human population (~1% of all donors).'
    }
  };

  const fetchMatrix = async () => {
    setLoading(true);
    const res = await apiFetch('/public/stats');
    if (res.success && res.bloodGroupAvailability) {
      setMatrix(res.bloodGroupAvailability);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const selectedInfo = compatibilityMap[selectedGroup] || compatibilityMap['A+'];
  const stockInfo = matrix[selectedGroup] || { rbc: 0, plasma: 0, platelets: 0, status: 'Normal' };

  return (
    <section className="py-16 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 mb-2">
              Regional Supply Overview
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Real-Time Blood Supply Status</h3>
            <p className="text-xs text-slate-500 mt-1">
              Select a blood group to view live network supply indicators and biological compatibility standards.
            </p>
          </div>
          
          <button 
            onClick={fetchMatrix}
            disabled={loading}
            className="mt-4 sm:mt-0 flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Availability</span>
          </button>
        </div>

        {/* 8 Blood Group Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {Object.entries(matrix).map(([group, info]) => {
            const isCritical = info.status === 'Critical';
            const isLow = info.status === 'Low';
            const isSelected = selectedGroup === group;

            return (
              <button 
                key={group}
                onClick={() => setSelectedGroup(group)}
                type="button"
                className={`text-left rounded-2xl border p-4 flex flex-col justify-between transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-rose-600 ring-2 ring-rose-600/30 bg-rose-50/40 shadow-md scale-[1.03] z-10'
                    : isCritical 
                    ? 'bg-white border-rose-300 ring-1 ring-rose-500/20 shadow-sm hover:border-rose-400' 
                    : isLow
                    ? 'bg-white border-amber-200 hover:border-amber-300 hover:shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm border ${
                      isSelected 
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs' 
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {group}
                    </span>
                    <StatusBadge status={info.status} />
                  </div>

                  <div className="mt-3">
                    <span className="text-2xl font-extrabold text-slate-900">{info.rbc}</span>
                    <span className="text-xs text-slate-500 ml-1">RBC Units</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100/80 space-y-1 text-[11px] text-slate-500 w-full">
                  <div className="flex justify-between">
                    <span>Plasma:</span>
                    <span className="font-semibold text-slate-700">{info.plasma} u</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platelets:</span>
                    <span className="font-semibold text-slate-700">{info.platelets} u</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-2 text-center">
                    <span className="inline-block text-[10px] font-bold text-rose-700 uppercase tracking-wider bg-rose-100/70 px-2 py-0.5 rounded-md">
                      Selected
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Blood Group Compatibility & Details Card */}
        <div className="mt-8 bg-slate-50/80 border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            <div className="md:col-span-4 flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-rose-600/30 shrink-0">
                {selectedGroup}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-base text-slate-900">
                    Blood Group {selectedGroup}
                  </h4>
                  <StatusBadge status={stockInfo.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedInfo.summary}
                </p>
              </div>
            </div>

            <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center space-x-2 text-rose-600 font-bold text-xs uppercase tracking-wider mb-2">
                <HeartHandshake className="w-4 h-4" />
                <span>Can Donate Red Blood Cells To:</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold">
                {selectedInfo.canDonateTo.join(', ')}
              </p>
            </div>

            <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center space-x-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Can Safely Receive From:</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold">
                {selectedInfo.canReceiveFrom.join(', ')}
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

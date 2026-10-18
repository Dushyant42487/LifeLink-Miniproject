import React, { useState, useEffect } from 'react';
import { publicApi } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { Droplet, RefreshCw, Sparkles, HeartHandshake, ShieldCheck, AlertCircle } from 'lucide-react';

export const LandingBloodGroupMatrix: React.FC = () => {
  const [matrix, setMatrix] = useState<Record<string, any>>({
    'O-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Critical' },
    'O+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
    'A+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
    'A-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Low' },
    'B+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
    'B-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Low' },
    'AB+': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Normal' },
    'AB-': { availableUnits: 0, rbc: 0, plasma: 0, platelets: 0, status: 'Low' },
  });
  const [selectedGroup, setSelectedGroup] = useState<string>('O-');
  const [loading, setLoading] = useState(false);

  // Biological compatibility standards
  const compatibilityMap: Record<string, { canDonateTo: string[]; canReceiveFrom: string[]; summary: string }> = {
    'O-': {
      canDonateTo: ['All Blood Groups (Universal RBC Donor)'],
      canReceiveFrom: ['O-'],
      summary: 'Universal Red Blood Cell Donor. Essential for emergency surgical interventions and trauma resuscitation before blood typing.'
    },
    'O+': {
      canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
      canReceiveFrom: ['O+', 'O-'],
      summary: 'Most frequently transfused blood type. Vital for daily clinical inpatient needs and general surgery.'
    },
    'A+': {
      canDonateTo: ['A+', 'AB+'],
      canReceiveFrom: ['A+', 'A-', 'O+', 'O-'],
      summary: 'Common blood type in the general population. Supports cancer therapy, trauma, and elective procedures.'
    },
    'A-': {
      canDonateTo: ['A+', 'A-', 'AB+', 'AB-'],
      canReceiveFrom: ['A-', 'O-'],
      summary: 'Valuable Rh-negative group for emergency transfusions to Rh-negative recipients.'
    },
    'B+': {
      canDonateTo: ['B+', 'AB+'],
      canReceiveFrom: ['B+', 'B-', 'O+', 'O-'],
      summary: 'Essential blood group with strong regional demand for scheduled and acute surgical procedures.'
    },
    'B-': {
      canDonateTo: ['B+', 'B-', 'AB+', 'AB-'],
      canReceiveFrom: ['B-', 'O-'],
      summary: 'Rare blood type. Monitored continuously for emergency safety reserves.'
    },
    'AB+': {
      canDonateTo: ['AB+'],
      canReceiveFrom: ['All Blood Groups (Universal RBC Recipient)'],
      summary: 'Universal recipient for red blood cells, and universal donor for blood plasma components.'
    },
    'AB-': {
      canDonateTo: ['AB+', 'AB-'],
      canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'],
      summary: 'Rarest blood group (~1% of the population). Specialized management ensures availability.'
    }
  };

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await publicApi.getStats();
      if (res.success && res.bloodGroupAvailability) {
        setMatrix(res.bloodGroupAvailability);
      }
    } catch (err) {
      console.warn('Failed to load blood availability:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const selectedInfo = compatibilityMap[selectedGroup] || compatibilityMap['O-'];
  const stockInfo = matrix[selectedGroup] || { rbc: 0, plasma: 0, platelets: 0, status: 'Normal' };

  return (
    <section className="py-20 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-14">
          <div>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
              <Droplet className="w-3.5 h-3.5 text-lifelink-600" />
              <span className="uppercase text-[11px] font-bold tracking-wider">Regional Supply & Compatibility</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.18]">
              Live Blood Supply & Biological Compatibility
            </h2>
            <p className="mt-2 text-slate-600 text-xs sm:text-sm">
              Select any blood group to inspect current network availability and clinical transfusion compatibility.
            </p>
          </div>
          
          <button 
            onClick={fetchMatrix}
            disabled={loading}
            className="mt-4 md:mt-0 inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-lifelink-600' : 'text-slate-500'}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>

        {/* 8 Blood Group Selector Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
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
                    ? 'border-lifelink-600 ring-2 ring-lifelink-600/30 bg-lifelink-50/50 shadow-md scale-[1.02] z-10'
                    : isCritical 
                    ? 'bg-white border-rose-300 ring-1 ring-rose-500/20 shadow-xs hover:border-rose-400 hover:-translate-y-0.5' 
                    : isLow
                    ? 'bg-white border-amber-200 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm border ${
                      isSelected 
                        ? 'bg-lifelink-600 text-white border-lifelink-700 shadow-xs' 
                        : 'bg-lifelink-50 text-lifelink-700 border-lifelink-200/60'
                    }`}>
                      {group}
                    </span>
                    <StatusBadge status={info.status} />
                  </div>

                  <div className="mt-3">
                    <span className="text-2xl font-extrabold text-slate-900">{info.rbc || 0}</span>
                    <span className="text-xs text-slate-500 ml-1">RBC Units</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100/90 space-y-1 text-[11px] text-slate-500 w-full">
                  <div className="flex justify-between">
                    <span>Plasma:</span>
                    <span className="font-semibold text-slate-700">{info.plasma || 0} u</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platelets:</span>
                    <span className="font-semibold text-slate-700">{info.platelets || 0} u</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-2 text-center">
                    <span className="inline-block text-[10px] font-bold text-lifelink-700 uppercase tracking-wider bg-lifelink-100/80 px-2 py-0.5 rounded-md">
                      Selected
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Blood Group Details & Biological Compatibility Card */}
        <div className="mt-8 bg-slate-50/80 border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Overview */}
            <div className="md:col-span-4 flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-[#E81743] text-white flex items-center justify-center font-black text-2xl shadow-md shadow-rose-600/30 shrink-0">
                {selectedGroup}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    Blood Group {selectedGroup}
                  </h3>
                  <StatusBadge status={stockInfo.status} />
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {selectedInfo.summary}
                </p>
              </div>
            </div>

            {/* Can Donate Red Blood Cells To */}
            <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center space-x-2 text-lifelink-600 font-bold text-xs uppercase tracking-wider mb-2">
                <HeartHandshake className="w-4 h-4" />
                <span>Can Donate Red Cells To:</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                {selectedInfo.canDonateTo.join(', ')}
              </p>
            </div>

            {/* Can Safely Receive From */}
            <div className="md:col-span-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center space-x-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Can Safely Receive From:</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                {selectedInfo.canReceiveFrom.join(', ')}
              </p>
            </div>

          </div>

          {/* Contextual Notice */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 flex items-center space-x-2 text-[11px] text-slate-500">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Compatibility rules indicate red blood cell antigen matching. Physical cross-matching is always required before transfusion.</span>
          </div>
        </div>

      </div>
    </section>
  );
};

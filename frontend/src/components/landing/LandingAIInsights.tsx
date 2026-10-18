import React from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Sliders, 
  Compass, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

export const LandingAIInsights: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Predictive Decision Support</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Smarter Insights. Better Preparedness.
          </h2>
          <p className="mt-3.5 text-slate-600 text-sm sm:text-base leading-relaxed">
            Operational visibility to help blood centers anticipate shortages, prioritize inventory, and coordinate resources.
          </p>
        </div>

        {/* Visually Interesting 5-Module Asymmetric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Module 1: Demand Forecasting (Spans 6 cols on desktop) */}
          <div className="md:col-span-6 bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/80">
                  Trend Modeling
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Demand Forecasting</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg mb-5">
                Evaluates seasonal trends and historical clinical demand patterns to assist facilities with prospective blood supply planning.
              </p>
            </div>

            {/* Contextual Visual: Forecast Indicators */}
            <div className="pt-4 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-white border border-slate-200/60">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">7-Day</p>
                <p className="font-bold text-slate-800 text-xs mt-0.5">Tactical Requisition</p>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200/60">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">30-Day</p>
                <p className="font-bold text-slate-800 text-xs mt-0.5">Elective Surgery</p>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200/60">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">90-Day</p>
                <p className="font-bold text-slate-800 text-xs mt-0.5">Seasonal Baseline</p>
              </div>
            </div>
          </div>

          {/* Module 2: Shortage Risk Detection (Spans 6 cols on desktop) */}
          <div className="md:col-span-6 bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-lifelink-50 text-lifelink-600 border border-lifelink-200/60 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lifelink-50 text-lifelink-700 border border-lifelink-200/80">
                  Threshold Alerting
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Shortage Risk Detection</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg mb-5">
                Surfaces critical inventory deficits across Rh-negative and high-turnover groups before surgical disruption occurs.
              </p>
            </div>

            {/* Contextual Visual: Threshold Status */}
            <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/60 text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-lifelink-600 animate-pulse"></span>
                <span className="font-bold text-slate-800">Buffer Threshold Watchlist:</span>
                <span className="text-slate-500 font-medium">O- & B- Rare Reservoirs</span>
              </div>
              <span className="text-[10px] font-bold text-lifelink-700 uppercase bg-lifelink-50 px-2 py-0.5 rounded-md">
                Active Rule
              </span>
            </div>
          </div>

          {/* Module 3: Expiry & Wastage Risk (Spans 4 cols on desktop) */}
          <div className="md:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/80">
                  FEFO Priority
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Expiry & Wastage Risk</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Prioritizes short shelf-life units such as platelets to support first-expiry allocation and reduce wastage.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Platelet Agitation: 5d</span>
              <span className="font-semibold text-slate-800">RBC Storage: 42d</span>
            </div>
          </div>

          {/* Module 4: Inventory Recommendations (Spans 4 cols on desktop) */}
          <div className="md:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  Safety Buffers
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Inventory Recommendations</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Suggests target holding volumes per component type to balance routine readiness against cold-chain storage capacity.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Dynamic Minimums</span>
              <span className="font-semibold text-emerald-600">Capacity Optimized</span>
            </div>
          </div>

          {/* Module 5: Donation Camp Recommendations (Spans 4 cols on desktop) */}
          <div className="md:col-span-4 bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80">
                  Targeted Drives
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Donation Camp Recommendations</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Provides geographic recommendations for voluntary donation drives based on upcoming regional blood group deficits.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Regional Mobilization</span>
              <span className="font-semibold text-blue-600">Deficit-Aware</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

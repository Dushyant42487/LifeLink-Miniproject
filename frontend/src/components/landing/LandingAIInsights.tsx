import React from 'react';
import { BrainCircuit, TrendingUp, AlertOctagon, Clock, Sparkles, Megaphone } from 'lucide-react';

export const LandingAIInsights: React.FC = () => {
  return (
    <section className="py-16 bg-slate-50/80 text-slate-900 border-b border-slate-200/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 mb-3 shadow-xs">
            <BrainCircuit className="w-3.5 h-3.5 text-rose-600" />
            <span>AI Decision-Support System</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Intelligent Blood Management</h2>
          <p className="mt-3 text-slate-600 text-sm">
            Leveraging predictive analytics to forecast demand, prevent critical shortages, eliminate unit wastage, and optimize voluntary campaign schedules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Demand Forecasting */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Demand Forecasting</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              7-day, 30-day, and 90-day predictive models analyzing historical surgical consumption, seasonal patterns, and emergency frequency.
            </p>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200/80">
              Scikit-Learn Regression Engine
            </span>
          </div>

          {/* Card 2: Shortage Prediction */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Shortage Risk Detection</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Flags critical inventory deficits (e.g. O- RBC stock below 2 units) before emergency surgical disruptions occur.
            </p>
            <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200/80">
              Real-time Threshold Monitoring
            </span>
          </div>

          {/* Card 3: Wastage & Expiry Prevention */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Expiry & Wastage Risk</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Identifies short-shelf-life units (Platelets & RBCs) at risk of expiring before clinical usage and recommends priority allocation.
            </p>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80">
              FIFO Stock Optimization
            </span>
          </div>

          {/* Card 4: Inventory Optimization */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Inventory Recommendations</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Recommends optimal stock buffer levels per component to balance emergency readiness against storage costs.
            </p>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80">
              Dynamic Safety Buffers
            </span>
          </div>

          {/* Card 5: Smart Campaigns */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-rose-300 transition-all md:col-span-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
              <Megaphone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Targeted Donation Campaign Recommendations</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Automatically recommends targeted voluntary donation drives tailored to upcoming specific blood group deficits (e.g., "Schedule O- drive in Midtown 5 days before anticipated surgical peak").
            </p>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/80">
              Automated Campaign Advisor
            </span>
          </div>

        </div>

      </div>
    </section>
  );
};

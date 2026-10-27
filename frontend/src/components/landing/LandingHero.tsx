import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  LogIn, 
  Activity, 
  Award, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section 
      id="home" 
      className="scroll-mt-24 relative overflow-hidden bg-gradient-to-b from-lifelink-50/40 via-white to-slate-50/80 text-slate-900 pt-10 sm:pt-14 pb-16 sm:pb-20 border-b border-slate-200/80"
    >
      {/* Background Soft Glow */}
      <div 
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[650px] h-[500px] bg-gradient-to-tr from-lifelink-100/30 via-rose-100/20 to-transparent rounded-full blur-3xl pointer-events-none -z-10" 
        aria-hidden="true" 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* ============================================================ */}
          {/* Left Column: Headline, Narrative & CTAs                      */}
          {/* ============================================================ */}
          <div className="lg:col-span-6 space-y-6 text-left">
            
            {/* Eyebrow Badge */}
            <div>
              <span className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-lifelink-50 text-lifelink-700 border border-lifelink-200/80 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-lifelink-600" />
                <span className="tracking-wide uppercase text-[11px] font-bold">Verified Blood Coordination Platform</span>
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Coordinated Care. <br />
              <span className="text-lifelink-600">Faster Blood Response.</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Connecting voluntary donors, hospitals, and blood banks through one coordinated platform for verified donations, urgent requests, and reliable blood availability.
            </p>

            {/* Call to Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/register"
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-lifelink-600 hover:bg-lifelink-700 text-white shadow-md shadow-lifelink-600/25 hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#portals"
                className="px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-lifelink-50/60 text-slate-800 border border-slate-200 shadow-2xs transition-all hover:scale-[1.02] active:scale-95 flex items-center space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600"
              >
                <Users className="w-4 h-4 text-lifelink-600" />
                <span>Explore Portals</span>
              </a>

              <Link
                to="/login"
                className="px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm text-slate-600 hover:text-slate-900 transition-colors flex items-center space-x-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600"
              >
                <LogIn className="w-4 h-4 text-slate-400" />
                <span>Sign In</span>
              </Link>
            </div>

            {/* Row of Compact Capabilities */}
            <div className="pt-3 border-t border-slate-200/70">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="flex items-center space-x-1.5 text-slate-700 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lifelink-600 shrink-0" />
                  <span className="font-semibold text-[11px] truncate">Verified Donors</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-700 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lifelink-600 shrink-0" />
                  <span className="font-semibold text-[11px] truncate">Request Tracking</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-700 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lifelink-600 shrink-0" />
                  <span className="font-semibold text-[11px] truncate">Blood Availability</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-700 bg-white/80 border border-slate-200/70 rounded-lg px-2.5 py-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lifelink-600 shrink-0" />
                  <span className="font-semibold text-[11px] truncate">Digital Certificates</span>
                </div>
              </div>
            </div>

          </div>

          {/* ============================================================ */}
          {/* Right Column: Realistic Product UI Composition               */}
          {/* ============================================================ */}
          <div className="lg:col-span-6 relative mt-6 lg:mt-0">
            
            {/* Floating Top Badge: Digital Certificate Preview */}
            <div className="absolute -top-4 -right-2 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-lg shadow-slate-900/5 hidden sm:flex items-center space-x-3 transition-transform hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="pr-1">
                <div className="flex items-center space-x-1.5">
                  <p className="font-bold text-slate-900 text-xs">Digital Certificate</p>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-[11px] text-slate-500">Verified Voluntary Donor (Credential Preview)</p>
              </div>
            </div>

            {/* Main Interactive Product Mockup Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-900/5 relative z-10 space-y-5">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-lifelink-600 animate-pulse"></div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Regional Coordination Hub</h3>
                    <p className="text-[11px] text-slate-400">Live inventory & active clinical requisitions</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Sync
                  </span>
                </div>
              </div>

              {/* Blood Component Inventory Rings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Blood Group Availability
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Safe Reserves</span>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center">
                  
                  {/* O- Gauge */}
                  <div className="flex flex-col items-center p-2 rounded-2xl bg-slate-50/70 border border-slate-100">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-200" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-lifelink-600" strokeDasharray="45, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute font-black text-xs text-lifelink-600">O-</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 mt-1">Priority</span>
                    <span className="text-[10px] text-slate-400">Universal</span>
                  </div>

                  {/* A+ Gauge */}
                  <div className="flex flex-col items-center p-2 rounded-2xl bg-slate-50/70 border border-slate-100">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-200" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-emerald-500" strokeDasharray="80, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute font-black text-xs text-emerald-600">A+</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 mt-1">Adequate</span>
                    <span className="text-[10px] text-slate-400">RBC & Platelets</span>
                  </div>

                  {/* B+ Gauge */}
                  <div className="flex flex-col items-center p-2 rounded-2xl bg-slate-50/70 border border-slate-100">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-200" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-blue-500" strokeDasharray="65, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute font-black text-xs text-blue-600">B+</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 mt-1">Normal</span>
                    <span className="text-[10px] text-slate-400">Stable Pool</span>
                  </div>

                  {/* AB- Gauge */}
                  <div className="flex flex-col items-center p-2 rounded-2xl bg-slate-50/70 border border-slate-100">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-200" strokeWidth="3.2" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-amber-500" strokeDasharray="30, 100" strokeWidth="3.2" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute font-black text-xs text-amber-600">AB-</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 mt-1">Monitored</span>
                    <span className="text-[10px] text-slate-400">Rare Type</span>
                  </div>

                </div>
              </div>

              {/* Request Tracking List */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Active Hospital Requests
                  </span>
                  <span className="text-[10px] text-slate-400">FEFO Allocated</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Item 1 */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-lg bg-lifelink-50 text-lifelink-700 font-bold text-xs flex items-center justify-center border border-lifelink-200/60">
                        O-
                      </span>
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">Trauma Center Requisition</p>
                        <p className="text-[10px] text-slate-400">Emergency Protocol · 2 Units RBC</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Dispatched
                    </span>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-200/60">
                        A+
                      </span>
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">Elective Surgery Reserve</p>
                        <p className="text-[10px] text-slate-400">Scheduled Procedure · Cross-Matched</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Fulfilled
                    </span>
                  </div>
                </div>
              </div>

              {/* Informative Caption */}
              <div className="pt-2 text-[10px] text-slate-400 text-center flex items-center justify-center space-x-1">
                <Sparkles className="w-3 h-3 text-lifelink-600" />
                <span>Illustrative clinical dashboard preview · Live data syncs inside role portals</span>
              </div>

            </div>

            {/* Floating Bottom Badge: Donor Match Confirmation */}
            <div className="absolute -bottom-5 -left-3 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-lg shadow-slate-900/5 hidden sm:flex items-center space-x-3 max-w-xs transition-transform hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-xl bg-lifelink-50 text-lifelink-600 flex items-center justify-center border border-lifelink-200/60 shrink-0">
                <Activity className="w-4 h-4 text-lifelink-600 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-xs">Donor Match Confirmed</p>
                <p className="text-[10px] text-slate-500">O- verified voluntary donor allocated to trauma emergency</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

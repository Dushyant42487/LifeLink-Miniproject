import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, LogIn, ShieldCheck, Activity, Users, CheckCircle2, Award, ArrowRight } from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section id="home" className="scroll-mt-20 relative overflow-hidden bg-gradient-to-b from-rose-50/40 via-white to-slate-50/80 text-slate-900 pt-8 pb-16 border-b border-slate-200/80">
      
      {/* Soft Light Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-200/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Top Badge */}
            <div>
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100/70 text-rose-700 border border-rose-200/80 shadow-2xs">
                <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                <span>Verified Blood Coordination Platform</span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
              Coordinated Care. <br />
              <span className="text-rose-600">Cleaner Response.</span>
            </h1>

            {/* Subhead */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              LifeLink brings donors, hospitals, and blood banks onto one structured platform for registration, verification, request handling, certificates, notifications, and better day-to-day blood coordination.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/register"
                className="px-5 py-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 hover:scale-[1.02] transition-all flex items-center space-x-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#portals"
                className="px-5 py-3 rounded-xl font-bold text-xs bg-white hover:bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs hover:scale-[1.02] transition-all flex items-center space-x-2"
              >
                <Users className="w-4 h-4 text-rose-600" />
                <span>Explore Portals</span>
              </a>

              <Link
                to="/login"
                className="px-5 py-3 rounded-xl font-bold text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center space-x-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Portal Login</span>
              </Link>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 pt-2 text-xs">
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Donor Verification</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hospital Portal</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Request Tracking</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Certificates & Achievements</span>
              </span>
            </div>

            {/* Bottom Banner Pill */}
            <div className="pt-3">
              <div className="inline-flex flex-wrap items-center gap-3 px-4 py-2 rounded-2xl bg-rose-50/70 border border-rose-200/70 text-xs text-slate-700 font-medium">
                <span className="flex items-center space-x-1 text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>Structured verification flow</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center space-x-1 text-slate-800">
                  <Users className="w-4 h-4 text-rose-600" />
                  <span><strong>3,200+</strong> Active Donors</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center space-x-1 text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-rose-600" />
                  <span><strong>127</strong> Partner Hospitals</span>
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Dashboard Mockup */}
          <div className="lg:col-span-6 relative mt-6 lg:mt-0">
            
            {/* Top Floating Badge: Certificate Issued */}
            <div className="absolute -top-4 -right-2 z-20 bg-white border border-slate-200 rounded-2xl p-3 shadow-lg flex items-center space-x-3 text-xs hidden sm:flex">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-[11px]">Certificate Issued</p>
                <p className="text-[10px] text-slate-500">Arjun M. · Donation #12</p>
              </div>
            </div>

            {/* Main Dashboard Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xl relative z-10 space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-5"></span>
                  <h3 className="font-bold text-slate-900 text-sm">Live Blood Inventory</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                  LIVE
                </span>
              </div>

              {/* 4 Circular Ring Gauges */}
              <div className="grid grid-cols-4 gap-3 text-center">
                
                {/* A+ Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-rose-500" strokeDasharray="75, 100" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="absolute font-extrabold text-xs text-rose-600">A+</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1.5">42u</span>
                </div>

                {/* B+ Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-blue-500" strokeDasharray="60, 100" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="absolute font-extrabold text-xs text-blue-600">B+</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1.5">28u</span>
                </div>

                {/* O+ Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-emerald-500" strokeDasharray="85, 100" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="absolute font-extrabold text-xs text-emerald-600">O+</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1.5">61u</span>
                </div>

                {/* AB- Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-amber-500" strokeDasharray="35, 100" strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <span className="absolute font-extrabold text-xs text-amber-600">AB-</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1.5">8u</span>
                </div>

              </div>

              {/* Request Status Rows */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-rose-600">O-</span>
                    <span className="text-slate-600 font-mono text-[11px]">REQ-041</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                    pending
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-rose-600">A+</span>
                    <span className="text-slate-600 font-mono text-[11px]">REQ-042</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                    matched
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-rose-600">O+</span>
                    <span className="text-slate-600 font-mono text-[11px]">REQ-043</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    fulfilled
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Floating Badge: Donor Matched */}
            <div className="absolute -bottom-5 -left-3 z-20 bg-white border border-slate-200 rounded-2xl p-3 shadow-lg flex items-center space-x-3 text-xs max-w-xs hidden sm:flex">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                <Activity className="w-4 h-4 text-rose-600 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-[11px]">Donor Matched</p>
                <p className="text-[10px] text-slate-500">O- donor verified · Emergency request fulfilled</p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

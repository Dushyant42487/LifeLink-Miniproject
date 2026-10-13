import React from 'react';
import { Link } from 'react-router-dom';
import { Droplet, ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold shadow-sm shadow-rose-600/30">
                <Droplet className="w-5 h-5 fill-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Life<span className="text-rose-500">Link</span></span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-sm">
              An intelligent blood donation, inventory management, and demand prediction platform connecting donors, hospitals, and blood banks across regional healthcare networks.
            </p>
          </div>

          {/* Donors */}
          <div>
            <h5 className="font-bold text-white text-sm mb-3">For Donors</h5>
            <ul className="space-y-2">
              <li><Link to="/register?role=donor" className="text-slate-400 hover:text-rose-400 transition-colors">Register as Donor</Link></li>
              <li><Link to="/donor/eligibility" className="text-slate-400 hover:text-rose-400 transition-colors">Eligibility Calculator</Link></li>
              <li><Link to="/donor/camps" className="text-slate-400 hover:text-rose-400 transition-colors">Find Blood Camps</Link></li>
              <li><Link to="/awareness" className="text-slate-400 hover:text-rose-400 transition-colors">Blood Safety Guide</Link></li>
            </ul>
          </div>

          {/* Healthcare Facilities */}
          <div>
            <h5 className="font-bold text-white text-sm mb-3">Facilities</h5>
            <ul className="space-y-2">
              <li><Link to="/register?role=hospital" className="text-slate-400 hover:text-rose-400 transition-colors">Hospital Registration</Link></li>
              <li><Link to="/register?role=blood_bank" className="text-slate-400 hover:text-rose-400 transition-colors">Blood Bank Portal</Link></li>
              <li><Link to="/search-blood" className="text-slate-400 hover:text-rose-400 transition-colors">Search Blood Availability</Link></li>
              <li><Link to="/login" className="text-slate-400 hover:text-rose-400 transition-colors">Facility Sign In</Link></li>
            </ul>
          </div>

          {/* Platform & Legal */}
          <div>
            <h5 className="font-bold text-white text-sm mb-3">Platform</h5>
            <ul className="space-y-2">
              <li><a href="#how-it-works" className="text-slate-400 hover:text-rose-400 transition-colors">How It Works</a></li>
              <li><span className="text-slate-400 hover:text-rose-400 cursor-pointer">Privacy Policy</span></li>
              <li><span className="text-slate-400 hover:text-rose-400 cursor-pointer">Terms of Service</span></li>
              <li><span className="text-slate-400 hover:text-rose-400 cursor-pointer">Security & Compliance</span></li>
            </ul>
          </div>

        </div>

        {/* Medical Disclaimer Banner in Footer */}
        <div className="pt-6 border-t border-slate-800 bg-slate-800/60 rounded-xl p-4 text-[11px] text-slate-300 flex items-start space-x-3 mb-6 border border-slate-700/60">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-white">Emergency & Medical Disclaimer:</strong> LifeLink is a decision-support and workflow software platform. All demand forecasts and inventory indicators are model-generated estimates for operational planning. Physical laboratory testing, ABO/Rh typing, disease screening, and clinical compatibility cross-matching must be performed by certified medical personnel before blood transfusion.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 pt-4 border-t border-slate-800">
          <p>© 2026 LifeLink Healthcare Technology Platform. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">Production Prototype for BTech CS Healthcare Innovation</p>
        </div>

      </div>
    </footer>
  );
};

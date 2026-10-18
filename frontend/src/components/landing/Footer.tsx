import React from 'react';
import { Link } from 'react-router-dom';
import { Droplet, ShieldAlert, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-10">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E81743] flex items-center justify-center text-white font-bold shadow-sm shadow-rose-600/30">
                <Droplet className="w-4 h-4 fill-white" />
              </div>
              <span className="text-xl font-black text-white tracking-tight">
                Life<span className="text-lifelink-500">Link</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Coordinated care and blood response. A unified platform connecting voluntary donors, clinical hospital facilities, and certified blood centers for safe and verified allocation.
            </p>
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3.5">Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#home" className="text-slate-400 hover:text-white transition-colors">Home</a>
              </li>
              <li>
                <a href="#portals" className="text-slate-400 hover:text-white transition-colors">Role Portals</a>
              </li>
              <li>
                <a href="#how-it-works" className="text-slate-400 hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#awareness" className="text-slate-400 hover:text-white transition-colors">Clinical Awareness</a>
              </li>
            </ul>
          </div>

          {/* Role Portals Links */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3.5">Specialized Portals</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/login?role=donor" className="text-slate-400 hover:text-lifelink-400 transition-colors">
                  Donor Portal
                </Link>
              </li>
              <li>
                <Link to="/login?role=hospital" className="text-slate-400 hover:text-lifelink-400 transition-colors">
                  Hospital Portal
                </Link>
              </li>
              <li>
                <Link to="/login?role=blood_bank" className="text-slate-400 hover:text-lifelink-400 transition-colors">
                  Blood Bank Portal
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-slate-400 hover:text-lifelink-400 transition-colors">
                  Register Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Educational & Awareness Links */}
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3.5">Education</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#awareness" className="text-slate-400 hover:text-white transition-colors">
                  Blood Components
                </a>
              </li>
              <li>
                <a href="#awareness" className="text-slate-400 hover:text-white transition-colors">
                  Donation Eligibility
                </a>
              </li>
              <li>
                <a href="#awareness" className="text-slate-400 hover:text-white transition-colors">
                  Safety & Screening
                </a>
              </li>
              <li>
                <Link to="/search-blood" className="text-slate-400 hover:text-white transition-colors">
                  Search Blood Availability
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Clinical Disclaimer Banner */}
        <div className="pt-6 border-t border-slate-800 bg-slate-800/40 rounded-2xl p-4 text-[11px] text-slate-300 flex items-start space-x-3 mb-8 border border-slate-700/60">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Emergency & Transfusion Disclaimer:</strong> LifeLink is a software coordination platform. All inventory indicators and planning tools are estimates designed to support clinical workflows. Physical blood group verification, antibody screening, and laboratory compatibility cross-matching must be performed by certified clinical personnel prior to blood administration.
          </p>
        </div>

        {/* Simple Truthful Copyright Line */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 pt-4 border-t border-slate-800/80">
          <p>© 2026 LifeLink. All rights reserved.</p>
          <p className="mt-2 sm:mt-0 text-slate-500">Blood Donation Coordination & Inventory Platform</p>
        </div>

      </div>
    </footer>
  );
};

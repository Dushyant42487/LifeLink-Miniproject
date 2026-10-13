import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, 
  UserCheck, 
  History, 
  AlertCircle, 
  Compass, 
  Search, 
  PlusCircle, 
  FileText, 
  TestTube, 
  MessageSquare, 
  Package, 
  CheckSquare, 
  BrainCircuit, 
  BarChart3,
  Building2,
  ShieldCheck,
  LogOut,
  Lock,
  Navigation,
  User,
  Thermometer
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const role = user.role;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
      isActive
        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20 font-semibold'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex-col justify-between shrink-0">
      <div className="space-y-6">
        
        {/* User Profile Header Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-rose-600/20">
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs text-slate-900 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 capitalize font-medium">{role.replace('_', ' ')} Account</p>
            </div>
          </div>

          {role === 'donor' && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[10px]">
              <span className="font-bold text-slate-700">Blood Group: <strong className="text-rose-600 font-extrabold text-xs">{user.bloodGroup || 'O+'}</strong></span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                {user.verificationStatus || 'Verified'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-1">

          {/* ========================================================= */}
          {/* 1. DONOR MODULE SIDEBAR                                    */}
          {/* ========================================================= */}
          {role === 'donor' && (
            <>
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Donor Navigation</div>
              <NavLink to="/donor/dashboard" className={linkClasses}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/donor/profile" className={linkClasses}>
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </NavLink>
              <NavLink to="/donor/eligibility" className={linkClasses}>
                <UserCheck className="w-4 h-4" />
                <span>Eligibility</span>
              </NavLink>
              <NavLink to="/donor/donations" className={linkClasses}>
                <History className="w-4 h-4" />
                <span>Donation History</span>
              </NavLink>
              <NavLink to="/donor/camps" className={linkClasses}>
                <Compass className="w-4 h-4" />
                <span>Camps & Requests</span>
              </NavLink>
              <NavLink to="/donor/alerts" className={linkClasses}>
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>Emergency Alerts</span>
              </NavLink>
            </>
          )}

          {/* ========================================================= */}
          {/* 2. HOSPITAL MODULE SIDEBAR                                 */}
          {/* ========================================================= */}
          {role === 'hospital' && (
            <>
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Hospital Operations</div>
              <NavLink to="/hospital/dashboard" className={linkClasses}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/hospital/availability" className={linkClasses}>
                <Search className="w-4 h-4" />
                <span>Blood Availability</span>
              </NavLink>
              <NavLink to="/hospital/requests/new" className={linkClasses}>
                <PlusCircle className="w-4 h-4 text-rose-600" />
                <span>Create Requisition</span>
              </NavLink>
              <NavLink to="/hospital/requests" className={linkClasses}>
                <FileText className="w-4 h-4" />
                <span>My Requests & Tracking</span>
              </NavLink>
              <NavLink to="/hospital/samples" className={linkClasses}>
                <TestTube className="w-4 h-4" />
                <span>Patient Samples Log</span>
              </NavLink>
              <NavLink to="/hospital/messages" className={linkClasses}>
                <MessageSquare className="w-4 h-4" />
                <span>Bank Communications</span>
              </NavLink>
              <NavLink to="/hospital/logistics" className={linkClasses}>
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span>Logistics & Regional Map</span>
              </NavLink>
            </>
          )}

          {/* ========================================================= */}
          {/* 3. BLOOD BANK MODULE SIDEBAR                              */}
          {/* ========================================================= */}
          {role === 'blood_bank' && (
            <>
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Blood Bank Operations</div>
              <NavLink to="/blood-bank/dashboard" className={linkClasses}>
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/blood-bank/inventory" className={linkClasses}>
                <Package className="w-4 h-4" />
                <span>Blood Unit Inventory</span>
              </NavLink>
              <NavLink to="/blood-bank/cold-storage" className={linkClasses}>
                <Thermometer className="w-4 h-4 text-cyan-600" />
                <span>Cold-Storage Monitoring</span>
              </NavLink>
              <NavLink to="/blood-bank/requests" className={linkClasses}>
                <FileText className="w-4 h-4" />
                <span>Hospital Requests</span>
              </NavLink>
              <NavLink to="/blood-bank/reservations" className={linkClasses}>
                <Lock className="w-4 h-4 text-purple-600" />
                <span>Reservations</span>
              </NavLink>
              <NavLink to="/blood-bank/collections" className={linkClasses}>
                <Compass className="w-4 h-4 text-rose-600" />
                <span>Blood Collections & Drives</span>
              </NavLink>
              <NavLink to="/blood-bank/analytics" className={linkClasses}>
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Inventory Analytics</span>
              </NavLink>
              <NavLink to="/blood-bank/testing" className={linkClasses}>
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>Lab Screening</span>
              </NavLink>
              <NavLink to="/blood-bank/ai-insights" className={linkClasses}>
                <BrainCircuit className="w-4 h-4 text-purple-600" />
                <span>AI Intelligence</span>
              </NavLink>
            </>
          )}

        </nav>
      </div>

      {/* Footer Section with Logout & Status */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        {/* Universal Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors border border-rose-100 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out / Logout</span>
        </button>

        <div className="bg-rose-50/50 rounded-xl p-3 text-[11px] text-slate-600">
          <div className="flex items-center space-x-1.5 font-bold text-rose-700 mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>LifeLink Verified</span>
          </div>
          <p className="text-[10px] text-slate-500">Regional Blood Network Active</p>
        </div>
      </div>
    </aside>
  );
};

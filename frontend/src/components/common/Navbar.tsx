import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { donorApi } from '../../services/api';
import { AppNotification } from '../../types';
import { Droplet, Bell, LogOut, ChevronDown, Sparkles, Menu, X, ChevronRight, User, CheckCheck, Clock, ExternalLink, LayoutDashboard, UserCheck, History, Compass, AlertCircle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('home');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menus on route change
  useEffect(() => {
    setShowNotifCenter(false);
    setShowUserMenu(false);
    setShowRoleMenu(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Outside Click & Escape key dismissal for all dropdown menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifCenter(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifCenter(false);
        setShowUserMenu(false);
        setShowRoleMenu(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isHomePage = location.pathname === '/';
  const isPortalPage = location.pathname.startsWith('/donor') || 
                       location.pathname.startsWith('/hospital') || 
                       location.pathname.startsWith('/blood-bank');

  // Compute breadcrumb title for portal pages
  const getPortalBreadcrumb = () => {
    const path = location.pathname;

    // Blood Bank Portal Routes
    if (path.startsWith('/blood-bank')) {
      if (path.includes('/dashboard')) return 'Dashboard';
      if (path.includes('/inventory')) return 'Blood Unit Inventory';
      if (path.includes('/reservations')) return 'Reservations';
      if (path.includes('/analytics')) return 'Inventory Analytics';
      if (path.includes('/testing')) return 'Lab Screening';
      if (path.includes('/cold-storage')) return 'Cold-Storage Monitoring';
      if (path.includes('/collections') || path.includes('/camps')) return 'Blood Collections & Drives';
      if (path.includes('/requests') || path.includes('/hospital-requests')) return 'Hospital Requests';
      if (path.includes('/ai-insights')) return 'AI Intelligence';
      return 'Dashboard';
    }

    // Hospital Portal Routes
    if (path.startsWith('/hospital')) {
      if (path.includes('/dashboard')) return 'Dashboard';
      if (path.includes('/availability')) return 'Blood Availability Search';
      if (path.includes('/requests')) return 'Hospital Requests';
      if (path.startsWith('/hospital/emergency')) return 'Emergency Requisitions';
      if (path.includes('/samples')) return 'Patient Samples Log';
      if (path.includes('/messages')) return 'Bank Communications';
      if (path.includes('/logistics')) return 'Logistics & Regional Map';
      return 'Dashboard';
    }

    // Donor Portal Routes
    if (path.startsWith('/donor')) {
      if (path.includes('/dashboard')) return 'Dashboard';
      if (path.includes('/profile')) return 'My Profile & Preferences';
      if (path.includes('/eligibility')) return 'Eligibility Engine';
      if (path.includes('/donations')) return 'Donation History & Wallet';
      if (path.includes('/camps')) return 'Nearby Camps & Org Requests';
      return 'Dashboard';
    }

    return 'Dashboard';
  };

  // Fetch notifications
  useEffect(() => {
    if (user && user.role === 'donor') {
      fetchNotifications();
    }
  }, [user, location.pathname]);

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    const res = await donorApi.getNotifications();
    if (res.success && res.notifications) {
      setNotifications(res.notifications);
    }
    setLoadingNotifs(false);
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await donorApi.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await donorApi.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Listen to scroll events to adjust navbar appearance & highlight active section
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      if (!isHomePage) return;

      const sections = ['home', 'portals', 'how-it-works', 'awareness'];
      const scrollPosition = window.scrollY + 120;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(sections[i]);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (isHomePage) {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else if (sectionId === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      navigate(`/#${sectionId}`);
    }
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'donor') return '/donor/dashboard';
    if (user.role === 'hospital') return '/hospital/dashboard';
    if (user.role === 'blood_bank') return '/blood-bank/dashboard';
    return '/';
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm shadow-slate-900/5 py-1' 
        : 'bg-white border-b border-slate-200/80 py-2'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          
          {/* Brand Logo & Breadcrumbs */}
          <div className="flex items-center space-x-3">
            <Link to={user ? getDashboardPath() : "/"} className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                <Droplet className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900">Life<span className="text-rose-600">Link</span></span>
                {!isPortalPage && (
                  <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full">
                    Regional Hub
                  </span>
                )}
              </div>
            </Link>

            {/* Portal Breadcrumb (Shown on Authenticated Portal Pages) */}
            {isPortalPage && user && (
              <div className="hidden sm:flex items-center space-x-2 border-l border-slate-200 pl-3 ml-2 text-xs font-semibold text-slate-600">
                <Link
                  to={user.role === 'hospital' ? '/hospital/dashboard' : user.role === 'blood_bank' ? '/blood-bank/dashboard' : '/donor/dashboard'}
                  className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {user.role === 'blood_bank' ? 'Blood Bank Portal' : `${user.role} Portal`}
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-900 font-bold">{getPortalBreadcrumb()}</span>
              </div>
            )}
          </div>

          {/* Navigation Links (Desktop — Shown ONLY on Public / Landing Pages) */}
          {!isPortalPage && (
            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
              <button 
                onClick={() => scrollToSection('home')}
                className={`transition-colors cursor-pointer ${
                  isHomePage && activeSection === 'home' ? 'text-rose-600 font-bold' : 'text-slate-600 hover:text-rose-600'
                }`}
              >
                Home
              </button>
              <button 
                onClick={() => scrollToSection('portals')}
                className={`transition-colors cursor-pointer ${
                  isHomePage && activeSection === 'portals' ? 'text-rose-600 font-bold' : 'text-slate-600 hover:text-rose-600'
                }`}
              >
                Portals
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')}
                className={`transition-colors cursor-pointer ${
                  isHomePage && activeSection === 'how-it-works' ? 'text-rose-600 font-bold' : 'text-slate-600 hover:text-rose-600'
                }`}
              >
                How It Works
              </button>
              <button 
                onClick={() => scrollToSection('awareness')}
                className={`transition-colors cursor-pointer ${
                  isHomePage && activeSection === 'awareness' ? 'text-rose-600 font-bold' : 'text-slate-600 hover:text-rose-600'
                }`}
              >
                Awareness
              </button>
            </nav>
          )}

          {/* Action CTAs & User Menu */}
          <div className="flex items-center space-x-3">

            {/* Quick Demo Role Switcher */}
            <div className="relative" ref={roleMenuRef}>
              <button 
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Switch demo user role instantly"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Demo Access</span>
                <span className="sm:hidden">Demo</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Select Stakeholder Role</div>
                  <button 
                    onClick={() => { switchDemoRole('donor'); setShowRoleMenu(false); navigate('/donor/dashboard'); }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-slate-900">Donor Portal</p>
                      <p className="text-[10px] text-slate-500">Alex M. (O+)</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-[10px] font-semibold text-rose-700">Donor</span>
                  </button>
                  <button 
                    onClick={() => { switchDemoRole('hospital'); setShowRoleMenu(false); navigate('/hospital/dashboard'); }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-slate-900">Hospital Portal</p>
                      <p className="text-[10px] text-slate-500">Apollo General</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[10px] font-semibold text-orange-700">Hospital</span>
                  </button>
                  <button 
                    onClick={() => { switchDemoRole('blood_bank'); setShowRoleMenu(false); navigate('/blood-bank/dashboard'); }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-slate-900">Blood Bank Portal</p>
                      <p className="text-[10px] text-slate-500">City Central</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-semibold text-emerald-700">Bank</span>
                  </button>
                </div>
              )}
            </div>

            {/* Authenticated User state */}
            {user ? (
              <div className="flex items-center space-x-2">
                
                {/* Notification Bell with Dropdown */}
                <div className="relative" ref={notifRef}>
                  <button 
                    onClick={() => setShowNotifCenter(!showNotifCenter)}
                    className="p-2 text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
                    title="Notification Center"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-white"></span>
                    )}
                  </button>

                  {/* Notification Center Dropdown */}
                  {showNotifCenter && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 text-xs">
                      <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Notifications</h4>
                          <p className="text-[11px] text-slate-500">{unreadCount} unread update{unreadCount === 1 ? '' : 's'}</p>
                        </div>
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-rose-600 font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark all read</span>
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {loadingNotifs ? (
                          <div className="p-4 text-center text-slate-400">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">
                            <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold">No notifications yet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Alerts & reminders will appear here.</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              className={`p-3.5 transition-colors flex items-start space-x-3 cursor-pointer ${
                                n.read ? 'bg-white hover:bg-slate-50/80' : 'bg-rose-50/30 hover:bg-rose-50/60 font-medium'
                              }`}
                              onClick={() => {
                                if (n.link) navigate(n.link);
                                setShowNotifCenter(false);
                              }}
                            >
                              <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-rose-600'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-slate-900 truncate">{n.title}</p>
                                  <span className="text-[10px] text-slate-400 flex items-center space-x-1 shrink-0 ml-2">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-2">{n.message}</p>
                              </div>
                              {!n.read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(n.id, e)}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700"
                                  title="Mark as read"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="pt-2 px-4 border-t border-slate-100 text-center">
                        <Link 
                          to="/donor/profile" 
                          onClick={() => setShowNotifCenter(false)}
                          className="text-[11px] font-semibold text-slate-600 hover:text-rose-600 inline-flex items-center space-x-1"
                        >
                          <span>Manage Notification Preferences</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {user.name ? user.name.charAt(0) : 'U'}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="font-bold text-slate-900">{user.name}</p>
                        <p className="text-slate-500 text-[11px] truncate">{user.email}</p>
                        <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                          Role: {user.role.replace('_', ' ')}
                        </span>
                      </div>

                      <Link
                        to={getDashboardPath()}
                        onClick={() => setShowUserMenu(false)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center space-x-2 font-medium"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Open Dashboard</span>
                      </Link>

                      <button 
                        onClick={() => { logout(); setShowUserMenu(false); navigate('/login'); }}
                        className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 flex items-center space-x-2 font-medium cursor-pointer border-t border-slate-100 mt-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link 
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs shadow-rose-500/20 transition-all hover:shadow-md"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 px-2 border-t border-slate-100 bg-white space-y-1 text-sm font-medium">
            {isPortalPage && user?.role === 'donor' ? (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Donor Navigation</div>
                <Link
                  to="/donor/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 text-xs font-semibold ${
                    location.pathname === '/donor/dashboard' ? 'bg-rose-600 text-white font-bold' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/donor/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 text-xs font-semibold ${
                    location.pathname === '/donor/profile' ? 'bg-rose-600 text-white font-bold' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>My Profile</span>
                </Link>
                <Link
                  to="/donor/eligibility"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 text-xs font-semibold ${
                    location.pathname === '/donor/eligibility' ? 'bg-rose-600 text-white font-bold' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Eligibility</span>
                </Link>
                <Link
                  to="/donor/donations"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 text-xs font-semibold ${
                    location.pathname === '/donor/donations' ? 'bg-rose-600 text-white font-bold' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Donation History</span>
                </Link>
                <Link
                  to="/donor/camps"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 text-xs font-semibold ${
                    location.pathname === '/donor/camps' ? 'bg-rose-600 text-white font-bold' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Camps & Requests</span>
                </Link>
                <Link
                  to="/donor/alerts"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2.5 text-xs font-semibold ${
                    location.pathname.includes('/alerts') ? 'bg-rose-600 text-white font-bold' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span>Emergency Alerts</span>
                </Link>
              </>
            ) : !isPortalPage ? (
              <>
                <button 
                  onClick={() => scrollToSection('home')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 font-semibold"
                >
                  Home
                </button>
                <button 
                  onClick={() => scrollToSection('portals')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 font-semibold"
                >
                  Portals
                </button>
                <button 
                  onClick={() => scrollToSection('how-it-works')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 font-semibold"
                >
                  How It Works
                </button>
                <button 
                  onClick={() => scrollToSection('awareness')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-600 font-semibold"
                >
                  Awareness
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
};

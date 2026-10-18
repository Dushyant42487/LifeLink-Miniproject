import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Building2, Landmark, ArrowRight, CheckCircle2, Sparkles, LogIn, UserPlus } from 'lucide-react';

export const LandingStakeholders: React.FC = () => {
  const { user } = useAuth();

  const getPortalDestination = (role: 'donor' | 'hospital' | 'blood_bank') => {
    if (user && user.role === role) {
      if (role === 'donor') return '/donor/dashboard';
      if (role === 'hospital') return '/hospital/dashboard';
      if (role === 'blood_bank') return '/blood-bank/dashboard';
    }
    return `/login?role=${role}`;
  };

  const getRegisterDestination = (role: 'donor' | 'hospital' | 'blood_bank') => {
    return `/register?role=${role}`;
  };

  const portals = [
    {
      id: 'donor',
      role: 'donor' as const,
      title: 'Donor Portal',
      badge: 'Voluntary Donors',
      icon: Users,
      iconBg: 'bg-lifelink-50 text-lifelink-600 border-lifelink-200/60',
      description: 'A personal space for voluntary donors to manage their profile, verify eligibility, register for donation camps, track donations, and access certificates.',
      capabilities: [
        'Donation eligibility and readiness.',
        'Donation history and certificates.',
        'Blood donation camp registration.',
        'Relevant emergency alerts.'
      ],
      ctaText: 'Explore Donor Portal',
      accentBorder: 'border-lifelink-200/80 hover:border-lifelink-400 hover:shadow-lifelink-600/10',
      badgeColor: 'bg-lifelink-50 text-lifelink-700 border-lifelink-200/80',
      tagline: 'Personal health & voluntary donation hub'
    },
    {
      id: 'hospital',
      role: 'hospital' as const,
      title: 'Hospital Portal',
      badge: 'Clinical Teams',
      icon: Building2,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200/60',
      description: 'Tools for clinical teams to request blood components, manage urgency, find available units, and track fulfillment.',
      capabilities: [
        'Routine and emergency requisitions.',
        'Blood availability and allocation.',
        'Patient sample and cross-match tracking.',
        'Request status and communication.'
      ],
      ctaText: 'Explore Hospital Portal',
      accentBorder: 'border-blue-200/80 hover:border-blue-400 hover:shadow-blue-500/10',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
      tagline: 'Emergency & surgical blood requisition'
    },
    {
      id: 'blood_bank',
      role: 'blood_bank' as const,
      title: 'Blood Bank Portal',
      badge: 'Blood Centers',
      icon: Landmark,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200/60',
      description: 'Operational tools for blood centers to manage inventory, quality checks, reservations, and hospital requests.',
      capabilities: [
        'Blood component inventory.',
        'Expiry-aware FEFO allocation.',
        'Lab screening records.',
        'Hospital request fulfillment and analytics.'
      ],
      ctaText: 'Explore Blood Bank Portal',
      accentBorder: 'border-emerald-200/80 hover:border-emerald-400 hover:shadow-emerald-500/10',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      tagline: 'Inventory, testing & regional allocation'
    }
  ];

  return (
    <section id="portals" className="scroll-mt-24 py-20 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Connected Infrastructure</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            One Connected Network. <br />
            <span className="text-lifelink-600">Three Specialized Portals.</span>
          </h2>
          <p className="mt-3.5 text-slate-600 text-sm sm:text-base leading-relaxed">
            Purpose-built experiences for every part of the blood coordination journey.
          </p>
        </div>

        {/* 3 Portal Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {portals.map((portal) => {
            const Icon = portal.icon;
            const primaryDest = getPortalDestination(portal.role);
            const registerDest = getRegisterDestination(portal.role);

            return (
              <div
                key={portal.id}
                className={`bg-white border ${portal.accentBorder} rounded-3xl p-7 sm:p-8 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group h-full relative`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl ${portal.iconBg} border flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${portal.badgeColor}`}>
                      {portal.badge}
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{portal.title}</h3>
                  <p className="text-xs font-semibold text-slate-400 mb-4">{portal.tagline}</p>
                  
                  {/* Description */}
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed mb-6">
                    {portal.description}
                  </p>

                  {/* Capabilities Bullet List */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-100 mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Key Capabilities</p>
                    {portal.capabilities.map((cap, cIdx) => (
                      <div key={cIdx} className="flex items-start space-x-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <Link
                    to={primaryDest}
                    className="w-full py-3 rounded-xl font-bold text-xs bg-lifelink-600 hover:bg-lifelink-700 text-white shadow-md shadow-lifelink-600/20 hover:shadow-lg transition-all flex items-center justify-center space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600"
                  >
                    <span>{portal.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center justify-between text-xs px-1 pt-1">
                    <Link
                      to={registerDest}
                      className="text-slate-500 hover:text-lifelink-600 font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Register role</span>
                    </Link>
                    <Link
                      to={`/login?role=${portal.role}`}
                      className="text-slate-500 hover:text-slate-900 font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in</span>
                    </Link>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

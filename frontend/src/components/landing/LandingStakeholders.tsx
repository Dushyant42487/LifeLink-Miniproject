import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, Landmark, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export const LandingStakeholders: React.FC = () => {
  const stakeholders = [
    {
      id: 'donor',
      title: 'Donor Portal',
      subtitle: 'For Voluntary Blood Donors',
      badge: 'Voluntary Donors',
      icon: Users,
      iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
      description: 'Empowering voluntary donors with a personalized hub to manage eligibility, schedule donations, track lifetime impact, and respond to local emergencies.',
      features: [
        'Instant digital eligibility self-check',
        'Voluntary blood donation camp registration',
        'Personal donation history & digital certificates',
        'Real-time emergency deficit alerts for your blood group'
      ],
      ctaText: 'Join as Donor',
      ctaLink: '/register?role=donor',
      loginText: 'Donor Sign In',
      loginLink: '/login?role=donor',
      accentColor: 'border-rose-200 hover:border-rose-300 hover:shadow-rose-500/10',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    {
      id: 'hospital',
      title: 'Hospital Portal',
      subtitle: 'For Clinical & Emergency Teams',
      badge: 'Healthcare Facilities',
      icon: Building2,
      iconBg: 'bg-orange-50 text-orange-600 border-orange-100',
      description: 'Enabling medical staff and trauma units to locate verified blood units across regional centers in real time, submit urgent requests, and track delivery pipelines.',
      features: [
        'Multi-center regional blood availability search',
        'Emergency, urgent & routine request dispatch',
        'Live request fulfillment & transit tracking',
        'Patient sample cross-match logging & direct bank messaging'
      ],
      ctaText: 'Register Facility',
      ctaLink: '/register?role=hospital',
      loginText: 'Hospital Sign In',
      loginLink: '/login?role=hospital',
      accentColor: 'border-orange-200 hover:border-orange-300 hover:shadow-orange-500/10',
      badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
    },
    {
      id: 'blood_bank',
      title: 'Blood Bank Portal',
      subtitle: 'For Regional Blood Centers & Labs',
      badge: 'Regional Blood Hubs',
      icon: Landmark,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      description: 'Comprehensive inventory intelligence and quality assurance platform with automated FEFO wastage minimization, camp logistics, and ML demand forecasting.',
      features: [
        'Full unit inventory tracking & cold-chain status',
        'Automated FEFO (First-Expiry-First-Out) priority issue',
        'Hospital request queue & reservation management',
        'Lab screening records & AI predictive shortage insights'
      ],
      ctaText: 'Register Blood Bank',
      ctaLink: '/register?role=blood_bank',
      loginText: 'Blood Bank Sign In',
      loginLink: '/login?role=blood_bank',
      accentColor: 'border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-500/10',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  ];

  return (
    <section id="portals" className="scroll-mt-20 py-20 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>Dedicated Stakeholder Portals</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            One Connected Network. <br />
            <span className="text-rose-600">Three Specialized Portals.</span>
          </h2>
          <p className="mt-3 text-slate-600 text-sm leading-relaxed">
            LifeLink bridges the gap between voluntary donors, clinical hospital units, and certified blood centers with purpose-built, secure role portals.
          </p>
        </div>

        {/* 3 Stakeholder Portal Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {stakeholders.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.id}
                className={`bg-white border ${portal.accentColor} rounded-3xl p-7 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group h-full`}
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl ${portal.iconBg} border flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${portal.badgeColor}`}>
                      {portal.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{portal.title}</h3>
                  <p className="text-xs font-semibold text-slate-400 mb-4">{portal.subtitle}</p>
                  
                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed mb-6">
                    {portal.description}
                  </p>

                  {/* Key Features Bullet List */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-100 mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Core Capabilities</p>
                    {portal.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start space-x-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <Link
                    to={portal.ctaLink}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <span>{portal.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    to={portal.loginLink}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center justify-center space-x-1.5"
                  >
                    <span>{portal.loginText}</span>
                  </Link>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

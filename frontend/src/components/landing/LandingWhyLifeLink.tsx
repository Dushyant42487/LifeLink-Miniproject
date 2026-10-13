import React from 'react';
import { FileCheck, Heart, Activity, Zap, Award, BarChart2 } from 'lucide-react';

export const LandingWhyLifeLink: React.FC = () => {
  const cards = [
    {
      title: 'Donor Verification',
      desc: 'Blood Bank & hospitals review uploaded documents and verify donor eligibility before any blood collection, ensuring safer and more reliable coordination.',
      icon: FileCheck,
      color: 'bg-rose-50 border-rose-100 text-rose-600'
    },
    {
      title: 'Smart Donor Matching',
      desc: 'Blood requests are matched with verified and available donors based on blood group, location, and urgency.',
      icon: Heart,
      color: 'bg-orange-50 border-orange-100 text-orange-600'
    },
    {
      title: 'Live Blood Availability',
      desc: 'Track shortage groups, monitor units across the network, and identify priority blood types in one clear view.',
      icon: Activity,
      color: 'bg-emerald-50 border-emerald-100 text-emerald-600'
    },
    {
      title: 'Emergency Coordination',
      desc: 'Urgent requests are highlighted clearly so hospitals can act faster and connect with the nearest possible support.',
      icon: Zap,
      color: 'bg-amber-50 border-amber-100 text-amber-600'
    },
    {
      title: 'Donation Certificates',
      desc: 'Donors can access certificates, view donation history, and track recognition milestones from their own portal.',
      icon: Award,
      color: 'bg-rose-50 border-rose-100 text-rose-600'
    },
    {
      title: 'Analytics & Reporting',
      desc: 'Both donors and hospitals get clean dashboards with useful insights around requests, activity, and outcomes.',
      icon: BarChart2,
      color: 'bg-rose-50 border-rose-100 text-rose-600'
    }
  ];

  return (
    <section className="py-16 bg-slate-50/50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 mb-3">
            Core Capabilities
          </span>
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Platform Features & Workflows</h3>
          <p className="mt-2 text-slate-500 text-sm">
            Designed for clinical reliability, rapid response, and seamless multi-stakeholder operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx} 
                className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs hover:shadow-md hover:border-rose-200 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between h-full"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl ${card.color} border flex items-center justify-center mb-5`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2.5">{card.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

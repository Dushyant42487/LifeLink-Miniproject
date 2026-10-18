import React from 'react';
import { UserCheck2, FileText, CheckCircle2, GitMerge, Sparkles } from 'lucide-react';

export const LandingHowItWorks: React.FC = () => {
  const steps = [
    {
      step: 1,
      title: 'Register & Verify',
      desc: 'Donors and institutions complete their appropriate registration and verification processes with proper document checks.',
      icon: UserCheck2,
      badge: 'Step 01'
    },
    {
      step: 2,
      title: 'Submit a Request',
      desc: 'Hospitals submit routine or urgent blood requirements with specific component, quantity, and clinical urgency levels.',
      icon: FileText,
      badge: 'Step 02'
    },
    {
      step: 3,
      title: 'Match & Allocate',
      desc: 'The system identifies suitable availability and supports appropriate donor matching or FEFO blood unit allocation.',
      icon: GitMerge,
      badge: 'Step 03'
    },
    {
      step: 4,
      title: 'Track & Complete',
      desc: 'Stakeholders follow request progress through fulfillment, delivery confirmation, and updated transfusion records.',
      icon: CheckCircle2,
      badge: 'Step 04'
    }
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-24 bg-slate-50/70 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Operational Journey</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Coordinated From Request to Fulfillment
          </h2>
          <p className="mt-3.5 text-slate-600 text-sm sm:text-base leading-relaxed">
            A clear four-stage workflow connecting clinical requisitions with verified inventory and donors.
          </p>
        </div>

        {/* Stepper Container */}
        <div className="relative max-w-6xl mx-auto">
          
          {/* Horizontal Connecting Line (Desktop) */}
          <div 
            className="hidden lg:block absolute top-10 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-lifelink-200 via-rose-200 to-lifelink-200 z-0" 
            aria-hidden="true"
          />

          {/* Vertical Connecting Line (Mobile / Tablet) */}
          <div 
            className="lg:hidden absolute top-8 bottom-8 left-6 w-0.5 bg-gradient-to-b from-lifelink-300 via-rose-200 to-lifelink-300 z-0" 
            aria-hidden="true"
          />

          {/* Steps Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-6 relative z-10">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div 
                  key={item.step}
                  className="flex flex-row lg:flex-col items-start lg:items-center text-left lg:text-center group pl-14 lg:pl-0 relative"
                >
                  {/* Step Node */}
                  <div className="absolute left-0 lg:relative mb-0 lg:mb-6 shrink-0">
                    <div className="w-12 h-12 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl bg-white border-2 border-slate-200/90 group-hover:border-lifelink-500 flex items-center justify-center text-slate-700 group-hover:text-lifelink-600 shadow-sm group-hover:shadow-md group-hover:shadow-lifelink-600/10 transition-all duration-300">
                      <Icon className="w-5 h-5 lg:w-8 lg:h-8" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 lg:-top-2 lg:-right-2 px-1.5 py-0.5 rounded-full bg-lifelink-600 text-white font-black text-[10px] lg:text-xs shadow-xs">
                      {item.step}
                    </span>
                  </div>

                  {/* Text Content Card */}
                  <div className="bg-white/90 lg:bg-transparent border lg:border-none border-slate-200/80 rounded-2xl p-4 lg:p-0 shadow-2xs lg:shadow-none w-full">
                    <span className="inline-block lg:hidden text-[10px] font-bold uppercase tracking-wider text-lifelink-600 mb-1">
                      {item.badge}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-lifelink-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
};

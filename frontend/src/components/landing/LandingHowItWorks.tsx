import React from 'react';
import { User, UserCheck, FileText, CheckCircle2 } from 'lucide-react';

export const LandingHowItWorks: React.FC = () => {
  const steps = [
    {
      step: 1,
      title: 'Donor Registers',
      desc: 'Donors create a profile, upload verification documents, and submit their details for review.',
      icon: User
    },
    {
      step: 2,
      title: 'Hospital Verifies',
      desc: 'Hospitals review the submitted information and verify eligible donors for active coordination.',
      icon: UserCheck
    },
    {
      step: 3,
      title: 'Request Created',
      desc: 'A hospital raises a blood request with the required blood group, urgency, and location details.',
      icon: FileText
    },
    {
      step: 4,
      title: 'Matched & Fulfilled',
      desc: 'The system surfaces available support so the request can move quickly toward fulfillment.',
      icon: CheckCircle2
    }
  ];

  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 mb-3">
            The Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">How It Works</h2>
          <p className="mt-2 text-slate-500 text-sm">
            A structured four-step cycle from registration to fulfillment.
          </p>
        </div>

        {/* Timeline Container */}
        <div className="relative max-w-5xl mx-auto">
          
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-10 left-[10%] right-[10%] h-0.5 bg-rose-200 z-0"></div>

          {/* Connecting Line (Mobile Vertical) */}
          <div className="md:hidden absolute top-8 bottom-8 left-6 w-0.5 bg-rose-200 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 relative z-10">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div 
                  key={item.step}
                  className="flex flex-row md:flex-col items-start md:items-center text-left md:text-center group pl-12 md:pl-0 relative"
                >
                  {/* Step Node */}
                  <div className="absolute left-0 md:relative mb-0 md:mb-6 shrink-0">
                    <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-white border-2 border-rose-200 group-hover:border-rose-500 flex items-center justify-center text-rose-600 shadow-xs group-hover:shadow-md transition-all">
                      <Icon className="w-5 h-5 md:w-8 md:h-8" />
                    </div>
                    <span className="absolute -top-1 -right-1 md:top-0 md:right-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-rose-600 text-white font-extrabold text-[10px] md:text-xs flex items-center justify-center shadow-xs">
                      {item.step}
                    </span>
                  </div>

                  {/* Text Content */}
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1.5 md:mb-2">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
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

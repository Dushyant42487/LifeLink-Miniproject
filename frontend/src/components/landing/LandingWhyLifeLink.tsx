import React from 'react';
import { FileCheck, Heart, Activity, Zap, Award, BarChart2, Sparkles } from 'lucide-react';

export const LandingWhyLifeLink: React.FC = () => {
  const cards = [
    {
      title: 'Donor Verification',
      desc: 'Blood banks and clinical teams review submitted donor documentation to verify clinical eligibility prior to collection.',
      icon: FileCheck,
      color: 'bg-lifelink-50 border-lifelink-200/60 text-lifelink-600'
    },
    {
      title: 'Smart Donor Matching',
      desc: 'Connects verified voluntary donors based on blood group compatibility, proximity, and urgency of clinical requisitions.',
      icon: Heart,
      color: 'bg-rose-50 border-rose-200/60 text-rose-600'
    },
    {
      title: 'Live Blood Availability',
      desc: 'Real-time visibility into inventory levels across regional centers helps prevent shortages and optimize clinical allocations.',
      icon: Activity,
      color: 'bg-emerald-50 border-emerald-200/60 text-emerald-600'
    },
    {
      title: 'Emergency Coordination',
      desc: 'Trauma units flag critical requisitions with immediate priority dispatch across available regional hubs.',
      icon: Zap,
      color: 'bg-amber-50 border-amber-200/60 text-amber-600'
    },
    {
      title: 'Donation Certificates',
      desc: 'Recognizes voluntary donors with verifiable digital certificates, tracking lifetime milestones and impact.',
      icon: Award,
      color: 'bg-purple-50 border-purple-200/60 text-purple-600'
    },
    {
      title: 'Analytics & Reporting',
      desc: 'Dashboards provide clinical insights into requisitions, fulfillment efficiency, and regional demand dynamics.',
      icon: BarChart2,
      color: 'bg-blue-50 border-blue-200/60 text-blue-600'
    }
  ];

  return (
    <section className="py-20 sm:py-24 bg-slate-50/60 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Platform Capabilities</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Engineered for Clinical Reliability
          </h2>
          <p className="mt-3.5 text-slate-600 text-sm sm:text-base leading-relaxed">
            Every feature is designed to reduce turnaround time, ensure patient safety, and eliminate component wastage.
          </p>
        </div>

        {/* 6 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx} 
                className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-8 shadow-xs hover:shadow-lg hover:border-lifelink-200 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between h-full group"
              >
                <div>
                  <div className={`w-11 h-11 rounded-2xl ${card.color} border flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2.5 group-hover:text-lifelink-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

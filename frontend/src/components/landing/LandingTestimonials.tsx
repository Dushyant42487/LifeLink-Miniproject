import React from 'react';
import { Activity, BellRing, ThermometerSnowflake, ShieldCheck } from 'lucide-react';

export const LandingTestimonials: React.FC = () => {
  const standards = [
    {
      icon: Activity,
      title: "Emergency Trauma Routing",
      description: "Automated First-Expired, First-Out (FEFO) allocation prioritizing urgent trauma surgery requisitions across nearby licensed blood banks.",
      badge: "Clinical Allocation"
    },
    {
      icon: BellRing,
      title: "Targeted Deficit Mobilization",
      description: "Direct notifications triggered only when a verified blood group experiences a regional deficit, eliminating donor alert fatigue.",
      badge: "Donor Coordination"
    },
    {
      icon: ThermometerSnowflake,
      title: "Cold-Chain & Quality Governance",
      description: "Continuous storage equipment temperature logging, mandatory 5-marker serology screening, and auditable excursion alarm records.",
      badge: "Safety & Compliance"
    }
  ];

  return (
    <section className="py-20 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Quality & Safety Standards</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Built on Rigorous Operational Protocols
          </h2>
          <p className="mt-3.5 text-slate-500 text-xs sm:text-sm">
            LifeLink eliminates guesswork with deterministic clinical matching, traceable laboratory clearance, and real-time cold-chain safeguards.
          </p>
        </div>

        {/* 3 Operational Standards Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {standards.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div 
                key={idx} 
                className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 sm:p-8 shadow-xs hover:shadow-lg hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-lifelink-50 text-lifelink-700 flex items-center justify-center border border-lifelink-200/60 shadow-xs">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-700 shadow-2xs">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-lg mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/70 mt-6 flex items-center text-[11px] font-semibold text-lifelink-700">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  <span>Enforced by Platform Policy Engine</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

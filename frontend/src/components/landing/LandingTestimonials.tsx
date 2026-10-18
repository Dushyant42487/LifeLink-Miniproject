import React from 'react';
import { Star, MessageSquare } from 'lucide-react';

export const LandingTestimonials: React.FC = () => {
  const testimonials = [
    {
      quote: "The unified request queue and FEFO allocation capabilities significantly streamline emergency blood component dispatch for trauma surgical cases.",
      author: "Dr. Priya Menon",
      role: "Emergency Medicine & Trauma Services",
      initials: "PM"
    },
    {
      quote: "As a voluntary donor, receiving timely notifications only when my blood group is experiencing a regional deficit makes donation truly meaningful.",
      author: "Arjun Sharma",
      role: "Verified Voluntary Donor · O-",
      initials: "AS"
    },
    {
      quote: "Managing testing records, cold-chain alarms, and hospital requisitions in one structured system eliminates manual coordination bottlenecks.",
      author: "Meera Krishnan",
      role: "Regional Blood Center Quality Supervisor",
      initials: "MK"
    }
  ];

  return (
    <section className="py-20 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Stakeholder Perspectives</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Designed With Healthcare Professionals
          </h2>
          <p className="mt-3.5 text-slate-500 text-xs sm:text-sm">
            Perspectives from clinical teams, voluntary donors, and blood bank operators participating in platform workflow validation.
          </p>
        </div>

        {/* 3 Feedback Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {testimonials.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 sm:p-8 shadow-xs hover:shadow-lg hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* 5 Stars */}
                <div className="flex items-center space-x-1 mb-5 text-amber-400" aria-label="5 out of 5 stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed italic mb-6">
                  "{item.quote}"
                </p>
              </div>

              {/* Author Footer */}
              <div className="flex items-center space-x-3.5 pt-4 border-t border-slate-200/70">
                <div className="w-10 h-10 rounded-2xl bg-lifelink-50 text-lifelink-700 font-extrabold text-xs flex items-center justify-center border border-lifelink-200/60 shrink-0">
                  {item.initials}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">{item.author}</h3>
                  <p className="text-[11px] text-slate-500">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

import React from 'react';
import { Star, Info } from 'lucide-react';

export const LandingTestimonials: React.FC = () => {
  const testimonials = [
    {
      quote: "LifeLink helped us respond to a mass casualty event in under 20 minutes. The request workflow and matching were extraordinary.",
      author: "Dr. Priya Menon",
      role: "Head of Emergency, City Medical Center",
      initials: "PM"
    },
    {
      quote: "As a regular donor, I love how I get notified only when my blood type is urgently needed. Clear, structured, and easy to use.",
      author: "Arjun Sharma",
      role: "Registered Blood Donor · O-",
      initials: "AS"
    },
    {
      quote: "We reduced fulfillment time significantly after switching to LifeLink. The donor verification and request pipeline is seamless.",
      author: "Meera Krishnan",
      role: "Blood Bank Manager, Apollo Network",
      initials: "MK"
    }
  ];

  return (
    <section className="py-20 bg-rose-50/50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-semibold text-rose-600 bg-white border border-rose-200/80 shadow-2xs mb-3">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Demonstration Feedback</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Trusted by Healthcare Teams
          </h2>
          <p className="mt-2 text-xs text-slate-500 flex items-center justify-center space-x-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Sample feedback from pilot network evaluation participants.</span>
          </p>
        </div>

        {/* 3 Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* 5 Stars */}
                <div className="flex items-center space-x-1 mb-4 text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>

                {/* Quote */}
                <p className="text-xs text-slate-600 leading-relaxed italic mb-6">
                  "{item.quote}"
                </p>
              </div>

              {/* Author Footer */}
              <div className="flex items-center space-x-3 pt-3 border-t border-slate-100">
                <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center border border-rose-200 shrink-0">
                  {item.initials}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">{item.author}</h4>
                  <p className="text-[10px] text-slate-500">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

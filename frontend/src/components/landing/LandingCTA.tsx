import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';

export const LandingCTA: React.FC = () => {
  return (
    <section className="py-20 bg-rose-50/60 border-b border-slate-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        <div className="bg-white border border-rose-200/80 rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
          
          {/* Subtle Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-100/50 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white mx-auto flex items-center justify-center shadow-md shadow-rose-600/30">
              <Heart className="w-6 h-6 fill-white" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Connect Blood. <span className="text-rose-600">Save Lives.</span>
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              Join healthcare facilities and voluntary blood donors across the region. Streamline blood coordination, eliminate wastage, and respond faster to critical emergencies.
            </p>

            <div className="flex flex-wrap justify-center items-center gap-4 pt-2">
              <Link
                to="/register"
                className="px-6 py-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 hover:scale-[1.02] transition-all flex items-center space-x-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#how-it-works"
                className="px-6 py-3 rounded-xl font-bold text-xs bg-white hover:bg-rose-50 text-slate-700 border border-slate-200 shadow-xs hover:scale-[1.02] transition-all"
              >
                Learn More
              </a>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

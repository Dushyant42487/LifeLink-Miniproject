import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Users, Sparkles } from 'lucide-react';

export const LandingCTA: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 bg-gradient-to-b from-white via-lifelink-50/30 to-slate-50/80 border-b border-slate-200/80 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        <div className="bg-white border border-lifelink-200/80 rounded-3xl p-8 sm:p-14 shadow-xl shadow-slate-900/5 relative overflow-hidden">
          
          {/* Subtle Background Radial Glow */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-lifelink-100/40 via-rose-50/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10" 
            aria-hidden="true" 
          />

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            
            {/* Centered Heart Icon */}
            <div className="w-14 h-14 rounded-2xl bg-[#E81743] text-white mx-auto flex items-center justify-center shadow-lg shadow-rose-600/30 hover:scale-105 transition-transform">
              <Heart className="w-7 h-7 fill-white" />
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Every Donation Can <br className="hidden sm:inline" />
              <span className="text-lifelink-600">Make a Difference.</span>
            </h2>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
              Join a connected network helping donors, hospitals, and blood banks coordinate with greater clarity.
            </p>

            {/* Actions */}
            <div className="flex flex-wrap justify-center items-center gap-3.5 pt-2">
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-lifelink-600 hover:bg-lifelink-700 text-white shadow-md shadow-lifelink-600/25 hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#portals"
                className="px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs transition-all hover:scale-[1.02] active:scale-95 flex items-center space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lifelink-600"
              >
                <Users className="w-4 h-4 text-lifelink-600" />
                <span>Explore Portals</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

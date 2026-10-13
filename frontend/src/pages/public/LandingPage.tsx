import React from 'react';
import { LandingHero } from '../../components/landing/LandingHero';
import { LandingStakeholders } from '../../components/landing/LandingStakeholders';
import { LandingWhyLifeLink } from '../../components/landing/LandingWhyLifeLink';
import { LandingHowItWorks } from '../../components/landing/LandingHowItWorks';
import { LandingBloodGroupMatrix } from '../../components/landing/LandingBloodGroupMatrix';
import { LandingAIInsights } from '../../components/landing/LandingAIInsights';
import { LandingCamps } from '../../components/landing/LandingCamps';
import { LandingAwareness } from '../../components/landing/LandingAwareness';
import { LandingTestimonials } from '../../components/landing/LandingTestimonials';
import { LandingCTA } from '../../components/landing/LandingCTA';
import { Footer } from '../../components/landing/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1">
        <LandingHero />
        <LandingStakeholders />
        <LandingWhyLifeLink />
        <LandingHowItWorks />
        <LandingBloodGroupMatrix />
        <LandingAIInsights />
        <LandingCamps />
        <LandingAwareness />
        <LandingTestimonials />
        <LandingCTA />
      </main>
      <Footer />
    </div>
  );
};

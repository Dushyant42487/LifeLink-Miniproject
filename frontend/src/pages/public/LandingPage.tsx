import React from 'react';
import { LandingHero } from '../../components/landing/LandingHero';
import { LandingStatsStrip } from '../../components/landing/LandingStatsStrip';
import { LandingStakeholders } from '../../components/landing/LandingStakeholders';
import { LandingBloodGroupMatrix } from '../../components/landing/LandingBloodGroupMatrix';
import { LandingHowItWorks } from '../../components/landing/LandingHowItWorks';
import { LandingWhyLifeLink } from '../../components/landing/LandingWhyLifeLink';
import { LandingAIInsights } from '../../components/landing/LandingAIInsights';
import { LandingCamps } from '../../components/landing/LandingCamps';
import { LandingAwareness } from '../../components/landing/LandingAwareness';
import { LandingTestimonials } from '../../components/landing/LandingTestimonials';
import { LandingCTA } from '../../components/landing/LandingCTA';
import { Footer } from '../../components/landing/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {/* 1. Hero Section */}
        <LandingHero />

        {/* 2. Real Dynamic Statistics Strip */}
        <LandingStatsStrip />

        {/* 3. Three Specialized Portals */}
        <LandingStakeholders />

        {/* 4. Live Blood Supply & Compatibility */}
        <LandingBloodGroupMatrix />

        {/* 5. How It Works Stepper */}
        <LandingHowItWorks />

        {/* 6. Platform Capabilities */}
        <LandingWhyLifeLink />

        {/* 7. Intelligent Blood Management */}
        <LandingAIInsights />

        {/* 8. Blood Donation Camps */}
        <LandingCamps />

        {/* 9. Educational Awareness */}
        <LandingAwareness />

        {/* 10. Stakeholder Perspectives */}
        <LandingTestimonials />

        {/* 11. Closing Call to Action */}
        <LandingCTA />
      </main>

      {/* 12. Footer */}
      <Footer />
    </div>
  );
};

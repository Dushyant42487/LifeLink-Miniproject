import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Activity, 
  UserCheck, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export const LandingAwareness: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'education' | 'myths'>('education');

  const myths = [
    {
      myth: "Donating blood makes you permanently weak or unfit.",
      fact: "The body replenishes lost fluid volume (plasma) within 24 to 48 hours. Red blood cells regenerate completely within 4 to 8 weeks with no lasting weakness."
    },
    {
      myth: "You can contract infectious illnesses during donation.",
      fact: "All equipment—including needles, tubing, and storage collection bags—is 100% sterile, factory-sealed, single-use, and disposed of immediately after phlebotomy."
    },
    {
      myth: "Vegetarians cannot donate blood due to inadequate iron.",
      fact: "Vegetarians who meet standard hemoglobin criteria (≥ 12.5 g/dL) can safely donate blood just as frequently as non-vegetarians."
    },
    {
      myth: "People with managed blood pressure or diabetes can never donate.",
      fact: "Individuals with stable, medication-controlled blood pressure or diabetes without insulin complications are frequently eligible following pre-donation clinical checkup."
    }
  ];

  return (
    <section id="awareness" className="scroll-mt-24 py-20 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-lifelink-700 bg-lifelink-50 border border-lifelink-200/80 mb-3.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-lifelink-600" />
            <span className="uppercase text-[11px] font-bold tracking-wider">Clinical Education & Safety</span>
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
            Know Your Blood. Make Every Donation Count.
          </h2>
          <p className="mt-3.5 text-slate-600 text-sm sm:text-base leading-relaxed">
            Clear, medically accurate guidance on blood components, voluntary donation readiness, and safety standards.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('education')}
              className={`px-5 py-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'education'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Educational Fundamentals
            </button>
            <button
              onClick={() => setActiveTab('myths')}
              className={`px-5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'myths'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-lifelink-600" />
              <span>Common Myths vs. Facts</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Three Core Educational Cards */}
        {activeTab === 'education' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
              
              {/* Card 1: Blood Components */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-slate-300 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-lifelink-50 text-lifelink-600 border border-lifelink-200/60 flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lifelink-50 text-lifelink-700 border border-lifelink-200/80">
                      Components
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">Blood Components</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-5">
                    Whole blood contains specialized cellular elements that can be separated into components to help multiple patients.
                  </p>

                  <div className="space-y-3 pt-3 border-t border-slate-200/70 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">Red Blood Cells (RBC)</span>
                        <span className="text-[10px] text-slate-400 font-semibold">42-day shelf life</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Transports oxygen throughout the body. Essential for surgical interventions, major trauma, and acute anemia.
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">Fresh Frozen Plasma (FFP)</span>
                        <span className="text-[10px] text-slate-400 font-semibold">1-year frozen life</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Contains critical clotting factors and electrolytes to treat severe burn victims, shock, and massive bleeding.
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">Platelets</span>
                        <span className="text-[10px] text-slate-400 font-semibold">5-day agitated life</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Microscopic cell fragments that trigger coagulation. Vital for oncology patients undergoing chemotherapy.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200/60 text-[11px] text-slate-400 font-medium text-center">
                  Component separation maximizes the therapeutic impact of every donation.
                </div>
              </div>

              {/* Card 2: Donation Eligibility */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-slate-300 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80">
                      Eligibility
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">Donation Eligibility</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-5">
                    Clear baseline criteria ensure voluntary donation is consistently safe for both the donor and the recipient.
                  </p>

                  <div className="space-y-3 pt-3 border-t border-slate-200/70 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <p className="font-bold text-slate-900 mb-1">Age & Weight Requirements</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Healthy adults aged 18 to 65 weighing at least 50 kg (110 lbs) are eligible for routine voluntary donation.
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <p className="font-bold text-slate-900 mb-1">Hemoglobin & Vitals</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Hemoglobin level of ≥ 12.5 g/dL and blood pressure within normal physiological range verified before every collection.
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <p className="font-bold text-slate-900 mb-1">Recovery Intervals & Medical Screening</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        A minimum of 12 weeks between whole-blood donations allows natural iron store and red cell replenishment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200/60 text-[11px] text-slate-400 font-medium text-center">
                  Pre-donation screening takes less than 10 minutes at accredited centers.
                </div>
              </div>

              {/* Card 3: Blood Safety & Screening */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-7 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-slate-300 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      Quality & Safety
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">Blood Safety & Screening</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-5">
                    Stringent laboratory testing and cross-matching protocols protect patients across every regional transfusion.
                  </p>

                  <div className="space-y-3 pt-3 border-t border-slate-200/70 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <p className="font-bold text-slate-900 mb-1">Multi-Marker Infectious Screening</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Every collection is screened for HIV 1 & 2, Hepatitis B (HBsAg), Hepatitis C, Syphilis, and Malaria prior to clearance.
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <p className="font-bold text-slate-900 mb-1">Forward & Reverse ABO/Rh Typing</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Dual laboratory verification confirms antigenic blood group properties and checks for irregular red cell antibodies.
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                      <p className="font-bold text-slate-900 mb-1">Clinical Cross-Match Mandatory</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Compatibility charts offer general guidance; patient serum and donor cells must undergo physical cross-matching before infusion.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200/60 text-[11px] text-slate-400 font-medium text-center">
                  Rigorous quality protocols ensure zero unverified units reach recipients.
                </div>
              </div>

            </div>

            {/* Medical Transparency Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start space-x-3 text-xs text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Clinical Disclaimer & Transfusion Protocol:</span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  General compatibility charts do not substitute for certified clinical screening. Transfusion medicine requires mandatory pre-transfusion cross-matching, atypical antibody screening, and laboratory verification by licensed hospital blood banks before unit administration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Myths vs Facts */}
        {activeTab === 'myths' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {myths.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-lifelink-600 border border-rose-200/60 flex items-center justify-center shrink-0 mt-0.5">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-lifelink-600">Common Misconception</span>
                    <h4 className="font-bold text-sm text-slate-900 mt-0.5">{item.myth}</h4>
                  </div>
                </div>

                <div className="flex items-start space-x-3 pt-3 border-t border-slate-200/60">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Clinical Fact</span>
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{item.fact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};

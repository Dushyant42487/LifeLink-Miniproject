import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const LandingAwareness: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'safety' | 'components' | 'myths'>('components');

  const myths = [
    {
      myth: "Blood donation makes you permanently weak or unfit.",
      fact: "The human body replenishes lost blood volume (plasma) within 24–48 hours. Red blood cells regenerate completely within 4 to 8 weeks."
    },
    {
      myth: "You can contract infectious diseases during blood donation.",
      fact: "All equipment used during donation—including needles and blood bags—is 100% sterile, single-use, and disposed of immediately after."
    },
    {
      myth: "Vegetarians cannot donate blood due to low iron.",
      fact: "Vegetarians with healthy hemoglobin levels (≥ 12.5 g/dL) can safely donate blood as often as non-vegetarians."
    },
    {
      myth: "People with high blood pressure or diabetes can never donate.",
      fact: "Individuals with controlled blood pressure or diabetes managed through oral medications are generally eligible after medical evaluation."
    }
  ];

  return (
    <section id="awareness" className="scroll-mt-20 py-16 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 mb-3">
            Education & Awareness
          </span>
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Blood Safety & Component Knowledge</h3>
          <p className="mt-3 text-slate-600 text-sm">
            Understanding blood components, voluntary donation safety standards, and clearing common misconceptions.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex justify-center mb-10">
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('components')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'components' ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Blood Components
            </button>
            <button
              onClick={() => setActiveTab('myths')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'myths' ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Myths vs Facts
            </button>
            <button
              onClick={() => setActiveTab('safety')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'safety' ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Blood Safety & Screening
            </button>
          </div>
        </div>

        {/* Tab 1: Components */}
        {activeTab === 'components' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black text-sm mb-4 border border-rose-100">
                RBC
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Packed Red Blood Cells (RBC)</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Carries oxygen throughout the body. Essential for trauma victims, surgical patients, and severe anemia management.
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Shelf Life:</span>
                  <span className="font-semibold text-slate-900">42 Days at 2°C–6°C</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="font-semibold text-slate-900">Blood Bank Refrigerators</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-sm mb-4 border border-amber-100">
                FFP
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Fresh Frozen Plasma (FFP)</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Liquid portion of blood containing clotting factors. Vital for severe burn victims, shock, and massive bleeding.
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Shelf Life:</span>
                  <span className="font-semibold text-slate-900">1 Year at -18°C or colder</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="font-semibold text-slate-900">Deep Freezers</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-sm mb-4 border border-purple-100">
                PLT
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Platelet Concentrate</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Cell fragments that prevent bleeding. Essential for cancer patients undergoing chemotherapy, dengue, and bone marrow transplants.
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Shelf Life:</span>
                  <span className="font-semibold text-slate-900">5 Days at 20°C–24°C (Agitated)</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="font-semibold text-slate-900">Platelet Agitators</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Myths vs Facts */}
        {activeTab === 'myths' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myths.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start space-x-3 mb-3">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Myth</span>
                    <h5 className="font-bold text-sm text-slate-900">{item.myth}</h5>
                  </div>
                </div>

                <div className="flex items-start space-x-3 pt-3 border-t border-slate-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Fact</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.fact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Safety */}
        {activeTab === 'safety' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 max-w-4xl mx-auto shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
              <div>
                <h4 className="text-xl font-bold text-slate-900">Mandatory Screening Standards</h4>
                <p className="text-xs text-slate-500">Every donated blood unit undergoes rigorous testing prior to clinical release.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <h5 className="font-bold text-slate-900 mb-1">HIV 1 & 2 Screening</h5>
                <p className="text-slate-500">Chemiluminescence immunoassay screening for antibody & antigen detection.</p>
              </div>
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <h5 className="font-bold text-slate-900 mb-1">Hepatitis B & C (HBV/HCV)</h5>
                <p className="text-slate-500">Mandatory surface antigen (HBsAg) & anti-HCV screening.</p>
              </div>
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <h5 className="font-bold text-slate-900 mb-1">Syphilis (VDRL/TPHA)</h5>
                <p className="text-slate-500">Serological testing to rule out Treponema pallidum infection.</p>
              </div>
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                <h5 className="font-bold text-slate-900 mb-1">Malaria & Blood Grouping</h5>
                <p className="text-slate-500">Microscopic blood smear screening and forward & reverse ABO/Rh typing.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Info, ExternalLink } from 'lucide-react';

export const DisclaimerBanner: React.FC<{ compact?: boolean }> = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  return (
    <>
      {/* Compact Footer Trigger Link / Banner */}
      <div className="pt-4 border-t border-slate-200/80 mt-8 mb-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>LifeLink Voluntary Donor Safety & Clinical Governance</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-rose-600 hover:text-rose-700 font-bold hover:underline inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>Medical & Clinical Safety Information</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Accessible Disclaimer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Clinical & Medical Safety Governance</h3>
                  <p className="text-[10px] text-slate-500">LifeLink Regional Coordination Platform</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-96 overflow-y-auto pr-1">
              <p>
                <strong className="text-slate-900">Decision-Support Platform Notice:</strong> LifeLink provides calculated donor eligibility cooldown timers, emergency matching, and location discovery as operational workflow aids. All automated calculations are based on standard clinical guidelines.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Mandatory In-Person Pre-Donation Clearance</span>
                </p>
                <p className="text-[11px] leading-normal">
                  Medical eligibility clearance, hemoglobin screening (≥ 12.5 g/dL), blood pressure evaluation, infectious disease laboratory testing (HIV, Hepatitis B/C, Syphilis, Malaria), and final suitability for transfusion must be performed by certified healthcare personnel at the blood collection center prior to collection.
                </p>
              </div>
              <p>
                <strong className="text-slate-900">Emergency Alerts & Dispatches:</strong> Responding to an emergency alert registers your willingness to donate. It does not replace clinical screening or constitute an automated dispatch.
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                I Understand & Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

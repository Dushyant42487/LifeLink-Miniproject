import React, { useState, useEffect } from 'react';
import { apiFetch, donorApi } from '../../services/api';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { UserCheck, Clock, AlertCircle, HeartHandshake, CheckCircle2, ShieldAlert, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';

export const DonorEligibility: React.FC = () => {
  const [eligibilityData, setEligibilityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-screening questionnaire state
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Health&Weight, 2: Procedures, 3: Travel&Meds, 4: Review
  const [qWeight, setQWeight] = useState('68');
  const [qHealthy, setQHealthy] = useState<boolean>(true);
  const [qTattoo, setQTattoo] = useState<boolean>(false);
  const [qSurgery, setQSurgery] = useState<boolean>(false);
  const [qFever, setQFever] = useState<boolean>(false);
  const [qMeds, setQMeds] = useState<boolean>(false);
  const [qTravel, setQTravel] = useState<boolean>(false);

  const [submittingQ, setSubmittingQ] = useState(false);
  const [prescreeningResult, setPrescreeningResult] = useState<any>(null);

  const fetchEligibility = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/donors/eligibility');
      if (res.success) {
        setEligibilityData(res.eligibility);
      } else {
        setError(res.error || 'Unable to retrieve donor eligibility data.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error occurred while calculating eligibility.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibility();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="p-8 text-center text-xs text-slate-500 font-semibold flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Calculating Donor Eligibility Rules...</span>
        </div>
      </div>
    );
  }

  if (error || !eligibilityData) {
    return (
      <div className="min-h-[400px] flex items-center justify-center max-w-xl mx-auto p-4">
        <div className="bg-white border border-rose-200 rounded-3xl p-8 text-center shadow-lg w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Eligibility Service Unavailable</h2>
            <p className="text-xs text-slate-500 mt-1">{error || 'Could not load your eligibility status.'}</p>
          </div>
          <button
            onClick={fetchEligibility}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Retry Request
          </button>
        </div>
      </div>
    );
  }

  const wb = eligibilityData?.wholeBlood;
  const plt = eligibilityData?.platelets;

  // Calculate Whole Blood Progress Safely
  const wbTotalWindow = wb?.coolOffDaysTotal || 56;
  const wbDaysRemaining = typeof wb?.daysRemaining === 'number' ? wb.daysRemaining : 0;
  const wbDaysPassed = Math.max(0, wbTotalWindow - wbDaysRemaining);
  const wbProgressPercent = wb?.isEligible ? 100 : Math.min(100, Math.max(0, Math.round((wbDaysPassed / wbTotalWindow) * 100)));

  // Calculate Platelets Progress Safely
  const pltTotalWindow = plt?.coolOffDaysTotal || 14;
  const pltDaysRemaining = typeof plt?.daysRemaining === 'number' ? plt.daysRemaining : 0;
  const pltDaysPassed = Math.max(0, pltTotalWindow - pltDaysRemaining);
  const pltProgressPercent = plt?.isEligible ? 100 : Math.min(100, Math.max(0, Math.round((pltDaysPassed / pltTotalWindow) * 100)));

  const hasNoPrevDonations = !eligibilityData?.lastDonationDate || eligibilityData?.lastDonationDate === 'No previous recorded donation';

  const handleFinalSubmit = async () => {
    setSubmittingQ(true);
    const res = await donorApi.savePrescreening({
      weightKg: Number(qWeight),
      isHealthy: qHealthy,
      hasFever: qFever,
      hasMedications: qMeds,
      hasTattoo: qTattoo,
      hasSurgery: qSurgery,
      hasTravelHistory: qTravel
    });
    setSubmittingQ(false);
    if (res.success && res.prescreening) {
      setPrescreeningResult(res.prescreening);
    }
    setQuestionnaireOpen(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Donor Eligibility Engine</h1>
        <p className="text-xs text-slate-500 mt-1">
          Automated cool-off timer and medical clearance status tracker for safe voluntary donation.
        </p>
      </div>

      {/* Main Eligibility Summary Status Banner */}
      <div className={`rounded-3xl p-6 sm:p-7 border text-white shadow-lg ${
        eligibilityData?.isEligible 
          ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 border-emerald-500/30' 
          : 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 border-amber-500/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0 shadow-md ${
              eligibilityData?.isEligible ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-slate-900'
            }`}>
              {eligibilityData?.isEligible ? <CheckCircle2 className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">Current Readiness Status</span>
              <h2 className="text-2xl font-extrabold text-white">
                {eligibilityData?.isEligible 
                  ? 'Eligible for Whole Blood Donation' 
                  : 'Cool-off Deferral Window Active'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Registered Blood Group: <strong className="text-rose-400 font-bold">{eligibilityData?.bloodGroup || 'O+'}</strong> • Last Recorded Donation: <strong className="text-white">{hasNoPrevDonations ? 'First-time Donor' : eligibilityData?.lastDonationDate}</strong>
              </p>
            </div>
          </div>

          {!eligibilityData?.isEligible && (
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl p-3.5 px-5 text-center shrink-0">
              <span className="text-[10px] font-extrabold uppercase text-amber-300 block">Remaining Cool-off</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400">{wbDaysRemaining} Days</span>
            </div>
          )}
        </div>
      </div>

      {/* Component Cool-Off Breakdown (2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Whole Blood */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <HeartHandshake className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900">Whole Blood Donation</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                wb?.isEligible 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {wb?.isEligible ? 'Eligible Now' : `${wbDaysRemaining} Days Left`}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-6">
              <div className="flex justify-between py-1 border-b border-slate-100/80">
                <span>Standard Cool-off Window:</span>
                <span className="font-bold text-slate-900">{wbTotalWindow} Days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/80">
                <span>Next Eligible Date:</span>
                <span className="font-bold text-rose-600">{wb?.nextEligibleDate || 'Eligible Now'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/80">
                <span>Physical Clearance:</span>
                <span className="font-semibold text-slate-700">Hemoglobin ≥ 12.5 g/dL, Weight ≥ 50kg</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pt-2">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
              <span>Cool-off Period Progress</span>
              <span className="font-bold text-slate-900">{wbProgressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
              <div 
                className="h-full bg-rose-600 rounded-full transition-all duration-500"
                style={{ width: `${wbProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Platelet Apheresis */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Platelet Apheresis</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                plt?.isEligible 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {plt?.isEligible ? 'Eligible Now' : `${pltDaysRemaining} Days Left`}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-6">
              <div className="flex justify-between py-1 border-b border-slate-100/80">
                <span>Standard Cool-off Window:</span>
                <span className="font-bold text-slate-900">{pltTotalWindow} Days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/80">
                <span>Next Eligible Date:</span>
                <span className="font-bold text-purple-600">{plt?.nextEligibleDate || 'Eligible Now'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100/80">
                <span>Physical Clearance:</span>
                <span className="font-semibold text-slate-700">Platelet Count ≥ 150,000 /µL</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pt-2">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
              <span>Cool-off Period Progress</span>
              <span className="font-bold text-slate-900">{pltProgressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
              <div 
                className="h-full bg-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${pltProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Deferral Explanation */}
      {eligibilityData?.deferralReason && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 mb-0.5">Deferral Reason & Guidelines</h4>
            <p>{eligibilityData.deferralReason}</p>
          </div>
        </div>
      )}

      {/* Pre-Screening Health Questionnaire Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-700 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
              3-Step Health Screening Wizard
            </span>
            {prescreeningResult && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                prescreeningResult.isCleared 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {prescreeningResult.status}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white">Interactive Medical Pre-Screening</h3>
          <p className="text-xs text-slate-300 max-w-xl">
            Complete our 3-step preliminary health assessment before arriving at the donation center to expedite your check-in.
          </p>
        </div>

        <button
          onClick={() => { setQuestionnaireOpen(true); setStep(1); }}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition-all shrink-0 cursor-pointer"
        >
          {prescreeningResult ? 'Retake Questionnaire' : 'Start Pre-Screening'}
        </button>
      </div>

      {/* 3-Step Wizard Modal */}
      {questionnaireOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            
            {/* Modal Header & Progress Indicator */}
            <div className="space-y-3 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Pre-Donation Health Assessment</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    {step === 4 ? 'Review & Submit Assessment' : `Step ${step} of 3 • Confidential Screening`}
                  </p>
                </div>
                <button
                  onClick={() => setQuestionnaireOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ShieldAlert className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-600 transition-all duration-300 rounded-full"
                  style={{ width: `${step === 1 ? 33 : step === 2 ? 66 : 100}%` }}
                />
              </div>
            </div>

            {/* Instructions Banner */}
            <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 text-xs space-y-1">
              <div className="flex items-center space-x-2 text-rose-900 font-extrabold">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Pre-Donation Screening Guidelines</span>
              </div>
              <p className="text-slate-700 leading-relaxed text-[11px]">
                Answer all five safety questions honestly before traveling to a camp. Temporary deferrals protect both you and the recipient. Final vital signs, including hemoglobin, blood pressure, and pulse, are assessed by medical staff.
              </p>
            </div>

            {/* STEP 1: Health & Weight */}
            {step === 1 && (
              <div className="space-y-5 text-xs">
                <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Step 1 — Health & Weight
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">Current Body Weight (kg) *</label>
                  <input
                    type="number"
                    value={qWeight}
                    onChange={(e) => setQWeight(e.target.value)}
                    required
                    min="30"
                    max="200"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    placeholder="e.g. 68"
                  />
                  {Number(qWeight) > 0 && Number(qWeight) < 50 && (
                    <p className="text-[11px] text-amber-700 font-bold mt-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Note: Minimum required weight for whole blood donation is 50 kg.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-slate-800 font-bold">1. Do you feel healthy and well today? *</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQHealthy(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        qHealthy ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes, I feel well</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQHealthy(false)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        !qHealthy ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>No, unwell</span>
                    </button>
                  </div>
                  {!qHealthy && (
                    <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 mt-2 font-semibold">
                      Donors must be in good general health on the day of donation. Please defer until you feel fully recovered.
                    </p>
                  )}
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    disabled={!qWeight || Number(qWeight) <= 0}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    <span>Continue to Step 2</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Recent Procedures */}
            {step === 2 && (
              <div className="space-y-5 text-xs">
                <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Step 2 — Recent Procedures (Past 6 Months)
                </div>

                {/* Q2: Tattoo */}
                <div className="space-y-2">
                  <label className="block text-slate-800 font-bold">2. Have you received a tattoo or body piercing within the past 6 months? *</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQTattoo(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        qTattoo ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQTattoo(false)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        !qTattoo ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>No</span>
                    </button>
                  </div>
                  {qTattoo && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 leading-relaxed">
                      Your answer requires further screening. The applicable deferral period depends on current local donation guidelines and your circumstances.
                    </p>
                  )}
                </div>

                {/* Q3: Surgery */}
                <div className="space-y-2 pt-2">
                  <label className="block text-slate-800 font-bold">3. Have you undergone a major surgical procedure or received a blood transfusion in the past 6 months? *</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQSurgery(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        qSurgery ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQSurgery(false)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        !qSurgery ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>No</span>
                    </button>
                  </div>
                  {qSurgery && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 leading-relaxed">
                      Recent surgical procedures or blood transfusions require clinical evaluation to ensure safe interval clearance.
                    </p>
                  )}
                </div>

                <div className="pt-3 flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
                  >
                    <span>Continue to Step 3</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Travel & Medications */}
            {step === 3 && (
              <div className="space-y-5 text-xs">
                <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Step 3 — Travel & Medications
                </div>

                {/* Q4: Fever */}
                <div className="space-y-2">
                  <label className="block text-slate-800 font-bold">4. Have you had a fever, chills, or flu-like symptoms in the past 14 days? *</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQFever(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        qFever ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQFever(false)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        !qFever ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>No</span>
                    </button>
                  </div>
                  {qFever && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 leading-relaxed">
                      Donors must be symptom-free for at least 14 days prior to blood collection to protect recipient safety.
                    </p>
                  )}
                </div>

                {/* Q5: Meds */}
                <div className="space-y-2 pt-1">
                  <label className="block text-slate-800 font-bold">5. Are you currently taking antibiotics, blood thinners, or prescription steroids? *</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQMeds(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        qMeds ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQMeds(false)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        !qMeds ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>No</span>
                    </button>
                  </div>
                  {qMeds && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 leading-relaxed">
                      Certain prescription medications require a temporary deferral period. Our medical team will review your specific medication during check-in.
                    </p>
                  )}
                </div>

                {/* Q6: Travel */}
                <div className="space-y-2 pt-1">
                  <label className="block text-slate-800 font-bold">6. Have you traveled internationally to malaria-endemic regions in the past 6 months? *</label>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setQTravel(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        qTravel ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQTravel(false)}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs border flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        !qTravel ? 'bg-slate-800 text-white border-slate-800 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>No</span>
                    </button>
                  </div>
                  {qTravel && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 leading-relaxed">
                      Travel to malaria-endemic regions requires screening for exposure risks and temporary travel deferrals.
                    </p>
                  )}
                </div>

                <div className="pt-3 flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md cursor-pointer"
                  >
                    <span>Review Answers</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Review Screen before Submission */}
            {step === 4 && (
              <div className="space-y-4 text-xs">
                <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Step 4 — Review Your Assessment Answers
                </div>

                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-700">
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-semibold">Body Weight:</span>
                    <span className="font-bold text-slate-900">{qWeight} kg</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-semibold">Feel Healthy Today:</span>
                    <span className={`font-bold ${qHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>{qHealthy ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-semibold">Tattoo / Piercing (6 mo):</span>
                    <span className={`font-bold ${qTattoo ? 'text-amber-600' : 'text-slate-900'}`}>{qTattoo ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-semibold">Surgery / Transfusion (6 mo):</span>
                    <span className={`font-bold ${qSurgery ? 'text-amber-600' : 'text-slate-900'}`}>{qSurgery ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-semibold">Fever / Flu Symptoms (14 days):</span>
                    <span className={`font-bold ${qFever ? 'text-amber-600' : 'text-slate-900'}`}>{qFever ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-semibold">Prescription Medications:</span>
                    <span className={`font-bold ${qMeds ? 'text-amber-600' : 'text-slate-900'}`}>{qMeds ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Malaria Travel History (6 mo):</span>
                    <span className={`font-bold ${qTravel ? 'text-amber-600' : 'text-slate-900'}`}>{qTravel ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={() => setStep(3)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Edit</span>
                  </button>
                  <button
                    onClick={handleFinalSubmit}
                    disabled={submittingQ}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {submittingQ ? 'Submitting...' : 'Confirm & Submit Assessment'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <DisclaimerBanner />
    </div>
  );
};

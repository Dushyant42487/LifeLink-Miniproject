import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, donorApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { DigitalDonorPassModal } from '../../components/common/DigitalDonorPassModal';
import { 
  Heart, 
  CheckCircle2, 
  AlertTriangle, 
  Compass, 
  History, 
  Building2, 
  ArrowRight, 
  ShieldCheck, 
  FileText, 
  QrCode, 
  CalendarCheck,
  Droplet,
  Award,
  HeartHandshake,
  UserCheck,
  Share2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CampRequest } from '../../types';
import { calculateAuthoritativeMetrics } from '../../utils/donorMetrics';
import { DONOR_MOCK_HISTORY_FIXTURE, checkBloodGroupDiscrepancy, VERIFIED_DONOR_BLOOD_GROUP } from '../../utils/donorIntegrity';
import { checkAlertCompatibility } from '../../utils/bloodCompatibility';

export const DonorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState<any>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [campRequests, setCampRequests] = useState<CampRequest[]>([]);
  const [digitalPassData, setDigitalPassData] = useState<any>(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [donorProfile, setDonorProfile] = useState<any>(null);

  const loadDonorData = async () => {
    setLoadingEligibility(true);
    setEligibilityError(null);
    try {
      const elRes = await apiFetch('/donors/eligibility');
      if (elRes.success && elRes.eligibility) {
        setEligibility(elRes.eligibility);
      } else {
        setEligibilityError(elRes.error || 'Could not load donor eligibility status.');
      }
    } catch (err: any) {
      setEligibilityError(err?.message || 'Network connection failed.');
    } finally {
      setLoadingEligibility(false);
    }

    const histRes = await apiFetch('/donors/history');
    if (histRes.success) setHistoryData(histRes);

    const alertRes = await apiFetch('/donors/emergency-alerts');
    if (alertRes.success) setAlerts(alertRes.alerts || []);

    const reqRes = await apiFetch('/donors/camp-requests');
    if (reqRes.success && reqRes.requests) setCampRequests(reqRes.requests);

    const profRes = await donorApi.getProfile();
    if (profRes.success && profRes.donor) setDonorProfile(profRes.donor);
  };

  useEffect(() => {
    loadDonorData();
  }, []);

  const handleOpenDigitalPass = async () => {
    const res = await donorApi.getDigitalPass();
    if (res.success && res.pass) {
      setDigitalPassData(res.pass);
      setShowPassModal(true);
    }
  };

  // Determine time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const wholeBlood = eligibility?.wholeBlood;
  const platelets = eligibility?.platelets;

  const isWbEligible = Boolean(wholeBlood?.isEligible);
  const isPltEligible = Boolean(platelets?.isEligible);
  const isAnyEligible = isWbEligible || isPltEligible;

  const donorName = user?.name || 'Valued Donor';
  const bloodGroup = eligibility?.bloodGroup || user?.bloodGroup || VERIFIED_DONOR_BLOOD_GROUP;
  const savedRadiusKm = Number(donorProfile?.travelRadiusKm || (user as any)?.travelRadiusKm || 25);

  // Authoritative metrics derived directly from history collection
  const historyList = historyData?.history || [];
  const metrics = useMemo(() => calculateAuthoritativeMetrics(historyList), [historyList]);

  // Cooldown calculation for Whole Blood (56-Day Policy)
  const wbCooldownDays = wholeBlood?.coolOffDaysTotal || 56;
  const wbDaysRemaining = typeof wholeBlood?.daysRemaining === 'number' ? Math.max(0, wholeBlood.daysRemaining) : 0;
  const wbDaysElapsed = Math.max(0, wbCooldownDays - wbDaysRemaining);
  const wbProgressPct = isWbEligible ? 100 : Math.min(100, Math.round((wbDaysElapsed / wbCooldownDays) * 100));

  // Cooldown calculation for Platelet Apheresis (14-Day Policy)
  const pltCooldownDays = platelets?.coolOffDaysTotal || 14;
  const pltDaysRemaining = typeof platelets?.daysRemaining === 'number' ? Math.max(0, platelets.daysRemaining) : 0;
  const pltDaysElapsed = Math.max(0, pltCooldownDays - pltDaysRemaining);
  const pltProgressPct = isPltEligible ? 100 : Math.min(100, Math.round((pltDaysElapsed / pltCooldownDays) * 100));

  // Eligibility-aware booking CTA definition
  const bookingCta = useMemo(() => {
    if (loadingEligibility) {
      return {
        label: 'Checking Eligibility...',
        action: () => {},
        disabled: true,
        variant: 'loading'
      };
    }
    if (eligibilityError) {
      return {
        label: 'Review Eligibility Status',
        action: () => navigate('/donor/eligibility'),
        disabled: false,
        variant: 'review'
      };
    }
    // If Platelet Apheresis is confirmed eligible while Whole Blood is in cool-off
    if (isPltEligible && !isWbEligible) {
      return {
        label: 'Book Platelet Donation',
        action: () => navigate('/donor/camps?type=platelets'),
        disabled: false,
        variant: 'platelets'
      };
    }
    // If Whole Blood is eligible
    if (isWbEligible) {
      return {
        label: isPltEligible ? 'Book Donation Slot' : 'Book Whole Blood Donation',
        action: () => navigate(isPltEligible ? '/donor/camps?type=all' : '/donor/camps?type=whole_blood'),
        disabled: false,
        variant: 'whole_blood'
      };
    }
    // If neither is eligible (both cool-offs active)
    return {
      label: 'View Next Eligible Date',
      action: () => navigate('/donor/eligibility'),
      disabled: false,
      variant: 'cooloff'
    };
  }, [loadingEligibility, eligibilityError, isWbEligible, isPltEligible, navigate]);

  // Filter emergency alerts strictly by active status and saved travel radius
  const eligibleAlerts = useMemo(() => {
    const now = Date.now();
    return alerts.filter(alert => {
      // Must be active
      const notExpired = alert.expiresAt ? new Date(alert.expiresAt).getTime() > now : true;
      // Must be within donor's saved service radius
      const dist = typeof alert.distanceKmApprox === 'number' ? alert.distanceKmApprox : 0;
      const withinRadius = dist <= savedRadiusKm;
      return notExpired && withinRadius;
    });
  }, [alerts, savedRadiusKm]);

  // Share alert handler for public non-sensitive details
  const handleShareAlert = (alert: any) => {
    const shareText = `URGENT BLOOD REQUIREMENT: ${alert.hospitalName} in ${alert.city} urgently requires ${alert.bloodGroup} ${alert.component}. Share to help coordinate voluntary donors!`;
    if (navigator.share) {
      navigator.share({
        title: `LifeLink Urgent Alert: ${alert.bloodGroup} ${alert.component}`,
        text: shareText,
        url: window.location.origin
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText);
      window.alert('Alert information copied to clipboard for sharing!');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Light, Modernized Welcome Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
              <span>Verified Donor</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900 text-white shadow-xs">
              {bloodGroup} Group
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()}, <span className="text-rose-600">{donorName}</span>!
          </h1>
          
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Welcome to your LifeLink donor portal. Your contributions save lives across partner hospitals and community blood centers.
          </p>
        </div>

        {/* Header Primary Action: Eligibility-Aware CTA */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full md:w-auto">
          {isAnyEligible ? (
            <button
              onClick={bookingCta.action}
              disabled={bookingCta.disabled}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center space-x-2 shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50 ${
                bookingCta.variant === 'platelets' 
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20' 
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>{bookingCta.label}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={bookingCta.action}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all flex items-center space-x-2 border border-slate-200 cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4 text-slate-500" />
                <span>{bookingCta.label}</span>
              </button>
              <button
                onClick={handleOpenDigitalPass}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center space-x-2 shadow-md shadow-slate-900/20 hover:scale-[1.02] cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-rose-400" />
                <span>View Donor Card</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Refreshed Authoritative Lifetime Metric Cards (Single Source of Truth) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Donations"
          value={metrics.totalDonations}
          subtitle="Countable donation records"
          icon={Award}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />

        <StatCard
          title="Blood Contributed"
          value={`${metrics.totalVolumeMl} mL`}
          subtitle="Whole blood & apheresis units"
          icon={Droplet}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Lives Impacted"
          value={`~${metrics.livesImpactedEst}`}
          subtitle="Estimated clinical transfusions"
          icon={Heart}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Active Emergency Alerts Notice (Clinically Verified Compatibility & Action States) */}
      {eligibleAlerts.length > 0 && (
        <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
              <h3 className="font-bold text-sm text-rose-900">Urgent Blood Deficits (Within {savedRadiusKm} km Radius)</h3>
            </div>
            <Link to="/donor/alerts" className="text-xs font-semibold text-rose-700 hover:underline">
              View All ({eligibleAlerts.length})
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eligibleAlerts.slice(0, 2).map((alert) => {
              const compResult = checkAlertCompatibility(bloodGroup, alert.bloodGroup, alert.component);
              const isIncompatible = compResult.status === 'confirmed_incompatible';
              const isCompatible = compResult.status === 'confirmed_compatible';

              return (
                <div key={alert.id} className="bg-white rounded-xl border border-rose-200 p-4 flex flex-col justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800">
                        URGENT: {alert.bloodGroup} {alert.component}
                      </span>
                      <span className="text-xs text-slate-500 truncate max-w-[150px]">{alert.hospitalName}</span>
                      {alert.distanceKmApprox && (
                        <span className="text-[10px] text-slate-400 font-semibold">~{alert.distanceKmApprox} km</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-1">{alert.description}</p>
                    
                    {/* Clinical Compatibility Message */}
                    <p className={`text-[11px] font-medium mt-1.5 ${
                      isIncompatible 
                        ? 'text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200' 
                        : isCompatible 
                        ? 'text-emerald-700' 
                        : 'text-slate-600'
                    }`}>
                      {compResult.message}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isIncompatible ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleShareAlert(alert)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Share Alert</span>
                        </button>
                        <span
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed"
                          title="You cannot respond directly as your blood type is not compatible with this patient requirement"
                        >
                          Incompatible Match
                        </span>
                      </>
                    ) : (
                      <Link
                        to="/donor/alerts"
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors"
                      >
                        Respond
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Column (7 cols): Donation Readiness Tracker, History & Guidelines */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Consolidated Donation Readiness Tracker (Whole Blood & Platelets Apheresis) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">Donation Readiness Tracker</h3>
              </div>
              <Link to="/donor/eligibility" className="text-xs text-rose-600 font-semibold hover:underline">
                View Full Engine & Policy
              </Link>
            </div>

            {loadingEligibility ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-500 flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading authoritative eligibility status...</span>
              </div>
            ) : eligibilityError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-rose-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  <span>Eligibility Information Unavailable</span>
                </div>
                <p className="text-slate-600">{eligibilityError}</p>
                <button
                  onClick={loadDonorData}
                  className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Retry Request
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* 1. Whole Blood Deferral Progress */}
                <div className={`p-4 rounded-xl border transition-all ${
                  isWbEligible 
                    ? 'bg-emerald-50/60 border-emerald-200' 
                    : 'bg-rose-50/60 border-rose-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <HeartHandshake className="w-4 h-4 text-rose-600" />
                      <span className="font-bold text-xs text-slate-900">Whole Blood Donation</span>
                      <span className="text-[10px] text-slate-500 font-medium">({wbCooldownDays}-Day Policy)</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      isWbEligible
                        ? 'bg-emerald-100 text-[#16A34A] border-emerald-300'
                        : 'bg-rose-100 text-[#DC2626] border-rose-300'
                    }`}>
                      {isWbEligible ? 'Eligible to Donate' : `Cool-off Active (${wbDaysRemaining} Days Left)`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                      <span>Rest Progress: {wbProgressPct}% Elapsed</span>
                      <span>Next Date: <strong className="text-slate-800">{wholeBlood?.nextEligibleDate || 'Eligible Now'}</strong></span>
                    </div>
                    <div 
                      className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
                      role="progressbar"
                      aria-valuenow={wbProgressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Whole blood donation eligibility cooldown progress"
                    >
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isWbEligible ? 'bg-emerald-500' : 'bg-rose-600'}`}
                        style={{ width: `${wbProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Platelet Apheresis Deferral Progress */}
                <div className={`p-4 rounded-xl border transition-all ${
                  isPltEligible 
                    ? 'bg-emerald-50/60 border-emerald-200' 
                    : 'bg-purple-50/60 border-purple-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-xs text-slate-900">Platelet Apheresis</span>
                      <span className="text-[10px] text-slate-500 font-medium">({pltCooldownDays}-Day Policy)</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      isPltEligible
                        ? 'bg-emerald-100 text-[#16A34A] border-emerald-300'
                        : 'bg-purple-100 text-purple-700 border-purple-300'
                    }`}>
                      {isPltEligible ? 'Eligible to Donate' : `Cool-off Active (${pltDaysRemaining} Days Left)`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                      <span>Rest Progress: {pltProgressPct}% Elapsed</span>
                      <span>Next Date: <strong className="text-slate-800">{platelets?.nextEligibleDate || 'Eligible Now'}</strong></span>
                    </div>
                    <div 
                      className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80"
                      role="progressbar"
                      aria-valuenow={pltProgressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Platelet apheresis eligibility cooldown progress"
                    >
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isPltEligible ? 'bg-emerald-500' : 'bg-purple-600'}`}
                        style={{ width: `${pltProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Last recorded donation & booking CTA */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500">
                    Last Recorded Donation: <strong className="text-slate-800">{eligibility?.lastDonationDate || 'First-time Donor'}</strong>
                  </p>
                  {isAnyEligible && (
                    <button
                      onClick={() => navigate('/donor/camps')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                    >
                      Find a Camp Near You
                    </button>
                  )}
                </div>

                {/* Regulatory Clinical Clearance Disclaimer */}
                <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">
                  Calculated eligibility guidelines only. Final clinical clearance, vital sign assessment (hemoglobin, pulse, BP), and donor suitability are confirmed by healthcare staff prior to collection.
                </p>

              </div>
            )}
          </div>
          
          {/* Recent Donation Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">Recent Donation History</h3>
              </div>
              <Link to="/donor/donations" className="text-xs text-rose-600 font-semibold hover:underline flex items-center space-x-1">
                <span>View Full Record</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {historyList.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No donation records yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  Your voluntary blood donations and official certificates will appear here once recorded.
                </p>
                <Link to="/donor/camps" className="mt-3 inline-block text-xs font-bold text-rose-600 hover:text-rose-700">
                  Find an upcoming donation camp &rarr;
                </Link>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-100 pl-4 space-y-5 ml-2">
                {historyList.slice(0, 3).map((item: any, idx: number) => {
                  const isMismatched = checkBloodGroupDiscrepancy(item.bloodGroup, bloodGroup);
                  return (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full bg-rose-600 ring-4 ring-white" />
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900 block">{item.bloodBankName}</span>
                            {isMismatched && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠️ Mismatch: {item.bloodGroup}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.date} • {item.volumeMl} mL {item.component} ({item.bloodGroup})</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 24-Hour Pre-Donation Preparation & Safety Guidance */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5 shadow-xs text-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-emerald-200/60 pb-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="font-extrabold text-sm text-emerald-950">24-Hour Pre-Donation Preparation Guidelines</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-emerald-900">
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="font-bold text-slate-900 block mb-0.5">💧 Hydration First</span>
                <p className="text-[11px] text-slate-600">Drink an extra 16 oz (500 mL) of water before your donation appointment.</p>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="font-bold text-slate-900 block mb-0.5">🥗 Iron-Rich Meal</span>
                <p className="text-[11px] text-slate-600">Eat a balanced, iron-rich meal (spinach, beans, lean protein). Avoid fatty foods.</p>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="font-bold text-slate-900 block mb-0.5">😴 Adequate Rest</span>
                <p className="text-[11px] text-slate-600">Get at least 7–8 hours of restful sleep the night before donating.</p>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="font-bold text-slate-900 block mb-0.5">🪪 ID & Digital Pass</span>
                <p className="text-[11px] text-slate-600">Bring an official photo ID and your LifeLink Digital Donor Pass for fast check-in.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Secondary Column (5 cols): Organization Camp Request CTA & Nearby Camps */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Prominent Single Organizational Blood Camp Request CTA Card */}
          <div className="bg-gradient-to-br from-rose-600 via-rose-700 to-red-800 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                <Building2 className="w-5 h-5" />
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-200">Community Drive Initiative</span>
                <h3 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
                  Request a Blood Camp for Your Organization
                </h3>
                <p className="text-xs text-rose-100 leading-relaxed mt-1">
                  Host an accredited voluntary blood drive at your company, college, university, or residential society. LifeLink handles medical team dispatch and blood bank coordination.
                </p>
              </div>

              <Link
                to="/donor/camps?tab=request"
                className="w-full py-3 rounded-xl text-xs font-bold text-rose-950 bg-white hover:bg-rose-50 transition-all flex items-center justify-center space-x-2 shadow-md hover:scale-[1.02]"
              >
                <span>Request Camp for Org</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Submitted Camp Requests Summary Card (if present) */}
          {campRequests.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-rose-600" />
                  <h3 className="font-bold text-sm text-slate-900">My Camp Requests ({campRequests.length})</h3>
                </div>
                <Link to="/donor/camps?tab=my-requests" className="text-xs text-rose-600 font-semibold hover:underline">
                  View All
                </Link>
              </div>

              <div className="space-y-2.5">
                {campRequests.slice(0, 2).map((req) => (
                  <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{req.organizationName}</span>
                      <p className="text-[11px] text-slate-500">{req.organizationType} • {req.proposedDate}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      req.status === 'Approved' || req.status === 'Scheduled'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : req.status === 'Submitted' || req.status === 'Under Review'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Donation Camps */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-rose-600" />
                  <h3 className="font-bold text-sm text-slate-900">Upcoming Donation Camps</h3>
                </div>
                <Link to="/donor/camps" className="text-xs text-rose-600 font-semibold hover:underline">
                  Browse All
                </Link>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/80">
                  <span className="text-xs font-bold text-slate-900 block">Metro Tech Park Blood Drive</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Aug 20, 2026 • 09:00 AM - 05:00 PM</p>
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">Tech Park Auditorium, Gate 3</p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/80">
                  <span className="text-xs font-bold text-slate-900 block">City University Campus Camp</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Aug 25, 2026 • 10:00 AM - 04:00 PM</p>
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">Student Union Center</p>
                </div>
              </div>
            </div>

            <Link
              to="/donor/camps"
              className="w-full mt-4 py-2.5 text-center rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Explore Camps & RSVP
            </Link>
          </div>

        </div>

      </div>

      {/* Digital Donor Pass Modal */}
      <DigitalDonorPassModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        passData={digitalPassData}
      />

      <DisclaimerBanner />
    </div>
  );
};

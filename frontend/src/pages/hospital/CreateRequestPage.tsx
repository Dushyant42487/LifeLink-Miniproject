import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { hospitalApi, apiFetch } from '../../services/api';
import { BloodGroup, BloodComponent, RequestUrgency, BloodRequest } from '../../types';
import { PlusCircle, AlertTriangle, CheckCircle2, ShieldAlert, PhoneCall, Clock, Search, ArrowRight, PackageCheck, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';

interface CreateRequestPageProps {
  forcedInitialUrgency?: RequestUrgency;
}

export const CreateRequestPage: React.FC<CreateRequestPageProps> = ({ forcedInitialUrgency }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialUrgency = forcedInitialUrgency || (searchParams.get('urgency') as RequestUrgency) || 'Routine';
  const initialGroup = (searchParams.get('bloodGroup') as BloodGroup) || 'O+';
  const initialComponent = (searchParams.get('component') as BloodComponent) || 'RBC';
  const initialBloodBankId = searchParams.get('bloodBankId') || '';
  const initialUnitId = searchParams.get('unitId') || '';

  // Preserve search filters when returning to availability search (Phase 4A)
  const returnBloodGroup = searchParams.get('returnBloodGroup') || searchParams.get('bloodGroup');
  const returnComponent = searchParams.get('returnComponent') || searchParams.get('component');
  const returnUrgency = searchParams.get('returnUrgency') || searchParams.get('urgency');

  const returnSearchQuery = new URLSearchParams();
  if (returnBloodGroup && returnBloodGroup !== 'all') returnSearchQuery.set('bloodGroup', returnBloodGroup);
  if (returnComponent && returnComponent !== 'all') returnSearchQuery.set('component', returnComponent);
  if (returnUrgency && returnUrgency !== 'Routine') returnSearchQuery.set('urgency', returnUrgency);

  const returnSearchUrl = `/hospital/availability${returnSearchQuery.toString() ? `?${returnSearchQuery.toString()}` : ''}`;

  const [targetUnitId, setTargetUnitId] = useState<string>(initialUnitId);
  const [urgency, setUrgency] = useState<RequestUrgency>(initialUrgency);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(initialGroup);
  const [component, setComponent] = useState<BloodComponent>(initialComponent);
  const [quantityUnits, setQuantityUnits] = useState<number>(1);
  const [patientReferenceId, setPatientReferenceId] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  
  // Calculate default required-by datetime based on urgency
  const calculateDefaultRequiredBy = (urgencyLevel: RequestUrgency) => {
    const hours = urgencyLevel === 'Emergency' ? 4 : urgencyLevel === 'Urgent' ? 12 : 24;
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 16);
  };

  const [requiredByDate, setRequiredByDate] = useState<string>(calculateDefaultRequiredBy(initialUrgency));
  const [notes, setNotes] = useState<string>('');
  const [bloodBankId, setBloodBankId] = useState<string>(initialBloodBankId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyRequests, setEmergencyRequests] = useState<BloodRequest[]>([]);
  const [availableBloodBanks, setAvailableBloodBanks] = useState<any[]>([]);

  // Fetch real blood banks dynamically from authoritative backend
  useEffect(() => {
    const fetchBloodBanks = async () => {
      try {
        const res = await apiFetch('/public/locations');
        if (res.success && res.bloodBanks && res.bloodBanks.length > 0) {
          setAvailableBloodBanks(res.bloodBanks);
          if (initialBloodBankId) {
            const found = res.bloodBanks.find((b: any) => b.id === initialBloodBankId);
            if (found) setBloodBankId(found.id);
          }
        }
      } catch (e) {
        // Fallback gracefully
      }
    };
    fetchBloodBanks();
  }, [initialBloodBankId]);

  // Fetch active emergency requests for hospital side-panel context
  useEffect(() => {
    const fetchActiveEmergencyOrders = async () => {
      const res = await hospitalApi.getRequests();
      if (res.success && res.requests) {
        setEmergencyRequests(
          res.requests.filter((r: BloodRequest) => 
            r.urgency === 'Emergency' && r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
          )
        );
      }
    };
    fetchActiveEmergencyOrders();
  }, []);

  // Update urgency and default time without discarding user-entered values
  const handleUrgencyChange = (newUrgency: RequestUrgency) => {
    setUrgency(newUrgency);
    setRequiredByDate(calculateDefaultRequiredBy(newUrgency));
    if (newUrgency === 'Emergency' && !department) {
      setDepartment('Emergency & Trauma Surgery');
    }
  };

  const [submissionKey] = useState<string>(() => `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!patientReferenceId.trim() || patientReferenceId.trim().length < 3) {
      setError('Patient reference identifier must be at least 3 characters (e.g. PAT-4402 or PAT-4402 (OR-2)).');
      return;
    }

    if (!department.trim()) {
      setError('Hospital Department is required.');
      return;
    }

    if (quantityUnits < 1 || quantityUnits > 20) {
      setError('Quantity must be between 1 and 20 units.');
      return;
    }

    setLoading(true);

    const res = await hospitalApi.createRequest({
      bloodGroup,
      component,
      quantityUnits: Number(quantityUnits),
      urgency,
      patientReferenceId: patientReferenceId.trim(),
      department: department.trim(),
      requiredByDate,
      notes: notes.trim(),
      bloodBankId: bloodBankId || undefined,
      targetUnitId: targetUnitId.trim() || undefined,
      idempotencyKey: submissionKey
    });

    setLoading(false);

    if (res.success && res.request) {
      navigate('/hospital/requests');
    } else {
      setError(res.error || 'Failed to submit requisition. Please check connection and try again.');
    }
  };

  const isEmergency = urgency === 'Emergency';

  return (
    <div className="space-y-6">
      
      {/* Target Unit Prefill Banner (Phase 3B) */}
      {targetUnitId && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-sky-200/70 flex items-center justify-center shrink-0 text-sky-800">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sky-950">Target Regional Unit Requisition</span>
                <span className="font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold">{targetUnitId}</span>
              </div>
              <p className="text-[11px] text-sky-700 mt-0.5">
                Parameters prefilled from regional inventory. Opening this form does not lock stock. Availability is verified atomically upon submission.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setTargetUnitId('')}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
            >
              Clear Unit Lock
            </button>
            <Link
              to={returnSearchUrl}
              className="text-[11px] font-bold bg-white text-sky-800 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Back to Search</span>
            </Link>
          </div>
        </div>
      )}

      {/* Header Banner - Urgent vs Routine */}
      {isEmergency ? (
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-800 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-950/70 px-2.5 py-0.5 rounded border border-rose-400/40">
                CRITICAL / STAT EMERGENCY PROTOCOL
              </span>
              <h1 className="text-2xl font-black text-white mt-1">
                Emergency Blood Requisition
              </h1>
              <p className="text-xs text-rose-100 mt-0.5">
                Rapid requisition overrides routine batches and notifies regional blood center emergency coordinators immediately.
              </p>
            </div>
          </div>

          <Link
            to="/search-blood?urgency=Emergency"
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white text-rose-700 hover:bg-rose-50 shadow-md flex items-center space-x-1.5 shrink-0 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Check Live Emergency Stock</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Requisition Portal
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-500 font-medium">{urgency} Protocol</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Create Hospital Blood Requisition
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Initiate an official clinical blood requirement to connected regional blood centers.
            </p>
          </div>

          <Link
            to="/hospital/requests"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
          >
            View Requisitions Log
          </Link>
        </div>
      )}

      {/* Error Banner with actionable location configuration */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-rose-950">{error}</p>
              {error.toLowerCase().includes('location') && (
                <p className="text-[11px] text-rose-700 mt-0.5">
                  LifeLink automatic routing requires genuine hospital geographic coordinates to compute spatial distance and candidate rankings.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {error.toLowerCase().includes('location') && (
              <Link
                to="/hospital/profile"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition"
              >
                <span>Configure Hospital Location</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <Link
              to={returnSearchUrl}
              className="inline-flex items-center space-x-1 text-xs font-bold text-rose-700 hover:text-rose-900 underline shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Regional Availability</span>
            </Link>
          </div>
        </div>
      )}

      {/* Two-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Requisition Form */}
        <div className={`${isEmergency ? 'lg:col-span-7' : 'lg:col-span-8'} bg-white rounded-2xl border ${isEmergency ? 'border-rose-200 shadow-rose-100/50' : 'border-slate-200'} p-6 shadow-sm space-y-6`}>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Urgency Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Requisition Urgency Level *
                </label>
                <span className="text-[11px] text-slate-400">
                  {isEmergency ? 'STAT Emergency: 4-hr dispatch window' : urgency === 'Urgent' ? 'Priority: 12-hr dispatch window' : 'Standard: 24-hr dispatch window'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(['Routine', 'Urgent', 'Emergency'] as RequestUrgency[]).map((u) => {
                  const isCurrent = urgency === u;
                  return (
                    <button
                      type="button"
                      key={u}
                      onClick={() => handleUrgencyChange(u)}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex flex-col items-center space-y-1 cursor-pointer ${
                        isCurrent
                          ? u === 'Emergency'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/30'
                            : u === 'Urgent'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30'
                            : 'bg-blood-600 text-white border-blood-600 shadow-md shadow-blood-500/30'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {u === 'Emergency' && <AlertTriangle className="w-4 h-4" />}
                      {u === 'Urgent' && <Clock className="w-4 h-4" />}
                      {u === 'Routine' && <CheckCircle2 className="w-4 h-4" />}
                      <span>{u === 'Emergency' ? 'Emergency / STAT' : u}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Blood Group, Component, Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group *</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className={`w-full px-3 py-2.5 text-xs border rounded-xl font-bold cursor-pointer ${
                    isEmergency 
                      ? 'border-rose-300 bg-rose-50/30 text-rose-950 focus:ring-rose-500' 
                      : 'border-slate-300 bg-white text-slate-900 focus:ring-blood-500'
                  }`}
                >
                  {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Component *</label>
                <select
                  value={component}
                  onChange={(e) => setComponent(e.target.value as BloodComponent)}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-blood-500 font-medium text-slate-900 cursor-pointer"
                >
                  <option value="RBC">Packed Red Blood Cells (RBC)</option>
                  <option value="Plasma">Fresh Frozen Plasma (FFP)</option>
                  <option value="Platelets">Platelet Concentrate (PLT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (Units) *</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={quantityUnits}
                  onChange={(e) => setQuantityUnits(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-blood-500"
                />
              </div>
            </div>

            {/* Patient Ref ID & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Anonymized Patient / Case Reference ID *
                </label>
                <input
                  type="text"
                  required
                  value={patientReferenceId}
                  onChange={(e) => setPatientReferenceId(e.target.value)}
                  placeholder="e.g. PAT-9482 (OR-3) or TRAUMA-881"
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-blood-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Do not enter raw patient names to protect privacy.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hospital Department / OT Room *
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Trauma Surgery, ICU, Obstetrics"
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>
            </div>

            {/* Required By Date & Clinical Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Required By Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-blood-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Dispatch Destination / Blood Bank
                  </label>
                  {!bloodBankId && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Smart Automatic Routing Active
                    </span>
                  )}
                </div>
                <select
                  value={bloodBankId}
                  onChange={(e) => setBloodBankId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-blood-500 cursor-pointer"
                >
                  <option value="">⚡ Automatic Smart Routing (Recommended — Nearest eligible banks with stock)</option>
                  {availableBloodBanks.map((bb: any) => (
                    <option key={bb.id} value={bb.id}>
                      Direct Facility Requisition: {bb.name} {bb.city ? `(${bb.city})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {bloodBankId 
                    ? 'Manual destination selected. Offer will be dispatched directly to this facility.'
                    : 'LifeLink will automatically rank nearby blood banks by distance and genuinely available stock, dispatching per-bank offers.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinical Indication & Cross-Match Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicate diagnosis, pre-op schedule, surgical hemorrhage notes, special filter requirements..."
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:ring-blood-500"
              />
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Submitting creates an encrypted dispatch ticket linked to laboratory tracking.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-3 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isEmergency 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' 
                    : 'bg-blood-600 hover:bg-blood-700 shadow-blood-500/30'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Transmitting Requisition...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>{isEmergency ? 'TRANSMIT EMERGENCY REQUISITION' : 'Submit Blood Requisition'}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Contextual Guidance / Active Emergency Orders Sidebar */}
        <div className={`${isEmergency ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-4`}>
          
          {/* Active Emergency Orders Panel (Visible in all modes, highlighted in Emergency) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className={`w-4 h-4 ${emergencyRequests.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Active Emergency Orders ({emergencyRequests.length})
                </h3>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {emergencyRequests.length > 0 ? (
                emergencyRequests.map(req => (
                  <div key={req.id} className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{req.id}</span>
                        <span className="font-extrabold text-rose-700">{req.bloodGroup} {req.component}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{req.patientReferenceId} • {req.quantityUnits} Units</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No active emergency requisitions pending.
                </div>
              )}
            </div>
          </div>

          {/* 24/7 Dispatch Hotline Card */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-rose-400">
              <PhoneCall className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Regional Trauma Hotline</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              For mass-casualty protocols or expedited red cell couriers, contact the central trauma dispatch desk directly.
            </p>
            <div className="pt-2">
              <a
                href="tel:18005550199"
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center space-x-1.5 transition-colors"
              >
                <span>Call 1-800-BLOOD-EMERG</span>
              </a>
            </div>
          </div>

          {/* Standard Workflow Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs space-y-2 text-slate-600">
            <h4 className="font-bold text-slate-900">Cross-Matching Workflow</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Once submitted, head to <strong>Patient Samples Log</strong> to register the EDTA compatibility tube for cross-match screening before unit release.
            </p>
            <Link
              to="/hospital/samples"
              className="inline-flex items-center space-x-1 font-bold text-blood-700 hover:underline pt-1"
            >
              <span>View Samples Log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};

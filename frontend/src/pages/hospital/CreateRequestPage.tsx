import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { hospitalApi, apiFetch } from '../../services/api';
import { BloodGroup, BloodComponent, RequestUrgency, BloodRequest } from '../../types';
import { 
  PlusCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  PhoneCall, 
  Clock, 
  Search, 
  ArrowRight, 
  PackageCheck, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  Radio
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { calcHaversineKm, isValidCoordinate } from '../../utils/geo';

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

  // Preserve search filters when returning to availability search
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
  const [showManualBankSelector, setShowManualBankSelector] = useState<boolean>(Boolean(initialBloodBankId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyRequests, setEmergencyRequests] = useState<BloodRequest[]>([]);
  const [availableBloodBanks, setAvailableBloodBanks] = useState<any[]>([]);
  const [hospitalProfile, setHospitalProfile] = useState<any | null>(null);
  const [showEmergencyPanel, setShowEmergencyPanel] = useState<boolean>(false);

  // Fetch hospital profile to get authoritative hospital coordinates for distance calculations
  useEffect(() => {
    hospitalApi.getProfile().then(res => {
      if (res.success && res.hospital) {
        setHospitalProfile(res.hospital);
      }
    }).catch(() => {});
  }, []);

  // Fetch verified blood banks dynamically from authoritative backend
  useEffect(() => {
    const fetchBloodBanks = async () => {
      try {
        const res = await apiFetch('/public/locations');
        if (res.success && res.bloodBanks && res.bloodBanks.length > 0) {
          const validBanks = res.bloodBanks.filter((b: any) => 
            b.hasValidLocation && b.lat && b.lng && b.isActive !== false && b.verificationStatus !== 'Rejected'
          );
          setAvailableBloodBanks(validBanks);
          if (initialBloodBankId) {
            const found = validBanks.find((b: any) => b.id === initialBloodBankId);
            if (found) {
              setBloodBankId(found.id);
              setShowManualBankSelector(true);
            }
          }
        }
      } catch {
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
        const activeEm = res.requests.filter((r: BloodRequest) => 
          r.urgency === 'Emergency' && r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
        );
        setEmergencyRequests(activeEm);
        if (activeEm.length > 0) {
          setShowEmergencyPanel(true);
        }
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

  // Selected blood bank details & calculated geographic distance
  const selectedBloodBank = bloodBankId ? availableBloodBanks.find(b => b.id === bloodBankId) : null;
  const calculatedManualDistance = (selectedBloodBank && hospitalProfile?.latitude && hospitalProfile?.longitude)
    ? Math.round(calcHaversineKm(hospitalProfile.latitude, hospitalProfile.longitude, selectedBloodBank.lat, selectedBloodBank.lng) * 10) / 10
    : null;

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

    try {
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
        // Separate create and result states: navigate immediately to tracking view
        navigate(`/hospital/requests?requestId=${res.request.id}&submitted=true`);
      } else {
        setError(res.error || 'Failed to submit requisition. Please check connection and try again.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Network error occurred while submitting requisition. Please try again.');
    }
  };

  const isEmergency = urgency === 'Emergency';

  return (
    <div className="space-y-6">

      {/* Target Unit Prefill Banner */}
      {targetUnitId && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
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
                Parameters prefilled from regional inventory. Availability verified atomically upon submission.
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

      {/* Header Banner - Clear hierarchy without making the whole page an alarming red crisis */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
              isEmergency
                ? 'text-rose-700 bg-rose-50 border-rose-200'
                : urgency === 'Urgent'
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-slate-700 bg-slate-100 border-slate-200'
            }`}>
              {urgency} Protocol
            </span>
            <span className="text-slate-300 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">Requisition Portal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Create Hospital Blood Requisition
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Submit a clinical blood requirement. Eligible regional blood centers will be notified automatically based on proximity and verified stock.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isEmergency && (
            <Link
              to="/search-blood?urgency=Emergency"
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 flex items-center space-x-1.5 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Check Live Emergency Stock</span>
            </Link>
          )}
          <Link
            to="/hospital/requests"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
          >
            View Requisitions Log
          </Link>
        </div>
      </div>

      {/* Actionable Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-rose-950">{error}</p>
              {error.toLowerCase().includes('location') && (
                <p className="text-[11px] text-rose-700 mt-0.5">
                  LifeLink smart routing requires verified hospital geographic coordinates to compute spatial distance and candidate rankings.
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
            <button
              onClick={() => setError(null)}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Requisition Form */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Request Urgency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Requisition Urgency Level *
                </label>
                <span className="text-[11px] text-slate-400">
                  {urgency === 'Emergency' ? 'STAT Emergency: 4-hr dispatch window' : urgency === 'Urgent' ? 'Priority: 12-hr dispatch window' : 'Routine: 24-hr standard dispatch'}
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
                      className={`py-3 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center space-y-1.5 cursor-pointer ${
                        isCurrent
                          ? u === 'Emergency'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/25 ring-2 ring-rose-200'
                            : u === 'Urgent'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 ring-2 ring-amber-200'
                            : 'bg-blood-600 text-white border-blood-600 shadow-md shadow-blood-500/25 ring-2 ring-blood-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {u === 'Emergency' && <AlertTriangle className="w-4 h-4" />}
                      {u === 'Urgent' && <Clock className="w-4 h-4" />}
                      {u === 'Routine' && <CheckCircle2 className="w-4 h-4" />}
                      <span>{u === 'Emergency' ? 'Emergency / STAT' : u}</span>
                      <span className={`text-[10px] font-normal opacity-85 ${isCurrent ? 'text-white' : 'text-slate-500'}`}>
                        {u === 'Emergency' ? 'Immediate 4h' : u === 'Urgent' ? 'Priority 12h' : 'Standard 24h'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Blood Component Requirements */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                2. Blood Product Requirements *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Blood Group *</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blood-500 cursor-pointer"
                  >
                    {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Component *</label>
                  <select
                    value={component}
                    onChange={(e) => setComponent(e.target.value as BloodComponent)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blood-500 font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="RBC">Packed Red Blood Cells (RBC)</option>
                    <option value="Plasma">Fresh Frozen Plasma (FFP)</option>
                    <option value="Platelets">Platelet Concentrate (PLT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Quantity (Units) *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={quantityUnits}
                    onChange={(e) => setQuantityUnits(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blood-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Clinical Reference & Timeline */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                3. Clinical Case Reference & Timing *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Anonymized Patient / Case Reference ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={patientReferenceId}
                    onChange={(e) => setPatientReferenceId(e.target.value)}
                    placeholder="e.g. PAT-9482 (OR-3) or TRAUMA-881"
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-blood-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Use clinical/case identifiers only. Do not enter raw patient names.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Hospital Department / OT Room *
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Trauma Surgery, ICU, Obstetrics"
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blood-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Clinically Required By Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blood-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Clinical Indication & Cross-Match Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Indicate diagnosis, pre-op schedule, surgical hemorrhage notes, special filter requirements..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blood-500"
                />
              </div>
            </div>

            {/* Section 4: Regional Routing Mode & Facility Selection */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                4. Regional Routing Mode & Blood Center Notification
              </label>

              <div className={`rounded-2xl border p-4.5 space-y-3 transition-all ${
                bloodBankId 
                  ? 'border-amber-300 bg-amber-50/30' 
                  : 'border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-teal-50/20 to-white'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      bloodBankId ? 'bg-amber-500 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                    }`}>
                      {bloodBankId ? <Building2 className="w-5 h-5" /> : <Radio className="w-5 h-5 animate-pulse" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                          {bloodBankId ? 'Direct Facility Requisition' : 'Automatic Smart Proximity Routing'}
                        </h4>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          bloodBankId 
                            ? 'bg-amber-100 text-amber-800 border-amber-300' 
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {bloodBankId ? 'Manual Selection' : 'Recommended Default'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {bloodBankId
                          ? `Dispatches requisition directly to ${selectedBloodBank?.name || 'selected facility'}.`
                          : 'Server computes Haversine spatial proximity, checks lab-cleared unreserved stock, and alerts nearest eligible blood banks (25–100 km).'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (showManualBankSelector && bloodBankId) {
                        setBloodBankId('');
                      }
                      setShowManualBankSelector(!showManualBankSelector);
                    }}
                    className={`text-xs font-bold underline shrink-0 cursor-pointer ${
                      bloodBankId ? 'text-amber-800 hover:text-amber-950' : 'text-emerald-800 hover:text-emerald-950'
                    }`}
                  >
                    {showManualBankSelector ? '← Use Automatic Smart Routing' : 'Choose Specific Blood Bank (Optional) →'}
                  </button>
                </div>

                {/* Collapsible Manual Facility Override Selector */}
                {showManualBankSelector && (
                  <div className="pt-3 border-t border-slate-200/80 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Select Specific Blood Bank Facility
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {availableBloodBanks.length} verified facilities connected
                      </span>
                    </div>

                    <select
                      value={bloodBankId}
                      onChange={(e) => setBloodBankId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-blood-500 cursor-pointer"
                    >
                      <option value="">⚡ Automatic Smart Proximity Routing (Recommended — Alerts nearest facilities with verified stock)</option>
                      {availableBloodBanks.map((bb: any) => (
                        <option key={bb.id} value={bb.id}>
                          {bb.name} {bb.city ? `(${bb.city})` : ''}
                        </option>
                      ))}
                    </select>

                    {selectedBloodBank && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{selectedBloodBank.name}</span>
                          {calculatedManualDistance !== null && (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{calculatedManualDistance} km geographic distance</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{selectedBloodBank.address}</p>

                        {calculatedManualDistance !== null && calculatedManualDistance > 100 && (
                          <div className="mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Long-distance facility notice:</strong> This center is {calculatedManualDistance} km away. Rapid emergency dispatch may be delayed by inter-regional transit times.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Idempotent submission creates a verified clinical requisition ticket.</span>
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

        {/* Sidebar Context & Active Emergency Orders */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Active Emergency Orders Collapsible Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <button
              type="button"
              onClick={() => setShowEmergencyPanel(!showEmergencyPanel)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className={`w-4 h-4 ${emergencyRequests.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Active Emergency Orders ({emergencyRequests.length})
                </h3>
              </div>
              {showEmergencyPanel ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showEmergencyPanel && (
              <div className="pt-2 border-t border-slate-100 space-y-2 max-h-[260px] overflow-y-auto pr-1 animate-in fade-in duration-150">
                {emergencyRequests.length > 0 ? (
                  emergencyRequests.map(req => (
                    <Link
                      to={`/hospital/requests?requestId=${req.id}`}
                      key={req.id} 
                      className="p-3 bg-rose-50/50 hover:bg-rose-50 rounded-xl border border-rose-200 text-xs flex justify-between items-center transition-colors block"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900">{req.id}</span>
                          <span className="font-extrabold text-rose-700">{req.bloodGroup} {req.component}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{req.patientReferenceId} • {req.quantityUnits} Units</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No active emergency requisitions pending.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 24/7 Regional Trauma Hotline */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-rose-400">
              <PhoneCall className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Regional Trauma Hotline</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              For mass-casualty protocols or expedited red cell couriers, contact the central trauma dispatch desk directly.
            </p>
            <div className="pt-1">
              <a
                href="tel:18005550199"
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center space-x-1.5 transition-colors"
              >
                <span>Call 1-800-BLOOD-EMERG</span>
              </a>
            </div>
          </div>

          {/* Cross-Matching Workflow Guidance */}
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

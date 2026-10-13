import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { hospitalApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { PatientSample, BloodRequest } from '../../types';
import { TestTube, PlusCircle, CheckCircle2, Clock, ShieldCheck, AlertCircle, RefreshCw, Barcode, ArrowRight, FileText } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';

export const PatientSamplesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryReqId = searchParams.get('requestId');
  const { user } = useAuth();

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [samples, setSamples] = useState<PatientSample[]>([]);
  const [patientRef, setPatientRef] = useState('');
  const [sampleType, setSampleType] = useState('Cross-Match Sample');
  const [notes, setNotes] = useState('Whole blood sample in cold chain EDTA container for cross-match compatibility.');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load eligible hospital requests and existing patient samples
  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [reqsRes, samplesRes] = await Promise.all([
      hospitalApi.getRequests(),
      hospitalApi.getSamples()
    ]);

    if (reqsRes.success && reqsRes.requests) {
      // Eligible for sample collection: in-pipeline tickets neither completed nor cancelled/rejected
      const eligible = reqsRes.requests.filter(
        (r: BloodRequest) => r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected'
      );
      setRequests(eligible);

      // Preselection logic: check query param first, then fallback to first eligible
      if (queryReqId && eligible.some((r: BloodRequest) => r.id === queryReqId)) {
        setSelectedReqId(queryReqId);
        const matched = eligible.find((r: BloodRequest) => r.id === queryReqId);
        if (matched) setPatientRef(matched.patientReferenceId);
      } else if (eligible.length > 0) {
        setSelectedReqId(eligible[0].id);
        setPatientRef(eligible[0].patientReferenceId);
      } else {
        setSelectedReqId('');
        setPatientRef('');
      }
    } else {
      setError(reqsRes.error || 'Failed to load hospital requisitions.');
    }

    if (samplesRes.success && samplesRes.samples) {
      setSamples(samplesRes.samples);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Sync selected requisition if query parameter changes
  useEffect(() => {
    if (queryReqId && requests.length > 0 && queryReqId !== selectedReqId) {
      if (requests.some(r => r.id === queryReqId)) {
        setSelectedReqId(queryReqId);
        const matched = requests.find(r => r.id === queryReqId);
        if (matched) setPatientRef(matched.patientReferenceId);
      }
    }
  }, [queryReqId, requests]);

  // Handle requisition change from dropdown
  const handleSelectRequisition = (reqId: string) => {
    setSelectedReqId(reqId);
    setSearchParams(reqId ? { requestId: reqId } : {});
    const matched = requests.find(r => r.id === reqId);
    if (matched) {
      setPatientRef(matched.patientReferenceId);
    }
  };

  const selectedRequest = requests.find(r => r.id === selectedReqId);

  const handleSubmitSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId) {
      setError('Please select an active requisition before submitting a patient sample.');
      return;
    }

    if (!patientRef.trim() || patientRef.trim().length < 3) {
      setError('Patient reference identifier must be at least 3 characters (e.g. PAT-4402).');
      return;
    }

    if (cooldown) {
      setError('Please wait a moment before logging another sample.');
      return;
    }

    setSubmitting(true);
    setMsg(null);
    setError(null);

    const res = await hospitalApi.submitSample({
      requestId: selectedReqId,
      patientReferenceId: patientRef.trim(),
      sampleType,
      notes: notes.trim()
    });

    setSubmitting(false);
    if (res.success && res.sample) {
      setMsg(`Sample ${res.sample.id} logged and linked to ${selectedReqId} successfully.`);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 4000);
      // Refresh samples and requests list
      loadData();
    } else {
      setError(res.error || 'Failed to submit patient sample.');
    }
  };

  const facilityName = (user as any)?.hospitalName || user?.name || 'Hospital Facility';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Laboratory Samples
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">{facilityName}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Patient Sample Requisition & Verification
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log cross-match EDTA tubes and blood-typing samples linked directly to clinical blood requisitions.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer self-start sm:self-auto"
          title="Refresh samples and requisitions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blood-600' : ''}`} />
        </button>
      </div>

      {/* Feedback Alerts */}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{msg}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-emerald-700 font-bold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Submit New Sample Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <TestTube className="w-4 h-4 text-blood-600" />
            <h3 className="font-bold text-sm text-slate-900">Submit Patient Sample</h3>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span>Loading eligible requisitions...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800">No Active Eligible Requisitions</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Samples must be linked to an active in-pipeline blood request. Create a new blood request first to submit samples.
              </p>
              <Link
                to="/hospital/requests/new"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blood-600 hover:bg-blood-700 transition-colors shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Blood Request</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmitSample} className="space-y-4">
              
              {/* Contextual Requisition Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Associated Blood Requisition *
                </label>
                <select
                  value={selectedReqId}
                  onChange={(e) => handleSelectRequisition(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono font-bold text-slate-900 focus:ring-blood-500 cursor-pointer"
                >
                  {requests.map(req => (
                    <option key={req.id} value={req.id}>
                      {req.id} — {req.bloodGroup} {req.component} ({req.quantityUnits} Units) [{req.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Requisition Badge Context */}
              {selectedRequest && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{selectedRequest.id}</span>
                    <StatusBadge status={selectedRequest.urgency} />
                  </div>
                  <p className="text-[11px] text-slate-600">
                    <strong className="text-blood-700">{selectedRequest.bloodGroup} {selectedRequest.component}</strong> • Dept: {selectedRequest.department}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Target Lab: {selectedRequest.bloodBankName || 'Regional Blood Center'}
                  </p>
                </div>
              )}

              {/* Patient Reference ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Patient Reference ID (Anonymized) *
                </label>
                <input
                  type="text"
                  required
                  value={patientRef}
                  onChange={(e) => setPatientRef(e.target.value)}
                  placeholder="e.g. PAT-9482 (OR-3)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-blood-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Automatically populated from selected requisition.
                </span>
              </div>

              {/* Sample Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sample Type *</label>
                <select
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-blood-500 cursor-pointer font-medium"
                >
                  <option value="Cross-Match Sample">Cross-Match Sample (Major / Minor Tube)</option>
                  <option value="Blood Typing Sample">Blood Typing & Rh Verification Tube</option>
                </select>
              </div>

              {/* Courier & Lab Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Courier & Lab Handling Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Cold chain courier transport, tube barcode notes, phlebotomy timestamp..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-700 focus:ring-blood-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || cooldown || !selectedReqId}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-blood-600 hover:bg-blood-700 shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Logging Sample...</span>
                  </>
                ) : cooldown ? (
                  <>
                    <Clock className="w-4 h-4 text-emerald-200" />
                    <span>Sample Logged (Cooldown active...)</span>
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    <span>Log & Submit Sample to Lab</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Patient Samples Log Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Hospital Sample Verification Log</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Audit trail of submitted cross-match tubes for {facilityName}.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {samples.length} Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Sample ID</th>
                  <th className="px-3 py-2.5">Requisition</th>
                  <th className="px-3 py-2.5">Patient Ref</th>
                  <th className="px-3 py-2.5">Sample Type</th>
                  <th className="px-3 py-2.5">Logged At</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                      <span>Loading sample history...</span>
                    </td>
                  </tr>
                ) : samples.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <TestTube className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700 text-xs">No sample records logged yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Submit a patient cross-match sample on the left to initiate laboratory screening.
                      </p>
                    </td>
                  </tr>
                ) : (
                  samples.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 font-mono font-bold text-slate-900">
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          <Barcode className="w-3 h-3 text-slate-500" />
                          <span>{s.id}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-blood-700">
                        <Link to={`/hospital/requests?selected=${s.requestId}`} className="hover:underline">
                          {s.requestId}
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">{s.patientReferenceId}</td>
                      <td className="px-3 py-3 text-slate-600">{s.sampleType}</td>
                      <td className="px-3 py-3 text-slate-500">
                        {new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" />
                          <span>{s.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};

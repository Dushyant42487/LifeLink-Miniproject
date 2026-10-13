import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { hospitalApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { BloodRequest, RequestStatus, PatientSample, RequestMessage } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FileText, CheckCircle2, Clock, MessageSquare, TestTube, ArrowRight, RefreshCw, AlertCircle, PlusCircle, ShieldCheck, X, Truck, Printer, AlertTriangle, PackageCheck } from 'lucide-react';

export const HospitalRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const routeParams = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = routeParams.id || searchParams.get('requestId') || searchParams.get('id');

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<BloodRequest | null>(null);
  const [linkedSamples, setLinkedSamples] = useState<PatientSample[]>([]);
  const [linkedMessages, setLinkedMessages] = useState<RequestMessage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState(false);
  const [filterTab, setFilterTab] = useState<'All' | 'Active' | 'Emergency' | 'Fulfilled'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 5D: Receipt confirmation & Discrepancy reporting state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptNotes, setReceiptNotes] = useState('Physical packs inspected. Cold-chain indicator verified in range.');
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyType, setDiscrepancyType] = useState('Cold-Chain Temperature Breach');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [reportingDiscrepancy, setReportingDiscrepancy] = useState(false);

  const [showSlipModal, setShowSlipModal] = useState(false);
  const [hospitalSlipData, setHospitalSlipData] = useState<any | null>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    const res = await hospitalApi.getRequests();
    if (res.success && res.requests) {
      setRequests(res.requests);
      if (requestedId && res.requests.some((r: BloodRequest) => r.id === requestedId)) {
        setSelectedReq(res.requests.find((r: BloodRequest) => r.id === requestedId) || null);
      } else if (res.requests.length > 0) {
        setSelectedReq(res.requests[0]);
      } else {
        setSelectedReq(null);
      }
    } else {
      setError(res.error || 'Failed to retrieve hospital requisitions.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  // Sync selected requisition if requestedId changes in URL
  useEffect(() => {
    if (requestedId && requests.length > 0) {
      const match = requests.find(r => r.id === requestedId);
      if (match && match.id !== selectedReq?.id) {
        setSelectedReq(match);
      }
    }
  }, [requestedId, requests]);

  // Fetch linked samples and messages whenever selected requisition changes
  useEffect(() => {
    if (!selectedReq) {
      setLinkedSamples([]);
      setLinkedMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingDetails(true);

    Promise.all([
      hospitalApi.getSamples(),
      hospitalApi.getMessages(selectedReq.id)
    ]).then(([samplesRes, messagesRes]) => {
      if (isMounted) {
        if (samplesRes.success && samplesRes.samples) {
          setLinkedSamples(samplesRes.samples.filter((s: PatientSample) => s.requestId === selectedReq.id));
        } else {
          setLinkedSamples([]);
        }

        if (messagesRes.success && messagesRes.messages) {
          setLinkedMessages(messagesRes.messages);
        } else {
          setLinkedMessages([]);
        }
        setLoadingDetails(false);
      }
    }).catch(() => {
      if (isMounted) setLoadingDetails(false);
    });

    return () => { isMounted = false; };
  }, [selectedReq?.id]);

  const handleCancelRequisition = async (reqId: string) => {
    if (!window.confirm(`Are you sure you want to cancel requisition ${reqId}? This will release any allocated units back to regional inventory.`)) {
      return;
    }
    setCancelling(true);
    const res = await hospitalApi.cancelRequest(reqId, 'Cancelled from Hospital Portal tracking dashboard.');
    setCancelling(false);
    if (res.success) {
      await fetchRequests();
    } else {
      alert(res.error || 'Failed to cancel requisition.');
    }
  };

  // Confirm Receipt Handler
  const handleConfirmReceipt = async () => {
    if (!selectedReq) return;
    setConfirmingReceipt(true);
    const res = await hospitalApi.confirmReceipt(selectedReq.id, { notes: receiptNotes });
    setConfirmingReceipt(false);
    setShowReceiptModal(false);

    if (res.success) {
      await fetchRequests();
    } else {
      alert(res.error || 'Failed to confirm receipt.');
    }
  };

  // Report Discrepancy Handler
  const handleReportDiscrepancy = async () => {
    if (!selectedReq) return;
    if (!discrepancyReason.trim()) {
      alert('Please describe the reason for the discrepancy report.');
      return;
    }
    setReportingDiscrepancy(true);
    const res = await hospitalApi.reportDiscrepancy(selectedReq.id, {
      discrepancyType,
      reason: discrepancyReason,
      notes: discrepancyNotes
    });
    setReportingDiscrepancy(false);
    setShowDiscrepancyModal(false);

    if (res.success) {
      await fetchRequests();
    } else {
      alert(res.error || 'Failed to report discrepancy.');
    }
  };

  // View Packing Slip
  const handleViewPackingSlip = async () => {
    if (!selectedReq) return;
    setLoadingSlip(true);
    const res = await hospitalApi.getRequestDispatch(selectedReq.id);
    setLoadingSlip(false);
    if (res.success && res.dispatch) {
      setHospitalSlipData(res.dispatch);
      setShowSlipModal(true);
    } else {
      alert(res.error || 'No dispatch manifest found for this requisition.');
    }
  };

  const stages: RequestStatus[] = [
    'Pending',
    'Sample Submitted',
    'Verified',
    'Reserved',
    'Dispatched',
    'Fulfilled'
  ];

  const getStageIndex = (status: RequestStatus) => {
    if (status === 'Pending') return 0;
    if (status === 'Sample Submitted') return 1;
    if (status === 'Verified') return 2;
    if (status === 'Reserved' || status === 'Partially Fulfilled' || status === 'Allocated') return 3;
    if (status === 'Issued' || status === 'Prepared for Dispatch' || status === 'Dispatched') return 4;
    if (status === 'Fulfilled' || status === 'Received') return 5;
    return 0;
  };

  // Filter requests based on tab
  const filteredRequests = requests.filter(req => {
    if (filterTab === 'All') return true;
    if (filterTab === 'Active') {
      return req.status !== 'Fulfilled' && req.status !== 'Cancelled' && req.status !== 'Rejected';
    }
    if (filterTab === 'Emergency') {
      return req.urgency === 'Emergency';
    }
    if (filterTab === 'Fulfilled') {
      return req.status === 'Fulfilled';
    }
    return true;
  });

  const facilityName = (user as any)?.hospitalName || user?.name || 'Hospital Facility';

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Hospital Requisitions
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">{facilityName}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Requisitions & Live Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status updates across the clinical blood fulfillment lifecycle.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRequests}
            title="Refresh requisitions"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blood-600' : ''}`} />
          </button>

          <Link
            to="/hospital/requests/new"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blood-600 hover:bg-blood-700 shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Requisition</span>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchRequests}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 text-xs">
        {(['All', 'Active', 'Emergency', 'Fulfilled'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              filterTab === tab
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab}
            <span className="ml-1.5 text-[10px] opacity-75">
              ({
                tab === 'All' 
                  ? requests.length 
                  : tab === 'Active' 
                  ? requests.filter(r => r.status !== 'Fulfilled' && r.status !== 'Cancelled' && r.status !== 'Rejected').length
                  : tab === 'Emergency'
                  ? requests.filter(r => r.urgency === 'Emergency').length
                  : requests.filter(r => r.status === 'Fulfilled').length
              })
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Request List Column */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Requisitions Log ({filteredRequests.length})
            </h3>
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <span>Loading requisitions...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700 text-xs">No requisitions in this view</p>
                <p className="text-[11px] text-slate-400">
                  {filterTab === 'All' 
                    ? 'Submit a requisition to start tracking blood fulfillment.'
                    : `No tickets match the "${filterTab}" filter.`}
                </p>
                {filterTab === 'All' && (
                  <Link
                    to="/hospital/requests/new"
                    className="inline-block mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blood-50 text-blood-700 hover:bg-blood-100 transition-colors"
                  >
                    + New Requisition
                  </Link>
                )}
              </div>
            ) : (
              filteredRequests.map(req => {
                const isSelected = selectedReq?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => {
                      setSelectedReq(req);
                      setSearchParams({ requestId: req.id });
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-blood-500 bg-blood-50/50 shadow-sm' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900">{req.id}</span>
                      <StatusBadge status={req.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blood-700">{req.bloodGroup} {req.component}</span>
                      <span className="font-semibold text-slate-600">{req.fulfilledUnits} / {req.quantityUnits} Units</span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 truncate">{req.patientReferenceId} • {req.department}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Request Live Tracking Detail */}
        {selectedReq ? (
          <div className="lg:col-span-2 space-y-6">
            
            {/* Request Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Requisition</span>
                  <div className="flex items-center space-x-3 mt-0.5">
                    <h2 className="text-xl font-extrabold text-slate-900 font-mono">{selectedReq.id}</h2>
                    <StatusBadge status={selectedReq.urgency} />
                    <StatusBadge status={selectedReq.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fulfillment partner: <strong className="text-slate-700">{selectedReq.bloodBankName || 'Assigned Blood Center'}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Phase 5D: Dispatched state receipt & discrepancy actions */}
                  {(selectedReq.status === 'Dispatched' || selectedReq.status === 'Issued') && (
                    <>
                      <button
                        onClick={() => setShowReceiptModal(true)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Delivery Receipt</span>
                      </button>

                      <button
                        onClick={() => setShowDiscrepancyModal(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Report Discrepancy</span>
                      </button>

                      <button
                        onClick={handleViewPackingSlip}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>View Packing Slip</span>
                      </button>
                    </>
                  )}

                  {selectedReq.status === 'Fulfilled' && (
                    <button
                      onClick={handleViewPackingSlip}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Audit Packing Slip</span>
                    </button>
                  )}

                  <Link
                    to={`/hospital/samples?requestId=${selectedReq.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 transition-colors"
                  >
                    <TestTube className="w-3.5 h-3.5 text-blood-600" />
                    <span>Submit Sample</span>
                  </Link>

                  <Link
                    to={`/hospital/messages?requestId=${selectedReq.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blood-50 hover:bg-blood-100 text-blood-700 flex items-center space-x-1 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat with Lab</span>
                  </Link>

                  {selectedReq.status !== 'Fulfilled' && selectedReq.status !== 'Cancelled' && selectedReq.status !== 'Issued' && selectedReq.status !== 'Dispatched' && (
                    <button
                      onClick={() => handleCancelRequisition(selectedReq.id)}
                      disabled={cancelling}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Cancel requisition and release any reserved units"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>{cancelling ? 'Cancelling...' : 'Cancel Request'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 7-Stage Live Request Status Timeline Bar */}
              <div className="pt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">7-Stage Fulfillment Progress</h4>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                  {stages.map((stageName, idx) => {
                    const currentIdx = getStageIndex(selectedReq.status);
                    const isCompleted = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                      <div key={stageName} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 transition-all ${
                          isCurrent
                            ? 'bg-blood-600 text-white ring-4 ring-blood-100 shadow-md'
                            : isCompleted
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                        </div>
                        <span className={`text-[10px] font-semibold leading-tight ${
                          isCurrent ? 'text-blood-700 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                        }`}>
                          {stageName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail fields */}
              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Required Blood:</span>
                  <span className="font-bold text-slate-900">{selectedReq.bloodGroup} ({selectedReq.component})</span>
                </div>

                <div>
                  <span className="text-slate-400 block">Quantity Needed:</span>
                  <span className="font-bold text-slate-900">{selectedReq.fulfilledUnits} / {selectedReq.quantityUnits} Units</span>
                </div>

                <div>
                  <span className="text-slate-400 block">Patient Ref:</span>
                  <span className="font-bold text-slate-900">{selectedReq.patientReferenceId}</span>
                </div>

                <div>
                  <span className="text-slate-400 block">Department:</span>
                  <span className="font-bold text-slate-900">{selectedReq.department}</span>
                </div>
              </div>

              {selectedReq.notes && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-0.5">Clinical Indication:</span>
                  <span>{selectedReq.notes}</span>
                </div>
              )}

            </div>

            {/* Linked Patient Cross-Match Samples */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <TestTube className="w-4 h-4 text-blood-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Linked Patient Cross-Match Samples ({linkedSamples.length})
                  </h3>
                </div>
                <Link
                  to={`/hospital/samples?requestId=${selectedReq.id}`}
                  className="text-xs font-semibold text-blood-600 hover:text-blood-700 flex items-center space-x-1"
                >
                  <span>+ Submit Sample</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loadingDetails ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading linked sample records...</span>
                </div>
              ) : linkedSamples.length === 0 ? (
                <div className="py-6 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <TestTube className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No cross-match samples recorded for {selectedReq.id}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Log a physical patient EDTA specimen to verify compatibility with donor units.</p>
                  <Link
                    to={`/hospital/samples?requestId=${selectedReq.id}`}
                    className="inline-block mt-2.5 px-3 py-1 rounded-lg text-xs font-bold bg-blood-50 text-blood-700 hover:bg-blood-100 transition-colors"
                  >
                    Log Sample Now
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {linkedSamples.map(sample => (
                    <div key={sample.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900">{sample.id}</span>
                          <span className="font-medium text-slate-600">• {sample.sampleType}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Patient Ref: <strong className="text-slate-600">{sample.patientReferenceId}</strong> • Logged: {new Date(sample.submittedAt).toLocaleDateString()}
                        </p>
                        {sample.verificationNotes && (
                          <p className="text-[11px] text-slate-500 italic">"{sample.verificationNotes}"</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={sample.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Lab & Bank Communications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-blood-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Requisition Messages & Lab Notes ({linkedMessages.length})
                  </h3>
                </div>
                <Link
                  to={`/hospital/messages?requestId=${selectedReq.id}`}
                  className="text-xs font-semibold text-blood-600 hover:text-blood-700 flex items-center space-x-1"
                >
                  <span>Open Full Chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loadingDetails ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading communications...</span>
                </div>
              ) : linkedMessages.length === 0 ? (
                <div className="py-6 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <MessageSquare className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No messages exchanged yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Use the communications hub to clarify cold chain, ETA, or testing status with the blood center lab.</p>
                  <Link
                    to={`/hospital/messages?requestId=${selectedReq.id}`}
                    className="inline-block mt-2.5 px-3 py-1 rounded-lg text-xs font-bold bg-blood-50 text-blood-700 hover:bg-blood-100 transition-colors"
                  >
                    Start Conversation
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedMessages.slice(-3).map(msg => (
                    <div key={msg.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-800">{msg.senderName} ({msg.senderRole})</span>
                        <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{msg.message}</p>
                    </div>
                  ))}
                  {linkedMessages.length > 3 && (
                    <Link
                      to={`/hospital/messages?requestId=${selectedReq.id}`}
                      className="block text-center text-xs font-semibold text-blood-600 hover:underline pt-1"
                    >
                      View all {linkedMessages.length} messages in hub →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Timeline Audit Log */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-4">Request Activity & Verification Log</h3>

              <div className="relative border-l-2 border-slate-100 pl-4 space-y-4">
                {(selectedReq.timeline || []).map((event, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blood-600 ring-4 ring-white" />
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-slate-900">{event.note}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">By: {event.actor}</p>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(event.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-600 text-sm">No Requisition Selected</p>
            <p className="text-xs text-slate-400 mt-1">Select an active ticket from the log on the left to track real-time fulfillment progress.</p>
          </div>
        )}

      </div>

      {/* Phase 5D: Hospital Receipt Confirmation Modal */}
      {showReceiptModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Confirm Blood Unit Delivery Receipt</h3>
                  <p className="text-xs text-slate-500">Requisition #{selectedReq.id} • {selectedReq.hospitalName}</p>
                </div>
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 inline mr-1" />
                Chain of Custody Acknowledgment
              </p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                You are confirming physical acceptance of <strong>{selectedReq.fulfilledUnits || selectedReq.quantityUnits} unit(s)</strong> of <strong>{selectedReq.bloodGroup} {selectedReq.component}</strong>. Confirming receipt will formally mark this requisition as <strong>Fulfilled</strong> and register these units into your local hospital blood storage ledger.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Receiving Inspection Notes / Physical Verification:
              </label>
              <textarea
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                placeholder="e.g., Physical packs inspected. Cold-chain indicator verified in range. Seal intact."
              />
              <p className="text-[10px] text-slate-400">Authenticated user: {user?.name || user?.email || 'Hospital Officer'}</p>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowReceiptModal(false)}
                disabled={confirmingReceipt}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReceipt}
                disabled={confirmingReceipt}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {confirmingReceipt ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording Receipt...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Receipt & Log to Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5D: Discrepancy Reporting Modal */}
      {showDiscrepancyModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Report Delivery Discrepancy</h3>
                  <p className="text-xs text-slate-500">Requisition #{selectedReq.id} • {selectedReq.hospitalName}</p>
                </div>
              </div>
              <button onClick={() => setShowDiscrepancyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center space-x-1">
                <AlertCircle className="w-4 h-4 text-amber-600 inline mr-1" />
                Exception Log & Urgent Notification
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Reporting an issue documents an auditable discrepancy event and immediately notifies blood bank dispatch operations for investigation and corrective action.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Discrepancy Category:
                </label>
                <select
                  value={discrepancyType}
                  onChange={(e) => setDiscrepancyType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="Cold-Chain Temperature Breach">Cold-Chain Temperature Breach (Indicator Triggered / Out-of-Range)</option>
                  <option value="Pack Leakage / Compromised Sterility">Pack Leakage / Compromised Integrity</option>
                  <option value="Quantity Mismatch">Quantity Mismatch (Fewer or More Units than Manifest)</option>
                  <option value="Blood Group / Component Mismatch">Blood Group or Component Mismatch with Patient Ticket</option>
                  <option value="Damaged Barcode / Illegible Label">Damaged Barcode / Illegible Unit Label</option>
                  <option value="Courier Delay / Late Arrival">Courier Transport Delay / Delivery Exception</option>
                  <option value="Other Delivery Exception">Other Delivery Exception</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reason / Immediate Finding <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  placeholder="e.g. Chemical cold indicator shows red threshold breach upon opening cooler"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Additional Observations / Actions Taken:
                </label>
                <textarea
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Unit quarantined in hospital lab isolation shelf pending blood bank inspection."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDiscrepancyModal(false)}
                disabled={reportingDiscrepancy}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReportDiscrepancy}
                disabled={reportingDiscrepancy || !discrepancyReason.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {reportingDiscrepancy ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Report...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Submit Discrepancy Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5D: Hospital Packing Slip Audit Modal */}
      {showSlipModal && hospitalSlipData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blood-700 bg-blood-50 px-2 py-0.5 rounded border border-blood-200">
                    Official Transport Manifest
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600">
                    {hospitalSlipData.dispatchNumber || hospitalSlipData.id}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">LifeLink Regional Blood Center</h2>
                <p className="text-[11px] text-slate-500">
                  Requisition Ref: {selectedReq?.id} • Destination: {selectedReq?.hospitalName}
                </p>
              </div>
              <button onClick={() => setShowSlipModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Receiving Hospital</span>
                <span className="font-black text-slate-900 text-sm block">{selectedReq?.hospitalName}</span>
                <span className="text-slate-600 block mt-0.5">Department: {selectedReq?.department}</span>
                <span className="text-slate-500 block font-mono mt-0.5">Patient Ref: {selectedReq?.patientReferenceId}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Dispatch Status</span>
                <span className="font-bold text-slate-900 block">{hospitalSlipData.status} • Urgency: {selectedReq?.urgency}</span>
                <span className="text-blood-700 font-bold block mt-0.5">
                  Requested: {selectedReq?.bloodGroup} {selectedReq?.component} ({selectedReq?.quantityUnits} Units)
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Dispatched Units: {(hospitalSlipData.units || []).length} Verified Units
                </span>
              </div>
            </div>

            {/* Units Table */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
                Itemized Blood Units Transferred
              </span>
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                  <tr>
                    <th className="p-2">Unit ID / Barcode</th>
                    <th className="p-2">Component</th>
                    <th className="p-2">Blood Group</th>
                    <th className="p-2">Volume</th>
                    <th className="p-2">Expiry Date</th>
                    <th className="p-2">Testing Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {(hospitalSlipData.units || []).map((u: any) => (
                    <tr key={u.unitId} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold">{u.unitId}</td>
                      <td className="p-2">{u.component}</td>
                      <td className="p-2 font-bold text-blood-700">{u.bloodGroup}</td>
                      <td className="p-2">{u.volumeMl} ml</td>
                      <td className="p-2 font-mono">{u.expiryDate}</td>
                      <td className="p-2 text-emerald-700 font-bold">Passed / Released</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cold Chain Protocol Info */}
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 text-xs space-y-1">
              <span className="font-extrabold text-purple-900 uppercase text-[10px] block">Cold-Chain Protocol & Handling</span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-purple-950">
                <div>Packaging: <strong>{hospitalSlipData.packagingType || 'Validated Cold-Chain Transport Insulated Shipper'}</strong></div>
                <div>Target Temp: <strong>{hospitalSlipData.targetTempC || '+2°C to +6°C (Red Cells) / -18°C (Plasma)'}</strong></div>
                <div>Dispatch Temp: <strong>{hospitalSlipData.temperatureAtDispatch ? `${hospitalSlipData.temperatureAtDispatch}°C` : 'Passive cold packs verified'}</strong></div>
                <div>Handling: <strong>{hospitalSlipData.specialHandlingInstructions || 'Keep upright. Avoid direct light or agitation.'}</strong></div>
              </div>
              <p className="text-[10px] text-purple-700 italic pt-1">
                Note: Passive temperature monitoring; unmonitored passive cold-chain transit.
              </p>
            </div>

            {/* Sign-off Blocks */}
            <div className="grid grid-cols-3 gap-3 text-[11px] border-t border-slate-200 pt-3 text-slate-600">
              <div className="border border-slate-200 p-2.5 rounded-lg space-y-4">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Prepared By (Blood Bank)</span>
                <span className="block text-slate-900 font-semibold">{hospitalSlipData.preparedBy || 'Staff'}</span>
                <span className="text-[10px] text-slate-400 block">{hospitalSlipData.preparedAt ? new Date(hospitalSlipData.preparedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded-lg space-y-4">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Courier Handover</span>
                <span className="block text-slate-900 font-semibold">{hospitalSlipData.courierReference || hospitalSlipData.courierName || 'Dedicated Medical Courier'}</span>
                <span className="text-[10px] text-slate-400 block">{hospitalSlipData.dispatchedAt ? new Date(hospitalSlipData.dispatchedAt).toLocaleTimeString() : 'Pending'}</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded-lg space-y-4">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Hospital Receiving Staff</span>
                <span className="block text-slate-900 font-semibold">{hospitalSlipData.receivedBy || 'Pending Receipt'}</span>
                <span className="text-[10px] text-slate-400 block">{hospitalSlipData.receivedAt ? new Date(hospitalSlipData.receivedAt).toLocaleDateString() : 'Pending'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Manifest</span>
              </button>
              <button
                onClick={() => setShowSlipModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


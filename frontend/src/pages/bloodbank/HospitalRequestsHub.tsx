import React, { useState, useEffect } from 'react';
import { bloodBankApi } from '../../services/api';
import { BloodRequest, BloodDispatch, BloodGroup, BloodComponent } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  PackageCheck, 
  Truck, 
  Printer, 
  AlertTriangle, 
  Search, 
  Filter, 
  RotateCcw, 
  Barcode, 
  Plus, 
  X, 
  Thermometer, 
  Clock, 
  Layers, 
  Sparkles,
  ClipboardList,
  FlaskConical
} from 'lucide-react';

export const HospitalRequestsHub: React.FC = () => {
  const { user } = useAuth();
  const facilityTitle = user?.name || (user as any)?.bloodBankName || 'Regional Blood Center';
  const facilityReg = (user as any)?.registrationId ? `(${(user as any).registrationId})` : '';

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [selectedReq, setSelectedReq] = useState<BloodRequest | null>(null);
  const [eligibleUnits, setEligibleUnits] = useState<any[]>([]);
  const [unitsDiagnostics, setUnitsDiagnostics] = useState<any | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [manualBarcode, setManualBarcode] = useState<string>('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'emergency' | 'reserved' | 'prepared' | 'dispatched' | 'matrix'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [componentFilter, setComponentFilter] = useState('all');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('all');

  // Dispatch Preparation Form State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [courierType, setCourierType] = useState<'Dedicated Hospital Courier' | 'Blood Bank Transport' | 'External Medical Courier'>('Dedicated Hospital Courier');
  const [courierRef, setCourierRef] = useState('');
  const [packagingType, setPackagingType] = useState('Standard Passive Thermal Container with Ice Gel Packs');
  const [targetTemp, setTargetTemp] = useState('2°C to 6°C (Chilled)');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Dispatch Packing Slip Modal State
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [slipData, setSlipData] = useState<any | null>(null);

  // Allocation Matrix State
  const [matrixData, setMatrixData] = useState<any | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const fetchRequests = async () => {
    setLoadingQueue(true);
    const res = await bloodBankApi.getRequests({
      tab: activeTab === 'matrix' ? 'all' : activeTab,
      component: componentFilter,
      bloodGroup: bloodGroupFilter,
      search: searchQuery
    });

    if (res.success && res.requests) {
      setRequests(res.requests);
      if (selectedReq) {
        const refreshed = res.requests.find((r: BloodRequest) => r.id === selectedReq.id);
        if (refreshed) {
          setSelectedReq(refreshed);
          setSelectedUnitIds(refreshed.assignedUnitIds || []);
        } else if (res.requests.length > 0) {
          setSelectedReq(res.requests[0]);
          setSelectedUnitIds(res.requests[0].assignedUnitIds || []);
        }
      } else if (res.requests.length > 0) {
        setSelectedReq(res.requests[0]);
        setSelectedUnitIds(res.requests[0].assignedUnitIds || []);
      } else {
        setSelectedReq(null);
      }
    }
    setLoadingQueue(false);
  };

  const fetchEligibleUnits = async (reqId: string) => {
    setLoadingUnits(true);
    setBarcodeError(null);
    const res = await bloodBankApi.getEligibleUnits(reqId);
    if (res.success && res.units) {
      setEligibleUnits(res.units);
      setUnitsDiagnostics(res.diagnostics || null);
    } else {
      setEligibleUnits([]);
      setUnitsDiagnostics(res?.diagnostics || null);
    }
    setLoadingUnits(false);
  };

  const fetchAllocationMatrix = async () => {
    setLoadingMatrix(true);
    const res = await bloodBankApi.getAllocationMatrix();
    if (res.success) {
      setMatrixData(res);
    }
    setLoadingMatrix(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab, componentFilter, bloodGroupFilter]);

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchAllocationMatrix();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedReq) {
      setSelectedUnitIds(selectedReq.assignedUnitIds || []);
      fetchEligibleUnits(selectedReq.id);

      // Auto-configure recommended dispatch settings based on component
      if (selectedReq.component === 'Platelets') {
        setPackagingType('Platelet Transit Agitator Box');
        setTargetTemp('20°C to 24°C (Ambient)');
        setSpecialInstructions('Maintain continuous agitation or constant ambient 20-24°C. Do not refrigerate or freeze.');
      } else if (selectedReq.component === 'Plasma') {
        setPackagingType('Validated Cold-Chain Shipper');
        setTargetTemp('-18°C or lower (Frozen)');
        setSpecialInstructions('Ship frozen with dry ice / eutectic ice packs. Do not thaw.');
      } else {
        setPackagingType('Standard Passive Thermal Container with Ice Gel Packs');
        setTargetTemp('2°C to 6°C (Chilled)');
        setSpecialInstructions('Keep upright. Maintain cold chain at 2°C to 6°C. Do not freeze.');
      }
    }
  }, [selectedReq?.id]);

  // Handle Manual Barcode / Unit ID Entry
  const handleAddBarcode = () => {
    if (!manualBarcode.trim()) return;
    const cleanId = manualBarcode.trim().toUpperCase();
    setBarcodeError(null);

    // Verify barcode exists in eligible units
    const match = eligibleUnits.find(u => u.id.toUpperCase() === cleanId);
    if (!match) {
      setBarcodeError(`Unit ${cleanId} is either not in available inventory, expired, untested, or clinically incompatible with this requisition.`);
      return;
    }

    if (selectedUnitIds.includes(match.id)) {
      setBarcodeError(`Unit ${cleanId} is already in the allocation selection.`);
      return;
    }

    const needed = (selectedReq?.quantityUnits || 1) - (selectedReq?.fulfilledUnits || 0);
    if (selectedUnitIds.length >= needed) {
      setBarcodeError(`Requisition only requires ${needed} unit(s). Remove an existing unit to allocate this one.`);
      return;
    }

    setSelectedUnitIds(prev => [...prev, match.id]);
    setManualBarcode('');
    setStatusMessage({ type: 'success', text: `Unit ${match.id} (${match.bloodGroup} ${match.component}) verified and staged.` });
  };

  // Commit Allocation
  const handleCommitAllocation = async () => {
    if (!selectedReq) return;
    setActionLoading(true);
    setStatusMessage(null);

    const res = await bloodBankApi.allocateUnits(selectedReq.id, {
      unitIds: selectedUnitIds,
      notes: 'Allocated and cross-matched via LifeLink Barcode Desk.'
    });

    setActionLoading(false);
    if (res.success) {
      setStatusMessage({ type: 'success', text: `Successfully allocated ${selectedUnitIds.length} verified unit(s).` });
      await fetchRequests();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to allocate units.' });
    }
  };

  // Release Allocation
  const handleReleaseAllocation = async () => {
    if (!selectedReq) return;
    if (!window.confirm(`Are you sure you want to release all allocated units for ${selectedReq.id}? They will be returned to available regional stock.`)) return;

    setActionLoading(true);
    setStatusMessage(null);

    const res = await bloodBankApi.releaseAllocation(selectedReq.id, 'Released by blood bank operator.');
    setActionLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Allocations released back to regional available stock.' });
      setSelectedUnitIds([]);
      await fetchRequests();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to release allocation.' });
    }
  };

  // Submit Dispatch Preparation
  const handlePrepareDispatch = async () => {
    if (!selectedReq) return;
    setActionLoading(true);
    setStatusMessage(null);

    const res = await bloodBankApi.prepareDispatch(selectedReq.id, {
      courierType,
      courierReference: courierRef,
      packagingType,
      targetTransportTemp: targetTemp,
      coldChainMonitoring: 'Passive Temp Strips',
      specialHandlingInstructions: specialInstructions,
      notes: `Dispatch prepared for ${selectedReq.hospitalName}.`
    });

    setActionLoading(false);
    setShowDispatchModal(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: `Dispatch manifest ${res.dispatch?.id} generated successfully.` });
      await fetchRequests();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to prepare dispatch.' });
    }
  };

  // Confirm Dispatch / Handover to Courier
  const handleConfirmCourierHandoff = async () => {
    if (!selectedReq) return;
    if (!window.confirm(`Confirm courier handoff for ${selectedReq.id}? This will transition blood units to Issued status and activate transit tracking.`)) return;

    setActionLoading(true);
    setStatusMessage(null);

    const res = await bloodBankApi.confirmDispatch(selectedReq.id, {
      courierReference: courierRef,
      notes: `Physical handover verified to courier ${courierRef}. Transport seals inspected.`
    });

    setActionLoading(false);
    if (res.success) {
      setStatusMessage({ type: 'success', text: `Requisition ${selectedReq.id} marked Dispatched & in transit.` });
      await fetchRequests();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to confirm dispatch.' });
    }
  };

  // View Printable Dispatch Slip
  const handleViewDispatchSlip = async () => {
    if (!selectedReq) return;
    const dispatchId = (selectedReq as any).dispatchId || selectedReq.id;
    const res = await bloodBankApi.getDispatchSlip(dispatchId);
    if (res.success && res.slip) {
      setSlipData(res.slip);
      setShowSlipModal(true);
    } else {
      alert(res.error || 'Failed to retrieve dispatch slip data.');
    }
  };

  // Compute summary stats
  const totalCount = requests.length;
  const emergencyCount = requests.filter(r => r.urgency === 'Emergency').length;
  const reservedCount = requests.filter(r => r.status === 'Reserved' || r.status === 'Allocated').length;
  const inTransitCount = requests.filter(r => r.status === 'Dispatched' || r.status === 'Issued').length;

  return (
    <div className="space-y-6">
      
      {/* Top Header & Operational KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Hospital Requisition Desk
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">{facilityTitle} {facilityReg}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Fulfillment, Barcode Assignment & Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-match released inventory, assign itemized blood units, generate packing manifests, and log courier handoffs.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'matrix' 
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Emergency Allocation Matrix</span>
          </button>
          <button
            onClick={fetchRequests}
            title="Refresh Requisitions"
            className="p-2 bg-white text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${loadingQueue ? 'animate-spin text-blood-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Inbound Queue</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{totalCount}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Active hospital tickets</span>
        </div>
        <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm bg-rose-50/20">
          <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider block flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Emergency / STAT</span>
          </span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{emergencyCount}</span>
          <span className="text-[11px] text-rose-600 mt-0.5 block">Critical surgical priority</span>
        </div>
        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm bg-amber-50/20">
          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">Reserved Units</span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">{reservedCount}</span>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Staged for preparation</span>
        </div>
        <div className="bg-white rounded-2xl border border-purple-200 p-4 shadow-sm bg-purple-50/20">
          <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block flex items-center space-x-1">
            <Truck className="w-3 h-3" />
            <span>In Cold Transit</span>
          </span>
          <span className="text-2xl font-black text-purple-700 mt-1 block">{inTransitCount}</span>
          <span className="text-[11px] text-purple-600 mt-0.5 block">Dispatched to hospitals</span>
        </div>
      </div>

      {/* Status Notifications Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Filter Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Requisitions ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('emergency')}
          className={`px-4 py-2 font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'emergency' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Emergency / STAT ({emergencyCount})
        </button>
        <button
          onClick={() => setActiveTab('reserved')}
          className={`px-4 py-2 font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'reserved' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Allocated & Reserved ({reservedCount})
        </button>
        <button
          onClick={() => setActiveTab('dispatched')}
          className={`px-4 py-2 font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'dispatched' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          In Transit / Dispatched ({inTransitCount})
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'matrix' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Emergency Stock Matrix
        </button>
      </div>

      {/* MAIN VIEW: Requisitions Fulfillment Desk OR Allocation Matrix */}
      {activeTab === 'matrix' ? (
        /* Emergency Stock Allocation Matrix View */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Authoritative Stock Matrix
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">Emergency Stock vs Priority Demand</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time released inventory compared against active hospital demand. Evaluates ABO/Rh clinical compatibility alternatives.
              </p>
            </div>
            <button
              onClick={fetchAllocationMatrix}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loadingMatrix ? 'animate-spin' : ''}`} />
              <span>Refresh Matrix</span>
            </button>
          </div>

          {loadingMatrix || !matrixData ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Calculating stock vs priority demand...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {matrixData.matrix.map((row: any) => (
                <div key={row.component} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blood-600" />
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      {row.component === 'RBC' ? 'Red Blood Cells (RBC / PRBC)' : row.component === 'Plasma' ? 'Fresh Frozen Plasma (FFP)' : 'Platelet Concentrates'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {row.groups.map((g: any) => {
                      const isDeficit = g.netBalance < 0;
                      const isBalanced = g.netBalance === 0;
                      return (
                        <div
                          key={g.bloodGroup}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isDeficit 
                              ? 'border-rose-300 bg-rose-50/40 shadow-xs' 
                              : isBalanced 
                              ? 'border-slate-200 bg-slate-50/50' 
                              : 'border-emerald-200 bg-emerald-50/30'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-base font-black text-slate-900">{g.bloodGroup}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                              isDeficit 
                                ? 'bg-rose-100 text-rose-800' 
                                : isBalanced 
                                ? 'bg-slate-100 text-slate-700' 
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isDeficit ? `Deficit (${g.netBalance})` : isBalanced ? 'Balanced (0)' : `Surplus (+${g.netBalance})`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Released Stock</span>
                              <span className="font-extrabold text-slate-800">{g.availableUnits} units</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Active Demand</span>
                              <span className="font-extrabold text-slate-800">{g.totalDemandUnits} units</span>
                            </div>
                          </div>

                          {g.emergencyDemand > 0 && (
                            <div className="text-[10px] font-bold text-rose-700 mb-2 flex items-center space-x-1">
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>STAT Demand: {g.emergencyDemand} units</span>
                            </div>
                          )}

                          <p className="text-[10px] text-slate-500 leading-tight border-t border-slate-100 pt-1.5 italic">
                            {g.recommendation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Requisitions Fulfillment Desk (Master-Detail Split) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT PANEL: Inbound Requisitions Queue (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            
            {/* Search & Quick Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search REQ, hospital, patient ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRequests()}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blood-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={componentFilter}
                  onChange={(e) => setComponentFilter(e.target.value)}
                  className="p-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium"
                >
                  <option value="all">All Components</option>
                  <option value="RBC">Red Blood Cells (RBC)</option>
                  <option value="Plasma">Plasma</option>
                  <option value="Platelets">Platelets</option>
                </select>

                <select
                  value={bloodGroupFilter}
                  onChange={(e) => setBloodGroupFilter(e.target.value)}
                  className="p-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-medium"
                >
                  <option value="all">All Blood Groups</option>
                  <option value="O-">O Negative (Universal)</option>
                  <option value="O+">O Positive</option>
                  <option value="A+">A Positive</option>
                  <option value="A-">A Negative</option>
                  <option value="B+">B Positive</option>
                  <option value="B-">B Negative</option>
                  <option value="AB+">AB Positive</option>
                  <option value="AB-">AB Negative</option>
                </select>
              </div>
            </div>

            {/* Request Card List */}
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {loadingQueue ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <div className="w-5 h-5 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading requisitions queue...</span>
                </div>
              ) : requests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600 text-xs">No Requisitions Found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try resetting search or category filters.</p>
                </div>
              ) : (
                requests.map((req) => {
                  const isSelected = selectedReq?.id === req.id;
                  const remaining = Math.max(0, req.quantityUnits - (req.fulfilledUnits || 0));
                  return (
                    <div
                      key={req.id}
                      onClick={() => setSelectedReq(req)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blood-500 bg-blood-50/40 shadow-sm ring-1 ring-blood-500/20' 
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">{req.id}</span>
                          <span className="text-[11px] text-slate-600 font-medium">{req.hospitalName}</span>
                        </div>
                        <StatusBadge status={req.urgency} />
                      </div>

                      <div className="flex items-center justify-between text-xs mt-2">
                        <span className="font-black text-blood-700 bg-white px-2 py-0.5 rounded border border-blood-100">
                          {req.bloodGroup} {req.component}
                        </span>
                        <span className="font-semibold text-slate-700 text-[11px]">
                          {req.fulfilledUnits} / {req.quantityUnits} Units fulfilled
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                        <StatusBadge status={req.status} />
                        <span className="text-slate-400 font-mono">{req.patientReferenceId}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* RIGHT PANEL: Requisition Processing, Barcode Assignment & Dispatch Manifest (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedReq ? (
              <div className="space-y-6">
                
                {/* Header Information Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{selectedReq.hospitalName}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 font-medium">{selectedReq.department}</span>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{selectedReq.id}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Patient Ref: <strong className="font-mono text-slate-700">{selectedReq.patientReferenceId}</strong>
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <StatusBadge status={selectedReq.urgency} />
                        <StatusBadge status={selectedReq.status} />
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Needed: {new Date(selectedReq.requiredByDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Clinical Indication */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs leading-relaxed text-slate-700">
                    <strong className="text-slate-900">Clinical Indication:</strong> {selectedReq.notes || 'Routine surgical reservation.'}
                  </div>

                  {/* Quantity & Allocation Progress */}
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">Fulfillment Progress</span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedUnitIds.length} / {selectedReq.quantityUnits} Units Staged ({Math.max(0, selectedReq.quantityUnits - selectedUnitIds.length)} Remaining)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blood-600 transition-all rounded-full"
                        style={{ width: `${Math.min(100, (selectedUnitIds.length / selectedReq.quantityUnits) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* SECTION 1: UNIT ALLOCATION & BARCODE ASSIGNMENT */}
                  {selectedReq.status !== 'Fulfilled' && selectedReq.status !== 'Dispatched' && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center space-x-1.5">
                          <Barcode className="w-4 h-4 text-blood-600" />
                          <h3 className="font-extrabold text-sm text-slate-900">Unit Allocation & Barcode Assignment</h3>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          Required: <strong className="text-blood-700">{selectedReq.bloodGroup} {selectedReq.component}</strong>
                        </span>
                      </div>

                      {/* Manual Barcode / Scanner Entry Bar */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                          Scan Barcode or Enter Blood Unit ID
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            placeholder="e.g. UNIT-2026-8015"
                            value={manualBarcode}
                            onChange={(e) => setManualBarcode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddBarcode()}
                            className="flex-1 px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blood-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddBarcode}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Verify & Add</span>
                          </button>
                        </div>
                        {barcodeError && (
                          <p className="text-xs text-rose-600 font-medium flex items-center space-x-1 pt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{barcodeError}</span>
                          </p>
                        )}
                      </div>

                      {/* Staged Units Chips */}
                      {selectedUnitIds.length > 0 && (
                        <div className="p-3 bg-blood-50/50 rounded-xl border border-blood-200 space-y-2">
                          <span className="text-[11px] font-extrabold text-blood-900 uppercase tracking-wider block">
                            Assigned Units for Requisition ({selectedUnitIds.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {selectedUnitIds.map(uId => {
                              const unitObj = eligibleUnits.find(u => u.id === uId);
                              return (
                                <div key={uId} className="px-3 py-1.5 bg-white border border-blood-300 rounded-xl text-xs font-bold text-slate-900 flex items-center space-x-2 shadow-xs">
                                  <Barcode className="w-3.5 h-3.5 text-blood-600" />
                                  <span>{uId}</span>
                                  {unitObj && (
                                    <span className="text-[10px] text-slate-500 font-normal">
                                      ({unitObj.bloodGroup} • Exp: {unitObj.expiryDate})
                                    </span>
                                  )}
                                  <button
                                    onClick={() => setSelectedUnitIds(prev => prev.filter(id => id !== uId))}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Authoritative FEFO Eligible Released Units */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-800">
                            Eligible Released FEFO Units ({eligibleUnits.length})
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Earliest expiring units prioritized
                          </span>
                        </div>

                        {loadingUnits ? (
                          <div className="py-6 text-center text-xs text-slate-400">
                            <div className="w-4 h-4 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-1.5" />
                            <span>Checking laboratory clearance & cold storage...</span>
                          </div>
                        ) : eligibleUnits.length === 0 ? (
                          unitsDiagnostics?.pendingTestingCount > 0 ? (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                              <div className="flex items-start space-x-3">
                                <div className="p-2 bg-amber-100 rounded-lg text-amber-700 mt-0.5 shrink-0">
                                  <FlaskConical className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-bold text-amber-900">
                                      Units Awaiting Laboratory Clearance
                                    </h4>
                                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-200 text-amber-900">
                                      {unitsDiagnostics.pendingTestingCount} in Laboratory Quarantine
                                    </span>
                                  </div>
                                  <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                                    {unitsDiagnostics.explanation}
                                  </p>
                                  {unitsDiagnostics.pendingTestingUnits?.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                      {unitsDiagnostics.pendingTestingUnits.map((u: any) => (
                                        <Link
                                          key={u.id}
                                          to={`/blood-bank/testing?unitId=${encodeURIComponent(u.id)}`}
                                          className="text-[10px] font-mono px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 rounded border border-amber-300 font-semibold shadow-sm transition inline-flex items-center gap-1"
                                          title={`Click to test unit ${u.id}`}
                                        >
                                          <span>{u.id}</span>
                                          <span className="text-[9px] text-amber-600 font-normal">({u.bloodGroup} • Screen &rarr;)</span>
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-3">
                                    <Link
                                      to={unitsDiagnostics.pendingTestingUnits?.[0]?.id 
                                        ? `/blood-bank/testing?unitId=${encodeURIComponent(unitsDiagnostics.pendingTestingUnits[0].id)}` 
                                        : '/blood-bank/testing'}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                                    >
                                      <FlaskConical className="w-3.5 h-3.5" />
                                      Go to Laboratory Testing & Clearance &rarr;
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                              {unitsDiagnostics?.explanation || `No available released units found for ${selectedReq.bloodGroup} ${selectedReq.component}. Check Emergency Allocation Matrix for clinical alternatives.`}
                            </div>
                          )
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto pr-1">
                            {eligibleUnits.map(unit => {
                              const isSelected = selectedUnitIds.includes(unit.id);
                              return (
                                <div
                                  key={unit.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedUnitIds(prev => prev.filter(id => id !== unit.id));
                                    } else {
                                      const needed = selectedReq.quantityUnits - (selectedReq.fulfilledUnits || 0);
                                      if (selectedUnitIds.length >= needed) {
                                        alert(`Requisition requires ${needed} units. Remove an existing unit before selecting another.`);
                                        return;
                                      }
                                      setSelectedUnitIds(prev => [...prev, unit.id]);
                                    }
                                  }}
                                  className={`p-2.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                                    isSelected 
                                      ? 'border-blood-500 bg-blood-50 font-bold' 
                                      : 'border-slate-200 hover:border-slate-300 bg-white'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-mono font-bold text-slate-900">{unit.id}</span>
                                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-800">
                                        {unit.bloodGroup}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                                      Exp: {unit.expiryDate} ({unit.daysToExpiry}d left) • {unit.storageLocation}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                    isSelected ? 'bg-blood-600 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    {isSelected ? 'Staged' : 'Select'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Allocation Action Buttons */}
                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100">
                        {selectedReq.assignedUnitIds && selectedReq.assignedUnitIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleReleaseAllocation}
                            disabled={actionLoading}
                            className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                          >
                            Release Allocation
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleCommitAllocation}
                          disabled={actionLoading || selectedUnitIds.length === 0}
                          className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading ? 'Saving...' : 'Commit Unit Allocation'}
                        </button>
                      </div>

                    </div>
                  )}

                  {/* SECTION 2: DISPATCH PREPARATION & COURIER HANDOFF */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Truck className="w-4 h-4 text-purple-600" />
                        <h3 className="font-extrabold text-sm text-slate-900">Dispatch Manifest & Transport Logistics</h3>
                      </div>
                      {(selectedReq as any).dispatchId && (
                        <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          Manifest: {(selectedReq as any).dispatchId}
                        </span>
                      )}
                    </div>

                    {/* Dispatch Workflow Stepper Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      
                      {/* Step A: Prepare Dispatch Button */}
                      {selectedReq.status === 'Reserved' && (
                        <button
                          onClick={() => setShowDispatchModal(true)}
                          disabled={actionLoading}
                          className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>Prepare Dispatch Manifest & Packing Slip</span>
                        </button>
                      )}

                      {/* Step B: Dispatch Manifest Actions (when Prepared for Dispatch) */}
                      {(selectedReq.status === 'Prepared for Dispatch' || (selectedReq as any).dispatchId) && (
                        <>
                          <button
                            onClick={handleViewDispatchSlip}
                            className="px-3.5 py-2 rounded-xl font-bold text-xs text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs flex items-center space-x-1.5 cursor-pointer"
                          >
                            <Printer className="w-4 h-4 text-slate-500" />
                            <span>View & Print Packing Slip</span>
                          </button>

                          {selectedReq.status === 'Prepared for Dispatch' && (
                            <button
                              onClick={handleConfirmCourierHandoff}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-blood-600 hover:bg-blood-700 shadow-sm flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Truck className="w-4 h-4" />
                              <span>Confirm Courier Handoff (Dispatch)</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Step C: If Dispatched or In Transit */}
                      {selectedReq.status === 'Dispatched' && (
                        <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 w-full flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Truck className="w-4 h-4 text-purple-600" />
                            <span>Handed off to courier. Awaiting hospital delivery confirmation.</span>
                          </div>
                          <button
                            onClick={handleViewDispatchSlip}
                            className="px-3 py-1 bg-white border border-purple-200 rounded-lg font-bold text-purple-700 hover:bg-purple-100 cursor-pointer"
                          >
                            View Packing Slip
                          </button>
                        </div>
                      )}

                      {/* Step D: If Fulfilled */}
                      {selectedReq.status === 'Fulfilled' && (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 w-full flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Hospital confirmed custody receipt and cold-chain integrity.</span>
                          </div>
                          <button
                            onClick={handleViewDispatchSlip}
                            className="px-3 py-1 bg-white border border-emerald-200 rounded-lg font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                          >
                            Audit Packing Slip
                          </button>
                        </div>
                      )}

                    </div>

                  </div>

                </div>

                {/* Audit Timeline */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-sm text-slate-900">Verification & Fulfillment Audit Trail</h3>
                  <div className="relative border-l-2 border-slate-200 pl-4 space-y-3.5">
                    {(selectedReq.timeline || []).map((event, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blood-600 ring-4 ring-white" />
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-slate-900 block">{event.note}</span>
                              <span className="text-[11px] text-slate-500 mt-0.5 block">By: {event.actor}</span>
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
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-600 text-sm">No Requisition Selected</p>
                <p className="text-xs text-slate-400 mt-1">Select an active hospital ticket from the queue on the left to review cross-matches and fulfill units.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL 1: PREPARE DISPATCH MANIFEST */}
      {showDispatchModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Prepare Dispatch Manifest</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure cold-chain transport parameters for {selectedReq.id}</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Courier Transit Type</label>
                <select
                  value={courierType}
                  onChange={(e: any) => setCourierType(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50"
                >
                  <option value="Dedicated Hospital Courier">Dedicated Hospital Courier</option>
                  <option value="Blood Bank Transport">Blood Bank Transport</option>
                  <option value="External Medical Courier">External Medical Courier</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Courier Reference / Vehicle ID</label>
                <input
                  type="text"
                  value={courierRef}
                  onChange={(e) => setCourierRef(e.target.value)}
                  placeholder="e.g. HOSP-AMB-04 or Courier Tag"
                  className="w-full p-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Thermal Packaging Type</label>
                <input
                  type="text"
                  value={packagingType}
                  onChange={(e) => setPackagingType(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Transport Temperature</label>
                <input
                  type="text"
                  value={targetTemp}
                  onChange={(e) => setTargetTemp(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Handling Instructions</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrepareDispatch}
                disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 cursor-pointer shadow-sm"
              >
                {actionLoading ? 'Generating...' : 'Generate Dispatch Slip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE DISPATCH PACKING SLIP */}
      {showSlipModal && slipData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            
            {/* Slip Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blood-700 bg-blood-50 px-2 py-0.5 rounded border border-blood-200">
                    Official Transport Manifest
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600">{slipData.documentId}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">{slipData.bloodBank.name}</h2>
                <p className="text-[11px] text-slate-500">
                  Licence: {slipData.bloodBank.registrationId} • Phone: {slipData.bloodBank.phone} • {slipData.bloodBank.address}, {slipData.bloodBank.city}
                </p>
              </div>
              <button onClick={() => setShowSlipModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Delivery Destination & Clinical Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Requesting Hospital</span>
                <span className="font-black text-slate-900 text-sm block">{slipData.hospital.name}</span>
                <span className="text-slate-600 block mt-0.5">Dept: {slipData.hospital.department}</span>
                <span className="text-slate-500 block font-mono mt-0.5">Patient Ref: {slipData.hospital.patientReferenceId}</span>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase text-[10px] block">Requisition Details</span>
                <span className="font-bold text-slate-900 block">{slipData.requestId} • Urgency: {slipData.clinicalRequisition.urgency}</span>
                <span className="text-blood-700 font-bold block mt-0.5">
                  Requested: {slipData.clinicalRequisition.bloodGroup} {slipData.clinicalRequisition.component} ({slipData.clinicalRequisition.quantityRequested} Units)
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Dispatched: {slipData.clinicalRequisition.quantityDispatched} Verified Units
                </span>
              </div>
            </div>

            {/* Itemized Blood Units Table */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
                Itemized Blood Units Transferred
              </span>
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                  <tr>
                    <th className="p-2">Unit ID / Barcode</th>
                    <th className="p-2">Component</th>
                    <th className="p-2">Group</th>
                    <th className="p-2">Volume</th>
                    <th className="p-2">Expiry Date</th>
                    <th className="p-2">Lab Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {slipData.units.map((u: any) => (
                    <tr key={u.unitId} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold">{u.unitId}</td>
                      <td className="p-2">{u.component}</td>
                      <td className="p-2 font-bold text-blood-700">{u.bloodGroup}</td>
                      <td className="p-2">{u.volumeMl} ml</td>
                      <td className="p-2 font-mono">{u.expiryDate}</td>
                      <td className="p-2 text-emerald-700 font-bold">Passed</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cold Chain Specifications */}
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 text-xs space-y-1">
              <span className="font-extrabold text-purple-900 uppercase text-[10px] block">Cold-Chain Protocol</span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-purple-950">
                <div>Container: <strong>{slipData.coldChainSpecifications.packagingType}</strong></div>
                <div>Target Temp: <strong>{slipData.coldChainSpecifications.targetTransportTemp}</strong></div>
                <div>Monitoring: <strong>{slipData.coldChainSpecifications.coldChainMonitoring}</strong></div>
                <div>Handling: <strong>{slipData.coldChainSpecifications.specialHandlingInstructions}</strong></div>
              </div>
              <p className="text-[10px] text-purple-700 italic pt-1">
                Note: {slipData.coldChainSpecifications.telemetryNote}
              </p>
            </div>

            {/* Physical Sign-off Blocks */}
            <div className="grid grid-cols-3 gap-3 text-[11px] border-t border-slate-200 pt-3 text-slate-600">
              <div className="border border-slate-200 p-2.5 rounded-lg space-y-4">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Prepared By (Blood Bank)</span>
                <span className="block text-slate-900 font-semibold">{slipData.courierHandoff.preparedBy}</span>
                <span className="text-[10px] text-slate-400 block">{new Date(slipData.courierHandoff.preparedAt).toLocaleDateString()}</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded-lg space-y-4">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Courier Handover</span>
                <span className="block text-slate-900 font-semibold">{slipData.courierHandoff.courierReference}</span>
                <span className="text-[10px] text-slate-400 block">{slipData.courierHandoff.dispatchedAt ? new Date(slipData.courierHandoff.dispatchedAt).toLocaleTimeString() : 'Pending'}</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded-lg space-y-4">
                <span className="font-bold text-slate-800 block text-[10px] uppercase">Hospital Receiving Staff</span>
                <span className="block text-slate-900 font-semibold">{slipData.courierHandoff.receivedBy || '______________________'}</span>
                <span className="text-[10px] text-slate-400 block">{slipData.courierHandoff.receivedAt ? new Date(slipData.courierHandoff.receivedAt).toLocaleDateString() : 'Pending Receipt'}</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
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

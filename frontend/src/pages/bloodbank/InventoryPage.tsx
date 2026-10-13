import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { BloodUnit, BloodGroup, BloodComponent, AvailabilityStatus, TestingStatus } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  Package, 
  PlusCircle, 
  Search, 
  Filter, 
  RefreshCw, 
  X, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  ArrowUpRight, 
  Layers, 
  Database,
  ArrowUpDown,
  Lock,
  ChevronRight,
  Info
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [fefoUnits, setFefoUnits] = useState<BloodUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [fefoLoading, setFefoLoading] = useState(false);

  // Summary Metrics State
  const [metrics, setMetrics] = useState({
    totalUnits: 0,
    rbcAvailable: 0,
    plasmaAvailable: 0,
    plateletsAvailable: 0,
    expiringSoon: 0,
    expiredUnits: 0,
    reservedUnits: 0,
    pendingRequests: 0,
    expiring3Days: 0,
    expiring7Days: 0,
    expiring30Days: 0
  });

  // Filters State
  const [bloodGroup, setBloodGroup] = useState<string>('all');
  const [component, setComponent] = useState<string>('all');
  const [testingStatus, setTestingStatus] = useState<string>('all');
  const [availability, setAvailability] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('earliest_expiry'); // FEFO Default
  const [search, setSearch] = useState<string>('');

  // Modals & Action State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<BloodUnit | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionModalUnit, setActionModalUnit] = useState<BloodUnit | null>(null);
  const [actionType, setActionType] = useState<'reserve' | 'issue' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionRequestId, setActionRequestId] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Unit Form state
  const [newGroup, setNewGroup] = useState<BloodGroup>('O+');
  const [newComp, setNewComp] = useState<BloodComponent>('RBC');
  const [newVol, setNewVol] = useState('350');
  const [newStorage, setNewStorage] = useState('Fridge Bay A-1');
  const [newSource, setNewSource] = useState('Voluntary Donation');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // 1. Fetch Inventory & Metrics
  const fetchInventory = async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (bloodGroup !== 'all') query.set('bloodGroup', bloodGroup);
    if (component !== 'all') query.set('component', component);
    if (testingStatus !== 'all') query.set('testingStatus', testingStatus);
    if (availability !== 'all') query.set('availability', availability);
    if (expiryFilter !== 'all') query.set('expiryFilter', expiryFilter);
    if (sortBy) query.set('sortBy', sortBy);
    if (search) query.set('search', search);

    const res = await apiFetch(`/blood-bank/inventory?${query.toString()}`);
    if (res.success && res.units) {
      setUnits(res.units);
    }
    setLoading(false);
  };

  // 2. Fetch Dashboard Summary Metrics
  const fetchDashboardMetrics = async () => {
    const res = await apiFetch('/blood-bank/dashboard');
    if (res.success && res.metrics) {
      const m = res.metrics;
      setMetrics(prev => ({
        ...prev,
        totalUnits: m.totalUnits || 0,
        rbcAvailable: m.rbcAvailable || 0,
        plasmaAvailable: m.plasmaAvailable || 0,
        plateletsAvailable: m.plateletsAvailable || 0,
        expiringSoon: m.expiringSoon || 0,
        expiredUnits: m.expiredUnits || 0,
        reservedUnits: m.reservedUnits || 0,
        pendingRequests: m.pendingRequests || 0
      }));
    }

    // Expiry breakdown API call
    const expRes = await apiFetch('/blood-bank/expiry');
    if (expRes.success && expRes.summary) {
      setMetrics(prev => ({
        ...prev,
        expiring3Days: expRes.summary.expiring3DaysCount || 0,
        expiring7Days: expRes.summary.expiring7DaysCount || 0,
        expiring30Days: expRes.summary.expiring30DaysCount || 0,
        expiredUnits: expRes.summary.expiredCount || prev.expiredUnits
      }));
    }
  };

  // 3. Fetch FEFO Next Priority Units
  const fetchFefoPriority = async () => {
    setFefoLoading(true);
    const query = new URLSearchParams();
    if (bloodGroup !== 'all') query.set('bloodGroup', bloodGroup);
    if (component !== 'all') query.set('component', component);
    query.set('limit', '4');

    const res = await apiFetch(`/blood-bank/inventory/fefo-priority?${query.toString()}`);
    if (res.success && res.priorityUnits) {
      setFefoUnits(res.priorityUnits);
    }
    setFefoLoading(false);
  };

  useEffect(() => {
    fetchInventory();
    fetchDashboardMetrics();
    fetchFefoPriority();
  }, [bloodGroup, component, testingStatus, availability, expiryFilter, sortBy, search]);

  // Handle Unit Reserve / Issue Execution with Double-Reservation Prevention
  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModalUnit || !actionType) return;

    setActionSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const endpoint = `/blood-bank/inventory/${actionModalUnit.id}/${actionType}`;
    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        requestId: actionRequestId || undefined,
        notes: actionNotes
      })
    });

    setActionSubmitting(false);

    if (res.success) {
      setSuccessMessage(res.message || `Unit ${actionModalUnit.id} ${actionType}d successfully.`);
      setActionModalUnit(null);
      setActionType(null);
      setActionNotes('');
      setActionRequestId('');
      fetchInventory();
      fetchDashboardMetrics();
      fetchFefoPriority();
    } else {
      setErrorMessage(res.error || `Failed to ${actionType} unit. Double-reservation prevented.`);
    }
  };

  // Handle Add New Unit Form
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdd(true);
    setErrorMessage(null);

    const res = await apiFetch('/blood-bank/inventory', {
      method: 'POST',
      body: JSON.stringify({
        bloodGroup: newGroup,
        component: newComp,
        volumeMl: Number(newVol),
        storageLocation: newStorage,
        source: newSource
      })
    });

    setSubmittingAdd(false);

    if (res.success) {
      setShowAddModal(false);
      setSuccessMessage('New blood unit logged and moved to quarantine testing bay.');
      fetchInventory();
      fetchDashboardMetrics();
      fetchFefoPriority();
    } else {
      setErrorMessage(res.error || 'Failed to record unit.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Alert Banner for Notifications */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-xs font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
              <span>Expiry-priority inventory</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>FIFO / FEFO Real-Time Sync</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Blood Unit Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track individual blood units, monitor expiry dates, and prioritize units for issue using earliest-expiry-first logic.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-blood-600 hover:bg-blood-700 shadow-md shadow-blood-500/20 transition-all flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record New Unit</span>
          </button>
        </div>
      </div>

      {/* 1. SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Units</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{units.length}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Logged in Inventory</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Available Units</div>
          <div className="text-3xl font-black text-emerald-700 mt-1">{metrics.totalUnits}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-0.5" /> Ready for Allocation
          </div>
        </div>

        <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Expiring Soon</div>
          <div className="text-3xl font-black text-amber-900 mt-1">{metrics.expiringSoon}</div>
          <div className="text-[10px] text-amber-700 font-bold mt-1 flex items-center">
            <Clock className="w-3 h-3 mr-0.5" /> &le; 7 Days Remaining
          </div>
        </div>

        <div className="bg-rose-50/80 rounded-2xl border border-rose-200 p-4 shadow-xs">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Expired Units</div>
          <div className="text-3xl font-black text-rose-900 mt-1">{metrics.expiredUnits}</div>
          <div className="text-[10px] text-rose-700 font-bold mt-1">Quarantined / Non-issuable</div>
        </div>

      </div>

      {/* 2. EXPIRY MONITORING CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-rose-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Expiry Risk Breakdown</h2>
          </div>
          <span className="text-[11px] font-medium text-slate-500">Calculated from collection date & shelf life</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'expiring_3d' ? 'all' : 'expiring_3d')}
            className={`p-3 rounded-xl border text-left transition-all ${
              expiryFilter === 'expiring_3d' 
                ? 'bg-rose-600 text-white border-rose-600 shadow-md' 
                : 'bg-rose-50/50 border-rose-200 hover:bg-rose-100/60'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[11px] font-bold ${expiryFilter === 'expiring_3d' ? 'text-rose-100' : 'text-rose-700'}`}>
                Critical (&le; 3 Days)
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                expiryFilter === 'expiring_3d' ? 'bg-white text-rose-700' : 'bg-rose-200 text-rose-900'
              }`}>
                {metrics.expiring3Days} Units
              </span>
            </div>
            <p className={`text-[11px] mt-1 font-medium ${expiryFilter === 'expiring_3d' ? 'text-rose-100' : 'text-slate-600'}`}>
              High wastage risk. Top priority for FEFO dispatch.
            </p>
          </button>

          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'expiring_7d' ? 'all' : 'expiring_7d')}
            className={`p-3 rounded-xl border text-left transition-all ${
              expiryFilter === 'expiring_7d' 
                ? 'bg-amber-600 text-white border-amber-600 shadow-md' 
                : 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/60'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[11px] font-bold ${expiryFilter === 'expiring_7d' ? 'text-amber-800' : 'text-amber-800'}`}>
                High Priority (&le; 7 Days)
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                expiryFilter === 'expiring_7d' ? 'bg-white text-amber-800' : 'bg-amber-200 text-amber-900'
              }`}>
                {metrics.expiring7Days} Units
              </span>
            </div>
            <p className={`text-[11px] mt-1 font-medium ${expiryFilter === 'expiring_7d' ? 'text-amber-100' : 'text-slate-600'}`}>
              Ideal for active hospital allocations.
            </p>
          </button>

          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'expiring_30d' ? 'all' : 'expiring_30d')}
            className={`p-3 rounded-xl border text-left transition-all ${
              expiryFilter === 'expiring_30d' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-blue-50/50 border-blue-200 hover:bg-blue-100/60'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[11px] font-bold ${expiryFilter === 'expiring_30d' ? 'text-blue-800' : 'text-blue-800'}`}>
                Rolling Reserve (&le; 30 Days)
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                expiryFilter === 'expiring_30d' ? 'bg-white text-blue-800' : 'bg-blue-200 text-blue-900'
              }`}>
                {metrics.expiring30Days} Units
              </span>
            </div>
            <p className={`text-[11px] mt-1 font-medium ${expiryFilter === 'expiring_30d' ? 'text-blue-100' : 'text-slate-600'}`}>
              Stable inventory rotation window.
            </p>
          </button>

          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
            className={`p-3 rounded-xl border text-left transition-all ${
              expiryFilter === 'expired' 
                ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                : 'bg-slate-100 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[11px] font-bold ${expiryFilter === 'expired' ? 'text-slate-200' : 'text-slate-800'}`}>
                Expired Units
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                expiryFilter === 'expired' ? 'bg-white text-slate-800' : 'bg-slate-300 text-slate-900'
              }`}>
                {metrics.expiredUnits} Units
              </span>
            </div>
            <p className={`text-[11px] mt-1 font-medium ${expiryFilter === 'expired' ? 'text-slate-300' : 'text-slate-600'}`}>
              Quarantined. Blocked from fulfillment.
            </p>
          </button>

        </div>
      </div>

      {/* 3. FEFO PRIORITY PANEL ("Next Units to Issue") */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 text-white rounded-2xl p-5 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                FEFO Priority Engine
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight">Next Units to Issue (Earliest Expiry First)</h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Automated clinical safety protocol: First Expiry, First Out (FEFO) prioritization.
            </p>
          </div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center">
            <Info className="w-3.5 h-3.5 mr-1 text-rose-400" />
            Prevents blood degradation & wastage
          </div>
        </div>

        {fefoLoading ? (
          <div className="py-6 text-center text-xs text-slate-400 animate-pulse">Computing FEFO priority queue...</div>
        ) : fefoUnits.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">No eligible available units in current FEFO filter.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fefoUnits.map((unit, index) => {
              const daysLeft = unit.daysRemaining ?? Math.ceil((new Date(unit.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const symbolRank = index === 0 ? '①' : index === 1 ? '②' : index === 2 ? '③' : index === 3 ? '④' : `⑤`;
              return (
                <div key={unit.id} className="bg-slate-800/90 rounded-xl p-3.5 border border-slate-700/80 relative hover:border-rose-500 transition-all shadow-md">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-rose-400">
                      {symbolRank}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 font-extrabold text-rose-400 text-xs border border-rose-500/30">
                      {unit.bloodGroup} {unit.component}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <div className="font-mono font-bold text-sm text-white tracking-wider">Unit: {unit.id}</div>
                    <div className="text-[11px] text-slate-300 mt-1 flex items-center">
                      <Clock className="w-3 h-3 text-amber-400 mr-1" />
                      Expires: <strong className="text-white ml-1">{unit.expiryDate}</strong>
                    </div>
                    <div className="text-[11px] font-bold text-amber-400 mt-0.5">
                      {daysLeft} days remaining
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex space-x-2">
                    <button
                      onClick={() => {
                        setActionModalUnit(unit);
                        setActionType('reserve');
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition-colors"
                    >
                      Reserve
                    </button>
                    <button
                      onClick={() => {
                        setActionModalUnit(unit);
                        setActionType('issue');
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                    >
                      Issue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. SORTING AND FILTERING CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-rose-600" />
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">Inventory Filter & Sorting Controls</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-500 font-bold">Sort Strategy:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl bg-slate-50 font-bold text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
            >
              <option value="earliest_expiry">Earliest Expiry First (FEFO Default)</option>
              <option value="latest_expiry">Latest Expiry First</option>
              <option value="collection_date">Collection Date (Newest First)</option>
              <option value="blood_group">Blood Group (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Search Unit ID</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="RBC-1024..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs"
            >
              <option value="all">All Blood Groups</option>
              {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Component</label>
            <select
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs"
            >
              <option value="all">All Components</option>
              <option value="RBC">RBC</option>
              <option value="Plasma">Plasma</option>
              <option value="Platelets">Platelets</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Screening</label>
            <select
              value={testingStatus}
              onChange={(e) => setTestingStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs"
            >
              <option value="all">All Screening States</option>
              <option value="Passed">Passed (Cleared)</option>
              <option value="Pending">Pending Screening</option>
              <option value="In Testing">In Testing</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Status</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Issued">Issued</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Expiry Filter</label>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs"
            >
              <option value="all">All Expiry Windows</option>
              <option value="expiring_3d">Expiring &le; 3 Days</option>
              <option value="expiring_7d">Expiring &le; 7 Days</option>
              <option value="expiring_30d">Expiring &le; 30 Days</option>
              <option value="expired">Already Expired</option>
            </select>
          </div>

        </div>
      </div>

      {/* 5. MAIN INVENTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Header Priority Label */}
        <div className="px-6 py-3.5 bg-rose-50/60 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
              Priority: Earliest Expiry First
            </span>
            <span className="text-xs font-bold text-slate-700">
              ↓ Next unit to expire &nbsp;&bull;&nbsp; ↓ Later expiry &nbsp;&bull;&nbsp; ↓ Latest expiry
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] font-bold shadow-2xs">
              Sorted by: {sortBy === 'earliest_expiry' ? 'Earliest Expiry' : sortBy.replace('_', ' ')}
            </span>
            <button 
              onClick={() => {
                fetchInventory();
                fetchDashboardMetrics();
                fetchFefoPriority();
              }} 
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Unit ID</th>
                <th className="px-4 py-3">Blood Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Collection Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Days Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-400 mb-2" />
                    <span>Loading authoritative blood units...</span>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-xs">
                    <Package className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No blood units match the specified search or filter criteria.</p>
                    <p className="text-slate-400 mt-0.5">Try resetting filters or recording a new donor phlebotomy collection.</p>
                  </td>
                </tr>
              ) : (
                units.map((u, index) => {
                  const daysLeft = u.daysRemaining ?? Math.ceil((new Date(u.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7 && u.availability === 'Available';
                  const isExpired = daysLeft < 0 || u.availability === 'Expired';
                  const isTopPriority = index === 0 && sortBy === 'earliest_expiry' && u.availability === 'Available';

                  return (
                    <tr 
                      key={u.id} 
                      className={`transition-colors ${
                        isTopPriority 
                          ? 'bg-rose-50/40 hover:bg-rose-50/80 font-medium' 
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Priority Column */}
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                          isTopPriority 
                            ? 'bg-rose-600 text-white shadow-2xs' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {index + 1}
                        </span>
                      </td>

                      {/* Unit ID Column */}
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">{u.id}</td>

                      {/* Blood Group Column */}
                      <td className="px-4 py-3.5">
                        <span className="w-7 h-7 rounded-md bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center font-extrabold text-xs">
                          {u.bloodGroup}
                        </span>
                      </td>

                      {/* Component Column */}
                      <td className="px-4 py-3.5 font-semibold text-slate-900">{u.component} ({u.volumeMl} mL)</td>

                      {/* Collection Date Column */}
                      <td className="px-4 py-3.5 text-slate-500 font-medium">{u.collectionDate}</td>

                      {/* Expiry Date Column */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">{u.expiryDate}</td>

                      {/* Days Remaining Column */}
                      <td className="px-4 py-3.5">
                        {isExpired ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-extrabold">
                            Expired ({daysLeft} days)
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold flex items-center w-fit space-x-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>{daysLeft} days</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 font-semibold">{daysLeft} days</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={isExpired ? 'Expired' : u.availability} />
                      </td>

                      {/* Action Column */}
                      <td className="px-4 py-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedUnit(u);
                            setShowDetailsModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all"
                        >
                          View
                        </button>

                        {u.availability === 'Available' && u.testingStatus === 'Passed' && !isExpired && (
                          <button
                            onClick={() => {
                              setActionModalUnit(u);
                              setActionType('reserve');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] shadow-2xs transition-all"
                          >
                            Reserve
                          </button>
                        )}

                        {(u.availability === 'Available' || u.availability === 'Reserved') && u.testingStatus === 'Passed' && !isExpired && (
                          <button
                            onClick={() => {
                              setActionModalUnit(u);
                              setActionType('issue');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition-all"
                          >
                            Issue
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: VIEW DETAILS MODAL */}
      {showDetailsModal && selectedUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Unit Traceability Audit</span>
                <h3 className="font-extrabold text-base text-slate-900 font-mono">{selectedUnit.id}</h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 font-semibold block">Blood Group:</span>
                  <span className="font-extrabold text-blood-700 text-sm">{selectedUnit.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Component:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedUnit.component} ({selectedUnit.volumeMl} mL)</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Collection Date:</span>
                  <span className="font-medium text-slate-800">{selectedUnit.collectionDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Expiry Date:</span>
                  <span className="font-medium text-slate-800">{selectedUnit.expiryDate}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-semibold block">Testing Status:</span>
                  <StatusBadge status={selectedUnit.testingStatus} />
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Availability Status:</span>
                  <StatusBadge status={selectedUnit.availability} />
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block">Storage Bay Location:</span>
                <span className="font-bold text-slate-800">{selectedUnit.storageLocation}</span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block">Donation Source & Donor Code:</span>
                <span className="font-medium text-slate-700">{selectedUnit.source} &bull; {selectedUnit.donorCode || 'ANON-DONOR'}</span>
              </div>

              {selectedUnit.reservedForRequestId && (
                <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl">
                  <strong>Reserved Assignment:</strong> Unit is allocated to Hospital Request <strong>{selectedUnit.reservedForRequestId}</strong>.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RESERVE / ISSUE ACTION MODAL (WITH DOUBLE-RESERVATION CHECK) */}
      {actionModalUnit && actionType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 capitalize">
                {actionType} Blood Unit — {actionModalUnit.id}
              </h3>
              <button onClick={() => { setActionModalUnit(null); setActionType(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-semibold block">Target Unit:</span>
                  <span className="font-mono font-bold text-slate-900">{actionModalUnit.id}</span>
                </div>
                <span className="w-8 h-8 rounded-lg bg-blood-100 text-blood-700 font-black flex items-center justify-center">
                  {actionModalUnit.bloodGroup}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Associated Hospital Request ID (Optional)</label>
                <input
                  type="text"
                  value={actionRequestId}
                  onChange={(e) => setActionRequestId(e.target.value)}
                  placeholder="e.g. REQ-1001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dispatch / Allocation Notes</label>
                <textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Reserved for emergency cardiac surgery cross-matching."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px]">
                <strong>Concurrency Guard:</strong> The backend verifies current availability status prior to execution. If another session reserved this unit simultaneously, double-reservation will be blocked.
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setActionModalUnit(null); setActionType(null); }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className={`px-5 py-2 rounded-xl font-bold text-white shadow-md ${
                    actionType === 'reserve' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {actionSubmitting ? 'Executing...' : `Confirm ${actionType.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW UNIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Record New Blood Unit</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUnit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blood Group *</label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value as BloodGroup)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Component *</label>
                  <select
                    value={newComp}
                    onChange={(e) => {
                      const c = e.target.value as BloodComponent;
                      setNewComp(c);
                      if (c === 'RBC') setNewVol('350');
                      if (c === 'Plasma') setNewVol('250');
                      if (c === 'Platelets') setNewVol('200');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="RBC">Packed Red Blood Cells (RBC)</option>
                    <option value="Plasma">Fresh Frozen Plasma</option>
                    <option value="Platelets">Platelet Concentrate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Volume (mL)</label>
                  <input
                    type="number"
                    value={newVol}
                    onChange={(e) => setNewVol(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Donation Source</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Voluntary Donation">Voluntary Donation</option>
                    <option value="Donation Camp">Donation Camp</option>
                    <option value="Replacement Donation">Replacement Donation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Storage Location Bay</label>
                <input
                  type="text"
                  value={newStorage}
                  onChange={(e) => setNewStorage(e.target.value)}
                  placeholder="Quarantine Bay B-2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-[11px]">
                <strong>Quarantine Rule:</strong> Newly logged blood units are automatically placed in <em>Quarantined / Pending Screening</em> status until infectious disease testing passes.
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-blood-600 hover:bg-blood-700 shadow-sm"
                >
                  {submittingAdd ? 'Recording...' : 'Add Unit to Quarantine'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

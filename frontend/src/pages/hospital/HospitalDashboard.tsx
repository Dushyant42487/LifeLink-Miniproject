import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { hospitalApi } from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { 
  Building2, 
  PlusCircle, 
  Search, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  Truck, 
  ThermometerSnowflake,
  Trash2,
  Edit3,
  ShieldCheck,
  X,
  Boxes,
  ArrowRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const HospitalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 4A: Local OT Storage Ledger state
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [newEntryForm, setNewEntryForm] = useState({
    storageLocation: 'OT-1 Emergency Cold Box (Trauma Suite)',
    bloodGroup: 'O-',
    component: 'RBC',
    quantityUnits: 2,
    status: 'Usable',
    expiryDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    minThreshold: 4,
    notes: ''
  });
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const loadHospitalData = async () => {
    setLoading(true);
    setError(null);
    const res = await hospitalApi.getDashboard();
    if (res.success) {
      setData(res);
    } else {
      setError(res.error || 'Unable to retrieve hospital operational data.');
    }
    setLoading(false);
  };

  const loadStorageLedger = async () => {
    setLedgerLoading(true);
    const res = await hospitalApi.getStorageLedger();
    if (res.success) {
      setLedgerData(res);
    }
    setLedgerLoading(false);
  };

  useEffect(() => {
    loadHospitalData();
    loadStorageLedger();
  }, [user]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError(null);

    if (!newEntryForm.storageLocation.trim()) {
      setEntryError('Storage location name is required (e.g. OT-1 Emergency Cold Box).');
      return;
    }

    const qty = Number(newEntryForm.quantityUnits);
    if (!Number.isInteger(qty) || qty < 0) {
      setEntryError('Quantity units must be a non-negative integer (0 or greater).');
      return;
    }

    setEntrySubmitting(true);
    const res = await hospitalApi.createStorageEntry({
      ...newEntryForm,
      quantityUnits: qty,
      minThreshold: newEntryForm.minThreshold !== undefined && String(newEntryForm.minThreshold).trim() !== '' ? Number(newEntryForm.minThreshold) : undefined
    });
    setEntrySubmitting(false);

    if (res.success) {
      setShowAddEntryModal(false);
      setEntryError(null);
      loadStorageLedger();
    } else {
      setEntryError(res.error || 'Failed to record entry.');
    }
  };

  const handleUpdateQuantity = async (entryId: string, delta: number, currentQty: number) => {
    const newQty = Math.max(0, currentQty + delta);
    const res = await hospitalApi.updateStorageEntry(entryId, { quantityUnits: newQty });
    if (res.success) {
      loadStorageLedger();
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('Remove this storage unit record from local OT ledger?')) return;
    const res = await hospitalApi.deleteStorageEntry(entryId);
    if (res.success) {
      loadStorageLedger();
    }
  };

  // Authenticated hospital identity resolution
  const facilityName = (user as any)?.hospitalName || user?.name || data?.facility?.hospitalName || 'Apollo General Hospital';
  const licenseId = (user as any)?.licenseId || data?.facility?.licenseId || 'HOSP-VERIFIED';
  const verificationStatus = (user as any)?.verificationStatus || data?.facility?.verificationStatus || 'Verified';
  const facilityCity = (user as any)?.city || data?.facility?.city || 'Metro City';

  // Derived metrics from authoritative backend collection
  const metrics = data?.metrics || { 
    activeRequests: 0, 
    emergencyRequests: 0, 
    reservedUnitsCount: 0, 
    fulfilledRequestsCount: 0 
  };

  const recentRequests = data?.recentRequests || [];
  const inventoryMatrix = data?.inventoryMatrix || {};
  const highlightedGroups = ['O-', 'O+', 'A+', 'B+'];

  return (
    <div className="space-y-6">
      
      {/* Header Banner - Dynamic Authenticated Facility Identity */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Hospital Portal</span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-[11px] text-slate-300 font-medium">{facilityCity}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1 flex items-center space-x-2">
            <span>{facilityName}</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 flex items-center space-x-2">
            <span>License ID: <strong className="font-mono text-slate-100">{licenseId}</strong></span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
              {verificationStatus} Facility
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => { loadHospitalData(); loadStorageLedger(); }}
            title="Refresh dashboard data and internal storage ledger"
            className="p-2.5 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-400"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || ledgerLoading) ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <Link
            to="/hospital/logistics"
            className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all flex items-center space-x-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-400"
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Logistics & Map</span>
          </Link>

          <Link
            to="/search-blood"
            className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all flex items-center space-x-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-400"
          >
            <Search className="w-4 h-4 text-slate-300" />
            <span>Search Regional Stock</span>
          </Link>

          {/* Quick STAT Emergency Shortcut (Opens unified form with emergency urgency preselected) */}
          <Link
            to="/hospital/requests/new?urgency=Emergency"
            title="Rapidly initiate unified requisition in STAT Emergency trauma protocol"
            className="px-3 py-2.5 rounded-xl text-xs font-bold text-rose-200 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 transition-all flex items-center space-x-1.5 focus:outline-hidden focus:ring-2 focus:ring-rose-400"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>STAT Protocol</span>
          </Link>

          {/* Prominent Primary CTA */}
          <Link
            to="/hospital/requests/new"
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-blood-600 hover:bg-blood-500 shadow-lg shadow-blood-900/40 border border-blood-500 transition-all flex items-center space-x-2 focus:outline-hidden focus:ring-2 focus:ring-blood-400"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ New Blood Request</span>
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
            onClick={loadHospitalData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Stat Cards - Scoped strictly to authenticated hospital */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Requests"
          value={loading ? '...' : metrics.activeRequests}
          subtitle="In pipeline verification"
          icon={FileText}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Emergency Requests"
          value={loading ? '...' : metrics.emergencyRequests}
          subtitle="Priority trauma surgeries"
          icon={AlertTriangle}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          badge={metrics.emergencyRequests > 0 ? { text: 'High Priority', variant: 'danger' } : undefined}
        />

        <StatCard
          title="Reserved Units"
          value={loading ? '...' : metrics.reservedUnitsCount}
          subtitle="Reserved at regional center for surgical procedures"
          icon={Clock}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />

        <StatCard
          title="Fulfilled Requests"
          value={loading ? '...' : metrics.fulfilledRequestsCount}
          subtitle="Completed transfusions"
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Recent Requests Table & Regional Network Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Authoritative Hospital-Owned Requests Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Hospital Requisitions & Live Status</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Authoritative active pipeline for {facilityName}.</p>
            </div>
            <Link to="/hospital/requests" className="text-xs font-semibold text-blood-600 hover:underline">
              View All Requests
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Request ID</th>
                  <th className="px-4 py-2.5">Group & Component</th>
                  <th className="px-4 py-2.5">Units</th>
                  <th className="px-4 py-2.5">Urgency</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-3.5 h-3.5 border-2 border-blood-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading active hospital requisitions...</span>
                      </div>
                    </td>
                  </tr>
                ) : recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      <FileText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700 text-xs">No requisitions currently registered</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Submit a new blood request to initiate clinical dispatch.
                      </p>
                      <Link
                        to="/hospital/requests/new"
                        className="inline-block mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-blood-50 text-blood-700 hover:bg-blood-100 transition-colors"
                      >
                        Create Requisition
                      </Link>
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req: any) => (
                    <tr 
                      key={req.id} 
                      onClick={() => navigate(`/hospital/requests/${req.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-bold font-mono">
                        <Link
                          to={`/hospital/requests/${req.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blood-700 group-hover:underline flex items-center space-x-1"
                        >
                          <span>{req.id}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-blood-700">{req.bloodGroup} {req.component}</td>
                      <td className="px-4 py-3 font-bold">{req.fulfilledUnits} / {req.quantityUnits}</td>
                      <td className="px-4 py-3"><StatusBadge status={req.urgency} /></td>
                      <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regional Network Stock Overview (Clearly Labeled Regional Boundaries) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-slate-900">Regional Blood Network Stock</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200">
                Network-Wide
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Available units across connected regional blood centers. Units reserved at regional centers for your hospital's surgical procedures appear under <strong>Reserved Units</strong>.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {highlightedGroups.map(bg => {
                const groupData = inventoryMatrix[bg] || { availableUnits: 0, rbc: 0 };
                const count = groupData.availableUnits || 0;
                const isCritical = bg === 'O-' && count <= 4;

                return (
                  <div key={bg} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block font-medium">{bg} ({bg === 'O-' ? 'Critical Universal' : 'Whole / Component'})</span>
                    <span className={`font-extrabold text-base ${isCritical ? 'text-rose-600' : 'text-slate-900'}`}>
                      {loading ? '...' : `${count} Units`}
                    </span>
                    <span className={`text-[10px] font-bold block mt-0.5 ${isCritical ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isCritical ? 'Critical Deficit' : 'Available in Network'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            <span>Note: Regional blood bank inventories reflect verified central cold rooms.</span>
          </div>
        </div>

      </div>

      {/* Local OT Storage Ledger & Par Monitor (Phase 4A) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <ThermometerSnowflake className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-950">Local OT Storage Ledger & Par Monitor</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Hospital-Owned Ledger
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Internal operating theater refrigerators, satellite coolers, and departmental minimum stock thresholds.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddEntryModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Record Internal Stock</span>
            </button>
          </div>
        </div>

        {/* Usable vs Reserved vs Shortage Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Usable Stock</span>
            <span className="font-extrabold text-lg text-emerald-700">
              {ledgerLoading ? '...' : (ledgerData?.summary?.totalUsable ?? 0)} Units
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">Verified usable on-premise</span>
          </div>

          <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100">
            <span className="text-[10px] uppercase font-bold text-purple-800 block">Reserved Stock</span>
            <span className="font-extrabold text-lg text-purple-700">
              {ledgerLoading ? '...' : (ledgerData?.summary?.totalReserved ?? 0)} Units
            </span>
            <span className="text-[10px] text-purple-600 block mt-0.5">Surgical case reservations</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Quarantine / Expired</span>
            <span className="font-extrabold text-lg text-slate-700">
              {ledgerLoading ? '...' : ((ledgerData?.summary?.totalQuarantined ?? 0) + (ledgerData?.summary?.totalExpired ?? 0))} Units
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Excluded from usable stock</span>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">Below-Par Deficits</span>
            <span className="font-extrabold text-lg text-amber-700">
              {ledgerLoading ? '...' : (
                (ledgerData?.entries || []).reduce((acc: number, e: any) => acc + (e.shortage || 0), 0)
              )} Units
            </span>
            <span className="text-[10px] text-amber-600 block mt-0.5">Formula: max(0, min - usable)</span>
          </div>
        </div>

        {/* Ledger Entries Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Storage Location</th>
                <th className="px-4 py-2.5">Group & Component</th>
                <th className="px-4 py-2.5">Quantity (Units)</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Expiry Date</th>
                <th className="px-4 py-2.5">Par Threshold & Shortage</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ledgerLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading local storage ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : !ledgerData?.entries || ledgerData.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <Boxes className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700 text-xs">No internal storage records registered</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Use "+ Record Internal Stock" to log units currently stored in OT refrigerators.
                    </p>
                  </td>
                </tr>
              ) : (
                ledgerData.entries.map((entry: any) => {
                  const isUsable = entry.effectiveStatus === 'Usable';
                  const isDeficit = entry.shortage > 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{entry.storageLocation}</span>
                        {entry.notes && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">{entry.notes}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-blood-700 mr-1.5">{entry.bloodGroup}</span>
                        <span className="text-slate-600 font-medium">{entry.component}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-slate-900">{entry.quantityUnits}</span>
                          <span className="text-[10px] text-slate-400">
                            ({isUsable ? 'Usable' : 'Unavailable'})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          entry.effectiveStatus === 'Usable' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : entry.effectiveStatus === 'Reserved'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : entry.effectiveStatus === 'Expired'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {entry.effectiveStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <span className={entry.isExpired ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                          {entry.expiryDate || '-'}
                        </span>
                        {entry.isExpired && (
                          <span className="block text-[9px] text-rose-600 font-bold uppercase">Expired</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.minThreshold != null ? (
                          <div>
                            <span className="text-[11px] text-slate-600">
                              Min Par: <strong>{entry.minThreshold}</strong>
                            </span>
                            {isDeficit ? (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Deficit: {entry.shortage} units</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Par Met</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No threshold set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleUpdateQuantity(entry.id, -1, entry.quantityUnits)}
                            disabled={entry.quantityUnits <= 0}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Decrement 1 unit"
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleUpdateQuantity(entry.id, 1, entry.quantityUnits)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer"
                            title="Increment 1 unit"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-1"
                            title="Remove entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clinical Safety & Isolation Protocol Disclaimer */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800 block">
              Clinical Safety & Regional Inventory Isolation Protocol
            </span>
            <p className="leading-relaxed">
              Hospital local storage entries represent on-premise emergency reserves and OT coolers recorded by hospital staff. They are strictly isolated from regional blood bank inventories and never trigger automatic transfusion release. Units marked <strong>Reserved</strong>, <strong>Expired</strong>, or <strong>Quarantined</strong> are strictly excluded from usable stock calculations.
            </p>
          </div>
        </div>

      </div>

      {/* Modal: Record Internal Stock Entry */}
      {showAddEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ThermometerSnowflake className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Record Internal Storage Unit</h3>
              </div>
              <button
                onClick={() => { setShowAddEntryModal(false); setEntryError(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {entryError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{entryError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Storage Location *</label>
                <input
                  type="text"
                  required
                  value={newEntryForm.storageLocation}
                  onChange={(e) => setNewEntryForm({ ...newEntryForm, storageLocation: e.target.value })}
                  placeholder="e.g. OT-1 Emergency Cold Box (Trauma Suite)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-blue-500 font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Blood Group *</label>
                  <select
                    value={newEntryForm.bloodGroup}
                    onChange={(e) => setNewEntryForm({ ...newEntryForm, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 cursor-pointer"
                  >
                    {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Component *</label>
                  <select
                    value={newEntryForm.component}
                    onChange={(e) => setNewEntryForm({ ...newEntryForm, component: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="RBC">Packed Red Cells (RBC)</option>
                    <option value="Plasma">Plasma (FFP)</option>
                    <option value="Platelets">Platelets (PLT)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity (Units) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newEntryForm.quantityUnits}
                    onChange={(e) => setNewEntryForm({ ...newEntryForm, quantityUnits: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-extrabold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status *</label>
                  <select
                    value={newEntryForm.status}
                    onChange={(e) => setNewEntryForm({ ...newEntryForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="Usable">Usable (Active Buffer)</option>
                    <option value="Reserved">Reserved (Surgical Hold)</option>
                    <option value="Quarantined">Quarantined (Pending Review)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newEntryForm.expiryDate}
                    onChange={(e) => setNewEntryForm({ ...newEntryForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Minimum Par Level (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={newEntryForm.minThreshold}
                    onChange={(e) => setNewEntryForm({ ...newEntryForm, minThreshold: Math.max(0, parseInt(e.target.value) || 0) })}
                    placeholder="e.g. 4"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Case Indication</label>
                <input
                  type="text"
                  value={newEntryForm.notes}
                  onChange={(e) => setNewEntryForm({ ...newEntryForm, notes: e.target.value })}
                  placeholder="e.g. Trauma Reserve or PAT-4402 surgery hold"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setShowAddEntryModal(false); setEntryError(null); }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={entrySubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {entrySubmitting ? 'Recording...' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DisclaimerBanner />
    </div>
  );
};

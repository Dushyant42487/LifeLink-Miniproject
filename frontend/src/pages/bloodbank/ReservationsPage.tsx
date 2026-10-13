import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { BloodUnit } from '../../types';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { StatCard } from '../../components/common/StatCard';
import { Lock, Clock, Building2, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw, Send, RotateCcw, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ReservationsPage: React.FC = () => {
  const [reservedUnits, setReservedUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const fetchReservedUnits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/blood-bank/inventory?availability=Reserved');
      if (res.success && res.units) {
        setReservedUnits(res.units);
      } else {
        setError(res.error || 'Failed to fetch reserved blood units.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error fetching reservations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservedUnits();
  }, []);

  const handleIssueUnit = async (unitId: string) => {
    setIssuingId(unitId);
    setActionSuccess(null);
    setError(null);

    const res = await apiFetch(`/blood-bank/inventory/${unitId}/issue`, {
      method: 'POST',
      body: JSON.stringify({ notes: 'Dispatched from reservation desk via cold-chain transport container.' })
    });
    setIssuingId(null);

    if (res.success) {
      setActionSuccess(`Unit ${unitId} successfully issued and dispatched for hospital transfusion!`);
      fetchReservedUnits();
    } else {
      setError(res.error || `Failed to issue unit ${unitId}`);
    }
  };

  const handleReleaseUnit = async (unitId: string) => {
    setReleasingId(unitId);
    setActionSuccess(null);
    setError(null);

    const res = await apiFetch(`/blood-bank/inventory/${unitId}/release`, {
      method: 'POST'
    });
    setReleasingId(null);

    if (res.success) {
      setActionSuccess(`Unit ${unitId} successfully released and returned to available inventory!`);
      fetchReservedUnits();
    } else {
      setError(res.error || `Failed to release reservation for unit ${unitId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 mb-1">
            <Lock className="w-5 h-5" />
            <span className="text-xs font-extrabold uppercase tracking-wider">Hospital Cross-Match Quarantine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Blood Unit Reservations Desk</h1>
          <p className="text-xs text-slate-300 mt-1">
            Track quarantined and cross-matched units locked for specific hospital surgeries and emergency requisitions.
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={fetchReservedUnits}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/blood-bank/hospital-requests"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blood-600 hover:bg-blood-500 shadow-sm flex items-center space-x-1.5"
          >
            <span>Hospital Request Desk</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs flex items-center space-x-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center space-x-2 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Reserved Units"
          value={loading ? '...' : `${reservedUnits.length} Units`}
          subtitle="Cross-matched & locked"
          icon={Lock}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          badge={{ text: 'Quarantined', variant: 'info' }}
        />

        <StatCard
          title="Earliest Reserved Expiry"
          value={reservedUnits.length > 0 ? `${reservedUnits[0]?.daysRemaining} Days` : 'N/A'}
          subtitle={reservedUnits.length > 0 ? reservedUnits[0]?.expiryDate : 'No active reservations'}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          badge={{ text: 'FEFO Monitored', variant: 'warning' }}
        />

        <StatCard
          title="Dispatch Readiness"
          value="100% Ready"
          subtitle="Cold-chain transport boxes prepared"
          icon={ShieldCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Reserved Units Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Active Hospital Unit Allocations</h3>
            <p className="text-xs text-slate-500">Units reserved for hospital cross-match cannot be reassigned until released or dispatched.</p>
          </div>
          <span className="text-xs text-slate-400 font-bold">{reservedUnits.length} Allocated Units</span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300 mb-2" />
            <span>Loading active unit allocations...</span>
          </div>
        ) : reservedUnits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Unit Barcode ID</th>
                  <th className="px-4 py-3">Blood Group & Component</th>
                  <th className="px-4 py-3">Target Hospital / Request</th>
                  <th className="px-4 py-3">Storage Bay</th>
                  <th className="px-4 py-3">Expiry Date (FEFO)</th>
                  <th className="px-4 py-3">Days Remaining</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reservedUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold font-mono text-slate-900">{u.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-blood-700">{u.bloodGroup}</span>
                      <span className="text-slate-500 ml-1.5">{u.component} ({u.volumeMl} mL)</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.reservedForHospital || 'Apollo General Hospital'}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-[11px] font-mono font-bold text-purple-700">{u.reservedForRequest || u.reservedForRequestId || 'Pre-op Lock'}</span>
                        {u.patientReferenceId && (
                          <span className="text-[10px] text-slate-400">• {u.patientReferenceId}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.storageLocation}</td>
                    <td className="px-4 py-3 font-medium">{u.expiryDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (u.daysRemaining ?? 0) <= 3 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {u.daysRemaining} days left
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleReleaseUnit(u.id)}
                        disabled={releasingId === u.id || issuingId === u.id}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 inline-flex items-center space-x-1 transition-all cursor-pointer"
                        title="Release reservation and return unit to available stock"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{releasingId === u.id ? 'Releasing...' : 'Release'}</span>
                      </button>

                      <button
                        onClick={() => handleIssueUnit(u.id)}
                        disabled={issuingId === u.id || releasingId === u.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blood-600 hover:bg-blood-700 shadow-xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{issuingId === u.id ? 'Dispatching...' : 'Issue & Dispatch'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-slate-400 text-xs">
            <Lock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No units currently in reservation quarantine.</p>
            <p className="mt-1">When hospital requests are reserved from the Inventory or Request Desk, they will appear here.</p>
          </div>
        )}
      </div>

      <DisclaimerBanner />
    </div>
  );
};

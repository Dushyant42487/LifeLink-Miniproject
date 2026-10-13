import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { CheckSquare, TestTube, CheckCircle2, XCircle, ShieldAlert, RefreshCw, AlertTriangle, Clock } from 'lucide-react';

export const TestingPage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'Passed' | 'Failed'>('pending');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchRecords = async (filter = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/blood-bank/testing?status=${filter}`);
      if (res.success && res.records) {
        setRecords(res.records);
        if (res.records.length > 0) {
          // Keep current selection if present, else pick first
          setSelectedRecord((prev: any) => {
            const found = prev ? res.records.find((r: any) => r.id === prev.id) : null;
            return found || res.records[0];
          });
        } else {
          setSelectedRecord(null);
        }
      } else {
        setError(res.error || 'Failed to load screening records');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error fetching screening records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(statusFilter);
  }, [statusFilter]);

  const handleUpdateStatus = async (status: 'Passed' | 'Failed' | 'In Testing') => {
    if (!selectedRecord) return;
    setUpdating(true);
    setActionSuccess(null);
    setError(null);

    const isPassed = status === 'Passed';
    const isFailed = status === 'Failed';

    const payload = {
      status,
      hivTest: isPassed ? 'Negative' : isFailed ? 'Positive (Reactive)' : selectedRecord.hivTest,
      hbvTest: isPassed ? 'Negative' : isFailed ? 'Positive (Reactive)' : selectedRecord.hbvTest,
      hcvTest: isPassed ? 'Negative' : isFailed ? 'Positive (Reactive)' : selectedRecord.hcvTest,
      syphilisTest: isPassed ? 'Negative' : isFailed ? 'Positive (Reactive)' : selectedRecord.syphilisTest,
      malariaTest: isPassed ? 'Negative' : isFailed ? 'Positive (Reactive)' : selectedRecord.malariaTest,
      notes: isPassed 
        ? 'All mandatory viral & infectious disease markers confirmed NEGATIVE. Unit cleared for transfusion.'
        : isFailed
        ? 'REACTIVE: Serology confirmation failed. Unit quarantined and marked for biohazard disposal.'
        : 'Screening in progress by authorized laboratory staff.'
    };

    try {
      const res = await apiFetch(`/blood-bank/testing/${selectedRecord.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setActionSuccess(
          isPassed 
            ? `Unit ${selectedRecord.unitId} verified NEGATIVE and cleared into available inventory!`
            : isFailed 
            ? `Unit ${selectedRecord.unitId} marked REACTIVE and quarantined for safe disposal.`
            : `Unit ${selectedRecord.unitId} updated to In Testing.`
        );
        fetchRecords(statusFilter);
      } else {
        setError(res.error || 'Failed to update testing record.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing laboratory screening action.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1">
              <CheckSquare className="w-3 h-3" />
              <span>Mandatory Transfusion Safety Protocol</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Mandatory Infectious Disease Lab Screening
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record mandatory screening results for HIV 1/2, HBV, HCV, Syphilis, and Malaria prior to inventory clearance.
          </p>
        </div>

        <button
          onClick={() => fetchRecords(statusFilter)}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 flex items-center space-x-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs flex items-center space-x-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center space-x-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors ${
            statusFilter === 'pending'
              ? 'border-blood-600 text-blood-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Screening</span>
        </button>

        <button
          onClick={() => setStatusFilter('all')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors ${
            statusFilter === 'all'
              ? 'border-blood-600 text-blood-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TestTube className="w-3.5 h-3.5" />
          <span>All Screening Records</span>
        </button>

        <button
          onClick={() => setStatusFilter('Passed')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors ${
            statusFilter === 'Passed'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Cleared / Passed</span>
        </button>

        <button
          onClick={() => setStatusFilter('Failed')}
          className={`pb-3 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors ${
            statusFilter === 'Failed'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Failed / Quarantined</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Screening Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Quarantined Blood Unit Screening Log</h3>
              <p className="text-xs text-slate-500">Units remain quarantined until all 5 viral markers test Negative.</p>
            </div>
            <span className="text-xs font-bold text-slate-400">{records.length} Units</span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300 mb-2" />
              <span>Loading laboratory screening log...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
              <p className="font-semibold text-slate-700">No units currently in this screening status.</p>
              <p className="mt-1">When new donations are logged, they are placed in quarantine and appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Unit ID</th>
                    <th className="px-4 py-2.5">Group & Comp</th>
                    <th className="px-4 py-2.5">Screening Date</th>
                    <th className="px-4 py-2.5">HIV / HBV / HCV</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {records.map((r) => {
                    const isSelected = selectedRecord?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRecord(r)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blood-50/70 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-bold font-mono text-slate-900">{r.unitId}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-blood-700">{r.bloodGroup}</span>
                          {r.component && <span className="text-slate-500 ml-1">({r.component})</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{r.testingDate}</td>
                        <td className="px-4 py-3 text-[11px]">
                          <span className={`font-semibold ${r.hivTest === 'Positive' ? 'text-rose-600' : 'text-slate-700'}`}>{r.hivTest}</span> / 
                          <span className={`font-semibold ml-1 ${r.hbvTest === 'Positive' ? 'text-rose-600' : 'text-slate-700'}`}>{r.hbvTest}</span> / 
                          <span className={`font-semibold ml-1 ${r.hcvTest === 'Positive' ? 'text-rose-600' : 'text-slate-700'}`}>{r.hcvTest}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Unit Screening Action Panel */}
        {selectedRecord ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lab Technician Panel</span>
              <h3 className="font-bold text-base text-slate-900 font-mono mt-0.5">{selectedRecord.unitId}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Blood Group: <strong className="text-blood-700 font-bold">{selectedRecord.bloodGroup}</strong> 
                {selectedRecord.component && ` • Component: ${selectedRecord.component}`}
              </p>
              {selectedRecord.storageLocation && (
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Bay: {selectedRecord.storageLocation}</p>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-700">Screening Panel Test Markers</h4>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">HIV 1 & 2 Antibody/Antigen:</span>
                <span className={`font-bold ${selectedRecord.hivTest === 'Negative' ? 'text-emerald-700' : selectedRecord.hivTest === 'Pending' ? 'text-amber-700' : 'text-rose-700'}`}>
                  {selectedRecord.hivTest}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Hepatitis B Surface Antigen (HBsAg):</span>
                <span className={`font-bold ${selectedRecord.hbvTest === 'Negative' ? 'text-emerald-700' : selectedRecord.hbvTest === 'Pending' ? 'text-amber-700' : 'text-rose-700'}`}>
                  {selectedRecord.hbvTest}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Hepatitis C Antibody (anti-HCV):</span>
                <span className={`font-bold ${selectedRecord.hcvTest === 'Negative' ? 'text-emerald-700' : selectedRecord.hcvTest === 'Pending' ? 'text-amber-700' : 'text-rose-700'}`}>
                  {selectedRecord.hcvTest}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Syphilis Serology (VDRL/TPHA):</span>
                <span className={`font-bold ${selectedRecord.syphilisTest === 'Negative' ? 'text-emerald-700' : selectedRecord.syphilisTest === 'Pending' ? 'text-amber-700' : 'text-rose-700'}`}>
                  {selectedRecord.syphilisTest}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Malaria Smear Microscopy:</span>
                <span className={`font-bold ${selectedRecord.malariaTest === 'Negative' ? 'text-emerald-700' : selectedRecord.malariaTest === 'Pending' ? 'text-amber-700' : 'text-rose-700'}`}>
                  {selectedRecord.malariaTest}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h4 className="font-bold text-xs text-slate-700">Lab Clearance Actions</h4>
              
              <button
                onClick={() => handleUpdateStatus('Passed')}
                disabled={updating}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{updating ? 'Processing...' : 'Mark All Negative & Clear Unit'}</span>
              </button>

              <button
                onClick={() => handleUpdateStatus('In Testing')}
                disabled={updating}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
              >
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Keep In-Testing (Processing)</span>
              </button>

              <button
                onClick={() => handleUpdateStatus('Failed')}
                disabled={updating}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Mark Reactive & Biohazard Discard</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center text-slate-400 text-xs flex flex-col items-center justify-center">
            <TestTube className="w-8 h-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">Select a Blood Unit</p>
            <p className="mt-1">Click any row in the log to inspect marker results and record clearance actions.</p>
          </div>
        )}

      </div>

      <DisclaimerBanner />
    </div>
  );
};

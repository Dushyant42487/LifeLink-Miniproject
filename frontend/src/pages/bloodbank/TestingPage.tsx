import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { bloodBankApi } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { 
  CheckSquare, 
  TestTube, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Search,
  ArrowRight,
  ShieldCheck,
  Save,
  Flame,
  FileCheck2,
  Calendar,
  Layers,
  Archive
} from 'lucide-react';

type MarkerResult = 'Negative' | 'Positive' | 'Pending';

export const TestingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryUnitId = searchParams.get('unitId');

  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all' | 'Passed' | 'Failed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [lastReleasedUnitId, setLastReleasedUnitId] = useState<string | null>(null);

  // Form state for selected unit's markers
  const [hivTest, setHivTest] = useState<MarkerResult>('Pending');
  const [hbvTest, setHbvTest] = useState<MarkerResult>('Pending');
  const [hcvTest, setHcvTest] = useState<MarkerResult>('Pending');
  const [syphilisTest, setSyphilisTest] = useState<MarkerResult>('Pending');
  const [malariaTest, setMalariaTest] = useState<MarkerResult>('Pending');
  const [testedBy, setTestedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Synchronize form inputs when selected record changes
  useEffect(() => {
    if (selectedRecord) {
      setHivTest(selectedRecord.hivTest || 'Pending');
      setHbvTest(selectedRecord.hbvTest || 'Pending');
      setHcvTest(selectedRecord.hcvTest || 'Pending');
      setSyphilisTest(selectedRecord.syphilisTest || 'Pending');
      setMalariaTest(selectedRecord.malariaTest || 'Pending');
      setTestedBy(selectedRecord.testedBy || 'Lab Specialist');
      setNotes(selectedRecord.notes || '');
      setError(null);
    }
  }, [selectedRecord?.id]);

  const fetchRecords = async (filter = statusFilter, preferredUnitId?: string) => {
    setLoading(true);
    setError(null);
    try {
      // If a specific unitId is passed in the URL, pass it to the API
      const targetId = preferredUnitId || queryUnitId;
      const res = await bloodBankApi.getTestingRecords({
        status: targetId ? 'all' : filter,
        unitId: targetId || undefined
      });

      if (res.success && res.records) {
        setRecords(res.records);
        if (res.records.length > 0) {
          if (targetId) {
            const matched = res.records.find((r: any) => 
              r.unitId.toUpperCase() === targetId.toUpperCase() || r.id.toUpperCase() === targetId.toUpperCase()
            );
            setSelectedRecord(matched || res.records[0]);
          } else {
            setSelectedRecord((prev: any) => {
              const found = prev ? res.records.find((r: any) => r.id === prev.id) : null;
              return found || res.records[0];
            });
          }
        } else {
          // If no records found for specific unitId, fallback to normal filter
          if (targetId) {
            const fallbackRes = await bloodBankApi.getTestingRecords({ status: filter });
            if (fallbackRes.success && fallbackRes.records) {
              setRecords(fallbackRes.records);
              setSelectedRecord(fallbackRes.records[0] || null);
            }
          } else {
            setSelectedRecord(null);
          }
        }
      } else {
        setError(res.error || 'Failed to load laboratory screening records.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error fetching laboratory screening records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(statusFilter, queryUnitId || undefined);
  }, [statusFilter, queryUnitId]);

  // Marker analysis
  const markers = [
    { name: 'HIV 1 & 2', val: hivTest },
    { name: 'Hepatitis B (HBsAg)', val: hbvTest },
    { name: 'Hepatitis C (anti-HCV)', val: hcvTest },
    { name: 'Syphilis (VDRL)', val: syphilisTest },
    { name: 'Malaria', val: malariaTest }
  ];

  const testedCount = markers.filter(m => m.val !== 'Pending').length;
  const hasReactiveMarker = markers.some(m => m.val === 'Positive');
  const allMarkersNegative = markers.every(m => m.val === 'Negative');
  const pendingMarkersList = markers.filter(m => m.val === 'Pending').map(m => m.name);
  const reactiveMarkersList = markers.filter(m => m.val === 'Positive').map(m => m.name);

  // Save intermediate marker results
  const handleSaveResults = async () => {
    if (!selectedRecord) return;
    setUpdating(true);
    setError(null);
    setActionSuccess(null);

    const payload = {
      hivTest,
      hbvTest,
      hcvTest,
      syphilisTest,
      malariaTest,
      testedBy,
      notes: notes || 'Assay results updated by laboratory technician.'
    };

    try {
      const res = await bloodBankApi.updateTestingRecord(selectedRecord.id, payload);
      if (res.success) {
        setActionSuccess(`Screening results saved for unit ${selectedRecord.unitId}. Status: ${res.record.status}`);
        fetchRecords(statusFilter);
      } else {
        setError(res.error || 'Failed to save screening results.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with laboratory screening service.');
    } finally {
      setUpdating(false);
    }
  };

  // Authorize & Release to Available Inventory
  const handleAuthorizeRelease = async () => {
    if (!selectedRecord) return;
    if (!allMarkersNegative) {
      setError(`Cannot release unit: All 5 mandatory infectious disease markers must be tested Negative. Currently pending: ${pendingMarkersList.join(', ')}`);
      return;
    }

    setUpdating(true);
    setError(null);
    setActionSuccess(null);

    const payload = {
      status: 'Passed',
      hivTest: 'Negative',
      hbvTest: 'Negative',
      hcvTest: 'Negative',
      syphilisTest: 'Negative',
      malariaTest: 'Negative',
      testedBy,
      notes: notes || 'All 5 mandatory viral & infectious disease markers confirmed NEGATIVE. Unit authorized and released for clinical transfusion.'
    };

    try {
      const res = await bloodBankApi.updateTestingRecord(selectedRecord.id, payload);
      if (res.success) {
        setLastReleasedUnitId(selectedRecord.unitId);
        setActionSuccess(`Unit ${selectedRecord.unitId} (${selectedRecord.bloodGroup} ${selectedRecord.component || 'RBC'}) verified NEGATIVE and released to Available Inventory!`);
        fetchRecords(statusFilter);
      } else {
        setError(res.error || 'Clinical release rejected by server.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error processing laboratory clearance.');
    } finally {
      setUpdating(false);
    }
  };

  // Mark Reactive & Quarantine for Disposal
  const handleQuarantineDiscard = async () => {
    if (!selectedRecord) return;
    setUpdating(true);
    setError(null);
    setActionSuccess(null);

    const payload = {
      status: 'Failed',
      hivTest,
      hbvTest,
      hcvTest,
      syphilisTest,
      malariaTest,
      testedBy,
      notes: notes || `REACTIVE SCREENING: Unit marked positive for ${reactiveMarkersList.join(', ')}. Placed in biohazard quarantine.`
    };

    try {
      const res = await bloodBankApi.updateTestingRecord(selectedRecord.id, payload);
      if (res.success) {
        setActionSuccess(`Unit ${selectedRecord.unitId} marked REACTIVE and quarantined for safe biohazard disposal.`);
        fetchRecords(statusFilter);
      } else {
        setError(res.error || 'Failed to update quarantine status.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error processing biohazard quarantine.');
    } finally {
      setUpdating(false);
    }
  };

  // Filter records by local search
  const filteredRecords = records.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.unitId?.toLowerCase().includes(q) ||
      r.bloodGroup?.toLowerCase().includes(q) ||
      r.component?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  });

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
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
              WHO / AABB Testing Standard
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Laboratory Infectious Disease Screening & Clearance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record authoritative test results for HIV 1/2, HBV, HCV, Syphilis, and Malaria before releasing blood units to inventory.
          </p>
        </div>

        <button
          onClick={() => fetchRecords(statusFilter)}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 flex items-center space-x-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 text-xs flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          {lastReleasedUnitId && (
            <Link
              to="/blood-bank/requests"
              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-xs transition"
            >
              <span>Allocate in Hospital Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 text-xs flex items-center space-x-2.5 shadow-xs animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Filters and Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex border-b border-transparent space-x-4 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`pb-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'border-blood-600 text-blood-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Quarantine / Pending Screening</span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`pb-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'all'
                ? 'border-blood-600 text-blood-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TestTube className="w-3.5 h-3.5" />
            <span>All Lab Records</span>
          </button>

          <button
            onClick={() => setStatusFilter('Passed')}
            className={`pb-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'Passed'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cleared / Released Stock</span>
          </button>

          <button
            onClick={() => setStatusFilter('Failed')}
            className={`pb-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === 'Failed'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reactive / Discarded</span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Unit ID or Group..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blood-500"
          />
        </div>
      </div>

      {/* Main Grid: Screening Queue & Lab Clearance Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Quarantine Screening Queue (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Laboratory Quarantine Screening Queue</h3>
                <p className="text-xs text-slate-500">Units remain locked in quarantine until all 5 disease assays are confirmed negative.</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredRecords.length} Units
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-xs text-slate-400">
                <RefreshCw className="w-7 h-7 mx-auto animate-spin text-slate-300 mb-2" />
                <span>Loading laboratory units from facility database...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-400 mb-2" />
                <p className="font-bold text-sm text-slate-700">No units in this screening status</p>
                <p className="mt-1 max-w-sm mx-auto text-slate-500">
                  {statusFilter === 'pending'
                    ? 'All blood units in your facility have completed screening or there are currently no unverified collections.'
                    : 'No records match the current status filter.'}
                </p>
                {statusFilter !== 'all' && (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                  >
                    View All Screening Records
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Unit Barcode</th>
                      <th className="px-3 py-2.5">Component & Group</th>
                      <th className="px-3 py-2.5">Collection</th>
                      <th className="px-3 py-2.5">Assay Progress</th>
                      <th className="px-3 py-2.5">Testing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRecords.map((r) => {
                      const isSelected = selectedRecord?.id === r.id || selectedRecord?.unitId === r.unitId;
                      const rMarkers = [r.hivTest, r.hbvTest, r.hcvTest, r.syphilisTest, r.malariaTest];
                      const compTested = rMarkers.filter(m => m !== 'Pending').length;
                      const hasReactive = rMarkers.some(m => m === 'Positive');

                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedRecord(r)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-blood-50/80 font-semibold ring-1 ring-blood-200' 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{r.unitId}</span>
                              {queryUnitId && r.unitId.toUpperCase() === queryUnitId.toUpperCase() && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">Target</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-extrabold text-blood-700">{r.bloodGroup}</span>
                            <span className="text-slate-500 ml-1 font-normal">({r.component || 'RBC'})</span>
                          </td>
                          <td className="px-3 py-3 text-slate-500">
                            {r.collectionDate || 'N/A'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${hasReactive ? 'bg-rose-500' : compTested === 5 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                  style={{ width: `${(compTested / 5) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">{compTested}/5</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
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

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Clinical Rule: Unverified or reactive units cannot be dispatched.</span>
            <span>Total Logged: {filteredRecords.length}</span>
          </div>
        </div>

        {/* Right Column: Lab Technician Testing & Clearance Workstation (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          {selectedRecord ? (
            <div className="space-y-4">
              
              {/* Unit Header Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Unit Inspection</span>
                    <h3 className="font-bold text-base text-slate-900 font-mono tracking-tight">{selectedRecord.unitId}</h3>
                  </div>
                  <StatusBadge status={selectedRecord.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Blood Group:</span>
                    <p className="font-bold text-blood-700 text-sm">{selectedRecord.bloodGroup} {selectedRecord.component && `(${selectedRecord.component})`}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Storage Bay:</span>
                    <p className="font-semibold text-slate-700">{selectedRecord.storageLocation || 'Quarantine Storage'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Collection Date:</span>
                    <p className="font-medium text-slate-700">{selectedRecord.collectionDate || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Expiry Shelf-Life:</span>
                    <p className="font-medium text-slate-700">{selectedRecord.expiryDate ? `${selectedRecord.expiryDate} (${selectedRecord.daysRemaining ?? 'N/A'}d)` : 'Standard Shelf'}</p>
                  </div>
                </div>
              </div>

              {/* Individual Disease Marker Selectors */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Mandatory Infectious Disease Assays
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {testedCount} of 5 recorded
                  </span>
                </div>

                {/* Marker 1: HIV */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-slate-900">1. HIV 1/2 Antibody & p24 Antigen</span>
                    <p className="text-[10px] text-slate-400">4th Gen Chemiluminescence / ELISA</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Negative', 'Pending', 'Positive'] as MarkerResult[]).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setHivTest(res)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          hivTest === res
                            ? res === 'Negative'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : res === 'Positive'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {res === 'Positive' ? 'Reactive' : res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marker 2: HBV */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-slate-900">2. Hepatitis B Surface Antigen (HBsAg)</span>
                    <p className="text-[10px] text-slate-400">Chemiluminescent Microparticle Assay</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Negative', 'Pending', 'Positive'] as MarkerResult[]).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setHbvTest(res)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          hbvTest === res
                            ? res === 'Negative'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : res === 'Positive'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {res === 'Positive' ? 'Reactive' : res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marker 3: HCV */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-slate-900">3. Hepatitis C Antibody (anti-HCV)</span>
                    <p className="text-[10px] text-slate-400">Recombinant Antigens Serology</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Negative', 'Pending', 'Positive'] as MarkerResult[]).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setHcvTest(res)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          hcvTest === res
                            ? res === 'Negative'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : res === 'Positive'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {res === 'Positive' ? 'Reactive' : res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marker 4: Syphilis */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-slate-900">4. Syphilis Serology (VDRL / TPHA)</span>
                    <p className="text-[10px] text-slate-400">Treponema Pallidum Hemagglutination</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Negative', 'Pending', 'Positive'] as MarkerResult[]).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setSyphilisTest(res)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          syphilisTest === res
                            ? res === 'Negative'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : res === 'Positive'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {res === 'Positive' ? 'Reactive' : res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Marker 5: Malaria */}
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-slate-900">5. Malaria Microscopy / Antigen</span>
                    <p className="text-[10px] text-slate-400">Peripheral Blood Smear & Rapid Antigen</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['Negative', 'Pending', 'Positive'] as MarkerResult[]).map(res => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setMalariaTest(res)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          malariaTest === res
                            ? res === 'Negative'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : res === 'Positive'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {res === 'Positive' ? 'Reactive' : res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lab Technician & Audit Details */}
              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Testing Analyst / Specialist</label>
                  <input
                    type="text"
                    value={testedBy}
                    onChange={(e) => setTestedBy(e.target.value)}
                    placeholder="Technician Name"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Laboratory Findings & Audit Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional assay notes or instrument run ID..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Decision Callout Card */}
              {hasReactiveMarker ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">REACTIVE BIOHAZARD HAZARD</strong>
                    <span>One or more markers tested positive ({reactiveMarkersList.join(', ')}). Clinical release is blocked. Unit must be discarded.</span>
                  </div>
                </div>
              ) : allMarkersNegative ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">ALL 5 MARKERS CONFIRMED NEGATIVE</strong>
                    <span>Unit satisfies mandatory infectious disease safety requirements and is eligible for clinical inventory release.</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">SCREENING IN PROGRESS</strong>
                    <span>{pendingMarkersList.length} marker(s) pending ({pendingMarkersList.join(', ')}). Unit cannot be released until all tests are complete.</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                
                {/* Save Intermediate Results */}
                <button
                  type="button"
                  onClick={handleSaveResults}
                  disabled={updating}
                  className="w-full py-2 px-3 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{updating ? 'Saving...' : 'Save Screening Results'}</span>
                </button>

                {/* Authorize & Release (Only enabled if all negative) */}
                <button
                  type="button"
                  onClick={handleAuthorizeRelease}
                  disabled={updating || !allMarkersNegative}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                    allMarkersNegative
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={allMarkersNegative ? 'Authorize and release unit to inventory' : 'All 5 markers must be confirmed Negative before release'}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>{updating ? 'Authorizing Release...' : 'Authorize & Release Unit to Available Stock'}</span>
                </button>

                {/* Mark Reactive & Biohazard Discard */}
                {hasReactiveMarker && (
                  <button
                    type="button"
                    onClick={handleQuarantineDiscard}
                    disabled={updating}
                    className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{updating ? 'Processing Quarantine...' : 'Quarantine for Biohazard Disposal'}</span>
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
              <TestTube className="w-9 h-9 text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Select a Unit to Screen</p>
              <p className="mt-1 max-w-xs text-slate-400">Click any quarantined unit from the queue to record laboratory assay findings.</p>
            </div>
          )}
        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};

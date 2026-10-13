import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { hospitalApi } from '../../services/api';
import { BloodGroup, BloodComponent, BloodUnit } from '../../types';
import { Search, MapPin, Phone, Landmark, ShieldCheck, ArrowRight, Calendar, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';

export const SearchBloodPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialGroup = (searchParams.get('bloodGroup') as BloodGroup) || 'all';
  const initialComponent = (searchParams.get('component') as BloodComponent) || 'all';
  const initialUrgency = searchParams.get('urgency') || 'Routine';

  const [bloodGroup, setBloodGroup] = useState<string>(initialGroup);
  const [component, setComponent] = useState<string>(initialComponent);
  const [urgency, setUrgency] = useState<string>(initialUrgency);
  const [results, setResults] = useState<any[]>([]);
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state to URL search parameters
  const updateFilter = (field: 'bloodGroup' | 'component' | 'urgency', val: string) => {
    if (field === 'bloodGroup') setBloodGroup(val);
    if (field === 'component') setComponent(val);
    if (field === 'urgency') setUrgency(val);

    const nextParams = new URLSearchParams(searchParams);
    if (val === 'all' || (field === 'urgency' && val === 'Routine')) {
      nextParams.delete(field);
    } else {
      nextParams.set(field, val);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const performSearch = async () => {
    setLoading(true);
    setError(null);

    const res = await hospitalApi.searchBlood({
      bloodGroup,
      component,
      urgency
    });

    if (res.success) {
      setResults(res.bloodBanks || []);
      setUnits(res.units || []);
      setTotalAvailable(res.totalAvailableUnits || 0);
      setError(null);
    } else {
      setResults([]);
      setUnits([]);
      setTotalAvailable(0);
      setError(res.error || 'Failed to query regional inventory.');
    }
    setLoading(false);
  };

  useEffect(() => {
    performSearch();
  }, [bloodGroup, component, urgency]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleResetFilters = () => {
    setBloodGroup('all');
    setComponent('all');
    setUrgency('Routine');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            Regional Network Inventory
          </span>
          <span className="text-slate-400 text-xs">•</span>
          <span className="text-xs text-slate-500 font-medium">Verified Blood Bank Network</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
          Search Regional Blood Availability
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Locate available blood units across connected regional blood centers in real-time. Units reserved for your surgical procedures appear under hospital active requests.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => updateFilter('bloodGroup', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-blood-500 font-medium text-slate-900 cursor-pointer"
            >
              <option value="all">All Blood Groups (All 8 Groups)</option>
              {['O-', 'O+', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Blood Component</label>
            <select
              value={component}
              onChange={(e) => updateFilter('component', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-blood-500 font-medium text-slate-900 cursor-pointer"
            >
              <option value="all">All Components (RBC, Plasma, Platelets)</option>
              <option value="RBC">Packed Red Blood Cells (RBC)</option>
              <option value="Plasma">Fresh Frozen Plasma (Plasma)</option>
              <option value="Platelets">Platelet Concentrate (Platelets)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Urgency Level</label>
            <select
              value={urgency}
              onChange={(e) => updateFilter('urgency', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-blood-500 font-medium text-slate-900 cursor-pointer"
            >
              <option value="Routine">Routine Request</option>
              <option value="Urgent">Urgent Procedure</option>
              <option value="Emergency">EMERGENCY (Trauma / Critical)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={performSearch}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry Search
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div>
          {loading ? (
            <span className="text-slate-500 font-medium flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
              <span>Querying regional blood banks in real time...</span>
            </span>
          ) : error ? (
            <span className="text-rose-600 font-semibold">Inventory inquiry failed — see message above</span>
          ) : (
            <span>
              Found <strong className="text-slate-900 font-extrabold">{totalAvailable} Available Units</strong> across {results.length} connected blood centers
            </span>
          )}
        </div>

        <button
          onClick={performSearch}
          disabled={loading}
          className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center space-x-1 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Available Blood Units Table (Earliest Expiry First) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs border border-rose-100">
              {bloodGroup === 'all' ? 'ALL' : bloodGroup}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {bloodGroup === 'all' ? 'All Verified Available Blood Units' : `Available Blood Units for Group: ${bloodGroup}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                Units listed in chronological First-Expiry First-Out (FEFO) clinical priority order.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[11px]">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Earliest Expiry First (FEFO)</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-semibold">
            <div className="w-5 h-5 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <span>Loading matching blood units from regional banks...</span>
          </div>
        ) : error ? (
          <div className="py-10 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-slate-800">Unable to load blood units</p>
            <p className="text-[11px] text-slate-500">An error occurred while connecting to the regional blood repository.</p>
            <button
              onClick={performSearch}
              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : units.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">No available units found for the selected criteria</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              There are currently no cleared units matching group <strong className="text-slate-700">{bloodGroup}</strong> and component <strong className="text-slate-700">{component}</strong> in the regional inventory.
            </p>
            <div className="pt-2 flex justify-center space-x-2">
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Reset Filters to All
              </button>
              <Link
                to={`/hospital/requests/new?bloodGroup=${bloodGroup !== 'all' ? bloodGroup : 'O+'}&component=${component !== 'all' ? component : 'RBC'}&urgency=${urgency}`}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blood-600 hover:bg-blood-700 text-white transition-colors"
              >
                Create Request Anyway
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-xl">Sample / Unit ID</th>
                  <th scope="col" className="px-4 py-3">Blood Group</th>
                  <th scope="col" className="px-4 py-3">Component</th>
                  <th scope="col" className="px-4 py-3">Expiry Date</th>
                  <th scope="col" className="px-4 py-3">Holding Blood Bank</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 rounded-r-xl text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((unit, index) => (
                  <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span>{unit.id}</span>
                        {index === 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Earliest Expiry
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-rose-50 text-rose-700 border border-rose-100">
                        {unit.bloodGroup}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {unit.component} ({unit.volumeMl} mL)
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {formatDate(unit.expiryDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {unit.bloodBankName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={unit.availability} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {unit.availability === 'Available' ? (
                        <Link
                          to={`/hospital/requests/new?unitId=${encodeURIComponent(unit.id)}&bloodGroup=${encodeURIComponent(unit.bloodGroup)}&component=${encodeURIComponent(unit.component)}&bloodBankId=${encodeURIComponent(unit.bloodBankId)}&urgency=${encodeURIComponent(urgency)}&returnBloodGroup=${encodeURIComponent(bloodGroup)}&returnComponent=${encodeURIComponent(component)}&returnUrgency=${encodeURIComponent(urgency)}`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blood-600 hover:bg-blood-500 shadow-sm transition-all cursor-pointer"
                          title={`Initiate requisition prefilled with unit ${unit.id}`}
                        >
                          <span>Requisition Unit</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium italic">
                          Unavailable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Blood Bank Cards */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Regional Blood Banks Inventory Breakdown</h3>
        {results.map(bank => (
          <div key={bank.bloodBankId} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">{bank.bloodBankName}</h3>
                  <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{bank.address} • ~{bank.distanceKm} km away</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <a 
                  href={`tel:${bank.emergencyPhone}`}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Call Emergency Desk</span>
                </a>

                <Link
                  to={`/hospital/requests/new?bloodBankId=${bank.bloodBankId}&bloodGroup=${bloodGroup !== 'all' ? bloodGroup : 'O+'}&component=${component !== 'all' ? component : 'RBC'}&urgency=${urgency}`}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blood-600 hover:bg-blood-700 shadow-sm transition-all flex items-center space-x-1"
                >
                  <span>Request Blood</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Component Breakdown Pills */}
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-slate-500 block">Total Verified Units</span>
                <span className="text-lg font-extrabold text-slate-900">{bank.availableUnitsCount} Units</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-slate-500 block">RBC Available</span>
                <span className="text-lg font-extrabold text-blood-700">{bank.rbcCount} Units</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-slate-500 block">Plasma Available</span>
                <span className="text-lg font-extrabold text-amber-700">{bank.plasmaCount} Units</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-slate-500 block">Platelets Available</span>
                <span className="text-lg font-extrabold text-purple-700">{bank.plateletsCount} Units</span>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};

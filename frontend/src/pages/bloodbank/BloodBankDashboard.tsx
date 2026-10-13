import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import { useAuth } from '../../contexts/AuthContext';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { Package, Clock, AlertTriangle, FileText, CheckSquare, BrainCircuit, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

export const BloodBankDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/blood-bank/dashboard');
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to load dashboard metrics');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error fetching dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = data?.metrics || {
    totalUnits: 0,
    rbcAvailable: 0,
    plasmaAvailable: 0,
    plateletsAvailable: 0,
    expiringSoon: 0,
    expiredUnits: 0,
    reservedUnits: 0,
    criticalGroupsCount: 0,
    criticalGroups: [],
    pendingTesting: 0,
    pendingRequests: 0,
    emergencyRequests: 0,
    todayCollectionsCount: 0
  };

  // Dynamically map chart data from authoritative inventorySummary matrix
  const chartData = data?.inventorySummary
    ? Object.entries(data.inventorySummary).map(([name, item]: [string, any]) => ({
        name,
        rbc: item.rbc || 0,
        plasma: item.plasma || 0,
        platelets: item.platelets || 0
      }))
    : [
        { name: 'O-', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'O+', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'A+', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'A-', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'B+', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'B-', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'AB+', rbc: 0, plasma: 0, platelets: 0 },
        { name: 'AB-', rbc: 0, plasma: 0, platelets: 0 }
      ];

  const pieData = [
    { name: 'RBC', value: metrics.rbcAvailable, color: '#DC2626' },
    { name: 'Plasma', value: metrics.plasmaAvailable, color: '#D97706' },
    { name: 'Platelets', value: metrics.plateletsAvailable, color: '#9333EA' },
  ];

  const bankName = data?.bankProfile?.bloodBankName || (user as any)?.bloodBankName || user?.name || 'Regional Blood Center';
  const regId = data?.bankProfile?.registrationId || (user as any)?.registrationId || 'VERIFIED';

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blood-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blood-400">Central Operational Hub</span>
          <h1 className="text-2xl font-extrabold text-white mt-1">{bankName}</h1>
          <p className="text-xs text-slate-300 mt-1">Registration ID: {regId} • <strong className="text-emerald-400 font-bold">Lab Operations Online</strong></p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <Link
            to="/blood-bank/inventory"
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center space-x-1.5"
          >
            <Package className="w-4 h-4" />
            <span>Manage Units</span>
          </Link>

          <Link
            to="/blood-bank/ai-insights"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/30 transition-all flex items-center space-x-1.5"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>AI Intelligence</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadDashboard} className="font-bold underline text-rose-900 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Critical Shortage Warning Banner */}
      {metrics.criticalGroupsCount > 0 && (
        <div className="bg-rose-500 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 shrink-0 text-white animate-bounce" />
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider">CRITICAL DEFICIT DETECTED: {metrics.criticalGroups.join(', ')}</h3>
              <p className="text-xs text-rose-100 mt-0.5">
                RBC stock for {metrics.criticalGroups.join(', ')} is under critical reserve threshold (&le; 2 units). Recommend targeted donor outreach.
              </p>
            </div>
          </div>

          <Link
            to="/blood-bank/ai-insights"
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-rose-50 shadow-md transition-all shrink-0"
          >
            Deploy AI Campaign
          </Link>
        </div>
      )}

      {/* 4 Primary Operational Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Available Stock"
          value={loading ? '...' : `${metrics.totalUnits} Units`}
          subtitle="Passed lab screening"
          icon={Package}
          iconBg="bg-blood-50"
          iconColor="text-blood-600"
        />

        <StatCard
          title="Expiring Soon (3d)"
          value={loading ? '...' : `${metrics.expiringSoon} Units`}
          subtitle="Requires priority dispatch"
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          badge={{ text: 'Action Needed', variant: 'warning' }}
        />

        <StatCard
          title="Pending Hospital Requests"
          value={loading ? '...' : `${metrics.pendingRequests}`}
          subtitle={`${metrics.emergencyRequests} Emergency Requisition(s)`}
          icon={FileText}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          badge={{ text: `${metrics.emergencyRequests} Emergency`, variant: 'danger' }}
        />

        <StatCard
          title="Lab Screening Quarantine"
          value={loading ? '...' : `${metrics.pendingTesting} Units`}
          subtitle="Mandatory disease testing"
          icon={CheckSquare}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
      </div>

      {/* Operational Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bar Chart: Inventory by Blood Group */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Inventory Distribution by Blood Group</h3>
              <p className="text-xs text-slate-500">Authoritative unit counts across RBC, Plasma, and Platelet components.</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Bar dataKey="rbc" fill="#DC2626" name="RBC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="plasma" fill="#D97706" name="Plasma" radius={[4, 4, 0, 0]} />
                <Bar dataKey="platelets" fill="#9333EA" name="Platelets" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Component Share */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">Component Share Ratio</h3>
            <p className="text-xs text-slate-500 mb-4">Ratio of tested available inventory.</p>

            <div className="h-48 w-full flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 text-xs pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                <span>Packed Red Blood Cells (RBC)</span>
              </span>
              <span className="font-bold">{metrics.rbcAvailable} u</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                <span>Fresh Frozen Plasma</span>
              </span>
              <span className="font-bold">{metrics.plasmaAvailable} u</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <span>Platelet Concentrate</span>
              </span>
              <span className="font-bold">{metrics.plateletsAvailable} u</span>
            </div>
          </div>
        </div>

      </div>

      <DisclaimerBanner />
    </div>
  );
};

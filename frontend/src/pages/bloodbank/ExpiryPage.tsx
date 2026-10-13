import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { Clock, AlertTriangle, Lightbulb, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ExpiryPage: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchExpiry = async () => {
      const res = await apiFetch('/blood-bank/expiry');
      if (res.success) setData(res);
    };
    fetchExpiry();
  }, []);

  const summary = data?.summary || { expiringTodayCount: 0, expiring3DaysCount: 4, expiring7DaysCount: 6, expiredCount: 1 };
  const expiringWithin3Days = data?.expiringWithin3Days || [];
  const recommendations = data?.recommendations || [];

  return (
    <div className="space-y-6">
      
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Shelf-Life & Expiry Risk Monitoring</h1>
        <p className="text-xs text-slate-500 mt-1">
          Proactive monitoring for short-shelf-life Platelets and RBCs to prevent blood component wastage.
        </p>
      </div>

      {/* 4 Risk Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Expiring Today</span>
          <p className="text-3xl font-black mt-1 text-rose-700">{summary.expiringTodayCount} Units</p>
          <span className="text-[11px] text-rose-600">Requires immediate dispatch</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Expiring in 3 Days</span>
          <p className="text-3xl font-black mt-1 text-amber-700">{summary.expiring3DaysCount} Units</p>
          <span className="text-[11px] text-amber-600">High expiry risk</span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Expiring in 7 Days</span>
          <p className="text-3xl font-black mt-1 text-blue-700">{summary.expiring7DaysCount} Units</p>
          <span className="text-[11px] text-blue-600">Standard rotation window</span>
        </div>

        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-slate-700">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Expired & Discarded</span>
          <p className="text-3xl font-black mt-1 text-slate-900">{summary.expiredCount} Units</p>
          <span className="text-[11px] text-slate-500">Quarantined for disposal</span>
        </div>
      </div>

      {/* Smart Recommendations Engine */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-sm text-slate-900">AI & Clinical Inventory Optimization Recommendations</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-xs text-slate-900">{rec.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{rec.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Units at High Expiry Risk */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Units Expiring Within 3 Days</h3>
          <Link to="/blood-bank/ai-insights" className="text-xs text-purple-600 font-bold hover:underline flex items-center space-x-1">
            <span>View AI Wastage Model</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Unit ID</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Collection Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Storage Bay</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {expiringWithin3Days.map((u: any) => (
                <tr key={u.id} className="hover:bg-amber-50/50">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{u.id}</td>
                  <td className="px-4 py-3.5 font-extrabold text-blood-700">{u.bloodGroup}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{u.component}</td>
                  <td className="px-4 py-3.5 text-slate-500">{u.collectionDate}</td>
                  <td className="px-4 py-3.5 font-bold text-amber-700">{u.expiryDate}</td>
                  <td className="px-4 py-3.5 text-slate-500">{u.storageLocation}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      Prioritize Issue
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
};

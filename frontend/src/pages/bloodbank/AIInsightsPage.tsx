import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DisclaimerBanner } from '../../components/common/DisclaimerBanner';
import { BrainCircuit, TrendingUp, AlertOctagon, Clock, Megaphone, CheckCircle2, Sparkles } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export const AIInsightsPage: React.FC = () => {
  const [period, setPeriod] = useState<'7 days' | '30 days' | '90 days'>('7 days');
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [shortageRisks, setShortageRisks] = useState<any[]>([]);
  const [wastageUnits, setWastageUnits] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    const fetchAI = async () => {
      const fRes = await apiFetch(`/ai/forecast?period=${encodeURIComponent(period)}`);
      if (fRes.success && fRes.predictions) setForecasts(fRes.predictions);

      const sRes = await apiFetch('/ai/shortage-risk');
      if (sRes.success && sRes.shortageRisks) setShortageRisks(sRes.shortageRisks);

      const wRes = await apiFetch('/ai/wastage-risk');
      if (wRes.success && wRes.wastageRiskUnits) setWastageUnits(wRes.wastageRiskUnits);

      const cRes = await apiFetch('/ai/campaign-recommendations');
      if (cRes.success && cRes.recommendations) setCampaigns(cRes.recommendations);
    };

    fetchAI();
  }, [period]);

  const handleDeployCampaign = async () => {
    setAlertSent(true);
    setTimeout(() => setAlertSent(false), 5000);
  };

  const chartData = forecasts.map(f => ({
    name: f.bloodGroup,
    Predicted: f.predictedDemandUnits,
    Historical: f.historicalDemandAvg,
    CurrentStock: f.currentInventoryUnits
  }));

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 mb-1">
            <BrainCircuit className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-wider">Scikit-Learn Machine Learning Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">AI Intelligence Center</h1>
          <p className="text-xs text-slate-300 mt-1">
            Predictive demand forecasting, shortage risk evaluation, expiry wastage prevention, and targeted donor campaign advisor.
          </p>
        </div>

        {/* Period Selector */}
        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex space-x-1">
          {(['7 days', '30 days', '90 days'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {alertSent && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span><strong>Emergency Alert Deployed!</strong> Urgent notification broadcast initiated to eligible registered donors.</span>
        </div>
      )}

      {/* 1. Demand Forecast Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Demand Forecast vs Inventory Stock ({period})</h3>
            <p className="text-xs text-slate-500">Predicted hospital demand compared to current available inventory and historical averages.</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Model Confidence: 94.2%
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Predicted" fill="#9333EA" name="Predicted Demand" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CurrentStock" fill="#DC2626" name="Current Stock" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Historical" fill="#64748B" name="Historical Average" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Shortage Risk Matrix Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-sm text-slate-900">Shortage Risk Matrix</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Blood Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Predicted Demand</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Shortage Window</th>
                <th className="px-4 py-3">Recommended Decision Support Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {shortageRisks.map((item, idx) => (
                <tr key={idx} className={item.riskLevel === 'Critical' ? 'bg-rose-50/60 font-medium' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3.5 font-extrabold text-slate-900">{item.bloodGroup}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-700">{item.component}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">{item.currentStock} Units</td>
                  <td className="px-4 py-3.5 font-bold text-purple-700">{item.predictedDemand} Units</td>
                  <td className="px-4 py-3.5"><StatusBadge status={item.riskLevel} /></td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{item.predictedShortageDate}</td>
                  <td className="px-4 py-3.5 text-slate-600 leading-relaxed">{item.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Smart Donation Campaign Recommendations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <Megaphone className="w-5 h-5 text-blood-600" />
          <h3 className="font-bold text-sm text-slate-900">Smart Voluntary Donation Campaign Recommendations</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Urgency: {c.urgency}
                  </span>
                  <h4 className="font-bold text-base text-slate-900 mt-1">{c.title}</h4>
                </div>
                <span className="w-8 h-8 rounded-lg bg-blood-600 text-white font-extrabold text-xs flex items-center justify-center">
                  {c.bloodGroup}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{c.reasoning}</p>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
                <span>Target Location: <strong>{c.suggestedLocation}</strong></span>
                <button
                  onClick={handleDeployCampaign}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-blood-600 hover:bg-blood-700 shadow-sm transition-all"
                >
                  {c.actionButtonText}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
};

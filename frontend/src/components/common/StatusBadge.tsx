import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'urgency' | 'risk' | 'verification';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status' }) => {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  const s = status.toLowerCase();

  if (s === 'available' || s === 'passed' || s === 'verified' || s === 'fulfilled' || s === 'received' || s === 'low') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'reserved' || s === 'allocated' || s === 'in testing' || s === 'under review' || s === 'sample submitted' || s === 'urgent' || s === 'medium') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (s === 'prepared for dispatch' || s === 'prepared' || s === 'quarantined' || s === 'pending' || s === 'pending verification') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (s === 'expired' || s === 'failed' || s === 'rejected' || s === 'emergency' || s === 'critical' || s === 'high' || s === 'discrepancy reported') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (s === 'issued' || s === 'dispatched' || s === 'in transit' || s === 'partially fulfilled') {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75"></span>
      {status}
    </span>
  );
};

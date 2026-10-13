import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { AppNotification } from '../../types';
import { Bell, AlertTriangle, CheckCircle2, Info, Clock } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const fetchNotifs = async () => {
      const res = await apiFetch('/public/notifications');
      if (res.success && res.notifications) {
        setNotifications(res.notifications);
      }
    };
    fetchNotifs();
  }, []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notification Center</h1>
        <p className="text-xs text-slate-500 mt-1">Real-time alerts for emergency blood requirements, AI shortage warnings, and request updates.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {notifications.map((n) => (
          <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              n.type === 'emergency' || n.priority === 'urgent'
                ? 'bg-rose-100 text-rose-600'
                : n.type === 'ai_alert'
                ? 'bg-purple-100 text-purple-600'
                : 'bg-blue-100 text-blue-600'
            }`}>
              {n.type === 'emergency' ? <AlertTriangle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>

            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-xs text-slate-900">{n.title}</h4>
                <span className="text-[10px] text-slate-400">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

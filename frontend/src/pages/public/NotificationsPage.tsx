import React from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, AlertTriangle, CheckCircle2, Clock, CheckCheck, Compass, Sparkles } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, connected, loading } = useNotifications();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notification Center</h1>
            <span 
              className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} 
              title={connected ? 'Real-Time Connected' : 'Syncing'} 
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verified alerts for blood requirements, donor verification decisions, and request updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-rose-600 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading live alerts...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Bell className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-sm text-slate-700">No notifications yet</p>
            <p className="text-xs text-slate-400 mt-1">Operational updates and verification alerts will appear here in real-time.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              onClick={() => {
                if (!n.read) markAsRead(n.id);
              }}
              className={`p-4 transition-colors flex items-start space-x-3 cursor-pointer ${
                n.read ? 'hover:bg-slate-50 bg-white' : 'bg-rose-50/40 hover:bg-rose-50/70 font-medium'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                n.type === 'emergency' || n.priority === 'urgent'
                  ? 'bg-rose-100 text-rose-600'
                  : n.type === 'verification'
                  ? 'bg-emerald-100 text-emerald-700'
                  : n.type === 'ai_alert'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {n.type === 'emergency' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : n.type === 'verification' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : n.type === 'camp' ? (
                  <Compass className="w-5 h-5" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-xs text-slate-900 truncate">{n.title}</h4>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

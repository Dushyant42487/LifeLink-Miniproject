import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  X, 
  ArrowRight, 
  Clock, 
  Activity, 
  CheckCircle2 
} from 'lucide-react';

export const EmergencyAlertBanner: React.FC = () => {
  const { 
    activeAlertBanner, 
    dismissActiveAlert, 
    soundEnabled, 
    setSoundEnabled 
  } = useNotifications();
  const navigate = useNavigate();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);

  useEffect(() => {
    if (!activeAlertBanner) {
      setSecondsRemaining(5);
      return;
    }

    setSecondsRemaining(5);
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAlertBanner]);

  if (!activeAlertBanner) return null;

  const titleLower = (activeAlertBanner.title || '').toLowerCase();
  const isEmergency = activeAlertBanner.type === 'emergency' || 
                      activeAlertBanner.priority === 'urgent' || 
                      titleLower.includes('emergency');

  const bgGradient = isEmergency 
    ? 'from-red-600 via-rose-600 to-red-700 border-red-500 shadow-red-900/30' 
    : 'from-amber-600 via-orange-600 to-amber-700 border-amber-500 shadow-orange-900/30';

  const handleAction = () => {
    dismissActiveAlert();
    if (activeAlertBanner.link) {
      navigate(activeAlertBanner.link);
    } else {
      navigate('/blood-bank/requests');
    }
  };

  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4 animate-in fade-in slide-in-from-top-4 duration-300`}
      role="alert"
      aria-live="assertive"
    >
      <div className={`bg-gradient-to-r ${bgGradient} text-white rounded-xl shadow-2xl border p-4 backdrop-blur-md`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          
          {/* Alert Icon & Heading */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isEmergency ? 'bg-red-800/80 animate-pulse' : 'bg-amber-800/80'}`}>
              {isEmergency ? (
                <ShieldAlert className="w-6 h-6 text-white" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {isEmergency ? 'CRITICAL EMERGENCY' : 'HIGH PRIORITY URGENT'}
                </span>
                {secondsRemaining > 0 && (
                  <span className="flex items-center gap-1 text-xs text-white/90 bg-black/20 px-2 py-0.5 rounded-full">
                    <Activity className="w-3 h-3 animate-spin text-yellow-300" />
                    Audio playing ({secondsRemaining}s)
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base md:text-lg text-white mt-0.5">
                {activeAlertBanner.title}
              </h3>
              <p className="text-sm text-white/90 line-clamp-2 mt-0.5">
                {activeAlertBanner.message}
              </p>
            </div>
          </div>

          {/* Controls & Navigation */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/20">
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Mute</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-white/70" />
                  <span className="hidden sm:inline">Unmute</span>
                </>
              )}
            </button>

            {/* View Requisition CTA */}
            <button
              onClick={handleAction}
              className="px-4 py-2 rounded-lg bg-white text-gray-900 font-bold text-sm shadow hover:bg-gray-100 transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>View Requisition</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Dismiss Button */}
            <button
              onClick={dismissActiveAlert}
              title="Dismiss alert"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

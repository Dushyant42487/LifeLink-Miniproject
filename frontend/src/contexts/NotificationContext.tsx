import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppNotification } from '../types';
import { notificationsApi, getAuthToken } from '../services/api';
import { useAuth } from './AuthContext';
import { audioAlertManager, AlertUrgency } from '../utils/audioAlert';

export interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  connected: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  activeAlertBanner: AppNotification | null;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  testSound: (urgency: AlertUrgency) => void;
  dismissActiveAlert: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => audioAlertManager.isEnabled());
  const [soundVolume, setSoundVolumeState] = useState<number>(() => audioAlertManager.getVolume());
  const [activeAlertBanner, setActiveAlertBanner] = useState<AppNotification | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Update unread count based on notifications list
  const updateCounts = (notifs: AppNotification[]) => {
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read).length);
  };

  // Fetch full notification list and check for missed urgent/emergency audio triggers
  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await notificationsApi.getNotifications();
      if (res.success && Array.isArray(res.notifications) && isMountedRef.current) {
        updateCounts(res.notifications);

        // Visibility-change / polling fallback for blood bank staff
        if (user.role === 'blood_bank') {
          const now = Date.now();
          const recentAlert = res.notifications.find((n: AppNotification) => {
            if (n.read) return false;
            const notifTime = n.createdAt ? new Date(n.createdAt).getTime() : now;
            // Within last 2 minutes
            if (now - notifTime > 120000) return false;
            const urgencyVal = n.data?.urgency;
            const isEmerg = n.type === 'emergency' || n.priority === 'urgent' || urgencyVal === 'Emergency';
            const isUrg = (n.priority === 'high' && n.type !== 'emergency') || urgencyVal === 'Urgent';
            return (isEmerg || isUrg) && !audioAlertManager.hasPlayed(n.id);
          });

          if (recentAlert) {
            const urgencyVal = recentAlert.data?.urgency;
            const isEmerg = recentAlert.type === 'emergency' || recentAlert.priority === 'urgent' || urgencyVal === 'Emergency';
            audioAlertManager.playAlert(isEmerg ? 'Emergency' : 'Urgent', recentAlert.id);
            setActiveAlertBanner(recentAlert);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic local update
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      setUnreadCount(updated.filter(n => !n.read).length);
      return updated;
    });

    // Notify other tabs
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'MARK_READ', id });
    }

    try {
      await notificationsApi.markRead(id);
    } catch (err) {
      console.warn('Error marking notification as read on server:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic local update
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      setUnreadCount(0);
      return updated;
    });

    // Notify other tabs
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'MARK_ALL_READ' });
    }

    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.warn('Error marking all notifications as read on server:', err);
    }
  }, []);

  // Multi-tab synchronization via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    try {
      const channel = new BroadcastChannel('lifelink_notifications_sync');
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || !isMountedRef.current) return;

        if (data.type === 'MARK_READ' && data.id) {
          setNotifications(prev => {
            const updated = prev.map(n => n.id === data.id ? { ...n, read: true } : n);
            setUnreadCount(updated.filter(n => !n.read).length);
            return updated;
          });
        } else if (data.type === 'MARK_ALL_READ') {
          setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, read: true }));
            setUnreadCount(0);
            return updated;
          });
        } else if (data.type === 'NEW_NOTIFICATION' && data.notification) {
          setNotifications(prev => {
            if (prev.some(n => n.id === data.notification.id)) return prev;
            const updated = [data.notification, ...prev];
            setUnreadCount(updated.filter(n => !n.read).length);
            return updated;
          });
        }
      };

      return () => {
        channel.close();
        channelRef.current = null;
      };
    } catch (e) {
      console.warn('BroadcastChannel not initialized:', e);
    }
  }, []);

  // Real-Time SSE connection lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setConnected(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const token = getAuthToken();
    if (!token) {
      refreshNotifications();
      return;
    }

    // Connect to Server-Sent Events stream
    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
      try {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isMountedRef.current) {
            setConnected(true);
          }
        };

        // Initial snapshot event
        es.addEventListener('initial', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.notifications && isMountedRef.current) {
              updateCounts(data.notifications);
            }
          } catch (err) {
            console.warn('Failed to parse initial SSE notifications:', err);
          }
        });

        // Real-time notification event
        es.addEventListener('notification', (e: MessageEvent) => {
          try {
            const notif: AppNotification = JSON.parse(e.data);
            if (!notif || !isMountedRef.current) return;

            setNotifications(prev => {
              if (prev.some(n => n.id === notif.id)) return prev;
              const updated = [notif, ...prev];
              setUnreadCount(updated.filter(n => !n.read).length);
              return updated;
            });

            // Authoritative 5-second Audio Alert Trigger:
            // High-priority audible alerts: Play a distinct five-second sound when a new urgent or emergency hospital request reaches an authorized blood bank recipient.
            // Hospital users and other roles do not trigger recipient-facing emergency alarms for requisitions.
            const isBloodBankRecipient = user?.role === 'blood_bank';
            const urgencyVal = notif.data?.urgency;
            const isEmergency = notif.type === 'emergency' || notif.priority === 'urgent' || urgencyVal === 'Emergency';
            const isUrgent = (notif.priority === 'high' && notif.type !== 'emergency') || urgencyVal === 'Urgent';

            if (isBloodBankRecipient) {
              if (isEmergency) {
                audioAlertManager.playAlert('Emergency', notif.id);
                setActiveAlertBanner(notif);
              } else if (isUrgent) {
                audioAlertManager.playAlert('Urgent', notif.id);
                setActiveAlertBanner(notif);
              }
            }

            // Cross-tab broadcast
            if (channelRef.current) {
              channelRef.current.postMessage({ type: 'NEW_NOTIFICATION', notification: notif });
            }
          } catch (err) {
            console.warn('Failed to parse SSE notification:', err);
          }
        });

        // Multi-tab read synchronization event from server
        es.addEventListener('read_sync', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (!isMountedRef.current) return;

            if (data.allRead) {
              setNotifications(prev => {
                const updated = prev.map(n => ({ ...n, read: true }));
                setUnreadCount(0);
                return updated;
              });
            } else if (data.notificationId) {
              setNotifications(prev => {
                const updated = prev.map(n => n.id === data.notificationId ? { ...n, read: true } : n);
                setUnreadCount(updated.filter(n => !n.read).length);
                return updated;
              });
            }
          } catch (err) {
            console.warn('Failed to parse SSE read_sync:', err);
          }
        });

        es.onerror = () => {
          if (isMountedRef.current) {
            setConnected(false);
          }
          es.close();

          // Exponential backoff reconnect
          if (isMountedRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && user) {
                connectSSE();
              }
            }, 5000);
          }
        };
      } catch (err) {
        console.warn('EventSource connection error:', err);
        // Fallback initial fetch
        refreshNotifications();
      }
    };

    connectSSE();

    // Global gesture listener to unlock Web Audio API on first user interaction
    const handleUserGesture = () => {
      audioAlertManager.unlockAudio();
    };
    window.addEventListener('click', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUserGesture, { capture: true, passive: true });

    // Visibility-aware polling fallback to catch any missed updates when tab refocuses
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        refreshNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      audioAlertManager.stop();
      window.removeEventListener('click', handleUserGesture, { capture: true });
      window.removeEventListener('keydown', handleUserGesture, { capture: true });
      window.removeEventListener('touchstart', handleUserGesture, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user, refreshNotifications]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    audioAlertManager.setEnabled(enabled);
    setSoundEnabledState(enabled);
  }, []);

  const setSoundVolume = useCallback((vol: number) => {
    audioAlertManager.setVolume(vol);
    setSoundVolumeState(vol);
  }, []);

  const testSound = useCallback((urgency: AlertUrgency) => {
    audioAlertManager.playAlert(urgency, undefined, true);
  }, []);

  const dismissActiveAlert = useCallback(() => {
    audioAlertManager.stop();
    setActiveAlertBanner(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        connected,
        soundEnabled,
        soundVolume,
        activeAlertBanner,
        setSoundEnabled,
        setSoundVolume,
        testSound,
        dismissActiveAlert,
        markAsRead,
        markAllAsRead,
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

import { Response } from 'express';
import { db } from '../models/store';
import { AppNotification } from '../models/types';
import { safeSupabaseSync } from '../models/db';

interface SSEClient {
  id: string;
  userId: string;
  role: string;
  organizationId?: string;
  res: Response;
}

class NotificationService {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, id) => {
        try {
          client.res.write(': ping\n\n');
        } catch {
          this.removeClient(id);
        }
      });
    }, 20000);
    // Don't prevent process from exiting
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  public addClient(id: string, userId: string, role: string, res: Response, organizationId?: string) {
    this.clients.set(id, { id, userId, role, organizationId, res });

    // Send initial snapshot of unread count and latest notifications
    try {
      const userNotifications = db.notifications.filter(n => {
        if (n.userId === userId) return true;
        if (organizationId && n.userId === organizationId) return true;
        if (n.userId === `role:${role}`) return true;
        if (n.userId === 'all') return true;
        return false;
      });

      const unreadCount = userNotifications.filter(n => !n.read).length;
      const recent = userNotifications.slice(0, 20);

      res.write(`event: initial\ndata: ${JSON.stringify({ unreadCount, count: userNotifications.length, notifications: recent })}\n\n`);
    } catch {
      this.removeClient(id);
    }
  }

  public removeClient(id: string) {
    this.clients.delete(id);
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  /**
   * Persists and broadcasts a real-time notification to targeted recipients
   */
  public async dispatchNotification(
    data: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string; createdAt?: string; read?: boolean; data?: any }
  ): Promise<AppNotification> {
    const notif: AppNotification = {
      id: data.id || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      priority: data.priority,
      read: data.read !== undefined ? data.read : false,
      createdAt: data.createdAt || new Date().toISOString(),
      link: data.link,
      data: data.data
    };
    (notif as any).isRead = notif.read;

    // 1. Persist notification in database store
    db.notifications.unshift(notif);
    db.saveSnapshot();

    // 2. Broadcast to all matching connected clients
    this.clients.forEach(client => {
      const matches =
        client.userId === notif.userId ||
        (client.organizationId && client.organizationId === notif.userId) ||
        notif.userId === `role:${client.role}` ||
        notif.userId === 'all';

      if (matches) {
        try {
          client.res.write(`event: notification\ndata: ${JSON.stringify(notif)}\n\n`);
        } catch {
          this.removeClient(client.id);
        }
      }
    });

    return notif;
  }

  /**
   * Broadcasts read-state updates so multi-tab clients stay synchronized
   */
  public broadcastReadSync(userId: string, notificationId?: string, allRead?: boolean) {
    this.clients.forEach(client => {
      if (client.userId === userId) {
        try {
          client.res.write(
            `event: read_sync\ndata: ${JSON.stringify({
              userId,
              notificationId,
              allRead: Boolean(allRead),
              timestamp: Date.now()
            })}\n\n`
          );
        } catch {
          this.removeClient(client.id);
        }
      }
    });
  }
}

export const notificationService = new NotificationService();

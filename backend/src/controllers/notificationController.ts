import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../models/store';
import { AuthenticatedRequest, JWT_SECRET } from '../middleware/auth';
import { safeSupabaseSync } from '../models/db';
import { notificationService } from '../services/notificationService';

/**
 * Universal Role-Aware Notification Retrieval
 */
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  await safeSupabaseSync();
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const userId = user.id;
  const role = user.role;

  const userNotifications = db.notifications.filter(n => {
    // Explicit user recipient or organization membership
    if (n.userId === userId) return true;
    if ((user as any).bloodBankId && n.userId === (user as any).bloodBankId) return true;
    if ((user as any).hospitalId && n.userId === (user as any).hospitalId) return true;
    // Broadcast to this user's role
    if (n.userId === `role:${role}`) return true;
    // Global broadcast
    if (n.userId === 'all') return true;
    return false;
  });

  // Sort newest first
  userNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formatted = userNotifications.map(n => ({
    ...n,
    isRead: Boolean(n.read),
    read: Boolean(n.read)
  }));

  res.json({
    success: true,
    count: formatted.length,
    unreadCount: formatted.filter(n => !n.read).length,
    notifications: formatted
  });
};

/**
 * Real-Time Server-Sent Events (SSE) Stream for authenticated users
 */
export const streamNotifications = async (req: AuthenticatedRequest, res: Response) => {
  void safeSupabaseSync();

  // Support token from either req.user (if auth middleware ran), Authorization header, or query param ?token=
  let user = req.user;
  if (!user) {
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const token = bearerToken || queryToken;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required for notifications stream' });
    }

    try {
      user = jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return res.status(403).json({ success: false, error: 'Invalid or expired stream token' });
    }
  }

  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required for notification stream' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });
  res.flushHeaders?.();

  const orgId = (user as any).bloodBankId || (user as any).hospitalId;
  const clientId = `client-${user.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  notificationService.addClient(clientId, user.id, user.role, res, orgId);

  req.on('close', () => {
    notificationService.removeClient(clientId);
  });
};

/**
 * Mark a single notification as read
 */
export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const notif = db.notifications.find(n => n.id === id);
  if (!notif) {
    return res.status(404).json({ success: false, error: 'Notification not found' });
  }

  notif.read = true;
  db.saveSnapshot();

  // Multi-tab synchronization broadcast
  notificationService.broadcastReadSync(user.id, notif.id, false);

  res.json({
    success: true,
    notification: {
      ...notif,
      isRead: true,
      read: true
    }
  });
};

/**
 * Mark all notifications for current user/role as read
 */
export const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const userId = user.id;
  const role = user.role;

  const bloodBankId = (user as any).bloodBankId;
  const hospitalId = (user as any).hospitalId;

  db.notifications.forEach(n => {
    if (
      n.userId === userId ||
      (bloodBankId && n.userId === bloodBankId) ||
      (hospitalId && n.userId === hospitalId) ||
      n.userId === `role:${role}` ||
      n.userId === 'all'
    ) {
      n.read = true;
    }
  });

  db.saveSnapshot();

  // Multi-tab synchronization broadcast
  notificationService.broadcastReadSync(user.id, undefined, true);

  res.json({ success: true, message: 'All notifications marked as read.' });
};

/**
 * Dispatch test notification (authorized)
 */
export const dispatchNotificationEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  const { userId, title, message, type, priority, link } = req.body;
  if (!userId || !title || !message) {
    return res.status(400).json({ success: false, error: 'userId, title, and message are required' });
  }

  const notif = await notificationService.dispatchNotification({
    userId,
    title,
    message,
    type: type || 'system',
    priority: priority || 'medium',
    link
  });

  res.json({ success: true, notification: notif });
};


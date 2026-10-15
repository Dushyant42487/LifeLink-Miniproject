import { Response } from 'express';
import { db } from '../models/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { safeSupabaseSync } from '../models/db';

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
    // Explicit user recipient
    if (n.userId === userId) return true;
    // Broadcast to this user's role
    if (n.userId === `role:${role}`) return true;
    // Global broadcast
    if (n.userId === 'all') return true;
    return false;
  });

  // Sort newest first
  userNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    success: true,
    count: userNotifications.length,
    unreadCount: userNotifications.filter(n => !n.read).length,
    notifications: userNotifications
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

  res.json({ success: true, notification: notif });
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

  db.notifications.forEach(n => {
    if (n.userId === userId || n.userId === `role:${role}` || n.userId === 'all') {
      n.read = true;
    }
  });

  db.saveSnapshot();

  res.json({ success: true, message: 'All notifications marked as read.' });
};

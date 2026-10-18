import { Router } from 'express';
import { 
  getNotifications, 
  streamNotifications,
  markNotificationRead, 
  markAllNotificationsRead,
  dispatchNotificationEndpoint
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getNotifications);
router.get('/stream', streamNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.post('/test-dispatch', dispatchNotificationEndpoint);

export default router;

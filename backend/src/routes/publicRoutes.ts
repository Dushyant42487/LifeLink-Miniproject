import { Router } from 'express';
import { getPublicStats, getPublicAvailability, getPublicCamps, rsvpCamp, getNotifications, getPublicLocations } from '../controllers/publicController';

const router = Router();

router.get('/stats', getPublicStats);
router.get('/availability', getPublicAvailability);
router.get('/camps', getPublicCamps);
router.get('/locations', getPublicLocations);
router.post('/camps/:id/rsvp', rsvpCamp);
router.get('/notifications', getNotifications);

export default router;

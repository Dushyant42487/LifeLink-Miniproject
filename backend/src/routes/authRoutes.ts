import { Router } from 'express';
import { login, register, getMe, forgotPassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';

const router = Router();

router.post('/login', authRateLimiter, login);
router.post('/register', authRateLimiter, register);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', authRateLimiter, forgotPassword);

export default router;

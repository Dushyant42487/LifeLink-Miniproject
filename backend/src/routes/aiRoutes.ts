import { Router } from 'express';
import { 
  getDemandForecast, 
  getShortageRisk, 
  getWastageRisk, 
  getCampaignRecommendations 
} from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Allow authenticated users to view AI insights
router.use(authenticateToken);

router.get('/forecast', getDemandForecast);
router.get('/shortage-risk', getShortageRisk);
router.get('/wastage-risk', getWastageRisk);
router.get('/campaign-recommendations', getCampaignRecommendations);

export default router;

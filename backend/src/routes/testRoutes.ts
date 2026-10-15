import { Router, Request, Response } from 'express';
import { db } from '../models/store';
import { setSyncPaused } from '../models/db';

const router = Router();

// Test harness routes - active ONLY in development/test environments
router.post('/reset', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Test endpoints disabled in production' });
  }

  setSyncPaused(true);
  db.clearAllData();
  return res.json({
    success: true,
    message: 'DataStore reset successfully. All operational tables are now empty.',
    counts: db.getRecordCounts()
  });
});

router.post('/seed-fixtures', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Test endpoints disabled in production' });
  }

  setSyncPaused(false);
  db.clearAllData();
  db.seedTestFixtures();
  return res.json({
    success: true,
    message: 'Test fixtures seeded successfully for automated testing suite.',
    counts: db.getRecordCounts()
  });
});

router.get('/counts', (req: Request, res: Response) => {
  return res.json({
    success: true,
    counts: db.getRecordCounts()
  });
});

export default router;

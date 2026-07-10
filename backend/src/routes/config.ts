import { Router, Request, Response, NextFunction } from 'express';
import { AIConfig } from '../models/aiConfig.model';

const router = Router();

// GET /api/config — Get current AI config
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let config = await AIConfig.findOne();
    if (!config) {
      // Create default config if none exists
      config = await AIConfig.create({
        voiceId: '',
        voiceName: 'Default',
        personality: {
          tone: 'professional',
          formality: 7,
          creativity: 5,
          responseLength: 'moderate',
        },
        greeting: 'Hello, welcome to Skyvion AI Systems. How can I assist you today?',
        escalationRules: [],
        operatingHours: [
          { day: 'Monday', startTime: '09:00', endTime: '17:00', enabled: true },
          { day: 'Tuesday', startTime: '09:00', endTime: '17:00', enabled: true },
          { day: 'Wednesday', startTime: '09:00', endTime: '17:00', enabled: true },
          { day: 'Thursday', startTime: '09:00', endTime: '17:00', enabled: true },
          { day: 'Friday', startTime: '09:00', endTime: '17:00', enabled: true },
          { day: 'Saturday', startTime: '10:00', endTime: '14:00', enabled: false },
          { day: 'Sunday', startTime: '10:00', endTime: '14:00', enabled: false },
        ],
        confidenceThreshold: 0.7,
        maxConversationTurns: 50,
        enableInterruptions: true,
      });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// PUT /api/config — Update AI config
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await AIConfig.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { synthesizeSpeech, isTtsAvailable } from '../services/ttsService';

const router = Router();

const ttsSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(1000),
});

// POST /api/tts — natural voice synthesis (signed-in users; browser TTS is
// the fallback so guests and quota exhaustion degrade gracefully)
router.post('/', authMiddleware, validateBody(ttsSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isTtsAvailable()) {
      res.status(503).json({ success: false, error: 'TTS temporarily unavailable' });
      return;
    }

    const wav = await synthesizeSpeech(req.body.text);
    if (!wav) {
      res.status(503).json({ success: false, error: 'TTS temporarily unavailable' });
      return;
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wav);
  } catch (error) {
    next(error);
  }
});

export default router;

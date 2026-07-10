import { Router, Request, Response, NextFunction } from 'express';
import { Conversation } from '../models/conversation.model';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// GET /api/conversations — List conversations with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const intent = req.query.intent as string;
    const sentiment = req.query.sentiment as string;
    const resolved = req.query.resolved as string;

    const filter: Record<string, unknown> = {};
    if (intent) filter.intent = intent;
    if (sentiment) filter.sentiment = sentiment;
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const total = await Conversation.countDocuments(filter);
    const conversations = await Conversation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: conversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/conversations/:id — Get single conversation
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw new ApiError(404, 'Conversation not found');

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversations — Create new conversation
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await Conversation.create(req.body);
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/conversations/:id — Update conversation
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!conversation) throw new ApiError(404, 'Conversation not found');

    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.id);
    if (!conversation) throw new ApiError(404, 'Conversation not found');

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;

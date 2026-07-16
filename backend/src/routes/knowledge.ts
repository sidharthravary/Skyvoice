import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { KnowledgeBase } from '../models/knowledgeBase.model';
import { ApiError } from '../middleware/errorHandler';
import { ingestDocument, searchKnowledge, generateEmbedding } from '../services/ragService';
import { validateBody } from '../middleware/validate';
import { z } from 'zod';

const faqSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  content: z.string().trim().min(1, 'Content is required').max(5000),
});

const searchSchema = z.object({
  query: z.string().trim().min(1, 'Search query is required').max(500),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed') as any);
    }
  },
});

const router = Router();

// GET /api/knowledge — List all entries
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sourceType = req.query.sourceType as string;
    const indexStatus = req.query.indexStatus as string;

    const filter: Record<string, unknown> = {};
    if (sourceType) filter.sourceType = sourceType;
    if (indexStatus) filter.indexStatus = indexStatus;

    const total = await KnowledgeBase.countDocuments(filter);
    const entries = await KnowledgeBase.find(filter)
      .select('-embedding')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/upload — Upload a document
router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ApiError(400, 'No file uploaded');

    const entry = await KnowledgeBase.create({
      title: req.file.originalname,
      content: 'Processing...',
      sourceType: req.file.mimetype === 'application/pdf' ? 'pdf' : 'docx',
      fileName: req.file.originalname,
      indexStatus: 'pending',
    });

    // Run ingestion in background
    ingestDocument(req.file.originalname, req.file.buffer, req.file.mimetype)
      .then(async (result) => {
        if (result.status === 'success') {
          await KnowledgeBase.findByIdAndUpdate(entry._id, {
            content: result.text.slice(0, 1000), // Sample content representation
            indexStatus: 'indexed',
          });
        } else {
          await KnowledgeBase.findByIdAndUpdate(entry._id, { indexStatus: 'error' });
        }
      })
      .catch(async (err) => {
        console.error('[Knowledge Route] Background ingestion failed:', err);
        await KnowledgeBase.findByIdAndUpdate(entry._id, { indexStatus: 'error' });
      });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/faq — Add FAQ entry
router.post('/faq', validateBody(faqSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content } = req.body;

    const embedding = await generateEmbedding(`${title} ${content}`);

    const entry = await KnowledgeBase.create({
      title,
      content,
      embedding,
      sourceType: 'faq',
      indexStatus: 'indexed',
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/search — Semantic search
router.post('/search', validateBody(searchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;

    const results = await searchKnowledge(query);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/knowledge/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await KnowledgeBase.findByIdAndDelete(req.params.id);
    if (!entry) throw new ApiError(404, 'Knowledge base entry not found');

    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /api/knowledge/retrain — Re-embed every entry with the active provider
// (also migrates entries whose embeddings came from a different provider/dims)
router.post('/retrain', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allEntries = await KnowledgeBase.find();

    // Retrain in background
    (async () => {
      for (const entry of allEntries) {
        try {
          const embedding = await generateEmbedding(`${entry.title} ${entry.content}`);
          await KnowledgeBase.findByIdAndUpdate(entry._id, {
            embedding,
            indexStatus: 'indexed',
          });
        } catch (err) {
          console.error(`[Knowledge Retrain] Failed for ${entry._id}:`, err);
          await KnowledgeBase.findByIdAndUpdate(entry._id, { indexStatus: 'error' });
        }
      }
    })();

    res.json({ success: true, message: 'Retraining initiated' });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { ProjectInquiry } from '../models/projectInquiry.model';
import { ApiError } from '../middleware/errorHandler';

import { sendEmail, getProjectInquiryTemplate } from '../services/emailService';

const router = Router();

// GET /api/inquiries
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const total = await ProjectInquiry.countDocuments(filter);
    const inquiries = await ProjectInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: inquiries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/inquiries
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await ProjectInquiry.create(req.body);

    // Send email alert in background
    const htmlBody = getProjectInquiryTemplate(
      inquiry.companyName,
      inquiry.requirements || 'No special requirements listed.',
      inquiry.budget || 'Not specified',
      inquiry.timeline || 'Not specified',
      inquiry.email
    );

    sendEmail({
      to: inquiry.email,
      subject: 'SkyVoice: Project Inquiry Received',
      html: htmlBody,
    }).catch(err => console.error('[Inquiries Route] Email failed:', err));

    res.status(201).json({ success: true, data: inquiry });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/inquiries/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inquiry = await ProjectInquiry.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!inquiry) throw new ApiError(404, 'Inquiry not found');

    res.json({ success: true, data: inquiry });
  } catch (error) {
    next(error);
  }
});

export default router;

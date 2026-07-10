import mongoose, { Schema, Document } from 'mongoose';

export interface IProjectInquiry extends Document {
  companyName: string;
  contactName?: string;
  email: string;
  phone?: string;
  requirements: string;
  projectType?: string;
  budget: string;
  timeline: string;
  status: 'new' | 'contacted' | 'in-progress' | 'closed' | 'rejected';
  conversationId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectInquirySchema = new Schema<IProjectInquiry>(
  {
    companyName: { type: String, required: true },
    contactName: { type: String },
    email: { type: String, required: true },
    phone: { type: String },
    requirements: { type: String, required: true },
    projectType: { type: String },
    budget: { type: String, required: true },
    timeline: { type: String, required: true },
    status: {
      type: String,
      enum: ['new', 'contacted', 'in-progress', 'closed', 'rejected'],
      default: 'new',
      index: true,
    },
    conversationId: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ProjectInquiry = mongoose.model<IProjectInquiry>('ProjectInquiry', ProjectInquirySchema);

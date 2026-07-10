import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledgeBase extends Document {
  title: string;
  content: string;
  embedding: number[];
  sourceType: 'pdf' | 'docx' | 'url' | 'faq' | 'manual' | 'seed';
  sourceUrl?: string;
  fileName?: string;
  chunkIndex?: number;
  totalChunks?: number;
  indexStatus: 'pending' | 'indexed' | 'error';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    sourceType: {
      type: String,
      enum: ['pdf', 'docx', 'url', 'faq', 'manual', 'seed'],
      required: true,
      index: true,
    },
    sourceUrl: { type: String },
    fileName: { type: String },
    chunkIndex: { type: Number },
    totalChunks: { type: Number },
    indexStatus: {
      type: String,
      enum: ['pending', 'indexed', 'error'],
      default: 'pending',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

KnowledgeBaseSchema.index({ title: 'text', content: 'text' });

export const KnowledgeBase = mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);

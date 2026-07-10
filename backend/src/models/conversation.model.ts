import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
}

export interface IConversation extends Document {
  userId: string;
  messages: IMessage[];
  audioUrl?: string;
  intent: 'general_query' | 'booking_request' | 'project_inquiry' | 'operational_query' | 'faq' | 'escalation' | 'greeting' | 'farewell' | 'unknown';
  sentiment: 'positive' | 'neutral' | 'negative';
  resolved: boolean;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  confidence: { type: Number, min: 0, max: 1 },
});

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: String, required: true, index: true },
    messages: [MessageSchema],
    audioUrl: { type: String },
    intent: {
      type: String,
      enum: ['general_query', 'booking_request', 'project_inquiry', 'operational_query', 'faq', 'escalation', 'greeting', 'farewell', 'unknown'],
      default: 'unknown',
      index: true,
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
      index: true,
    },
    resolved: { type: Boolean, default: false },
    duration: { type: Number },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

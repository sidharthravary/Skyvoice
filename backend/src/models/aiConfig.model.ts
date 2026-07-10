import mongoose, { Schema, Document } from 'mongoose';

export interface IEscalationRule {
  condition: string;
  action: string;
  priority: number;
}

export interface IAIConfig extends Document {
  voiceId: string;
  voiceName: string;
  personality: {
    tone: string;
    formality: number;
    creativity: number;
    responseLength: 'brief' | 'moderate' | 'detailed';
  };
  greeting: string;
  escalationRules: IEscalationRule[];
  operatingHours: {
    day: string;
    startTime: string;
    endTime: string;
    enabled: boolean;
  }[];
  confidenceThreshold: number;
  maxConversationTurns: number;
  enableInterruptions: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EscalationRuleSchema = new Schema<IEscalationRule>({
  condition: { type: String, required: true },
  action: { type: String, required: true },
  priority: { type: Number, default: 0 },
});

const AIConfigSchema = new Schema<IAIConfig>(
  {
    voiceId: { type: String, default: '' },
    voiceName: { type: String, default: 'Default' },
    personality: {
      tone: { type: String, default: 'professional' },
      formality: { type: Number, default: 7, min: 1, max: 10 },
      creativity: { type: Number, default: 5, min: 1, max: 10 },
      responseLength: {
        type: String,
        enum: ['brief', 'moderate', 'detailed'],
        default: 'moderate',
      },
    },
    greeting: {
      type: String,
      default: 'Hello, welcome to Skyvion AI Systems. How can I assist you today?',
    },
    escalationRules: [EscalationRuleSchema],
    operatingHours: [
      {
        day: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        enabled: { type: Boolean, default: true },
      },
    ],
    confidenceThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
    maxConversationTurns: { type: Number, default: 50 },
    enableInterruptions: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AIConfig = mongoose.model<IAIConfig>('AIConfig', AIConfigSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityEntry {
  timestamp: Date;
  type: 'login' | 'logout' | 'voice_query' | 'booking_created' | 'booking_cancelled'
      | 'project_update' | 'knowledge_query' | 'greeting';
  details?: Record<string, unknown>;
  intent?: string;
  userMessage?: string;
  aiResponse?: string;
  resolved?: boolean;
}

export interface IProjectInteraction {
  projectName: string;
  lastQueried?: Date;
  lastUpdated?: Date;
  updatesLog: Array<{
    timestamp: Date;
    previousStatus: string;
    newStatus: string;
    updatedBy: string;
    note: string;
  }>;
}

export interface IUserSession extends Document {
  userId: string;
  username: string;
  fullName?: string;
  activityLog: IActivityEntry[];
  totalSessions: number;
  totalMessages: number;
  totalBookings: number;
  lastActive?: Date;
  firstLogin?: Date;
  appointments: mongoose.Types.ObjectId[];
  projectInteractions: IProjectInteraction[];
  createdAt: Date;
  updatedAt: Date;
}

const ActivityEntrySchema = new Schema<IActivityEntry>(
  {
    timestamp:   { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['login','logout','voice_query','booking_created','booking_cancelled',
             'project_update','knowledge_query','greeting'],
      required: true,
    },
    details:     { type: Schema.Types.Mixed },
    intent:      { type: String },
    userMessage: { type: String },
    aiResponse:  { type: String },
    resolved:    { type: Boolean, default: true },
  },
  { _id: false }
);

const ProjectInteractionSchema = new Schema<IProjectInteraction>(
  {
    projectName: { type: String, required: true },
    lastQueried: { type: Date },
    lastUpdated: { type: Date },
    updatesLog: [{
      timestamp:      { type: Date, default: Date.now },
      previousStatus: { type: String, default: '' },
      newStatus:      { type: String, required: true },
      updatedBy:      { type: String, default: '' },
      note:           { type: String, default: '' },
    }],
  },
  { _id: false }
);

const UserSessionSchema = new Schema<IUserSession>(
  {
    userId:     { type: String, required: true, unique: true, index: true },
    username:   { type: String, required: true },
    fullName:   { type: String },
    activityLog: { type: [ActivityEntrySchema], default: [] },
    totalSessions: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    lastActive:  { type: Date },
    firstLogin:  { type: Date },
    appointments: [{ type: Schema.Types.ObjectId, ref: 'Appointment' }],
    projectInteractions: { type: [ProjectInteractionSchema], default: [] },
  },
  { timestamps: true }
);

export const UserSession = mongoose.model<IUserSession>('UserSession', UserSessionSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  userId: string;
  visitorName?: string;
  name: string;
  email?: string;
  date: Date;
  time: string;
  timezone: string;
  calendarEventId?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    userId:        { type: String, required: true, index: true },
    visitorName:   { type: String },
    name:          { type: String, required: true },
    email:         { type: String },
    date:          { type: Date, required: true, index: true },
    time:          { type: String, required: true },
    timezone:      { type: String, default: 'UTC' },
    calendarEventId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
      default: 'pending',
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

AppointmentSchema.index({ date: 1, status: 1 });

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);

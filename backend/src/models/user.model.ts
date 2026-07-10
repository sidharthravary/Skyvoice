import mongoose, { Schema, Document } from 'mongoose';

export interface ILoginEntry {
  timestamp: Date;
  ip: string;
}

export interface IUser extends Document {
  fullName?: string;
  username: string;
  email?: string;
  passwordHash: string;
  role: 'admin' | 'visitor';
  avatar?: string;
  lastLogin?: Date;
  loginHistory: ILoginEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const LoginEntrySchema = new Schema<ILoginEntry>(
  {
    timestamp: { type: Date, required: true, default: Date.now },
    ip:        { type: String, default: 'unknown' },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    fullName:     { type: String },
    username:     { type: String, required: true, unique: true, index: true },
    email:        { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: {
      type:    String,
      enum:    ['admin', 'visitor'],
      default: 'visitor',
    },
    avatar:       { type: String },
    lastLogin:    { type: Date },
    loginHistory: { type: [LoginEntrySchema], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

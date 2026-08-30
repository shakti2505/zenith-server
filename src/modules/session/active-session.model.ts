import { Schema, model, Document, Types } from 'mongoose';
import { IProcedure } from '../procedure/procedure.model.js';

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED';

/**
 * Plain TypeScript Interface for ActiveSession (Supports .lean() queries)
 */
export interface IActiveSession {
  _id?: Types.ObjectId | string;
  socket_id: string;
  procedure_id: Types.ObjectId | string | IProcedure;
  current_step_index: number;
  invalid_frame_count?: number;
  status: SessionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IActiveSessionDocument extends IActiveSession, Document {
  _id: Types.ObjectId;
  invalid_frame_count: number;
}

const ActiveSessionSchema = new Schema<IActiveSessionDocument>(
  {
    socket_id: { type: String, required: true, index: true },
    procedure_id: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true },
    current_step_index: { type: Number, default: 0, required: true },
    invalid_frame_count: { type: Number, default: 0, required: true },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED'],
      default: 'IN_PROGRESS',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const ActiveSession = model<IActiveSessionDocument>('ActiveSession', ActiveSessionSchema);
export const ActiveSessionModel = ActiveSession;

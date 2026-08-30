import { Schema, model, Document, Types } from 'mongoose';

export interface IProcedureStep {
  step_number: number;
  instruction_text: string;
  safety_warning?: string;
}

/**
 * Plain TypeScript Interface for Procedure (Supports .lean() queries)
 */
export interface IProcedure {
  _id?: Types.ObjectId | string;
  title: string;
  description?: string;
  steps: IProcedureStep[];
  is_custom?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProcedureDocument extends IProcedure, Document {
  _id: Types.ObjectId;
}

const ProcedureStepSchema = new Schema<IProcedureStep>(
  {
    step_number: { type: Number, required: true },
    instruction_text: { type: String, required: true, trim: true },
    safety_warning: { type: String, trim: true },
  },
  { _id: false }
);

const ProcedureSchema = new Schema<IProcedureDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    steps: { type: [ProcedureStepSchema], default: [], required: true },
    is_custom: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Procedure = model<IProcedureDocument>('Procedure', ProcedureSchema);
export const ProcedureModel = Procedure;

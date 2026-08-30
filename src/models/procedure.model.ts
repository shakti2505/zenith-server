import { Schema, model, Document, Types } from 'mongoose';

export interface IProcedureStep {
  step_number: number;
  instruction_text: string;
  safety_warning?: string;
}

export interface IProcedure extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  steps: IProcedureStep[];
  is_custom?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProcedureStepSchema = new Schema<IProcedureStep>(
  {
    step_number: { type: Number, required: true },
    instruction_text: { type: String, required: true, trim: true },
    safety_warning: { type: String, trim: true },
  },
  { _id: false }
);

const ProcedureSchema = new Schema<IProcedure>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    steps: { type: [ProcedureStepSchema], default: [], required: true },
    is_custom: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Procedure = model<IProcedure>('Procedure', ProcedureSchema);
export const ProcedureModel = Procedure;

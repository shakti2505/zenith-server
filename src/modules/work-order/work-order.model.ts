import { Schema, model, Document } from 'mongoose';

export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface IWorkOrderStep {
  stepId: string;
  title: string;
  description?: string;
  completed: boolean;
  notes?: string;
  completedAt?: Date;
}

export interface IWorkOrder extends Document {
  title: string;
  description?: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  currentStepIndex: number;
  steps: IWorkOrderStep[];
  assetId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkOrderStepSchema = new Schema<IWorkOrderStep>(
  {
    stepId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    completed: { type: Boolean, default: false },
    notes: { type: String },
    completedAt: { type: Date },
  },
  { _id: false }
);

const WorkOrderSchema = new Schema<IWorkOrder>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignedWorkerId: { type: String, index: true },
    assignedWorkerName: { type: String },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'paused'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    currentStepIndex: { type: Number, default: 0 },
    steps: { type: [WorkOrderStepSchema], default: [] },
    assetId: { type: String, index: true },
  },
  {
    timestamps: true,
  }
);

export const WorkOrderModel = model<IWorkOrder>('WorkOrder', WorkOrderSchema);

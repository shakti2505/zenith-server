import { WorkOrderModel, IWorkOrder, WorkOrderStatus } from './work-order.model.js';

export class WorkOrderService {
  static async createWorkOrder(data: Partial<IWorkOrder>): Promise<IWorkOrder> {
    const workOrder = new WorkOrderModel(data);
    return await workOrder.save();
  }

  static async getWorkOrderById(id: string): Promise<IWorkOrder | null> {
    return await WorkOrderModel.findById(id).exec();
  }

  static async listWorkOrders(filter: { status?: WorkOrderStatus; assignedWorkerId?: string; assetId?: string }) {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.assignedWorkerId) query.assignedWorkerId = filter.assignedWorkerId;
    if (filter.assetId) query.assetId = filter.assetId;

    return await WorkOrderModel.find(query).sort({ createdAt: -1 }).exec();
  }

  static async updateWorkOrder(id: string, updates: Partial<IWorkOrder>): Promise<IWorkOrder | null> {
    return await WorkOrderModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).exec();
  }

  static async updateStepStatus(
    workOrderId: string,
    stepIndex: number,
    completed: boolean,
    notes?: string
  ): Promise<IWorkOrder | null> {
    const workOrder = await WorkOrderModel.findById(workOrderId);
    if (!workOrder) return null;

    if (stepIndex >= 0 && stepIndex < workOrder.steps.length) {
      workOrder.steps[stepIndex].completed = completed;
      if (completed) {
        workOrder.steps[stepIndex].completedAt = new Date();
      }
      if (notes !== undefined) {
        workOrder.steps[stepIndex].notes = notes;
      }

      // Auto update currentStepIndex if current step completed
      if (completed && stepIndex === workOrder.currentStepIndex && stepIndex + 1 < workOrder.steps.length) {
        workOrder.currentStepIndex = stepIndex + 1;
      }

      // Check if all steps completed
      const allCompleted = workOrder.steps.every((s) => s.completed);
      if (allCompleted) {
        workOrder.status = 'completed';
      } else if (workOrder.status === 'pending') {
        workOrder.status = 'in_progress';
      }

      return await workOrder.save();
    }

    return workOrder;
  }

  static async deleteWorkOrder(id: string): Promise<boolean> {
    const result = await WorkOrderModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}

import { FastifyRequest, FastifyReply } from 'fastify';
import { WorkOrderService } from './work-order.service.js';
import { WorkOrderStatus } from './work-order.model.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';

export class WorkOrderController {
  static async listWorkOrders(
    request: FastifyRequest<{
      Querystring: { status?: WorkOrderStatus; assignedWorkerId?: string; assetId?: string };
    }>,
    reply: FastifyReply
  ) {
    const { status, assignedWorkerId, assetId } = request.query;
    const workOrders = await WorkOrderService.listWorkOrders({ status, assignedWorkerId, assetId });
    return sendSuccess(reply, {
      message: 'Work orders retrieved successfully',
      data: workOrders,
      meta: { count: workOrders.length },
    });
  }

  static async getWorkOrderById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const workOrder = await WorkOrderService.getWorkOrderById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }
    return sendSuccess(reply, {
      message: 'Work order details retrieved',
      data: workOrder,
    });
  }

  static async createWorkOrder(
    request: FastifyRequest<{
      Body: {
        title: string;
        description?: string;
        assignedWorkerId?: string;
        assignedWorkerName?: string;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        steps?: Array<{ stepId: string; title: string; description?: string }>;
        assetId?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { title, description, assignedWorkerId, assignedWorkerName, priority, steps, assetId } = request.body;

    if (!title || !title.trim()) {
      throw AppError.badRequest('Work order title is required');
    }

    const formattedSteps = (steps || []).map((step) => ({
      stepId: step.stepId,
      title: step.title,
      description: step.description,
      completed: false,
    }));

    const workOrder = await WorkOrderService.createWorkOrder({
      title: title.trim(),
      description,
      assignedWorkerId,
      assignedWorkerName,
      priority,
      steps: formattedSteps,
      assetId,
    });

    return sendSuccess(reply, {
      statusCode: 201,
      message: 'Work order created successfully',
      data: workOrder,
    });
  }

  static async updateWorkOrder(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        status?: WorkOrderStatus;
        assignedWorkerId?: string;
        assignedWorkerName?: string;
        currentStepIndex?: number;
        priority?: 'low' | 'medium' | 'high' | 'critical';
      };
    }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const updated = await WorkOrderService.updateWorkOrder(id, request.body);
    if (!updated) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    return sendSuccess(reply, {
      message: 'Work order updated successfully',
      data: updated,
    });
  }

  static async updateStepStatus(
    request: FastifyRequest<{
      Params: { id: string; stepIndex: string };
      Body: { completed: boolean; notes?: string };
    }>,
    reply: FastifyReply
  ) {
    const { id, stepIndex } = request.params;
    const { completed, notes } = request.body;
    const idx = parseInt(stepIndex, 10);

    if (isNaN(idx)) {
      throw AppError.badRequest('Step index must be a valid integer');
    }

    const updated = await WorkOrderService.updateStepStatus(id, idx, completed, notes);
    if (!updated) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    return sendSuccess(reply, {
      message: `Step ${idx} updated successfully`,
      data: updated,
    });
  }

  static async deleteWorkOrder(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const deleted = await WorkOrderService.deleteWorkOrder(id);
    if (!deleted) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    return sendSuccess(reply, {
      message: 'Work order deleted successfully',
      data: { id },
    });
  }
}

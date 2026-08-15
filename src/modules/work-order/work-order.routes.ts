import { FastifyPluginAsync } from 'fastify';
import { WorkOrderController } from './work-order.controller.js';

export const workOrderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', WorkOrderController.listWorkOrders);
  fastify.get('/:id', WorkOrderController.getWorkOrderById);
  fastify.post('/', WorkOrderController.createWorkOrder);
  fastify.patch('/:id', WorkOrderController.updateWorkOrder);
  fastify.post('/:id/steps/:stepIndex', WorkOrderController.updateStepStatus);
  fastify.delete('/:id', WorkOrderController.deleteWorkOrder);
};

import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

export async function connectDatabase(fastify: FastifyInstance): Promise<void> {
  const uri = fastify.config.MONGODB_URI;

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    fastify.log.info(`[MongoDB] Successfully connected to database: ${mongoose.connection.name}`);

    fastify.addHook('onClose', async () => {
      fastify.log.info('[MongoDB] Disconnecting from database...');
      await mongoose.disconnect();
      fastify.log.info('[MongoDB] Disconnected successfully');
    });
  } catch (error) {
    fastify.log.error(`[MongoDB] Connection error: ${error}`);
    throw error;
  }
}

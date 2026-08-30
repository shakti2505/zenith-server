import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { colors } from '../plugins/requestLogger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Connect to MongoDB database instance (Supports Fastify plugin and Standalone Worker)
 */
export async function connectDatabase(fastify?: FastifyInstance): Promise<void> {
  const uri =
    fastify?.config?.MONGODB_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/industrial_copilot';

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log(`  ${colors.brightGreen}🍃 MongoDB Connected:${colors.reset}   ${mongoose.connection.name}`);

    if (fastify) {
      fastify.addHook('onClose', async () => {
        console.log('[MongoDB] Disconnecting from database...');
        await mongoose.disconnect();
        console.log('[MongoDB] Disconnected successfully');
      });
    }
  } catch (error) {
    console.error(`  ${colors.brightRed}❌ MongoDB Error:${colors.reset}       ${error}`);
    if (fastify) throw error;
  }
}

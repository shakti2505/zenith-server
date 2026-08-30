import { startVisionWorker, stopVisionWorker } from './workers/vision.worker.js';
import { QUEUE_NAMES } from './queues/queue.config.js';
import { connectDatabase } from './config/database.js';
import { colors } from './plugins/requestLogger.js';

async function bootstrapWorker() {
  try {
    console.log(`\n${colors.bold}${colors.brightCyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.brightCyan}║   🏭  ZENITH INDUSTRIAL AI COPILOT VISION WORKER v1.0.0       ║${colors.reset}`);
    console.log(`${colors.bold}${colors.brightCyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`  ${colors.brightGreen}Queue Listener:${colors.reset}   ${QUEUE_NAMES.AI_VISION}`);
    console.log(`  ${colors.brightMagenta}Engine:${colors.reset}           Gemini 3.6 Flash Multimodal (LangChain)`);
    console.log(`  ${colors.brightCyan}Output Emitter:${colors.reset}   Socket.IO Redis Emitter (@socket.io/redis-emitter)\n`);

    // Connect to MongoDB for ActiveSession & Procedure state tracking
    try {
      await connectDatabase();
    } catch (dbErr) {
      console.warn('Worker proceeding without active MongoDB connection (fallback mode)');
    }

    const worker = startVisionWorker();

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down worker gracefully...`);
      await stopVisionWorker();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Error starting Vision Worker process:', err);
    process.exit(1);
  }
}

bootstrapWorker();

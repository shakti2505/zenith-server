import { buildApp } from './app.js';
import { colors } from './plugins/requestLogger.js';

async function start() {
  try {
    const app = await buildApp();

    const port = app.config.PORT || 3000;
    const host = app.config.HOST || '0.0.0.0';
    await app.listen({ port, host });

    console.log(`\n${colors.bold}${colors.brightCyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.brightCyan}║   🏭  ZENITH INDUSTRIAL AI COPILOT WEBSOCKET GATEWAY v1.0.0    ║${colors.reset}`);
    console.log(`${colors.bold}${colors.brightCyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`  ${colors.brightGreen}Gateway Running:${colors.reset}      http://${host}:${port}`);
    console.log(`  ${colors.brightCyan}Socket.IO (Redis):${colors.reset}    ws://${host}:${port}/socket.io/`);
    console.log(`  ${colors.brightMagenta}BullMQ Ingestion:${colors.reset}     ai-vision-queue ('process_frame' event)`);
    console.log(`  ${colors.brightYellow}Work Orders API:${colors.reset}      GET /api/work-orders`);
    console.log(`  ${colors.brightMagenta}Knowledge & SOPs:${colors.reset}     GET /api/knowledge/asset/:assetId\n`);

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down Gateway gracefully...`);
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Error starting Gateway server:', err);
    process.exit(1);
  }
}

start();

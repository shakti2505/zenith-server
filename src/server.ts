import { buildApp } from './app.js';

async function start() {
  try {
    const app = await buildApp();

    const port = app.config.PORT || 3000;
    const host = app.config.HOST
    await app.listen({ port, host });
    app.log.info(`🚀 Industrial AI Copilot Server running on http://${host}:${port}`);
    app.log.info(`📡 LiveKit RTC Token endpoint ready at GET http://${host}:${port}/api/rtc/token`);

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();

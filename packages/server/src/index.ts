import 'dotenv/config';
import { loadConfig } from './config.js';
import { createReadinessController } from './readiness.js';
import { createServer } from './server.js';

const bootstrap = async (): Promise<void> => {
  const config = loadConfig();
  const readiness = createReadinessController();
  const app = await createServer({ config, readiness });

  const close = async () => {
    readiness.markNotReady();
    try {
      await app.close();
    } catch (error) {
      app.log.error({ err: error }, 'Error while shutting down server');
    }
  };

  process.on('SIGINT', () => {
    void (async () => {
      app.log.info('Received SIGINT, shutting down');
      await close();
      process.exit(0);
    })();
  });

  process.on('SIGTERM', () => {
    void (async () => {
      app.log.info('Received SIGTERM, shutting down');
      await close();
      process.exit(0);
    })();
  });

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    readiness.markReady();
    app.log.info({ host: config.HOST, port: config.PORT }, 'Server is listening');
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start server');
    readiness.markNotReady();
    process.exit(1);
  }
};

void bootstrap();

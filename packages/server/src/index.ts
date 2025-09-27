// @module: server-bootstrap
// @tags: entrypoint, lifecycle, readiness

import 'dotenv/config';
import { loadConfig } from './config.js';
import { createReadinessController } from './readiness.js';
import { createServer } from './server.js';

const bootstrap = async (): Promise<void> => {
  const config = loadConfig();
  const readiness = createReadinessController();
  const app = await createServer({ config, readiness });

  const shutdownServer = async (): Promise<void> => {
    readiness.markNotReady();
    try {
      await app.close();
    } catch (error) {
      app.log.error({ err: error }, 'Error while shutting down server');
    }
  };

  const registerSignalHandler = (signal: NodeJS.Signals): void => {
    process.on(signal, () => {
      void (async () => {
        app.log.info({ signal }, 'Received shutdown signal');
        await shutdownServer();
        process.exit(0);
      })();
    });
  };

  registerSignalHandler('SIGINT');
  registerSignalHandler('SIGTERM');

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

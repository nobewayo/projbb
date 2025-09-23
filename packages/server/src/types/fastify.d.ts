import 'fastify';
import type { ReadinessController } from '../readiness.js';

declare module 'fastify' {
  interface FastifyInstance {
    readiness: ReadinessController;
  }
}

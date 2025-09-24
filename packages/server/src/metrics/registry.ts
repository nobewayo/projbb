import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';

export interface MetricsBundle {
  registry: Registry;
  activeConnections: Gauge;
  moveEvents: Counter;
  chatEvents: Counter;
  itemPickups: Counter;
}

export const createMetricsBundle = (): MetricsBundle => {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const activeConnections = new Gauge({
    name: 'bitby_realtime_connections',
    help: 'Number of active realtime websocket connections',
    registers: [registry],
  });

  const moveEvents = new Counter({
    name: 'bitby_move_events_total',
    help: 'Count of processed move events',
    registers: [registry],
  });

  const chatEvents = new Counter({
    name: 'bitby_chat_events_total',
    help: 'Count of processed chat messages',
    registers: [registry],
  });

  const itemPickups = new Counter({
    name: 'bitby_item_pickups_total',
    help: 'Count of successful item pickup events',
    registers: [registry],
  });

  return {
    registry,
    activeConnections,
    moveEvents,
    chatEvents,
    itemPickups,
  };
};

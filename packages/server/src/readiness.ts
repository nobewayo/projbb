// @module: server-readiness
// @tags: health, lifecycle

export interface ReadinessController {
  markReady(): void;
  markNotReady(): void;
  isReady(): boolean;
}

export const createReadinessController = (): ReadinessController => {
  let ready = false;

  return {
    markReady(): void {
      ready = true;
    },
    markNotReady(): void {
      ready = false;
    },
    isReady(): boolean {
      return ready;
    },
  };
};

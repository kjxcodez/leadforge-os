export const SequenceWorker = {
  start() {
    console.log("[SequenceWorker] Background automation runner is decommissioned (handled by desktop runtime).");
  },

  stop() {
    console.log("[SequenceWorker] Background automation runner stopped.");
  },

  async poll() {
    // No-op
  }
};

import { SequenceExecutionModel } from "../../db/models/sequence-execution.model.js";
import { AutomationService } from "./automation.service.js";
import { ExecutionStatus } from "@leadforge/schema";

let intervalId: any = null;

export const SequenceWorker = {
  start() {
    if (intervalId) return;

    // Run poll immediately on boot to resume any pending items
    this.poll().catch((err) => console.error("[SequenceWorker] Initial poll error:", err));

    // Poll every 10 seconds
    intervalId = setInterval(() => {
      this.poll().catch((err) => console.error("[SequenceWorker] Polling error:", err));
    }, 10000);

    console.log("[SequenceWorker] Background automation runner started.");
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    console.log("[SequenceWorker] Background automation runner stopped.");
  },

  async poll() {
    const now = new Date();

    // 1. Get WAITING executions whose delay has passed
    const waitingExecs = await SequenceExecutionModel.find({
      status: ExecutionStatus.WAITING,
      nextExecutionAt: { $lte: now }
    });

    // 2. Get stale RUNNING executions (to recover from crashes/restarts)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const staleExecs = await SequenceExecutionModel.find({
      status: ExecutionStatus.RUNNING,
      updatedAt: { $lte: fiveMinutesAgo }
    });

    const allExecs = [...waitingExecs, ...staleExecs];

    if (allExecs.length === 0) return;

    console.log(`[SequenceWorker] Found ${allExecs.length} sequence executions to process.`);

    for (const exec of allExecs) {
      try {
        // Set status to RUNNING to avoid double polling
        exec.status = ExecutionStatus.RUNNING;
        exec.nextExecutionAt = null as any;
        await exec.save();

        const service = new AutomationService(exec.workspaceId.toString());
        await service.executeNextStep(exec._id.toString());
      } catch (err) {
        console.error(`[SequenceWorker] Error processing execution ${exec._id.toString()}:`, err);
      }
    }
  }
};

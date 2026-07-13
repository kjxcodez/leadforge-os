import type { JobContext } from '../../shared/types/job';
import { scrapeMaps } from './plugins/scraper';
import { enrichWebsite } from './plugins/enricher';
import { dispatchOutreach } from './plugins/outreach';

// A registry of local job plugins.
const JobRegistry: Record<string, (ctx: JobContext) => Promise<any>> = {
  'scraper:maps': scrapeMaps,
  'enrich:website': enrichWebsite,
  'outreach:campaign': dispatchOutreach,

  /**
   * Mock test job plugin that simulates slow progress.
   */
  'mock:test': async (ctx) => {
    ctx.emitLog('Starting mock test execution', 'info');
    for (let i = 1; i <= 10; i++) {
      if (ctx.isCancelled()) {
        ctx.emitLog('Mock test execution cancelled.', 'warn');
        throw new Error('Job cancelled.');
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      ctx.updateProgress(i * 10, { step: i, description: `Running test stage ${i} of 10` });
      ctx.emitLog(`Mock stage ${i} completed successfully.`, 'info');
    }
    ctx.emitLog('Mock test execution completed successfully.', 'info');
    return { status: 'success', stagesRun: 10 };
  },
};

/**
 * Worker Host process script.
 * Listen for the 'start' command from the Main process, construct the job context,
 * and execute the resolved plugin task.
 */
process.on('message', async (msg: any) => {
  if (!msg || msg.command !== 'start') return;

  const { jobId, workspaceId, type, payload } = msg;

  let isCancelledState = false;
  
  // Listen for SIGTERM or termination IPC signals
  process.on('SIGTERM', () => {
    isCancelledState = true;
  });

  const context: JobContext = {
    jobId,
    workspaceId,
    payload,
    updateProgress: (progress: number, metadata?: any) => {
      process.send?.({ type: 'progress', progress, metadata });
    },
    emitLog: (message: string, severity: 'info' | 'warn' | 'error' = 'info', meta?: any) => {
      process.send?.({ type: 'log', severity, message, meta });
    },
    isCancelled: () => isCancelledState,
  };

  try {
    const pluginFn = JobRegistry[type];
    if (!pluginFn) {
      throw new Error(`Job type "${type}" is not registered in the Worker Host.`);
    }

    const result = await pluginFn(context);
    process.send?.({ type: 'success', result });
    process.exit(0);
  } catch (err: any) {
    process.send?.({ type: 'error', error: err.message || String(err) });
    process.exit(1);
  }
});

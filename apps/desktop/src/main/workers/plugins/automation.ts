import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { JobContext } from '../../../shared/types/job';

// ── Types ────────────────────────────────────────────────────────────────────

interface AutomationWorkflowPayload {
  sequenceId: string;
  entityId: string;
  entityType: string;
  triggerType?: string;
  triggerPayload?: any;
  workspaceId?: string;
  /** Present on resume: the previously saved checkpoint data. */
  _checkpoint?: AutomationCheckpoint | null;
}

interface AutomationCheckpoint {
  executionId: string;
  currentStep: number;
  sequenceId: string;
  entityId: string;
  entityType: string;
}

interface SequenceRecord {
  id: string;
  name: string;
  status: string;
  trigger: string;
  steps: string;
}

interface StepDefinition {
  type: string;
  [key: string]: any;
}

// ── Automation Workflow Plugin ────────────────────────────────────────────────

/**
 * Automation Workflow Plugin — TASK-022.
 *
 * Executes `automation:workflow` jobs created by the AutomationTriggerEvaluator.
 *
 * Responsibilities for this task:
 * 1. Validate payload (sequenceId, entityId, entityType required)
 * 2. Load and validate the target sequence from SQLite
 * 3. Parse sequence steps
 * 4. Create the sequence_execution record (atomically)
 * 5. Determine and log the first executable step
 * 6. Support checkpoint/resume, pause, cancellation
 * 7. Report deterministic progress
 *
 * Step execution (WAIT, SEND_EMAIL, CONDITION, etc.) is implemented in a later task.
 * This plugin initializes the execution record and signals readiness.
 *
 * Spec: automation_engine_spec.md §2.3 / build_order.md TASK-022
 */
export async function executeAutomationWorkflow(ctx: JobContext): Promise<any> {
  ctx.emitLog('Automation workflow plugin starting.', 'info');

  // ── 1. Validate payload ───────────────────────────────────────────────────

  ctx.updateProgress(5, { description: 'Validating payload...' });

  const payload = ctx.payload as AutomationWorkflowPayload;
  const sequenceId = payload?.sequenceId;
  const entityId = payload?.entityId;
  const entityType = payload?.entityType;

  if (!sequenceId) {
    throw new Error('Automation workflow: missing required payload field: sequenceId.');
  }
  if (!entityId) {
    throw new Error('Automation workflow: missing required payload field: entityId.');
  }
  if (!entityType) {
    throw new Error('Automation workflow: missing required payload field: entityType.');
  }

  ctx.emitLog(`Payload validated — sequenceId: ${sequenceId}, entityId: ${entityId}, entityType: ${entityType}`, 'info');

  // ── 2. Cancellation check (early) ─────────────────────────────────────────

  if (ctx.isCancelled()) {
    ctx.emitLog('Automation workflow cancelled before execution started.', 'warn');
    return { status: 'cancelled', sequenceId, entityId };
  }

  // ── 3. Resume from checkpoint if present ─────────────────────────────────

  const checkpoint = ctx.getCheckpoint() as AutomationCheckpoint | null;
  if (checkpoint?.executionId) {
    ctx.emitLog(
      `Resuming from checkpoint — executionId: ${checkpoint.executionId}, currentStep: ${checkpoint.currentStep}`,
      'info'
    );
    ctx.updateProgress(100, {
      description: `Resumed from checkpoint at step ${checkpoint.currentStep}.`,
      step: checkpoint.currentStep,
    });
    // Resume logic (step execution) belongs to future implementation.
    // Return the checkpoint state so the scheduler knows this was a clean resume.
    return {
      status: 'resumed',
      executionId: checkpoint.executionId,
      sequenceId: checkpoint.sequenceId || sequenceId,
      entityId: checkpoint.entityId || entityId,
      currentStep: checkpoint.currentStep,
    };
  }

  // ── 4. Open SQLite ────────────────────────────────────────────────────────

  const db = new Database(ctx.dbPath);

  try {
    // ── 5. Load sequence from SQLite ─────────────────────────────────────────

    ctx.updateProgress(10, { description: 'Loading sequence...' });

    const sequence = db.prepare(`
      SELECT id, name, status, trigger, steps
      FROM sequences
      WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `).get(sequenceId, ctx.workspaceId) as SequenceRecord | undefined;

    if (!sequence) {
      throw new Error(
        `Automation workflow: sequence "${sequenceId}" not found or deleted in workspace "${ctx.workspaceId}".`
      );
    }

    ctx.emitLog(`Sequence loaded: "${sequence.name}" (status: ${sequence.status})`, 'info');

    // ── 6. Validate sequence is active ───────────────────────────────────────

    ctx.updateProgress(20, { description: 'Validating sequence...' });

    if (sequence.status !== 'active') {
      throw new Error(
        `Automation workflow: sequence "${sequence.name}" (${sequenceId}) is not active. ` +
        `Current status: "${sequence.status}". Only active sequences can be executed.`
      );
    }

    ctx.emitLog('Sequence validation passed — status is active.', 'info');

    // ── 7. Parse sequence steps ───────────────────────────────────────────────

    ctx.updateProgress(30, { description: 'Parsing sequence steps...' });

    let steps: StepDefinition[];
    try {
      const parsed = JSON.parse(sequence.steps || '[]');
      if (!Array.isArray(parsed)) {
        throw new Error('steps field is not an array.');
      }
      steps = parsed;
    } catch (parseErr: any) {
      throw new Error(
        `Automation workflow: sequence "${sequence.name}" has invalid steps JSON. ` +
        `Parse error: ${parseErr.message || parseErr}`
      );
    }

    ctx.emitLog(`Sequence has ${steps.length} step(s).`, 'info');

    // ── 8. Resolve first step ─────────────────────────────────────────────────

    ctx.updateProgress(40, { description: 'Resolving first step...' });

    if (steps.length === 0) {
      // Empty sequence — nothing to execute. Mark immediately completed.
      ctx.emitLog('Sequence has no steps. Marking as completed with no execution.', 'warn');
      ctx.updateProgress(100, { description: 'Sequence has no steps. Completed.', total: 0 });
      db.close();
      return {
        status: 'completed',
        executionId: null,
        sequenceId,
        entityId,
        stepsTotal: 0,
        firstStep: null,
      };
    }

    const firstStep = steps[0];
    if (!firstStep || !firstStep.type) {
      throw new Error(
        `Automation workflow: sequence "${sequence.name}" first step is malformed or missing a type field.`
      );
    }

    ctx.emitLog(`First step resolved: type="${firstStep.type}"`, 'info');

    // ── 9. Cancellation check (before DB write) ────────────────────────────────

    if (ctx.isCancelled()) {
      ctx.emitLog('Automation workflow cancelled before creating sequence execution.', 'warn');
      db.close();
      return { status: 'cancelled', sequenceId, entityId };
    }

    // ── 10. Create sequence_execution atomically ──────────────────────────────

    ctx.updateProgress(50, { description: 'Creating sequence execution record...' });

    const executionId = randomUUID();
    const logId = randomUUID();
    const now = new Date().toISOString();

    // Resolve contactId / companyId from entityType
    const contactId =
      entityType === 'contact' || entityType === 'contacts' ? entityId : null;
    const companyId =
      entityType === 'company' || entityType === 'companies' ? entityId : null;

    db.transaction(() => {
      // Insert sequence_execution record
      db.prepare(`
        INSERT INTO sequence_executions (
          id, sequenceId, workspaceId,
          contactId, companyId,
          currentStep, status,
          startedAt, createdAt, updatedAt,
          parentJobId
        ) VALUES (
          ?, ?, ?,
          ?, ?,
          0, 'running',
          ?, ?, ?,
          ?
        )
      `).run(
        executionId,
        sequenceId,
        ctx.workspaceId,
        contactId,
        companyId,
        now,
        now,
        now,
        ctx.jobId
      );

      // Insert initial sequence_log entry
      db.prepare(`
        INSERT INTO sequence_logs (
          id, executionId, workspaceId,
          timestamp, step, action, status, message,
          createdAt, updatedAt
        ) VALUES (
          ?, ?, ?,
          ?, 0, 'INITIALIZED', 'success', ?,
          ?, ?
        )
      `).run(
        logId,
        executionId,
        ctx.workspaceId,
        now,
        `Automation workflow initialized for sequence "${sequence.name}". ` +
        `First step: ${firstStep.type}. Entity: ${entityType}/${entityId}.`,
        now,
        now
      );
    })();

    ctx.emitLog(`Sequence execution created: executionId="${executionId}"`, 'info');

    // ── 11. Pause check (after DB write) ─────────────────────────────────────

    if (ctx.isPaused()) {
      const pauseCheckpoint: AutomationCheckpoint = {
        executionId,
        currentStep: 0,
        sequenceId,
        entityId,
        entityType,
      };
      ctx.saveCheckpoint(pauseCheckpoint);
      ctx.emitLog('Automation workflow paused after initialization. Checkpoint saved.', 'info');
      db.close();
      return { status: 'paused', executionId, sequenceId, entityId, currentStep: 0 };
    }

    // ── 12. Save initial checkpoint ───────────────────────────────────────────

    const initialCheckpoint: AutomationCheckpoint = {
      executionId,
      currentStep: 0,
      sequenceId,
      entityId,
      entityType,
    };
    ctx.saveCheckpoint(initialCheckpoint);
    ctx.emitLog('Initial checkpoint saved.', 'info');

    // ── 13. Final progress and completion ─────────────────────────────────────

    ctx.updateProgress(80, {
      description: `Execution initialized. First step: ${firstStep.type}`,
      step: 0,
      total: steps.length,
    });

    // Final cancellation check
    if (ctx.isCancelled()) {
      ctx.emitLog('Automation workflow cancelled after initialization.', 'warn');
      db.close();
      return { status: 'cancelled', executionId, sequenceId, entityId };
    }

    ctx.updateProgress(100, {
      description: 'Automation workflow initialization complete.',
      step: 0,
      total: steps.length,
    });

    ctx.emitLog(
      `Automation workflow initialization complete. executionId="${executionId}", ` +
      `firstStep="${firstStep.type}", totalSteps=${steps.length}`,
      'info'
    );

    db.close();

    return {
      status: 'initialized',
      executionId,
      sequenceId,
      entityId,
      entityType,
      firstStep: firstStep.type,
      stepsTotal: steps.length,
    };
  } catch (err) {
    // Ensure DB is closed on any error path
    try { db.close(); } catch { /* ignore */ }
    throw err;
  }
}

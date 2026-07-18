import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { LocalEventBus, AppEvent, EventType } from '../lib/event-bus';

// ── Trigger type constants ────────────────────────────────────────────────────
// These values must match what is stored in sequences.trigger JSON in SQLite.
// Based on automation_engine_spec.md §5 and the API sequence model.

const TRIGGER_TYPES = {
  COMPANY_CREATED:            'COMPANY_CREATED',
  CONTACT_CREATED:            'CONTACT_CREATED',
  PIPELINE_STAGE_CHANGED:     'PIPELINE_STAGE_CHANGED',
  DISCOVERY_IMPORT_COMPLETED: 'DISCOVERY_IMPORT_COMPLETED',
  EMAIL_SENT:                 'EMAIL_SENT',
  EMAIL_REPLIED:              'EMAIL_REPLIED',
  EMAIL_BOUNCED:              'EMAIL_BOUNCED',
  JOB_COMPLETED:              'JOB_COMPLETED',
  JOB_FAILED:                 'JOB_FAILED',
} as const;

type AutomationTriggerType = typeof TRIGGER_TYPES[keyof typeof TRIGGER_TYPES];

// ── Event → Trigger mapping helper ───────────────────────────────────────────

/**
 * Maps an incoming LocalEventBus event to an AutomationTriggerType.
 * Returns null if the event does not correspond to any trigger type.
 * Spec: automation_engine_spec.md §5
 */
function mapEventToTriggerType(event: AppEvent): AutomationTriggerType | null {
  const { type, payload } = event;
  const entityType: string = payload?.entityType || '';
  const changeType: string = payload?.changeType || '';
  const jobType: string = payload?.type || payload?.jobType || '';

  switch (type) {
    case 'crm:created':
      if (entityType === 'company' || entityType === 'companies') {
        return TRIGGER_TYPES.COMPANY_CREATED;
      }
      if (entityType === 'contact' || entityType === 'contacts') {
        return TRIGGER_TYPES.CONTACT_CREATED;
      }
      return null;

    case 'crm:updated':
      // Pipeline stage change is indicated by a status changeType on contact
      if (
        (entityType === 'contact' || entityType === 'contacts') &&
        (changeType === 'status' || changeType === 'pipelineStage' || changeType === 'pipeline_stage')
      ) {
        return TRIGGER_TYPES.PIPELINE_STAGE_CHANGED;
      }
      return null;

    case 'crm:deleted':
      return null; // No trigger types defined for deletes in spec §5

    case 'job:completed':
      if (jobType === 'scraper:maps' || jobType?.startsWith('scraper')) {
        return TRIGGER_TYPES.DISCOVERY_IMPORT_COMPLETED;
      }
      return TRIGGER_TYPES.JOB_COMPLETED;

    case 'job:failed':
      return TRIGGER_TYPES.JOB_FAILED;

    case 'job:cancelled':
    case 'job:paused':
    case 'job:resumed':
    case 'job:heartbeat:timeout':
    case 'automation:triggered':
      // These events are observed but have no direct trigger type mapping in spec §5
      return null;

    default:
      return null;
  }
}

// ── AutomationTriggerEvaluator ────────────────────────────────────────────────

/**
 * AutomationTriggerEvaluator — TASK-021.
 *
 * Lives in the main process (WorkspaceRuntime). Subscribes to LocalEventBus events,
 * evaluates which active sequences have matching trigger conditions, deduplicates
 * against in-flight jobs and sequence_executions, and queues `automation:workflow`
 * jobs into the SQLite jobs table.
 *
 * Error isolation: one broken sequence evaluation never stops evaluation of others,
 * and evaluation errors never crash WorkspaceRuntime.
 *
 * Spec: automation_engine_spec.md §2.2
 */
export class AutomationTriggerEvaluator {
  /** Stored unsubscribe functions returned by eventBus.subscribe(). */
  private readonly unsubscribers: Array<() => void> = [];

  /**
   * Cached prepared statement for loading active sequences.
   * Re-used on every event to avoid repeated compilation overhead.
   */
  private readonly stmtLoadSequences: Database.Statement;

  /**
   * Cached prepared statement for checking existing in-flight jobs.
   */
  private readonly stmtCheckExistingJob: Database.Statement;

  /**
   * Cached prepared statement for checking existing running/waiting executions.
   */
  private readonly stmtCheckExistingExecution: Database.Statement;

  /**
   * Cached prepared statement for inserting a new automation workflow job.
   */
  private readonly stmtInsertJob: Database.Statement;

  constructor(
    private readonly workspaceId: string,
    private readonly db: Database.Database,
    private readonly eventBus: LocalEventBus
  ) {
    // Pre-compile all prepared statements once — never re-compiled on every event.
    this.stmtLoadSequences = this.db.prepare(`
      SELECT id, trigger, steps
      FROM sequences
      WHERE workspaceId = ?
        AND status = 'active'
        AND deletedAt IS NULL
    `);

    this.stmtCheckExistingJob = this.db.prepare(`
      SELECT id FROM jobs
      WHERE workspaceId = ?
        AND type = 'automation:workflow'
        AND json_extract(payload, '$.sequenceId') = ?
        AND json_extract(payload, '$.entityId') = ?
        AND status IN ('queued', 'starting', 'running', 'retrying')
      LIMIT 1
    `);

    this.stmtCheckExistingExecution = this.db.prepare(`
      SELECT id FROM sequence_executions
      WHERE workspaceId = ?
        AND sequenceId = ?
        AND (contactId = ? OR companyId = ?)
        AND status IN ('running', 'waiting')
      LIMIT 1
    `);

    this.stmtInsertJob = this.db.prepare(`
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
      VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
    `);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Starts the evaluator: registers all EventBus subscriptions.
   * Must be called from WorkspaceRuntime.start() before scheduler starts.
   */
  public start(): void {
    // All automation-relevant events from the EventType union
    const eventsToSubscribe: EventType[] = [
      'crm:created',
      'crm:updated',
      'crm:deleted',
      'job:completed',
      'job:failed',
      'job:cancelled',
      'job:paused',
      'job:resumed',
      'job:heartbeat:timeout',
      'automation:triggered',
    ];

    for (const eventType of eventsToSubscribe) {
      const unsub = this.eventBus.subscribe(eventType, (event) => this.onEvent(event));
      this.unsubscribers.push(unsub);
    }

    console.log(
      `[AutomationTriggerEvaluator] Started — subscribed to ${eventsToSubscribe.length} event types for workspace: ${this.workspaceId}`
    );
  }

  /**
   * Stops the evaluator: unregisters all EventBus subscriptions and releases resources.
   * Must be called from WorkspaceRuntime.stop() before eventBus.clear().
   */
  public stop(): void {
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch (err) {
        console.error('[AutomationTriggerEvaluator] Error unsubscribing listener:', err);
      }
    }
    this.unsubscribers.length = 0;
    console.log(`[AutomationTriggerEvaluator] Stopped — all listeners unregistered for workspace: ${this.workspaceId}`);
  }

  // ── Event handler ─────────────────────────────────────────────────────────

  /**
   * Top-level event handler — called by LocalEventBus for every subscribed event.
   * Wrapped in try/catch to prevent crashes in WorkspaceRuntime.
   */
  private onEvent(event: AppEvent): void {
    // Guard: only evaluate events for this workspace
    if (event.workspaceId !== this.workspaceId) {
      return;
    }

    console.log(`[AutomationTriggerEvaluator] Event received: ${event.type} for workspace: ${this.workspaceId}`);

    try {
      this.evaluate(event);
    } catch (err) {
      console.error(`[AutomationTriggerEvaluator] Unhandled error evaluating event "${event.type}":`, err);
    }
  }

  // ── Evaluation engine ─────────────────────────────────────────────────────

  /**
   * Core trigger evaluation logic.
   *
   * 1. Map event to AutomationTriggerType.
   * 2. Load all active sequences for this workspace.
   * 3. Filter sequences whose trigger.type matches.
   * 4. For each match: check duplicates, then insert job.
   */
  private evaluate(event: AppEvent): void {
    const triggerType = mapEventToTriggerType(event);
    if (!triggerType) {
      // Event does not map to any trigger — skip silently
      return;
    }

    const entityId: string = event.payload?.entityId || event.payload?.id || '';
    const entityType: string = event.payload?.entityType || '';

    console.log(
      `[AutomationTriggerEvaluator] Evaluating trigger type "${triggerType}" for entity "${entityId}" (${entityType})`
    );

    // Load all active sequences for this workspace
    const sequences = this.stmtLoadSequences.all(this.workspaceId) as Array<{
      id: string;
      trigger: string;
      steps: string;
    }>;

    if (sequences.length === 0) {
      return;
    }

    for (const seq of sequences) {
      // Each sequence is evaluated independently to prevent one failure from blocking others
      try {
        this.evaluateSequence(seq, triggerType, entityId, entityType, event);
      } catch (seqErr) {
        console.error(
          `[AutomationTriggerEvaluator] Error evaluating sequence "${seq.id}":`,
          seqErr
        );
        // Continue to next sequence — error isolation
      }
    }
  }

  /**
   * Evaluates a single sequence against the resolved trigger type.
   * Checks trigger match, then deduplicates, then inserts job.
   */
  private evaluateSequence(
    seq: { id: string; trigger: string; steps: string },
    triggerType: AutomationTriggerType,
    entityId: string,
    entityType: string,
    sourceEvent: AppEvent
  ): void {
    // Parse the sequence trigger JSON
    let triggerConfig: Record<string, any>;
    try {
      triggerConfig = JSON.parse(seq.trigger || '{}');
    } catch {
      console.error(`[AutomationTriggerEvaluator] Sequence "${seq.id}" has invalid trigger JSON — skipping.`);
      return;
    }

    // Check if this sequence's trigger type matches the resolved trigger type
    if (triggerConfig.type !== triggerType) {
      return; // Not a match — skip silently
    }

    console.log(`[AutomationTriggerEvaluator] Sequence "${seq.id}" matched trigger "${triggerType}"`);

    // ── Duplicate prevention ─────────────────────────────────────────────────

    // Check 1: Is there already a queued/active automation:workflow job for this sequence+entity?
    const existingJob = this.stmtCheckExistingJob.get(
      this.workspaceId,
      seq.id,
      entityId
    ) as { id: string } | undefined;

    if (existingJob) {
      console.log(
        `[AutomationTriggerEvaluator] Duplicate prevented — active job "${existingJob.id}" already exists for sequence "${seq.id}" + entity "${entityId}"`
      );
      return;
    }

    // Check 2: Is there already a running/waiting sequence_execution for this sequence+entity?
    const existingExecution = this.stmtCheckExistingExecution.get(
      this.workspaceId,
      seq.id,
      entityId,
      entityId
    ) as { id: string } | undefined;

    if (existingExecution) {
      console.log(
        `[AutomationTriggerEvaluator] Duplicate prevented — active execution "${existingExecution.id}" already exists for sequence "${seq.id}" + entity "${entityId}"`
      );
      return;
    }

    // ── Job insertion ─────────────────────────────────────────────────────────

    const jobId = randomUUID();
    const payload = JSON.stringify({
      sequenceId: seq.id,
      entityId,
      entityType,
      triggerType,
      triggerPayload: sourceEvent.payload,
      workspaceId: this.workspaceId,
    });

    this.stmtInsertJob.run(jobId, this.workspaceId, payload);

    console.log(
      `[AutomationTriggerEvaluator] Workflow job "${jobId}" queued for sequence "${seq.id}" + entity "${entityId}"`
    );

    // ── Publish automation:triggered ──────────────────────────────────────────
    // Published ONLY after successful DB insert — never before.

    this.eventBus.publish('automation:triggered', {
      sequenceId: seq.id,
      jobId,
      entityId,
      entityType,
      triggerType,
      workspaceId: this.workspaceId,
    });
  }
}

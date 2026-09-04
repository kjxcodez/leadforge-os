import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { operationsRouter } from '../../routes/operations.js';
import { OperationsService } from '../../services/operations/operations.service.js';
import { errorHandler } from '../../middleware/error-handler.js';

vi.mock('../../services/operations/operations.service.js');

describe('Operations API Route & Schema Contracts', () => {
  let app: OpenAPIHono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new OpenAPIHono();
    app.onError(errorHandler);
  });

  it('enforces workspace context requirement (HTTP 403 / Forbidden)', async () => {
    // Mount router without workspace middleware
    app.route('/operations', operationsRouter);

    const res = await app.request('/operations/health', {
      method: 'GET'
    });

    // When workspaceId is missing in Hono context, getWorkspaceId throws ForbiddenError
    expect(res.status).toBe(403);
  });

  it('GET /operations/health returns 200 with all 8 subsystem health objects', async () => {
    const mockSummary = {
      workspaceId: 'ws_contract_test',
      overallStatus: 'healthy',
      timestamp: '2026-09-04T00:00:00.000Z',
      subsystems: {
        api: { status: 'healthy', message: 'API Gateway operational', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        mongodb: { status: 'healthy', message: 'MongoDB replica set connected', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        sqlite: { status: 'healthy', message: 'Desktop SQLite cache accessible', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        gmail: { status: 'healthy', message: 'OAuth mailbox authorized', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        scheduler: { status: 'healthy', message: 'Scheduler loop running', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        workers: { status: 'healthy', message: 'Worker pool active', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        inboundPolling: { status: 'healthy', message: 'Reply poller active', lastCheckedAt: '2026-09-04T00:00:00.000Z' },
        reconciliation: { status: 'healthy', message: 'Reconciler active', lastCheckedAt: '2026-09-04T00:00:00.000Z' }
      },
      metrics: {
        activeOperationsCount: 0,
        failedOperationsCount: 0,
        staleOperationsCount: 0,
        retryingCount: 0,
        lastSuccessfulPollAt: '2026-09-04T00:00:00.000Z',
        lastSuccessfulReconciliationAt: '2026-09-04T00:00:00.000Z'
      }
    };

    OperationsService.prototype.getHealthSummary = vi.fn().mockResolvedValue(mockSummary);

    app.use('*', async (c, next) => {
      (c as any).set('workspaceId', 'ws_contract_test');
      await next();
    });
    app.route('/operations', operationsRouter);

    const res = await app.request('/operations/health', {
      method: 'GET'
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.workspaceId).toBe('ws_contract_test');
    expect(body.data.overallStatus).toBe('healthy');
    expect(Object.keys(body.data.subsystems)).toHaveLength(8);
  });

  it('GET /operations returns paginated operations list', async () => {
    const mockList = {
      items: [
        {
          id: 'op_1',
          type: 'email:send',
          workspaceId: 'ws_contract_test',
          status: 'completed',
          createdAt: '2026-09-04T00:00:00.000Z',
          attempt: 1,
          maxAttempts: 3,
          isStale: false,
          retryable: false
        }
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1
    };

    OperationsService.prototype.listOperations = vi.fn().mockResolvedValue(mockList);

    app.use('*', async (c, next) => {
      (c as any).set('workspaceId', 'ws_contract_test');
      await next();
    });
    app.route('/operations', operationsRouter);

    const res = await app.request('/operations?status=completed&page=1&limit=50', {
      method: 'GET'
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe('op_1');
    expect(OperationsService.prototype.listOperations).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        page: 1,
        limit: 50
      })
    );
  });

  it('GET /operations/:id returns 404 when operation is not found', async () => {
    OperationsService.prototype.getOperation = vi.fn().mockResolvedValue(null);

    app.use('*', async (c, next) => {
      (c as any).set('workspaceId', 'ws_contract_test');
      await next();
    });
    app.route('/operations', operationsRouter);

    const res = await app.request('/operations/60f7e1b5c9e77c001f3b1234', {
      method: 'GET'
    });

    expect(res.status).toBe(404);
  });

  it('POST /operations/:id/retry passes retry parameters and returns result', async () => {
    const mockRetryResult = {
      success: true,
      message: 'Job successfully queued for retry.',
      operation: {
        id: '60f7e1b5c9e77c001f3b1234',
        type: 'crawler:website',
        workspaceId: 'ws_contract_test',
        status: 'queued',
        createdAt: '2026-09-04T00:00:00.000Z',
        attempt: 1,
        maxAttempts: 3,
        isStale: false,
        retryable: true
      }
    };

    OperationsService.prototype.retryOperation = vi.fn().mockResolvedValue(mockRetryResult);

    app.use('*', async (c, next) => {
      (c as any).set('workspaceId', 'ws_contract_test');
      await next();
    });
    app.route('/operations', operationsRouter);

    const res = await app.request('/operations/60f7e1b5c9e77c001f3b1234/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('successfully queued');
    expect(OperationsService.prototype.retryOperation).toHaveBeenCalledWith(
      '60f7e1b5c9e77c001f3b1234',
      false
    );
  });

  it('POST /operations/:id/reconcile invokes reconcileOperation', async () => {
    const mockReconcileResult = {
      reconciled: true,
      resolvedStatus: 'SENT',
      message: 'Reconciliation completed.'
    };

    OperationsService.prototype.reconcileOperation = vi.fn().mockResolvedValue(mockReconcileResult);

    app.use('*', async (c, next) => {
      (c as any).set('workspaceId', 'ws_contract_test');
      await next();
    });
    app.route('/operations', operationsRouter);

    const res = await app.request('/operations/60f7e1b5c9e77c001f3b1234/reconcile', {
      method: 'POST'
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.resolvedStatus).toBe('SENT');
  });
});

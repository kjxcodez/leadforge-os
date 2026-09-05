import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { deliveriesRouter } from '../../routes/deliveries.js';
import { suppressionsRouter } from '../../routes/suppressions.js';
import { EmailDeliveryRepository } from '../../repositories/email-delivery/email-delivery.repository.js';
import { ReconciliationService } from '../../services/email/reconciliation.service.js';
import { SuppressionRepository } from '../../repositories/suppression/suppression.repository.js';
import { errorHandler } from '../../middleware/error-handler.js';

vi.mock('../../repositories/email-delivery/email-delivery.repository.js');
vi.mock('../../services/email/reconciliation.service.js');
vi.mock('../../repositories/suppression/suppression.repository.js');

describe('Inbound Reconciliation & Suppression Contracts (Phase 17)', () => {
  let app: OpenAPIHono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new OpenAPIHono();
    app.onError(errorHandler);
  });

  describe('POST /email-deliveries/:id/manual-reconcile Contract', () => {
    it('enforces workspace context requirement (HTTP 403 / Forbidden)', async () => {
      app.route('/email-deliveries', deliveriesRouter);

      const res = await app.request('/email-deliveries/del_inbound_1/manual-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: 'contact_1'
        })
      });

      expect(res.status).toBe(403);
    });

    it('rejects request with HTTP 400 when contactId is missing', async () => {
      app.use('*', async (c, next) => {
        (c as any).set('workspaceId', 'ws_test');
        (c as any).set('user', { id: 'usr_test' });
        await next();
      });
      app.route('/email-deliveries', deliveriesRouter);

      const res = await app.request('/email-deliveries/del_inbound_1/manual-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'missing contact'
        })
      });

      expect(res.status).toBe(400);
    });

    it('returns 200 with reconciled delivery when valid parameters provided', async () => {
      const mockReconciledDelivery = {
        _id: 'del_inbound_1',
        workspaceId: 'ws_test',
        direction: 'INBOUND',
        status: 'SENT',
        processingStatus: 'MATCHED',
        matchConfidence: 'manual',
        contactId: 'contact_42',
        matchedDeliveryId: 'del_outbound_1',
        campaignId: 'camp_1',
        reconciliationNotes: 'Manual reconciliation by operator',
        reconciledAt: new Date().toISOString()
      };

      ReconciliationService.prototype.manualReconcileInboundReply = vi
        .fn()
        .mockResolvedValue(mockReconciledDelivery);

      app.use('*', async (c, next) => {
        (c as any).set('workspaceId', 'ws_test');
        (c as any).set('user', { id: 'usr_test' });
        await next();
      });
      app.route('/email-deliveries', deliveriesRouter);

      const res = await app.request('/email-deliveries/del_inbound_1/manual-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: 'contact_42',
          matchedDeliveryId: 'del_outbound_1',
          campaignId: 'camp_1',
          notes: 'Manual reconciliation by operator'
        })
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.processingStatus).toBe('MATCHED');
      expect(json.data.matchConfidence).toBe('manual');
      expect(json.data.contactId).toBe('contact_42');
      expect(ReconciliationService.prototype.manualReconcileInboundReply).toHaveBeenCalledWith(
        'del_inbound_1',
        expect.objectContaining({
          contactId: 'contact_42',
          matchedDeliveryId: 'del_outbound_1',
          campaignId: 'camp_1',
          notes: 'Manual reconciliation by operator'
        })
      );
    });
  });

  describe('GET /email-deliveries?processingStatus Contract', () => {
    it('passes processingStatus filter to repository query', async () => {
      const mockResult = {
        data: [
          {
            _id: 'del_pending_1',
            direction: 'INBOUND',
            processingStatus: 'CORRELATION_PENDING',
            subject: 'Re: Follow up'
          }
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      };

      EmailDeliveryRepository.prototype.paginate = vi.fn().mockResolvedValue(mockResult);

      app.use('*', async (c, next) => {
        (c as any).set('workspaceId', 'ws_test');
        (c as any).set('user', { id: 'usr_test' });
        await next();
      });
      app.route('/email-deliveries', deliveriesRouter);

      const res = await app.request('/email-deliveries?processingStatus=CORRELATION_PENDING', {
        method: 'GET'
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.data[0].processingStatus).toBe('CORRELATION_PENDING');
      expect(EmailDeliveryRepository.prototype.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          processingStatus: 'CORRELATION_PENDING'
        }),
        1,
        50,
        { createdAt: -1 }
      );
    });
  });

  describe('DELETE /suppressions/:email Contract (UNSUPPRESS-13)', () => {
    it('returns restoredContactIds alongside unsuppression status', async () => {
      SuppressionRepository.prototype.unsuppress = vi.fn().mockResolvedValue({
        success: true,
        unsuppressed: true,
        email: 'bounced@example.com',
        restoredContactIds: ['contact_bounced_1', 'contact_bounced_2']
      });

      app.use('*', async (c, next) => {
        (c as any).set('workspaceId', 'ws_test');
        (c as any).set('user', { id: 'usr_test' });
        await next();
      });
      app.route('/suppressions', suppressionsRouter);

      const res = await app.request('/suppressions/bounced%40example.com', {
        method: 'DELETE'
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.unsuppressed).toBe(true);
      expect(json.data.email).toBe('bounced@example.com');
      expect(json.data.restoredContactIds).toEqual(['contact_bounced_1', 'contact_bounced_2']);
    });
  });
});

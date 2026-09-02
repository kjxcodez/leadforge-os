import { OpenAPIHono } from '@hono/zod-openapi';
import { EmailDeliveryRepository } from '../repositories/email-delivery/email-delivery.repository.js';
import {
  createEmailDeliveryDtoSchema,
  bulkEmailDeliveryDtoSchema,
  updateEmailDeliveryDtoSchema,
  reserveEmailDeliveryDtoSchema,
  finalizeEmailDeliveryDtoSchema
} from '@leadforge/schema';
import { successResponse } from '../utils/index.js';
import { getWorkspaceId } from './common.js';
import { NotFoundError } from '../errors/index.js';

export const deliveriesRouter = new OpenAPIHono();

// 1. List / Paginate Deliveries
deliveriesRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const campaignId = c.req.query('campaignId');
  const sequenceId = c.req.query('sequenceId');
  const status = c.req.query('status');

  const filter: any = {};
  if (campaignId && campaignId !== 'undefined' && campaignId !== 'null') filter.campaignId = campaignId;
  if (sequenceId && sequenceId !== 'undefined' && sequenceId !== 'null') filter.sequenceId = sequenceId;
  if (status && status !== 'undefined' && status !== 'null') filter.status = status;

  const repo = new EmailDeliveryRepository(wsId);
  const result = await repo.paginate(filter, page, limit, { createdAt: -1 });
  return c.json(successResponse(result));
});

// 2. Query Ambiguous Deliveries for Diagnosis
deliveriesRouter.get('/ambiguous', async (c) => {
  const wsId = getWorkspaceId(c);
  const repo = new EmailDeliveryRepository(wsId);
  const ambiguous = await repo.findMany({ status: 'AMBIGUOUS' });
  return c.json(successResponse(ambiguous));
});

// 3. Lookup Delivery by Idempotency Key
deliveriesRouter.get('/by-idempotency/:key', async (c) => {
  const wsId = getWorkspaceId(c);
  const key = c.req.param('key');

  const repo = new EmailDeliveryRepository(wsId);
  const delivery = await repo.findByIdempotencyKey(key);
  if (!delivery) throw new NotFoundError(`Delivery with idempotency key ${key} not found`);
  return c.json(successResponse(delivery));
});

// 4. Reserve Delivery Atomically (Pre-Send Ledger Reservation)
deliveriesRouter.post('/reserve', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const validated = reserveEmailDeliveryDtoSchema.parse(body);

  const repo = new EmailDeliveryRepository(wsId);
  const result = await repo.reserveDelivery(validated);
  return c.json(successResponse(result), result.isAlreadySent ? 200 : 201);
});

// 5. Batch Create/Upsert Deliveries (Max 50)
deliveriesRouter.post('/bulk', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const validated = bulkEmailDeliveryDtoSchema.parse(body);

  const repo = new EmailDeliveryRepository(wsId);
  const result = await repo.bulkUpsert(validated.deliveries, ['idempotencyKey']);
  return c.json(successResponse(result), result.failed > 0 && result.inserted === 0 ? 400 : 201);
});

// 6. Create Single Delivery
deliveriesRouter.post('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const validated = createEmailDeliveryDtoSchema.parse(body);

  const repo = new EmailDeliveryRepository(wsId);
  const existing = await repo.findByIdempotencyKey(validated.idempotencyKey);
  if (existing) {
    return c.json(successResponse(existing), 200);
  }

  const delivery = await repo.create(validated as any);
  return c.json(successResponse(delivery), 201);
});

// 7. Get Delivery by ID
deliveriesRouter.get('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const repo = new EmailDeliveryRepository(wsId);
  const delivery = await repo.findById(id);
  return c.json(successResponse(delivery));
});

// 8. Finalize Delivery Status (Mark SENT)
deliveriesRouter.post('/:id/finalize', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const validated = finalizeEmailDeliveryDtoSchema.parse(body);

  const repo = new EmailDeliveryRepository(wsId);
  const updated = await repo.finalizeDelivery(id, {
    providerMessageId: validated.providerMessageId || '',
    providerThreadId: validated.providerThreadId,
    sentAt: validated.sentAt || new Date()
  });

  return c.json(successResponse(updated));
});

// 9. Reconcile Stale Deliveries
deliveriesRouter.post('/reconcile', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json().catch(() => ({}));
  const maxAgeMs = typeof body.maxAgeMs === 'number' ? body.maxAgeMs : 300000;

  const repo = new EmailDeliveryRepository(wsId);
  const diagnosis = await repo.reconcileStaleDeliveries(maxAgeMs);
  return c.json(successResponse(diagnosis));
});

// 10. Update Delivery Status (Mark SENT, FAILED, RETRYING)
deliveriesRouter.patch('/:id/status', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const validated = updateEmailDeliveryDtoSchema.parse(body);

  const repo = new EmailDeliveryRepository(wsId);
  const updated = await repo.updateDeliveryStatus(
    id,
    validated.status,
    validated.providerMessageId,
    validated.error,
    validated.sentAt
  );
  if (!updated) throw new NotFoundError(`Delivery with id ${id} not found`);
  return c.json(successResponse(updated));
});

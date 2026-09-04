import { OpenAPIHono } from '@hono/zod-openapi';
import { SuppressionRepository } from '../repositories/suppression/suppression.repository.js';
import { createSuppressionDtoSchema } from '@leadforge/schema';
import { successResponse } from '../utils/index.js';
import { getWorkspaceId, getUserId } from './common.js';
import { BadRequestError } from '../errors/index.js';

export const suppressionsRouter = new OpenAPIHono();

// 1. List workspace suppressions
suppressionsRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const repo = new SuppressionRepository(wsId);
  const reason = c.req.query('reason');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;
  const skip = c.req.query('skip') ? parseInt(c.req.query('skip')!, 10) : 0;

  const result = await repo.listSuppressions({ reason, limit, skip });
  return c.json(successResponse(result));
});

// 2. Check if a specific email is suppressed
suppressionsRouter.get('/check', async (c) => {
  const wsId = getWorkspaceId(c);
  const email = c.req.query('email');
  if (!email) {
    throw new BadRequestError('Query param "email" is required.');
  }

  const repo = new SuppressionRepository(wsId);
  const suppression = await repo.getSuppression(email);
  return c.json(
    successResponse({
      email,
      suppressed: Boolean(suppression),
      suppression: suppression || null
    })
  );
});

// 3. Record a suppression
suppressionsRouter.post('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json().catch(() => ({}));
  const validated = createSuppressionDtoSchema.parse(body);

  let userId: string | null = null;
  try {
    userId = getUserId(c);
  } catch {
    userId = null;
  }

  const repo = new SuppressionRepository(wsId);
  const record = await repo.suppress(
    validated.email,
    validated.reason,
    validated.source || 'manual',
    validated.evidence || null,
    userId,
    validated.notes || null
  );

  return c.json(successResponse(record), 201);
});

// 4. Remove suppression (unsuppress)
suppressionsRouter.delete('/:email', async (c) => {
  const wsId = getWorkspaceId(c);
  const email = decodeURIComponent(c.req.param('email'));

  let userId: string | null = null;
  try {
    userId = getUserId(c);
  } catch {
    userId = 'user';
  }

  const repo = new SuppressionRepository(wsId);
  const removed = await repo.unsuppress(email, userId || 'user');

  return c.json(successResponse({ email, unsuppressed: removed }));
});

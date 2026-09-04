import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { EmailQualityService } from '../services/email/email-quality.service.js';
import { successResponse } from '../utils/index.js';
import { getWorkspaceId } from './common.js';
import { BadRequestError } from '../errors/index.js';

export const emailQualityRouter = new OpenAPIHono();

const evaluateBodySchema = z.object({
  email: z.string().email(),
  forceRefresh: z.boolean().optional()
});

const verifyBodySchema = z.object({
  email: z.string().email()
});

// 1. Evaluate Email Deliverability & Quality (cached or fresh)
emailQualityRouter.post('/evaluate', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json().catch(() => ({}));
  const validated = evaluateBodySchema.safeParse(body);
  if (!validated.success) {
    throw new BadRequestError(`Invalid evaluation payload: ${validated.error.message}`);
  }

  const service = new EmailQualityService(wsId);
  const result = await service.evaluateEmail(
    validated.data.email,
    validated.data.forceRefresh !== undefined
      ? { forceRefresh: validated.data.forceRefresh }
      : undefined
  );

  return c.json(successResponse(result));
});

// 2. Explicit Verification Trigger
emailQualityRouter.post('/verify', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json().catch(() => ({}));
  const validated = verifyBodySchema.safeParse(body);
  if (!validated.success) {
    throw new BadRequestError(`Invalid verification payload: ${validated.error.message}`);
  }

  const service = new EmailQualityService(wsId);
  const result = await service.verifyEmail(validated.data.email);

  return c.json(successResponse(result));
});

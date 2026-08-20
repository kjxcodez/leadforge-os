import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { EmailAccountService } from '../../services/email/email-account.service.js';
import { EmailService } from '../../services/email/email.service.js';
import { successResponse } from '../../utils/index.js';
import { ForbiddenError } from '../../errors/index.js';

export const emailRouter = new OpenAPIHono();

function getWorkspaceId(c: any): string {
  const wsId = c.get('workspaceId');
  if (!wsId) throw new ForbiddenError('Workspace context required.');
  return wsId.toString();
}

const connectSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  name: z.string().optional(),
  signature: z.string().optional(),
  dailyLimit: z.number().optional(),
  hourlyLimit: z.number().optional(),
  isDefault: z.boolean().optional()
});

const reconnectSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  name: z.string().optional(),
  signature: z.string().optional(),
  dailyLimit: z.number().optional(),
  hourlyLimit: z.number().optional()
});

const sendSchema = z.object({
  accountId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  from: z.string().optional()
});

// ── Accounts ──────────────────────────────────────────────────────────────

emailRouter.get('/accounts', async (c) => {
  const wsId = getWorkspaceId(c);
  const service = new EmailAccountService(wsId);
  const accounts = await service.listAccounts();
  return c.json(successResponse(accounts));
});

emailRouter.get('/accounts/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new EmailAccountService(wsId);
  const account = await service.getAccount(id);
  return c.json(successResponse(account));
});

// Connect Gmail mailbox via authorization code (exchanged server-side).
emailRouter.post('/accounts/gmail/connect', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = connectSchema.parse(await c.req.json());
  const service = new EmailAccountService(wsId);
  const account = await service.connectGmail(body);
  return c.json(successResponse(account));
});

emailRouter.post('/accounts/:id/reconnect', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = reconnectSchema.parse(await c.req.json());
  const service = new EmailAccountService(wsId);
  const account = await service.reconnectGmail(id, body);
  return c.json(successResponse(account));
});

emailRouter.post('/accounts/:id/disconnect', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new EmailAccountService(wsId);
  const result = await service.disconnect(id);
  return c.json(successResponse(result));
});

// Metadata-only sync from desktop after a local reconnect.
// Deliberately does NOT accept credential fields (refreshToken, accessToken, etc.).
const metaSyncSchema = z.object({
  provider: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  status: z.string().optional(),
  googleAccountId: z.string().optional(),
  signature: z.string().optional(),
  dailyLimit: z.number().optional(),
  hourlyLimit: z.number().optional()
});

emailRouter.patch('/accounts/:id/meta', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const raw = metaSyncSchema.parse(await c.req.json());
  // Strip undefined keys to satisfy exactOptionalPropertyTypes
  const body = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined)
  ) as Parameters<EmailAccountService['syncMeta']>[1];
  const service = new EmailAccountService(wsId);
  const account = await service.syncMeta(id, body);
  return c.json(successResponse(account));
});

// ── Sending ────────────────────────────────────────────────────────────────

emailRouter.post('/accounts/:id/test', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new EmailService(wsId);
  const result = await service.sendTest(id);
  return c.json(successResponse(result));
});

emailRouter.post('/send', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = sendSchema.parse(await c.req.json());
  const service = new EmailService(wsId);
  const result = await service.send(body);
  return c.json(successResponse(result));
});

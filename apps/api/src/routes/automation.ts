import { OpenAPIHono } from '@hono/zod-openapi';
import { AutomationService } from '../services/automation/automation.service.js';
import { successResponse } from '../utils/index.js';
import { ForbiddenError } from '../errors/index.js';

export const automationRouter = new OpenAPIHono();

// Helper to get active workspace ID from context
function getWorkspaceId(c: any): string {
  const wsId = c.get('workspaceId');
  if (!wsId) throw new ForbiddenError('Workspace context required.');
  return wsId.toString();
}

// ── Sequences CRUD ──────────────────────────────────────────────────────────

automationRouter.get('/sequences', async (c) => {
  const wsId = getWorkspaceId(c);
  const service = new AutomationService(wsId);
  const list = await service.listSequences();
  return c.json(successResponse(list));
});

automationRouter.get('/sequences/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AutomationService(wsId);
  const sequence = await service.getSequence(id);
  return c.json(successResponse(sequence));
});

automationRouter.post('/sequences', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new AutomationService(wsId);
  const sequence = await service.createSequence(body);
  return c.json(successResponse(sequence));
});

automationRouter.patch('/sequences/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const service = new AutomationService(wsId);
  const sequence = await service.updateSequence(id, body);
  return c.json(successResponse(sequence));
});

automationRouter.delete('/sequences/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AutomationService(wsId);
  await service.deleteSequence(id);
  return c.json(successResponse({ success: true }));
});

// ── Executions ──────────────────────────────────────────────────────────────

automationRouter.get('/executions', async (c) => {
  const wsId = getWorkspaceId(c);
  const service = new AutomationService(wsId);
  const list = await service.listExecutions();
  return c.json(successResponse(list));
});

automationRouter.get('/executions/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AutomationService(wsId);
  const exec = await service.getExecution(id);
  return c.json(successResponse(exec));
});

automationRouter.post('/executions', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new AutomationService(wsId);
  const exec = await service.createExecution(body);
  return c.json(successResponse(exec));
});

automationRouter.patch('/executions/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const service = new AutomationService(wsId);
  const exec = await service.updateExecution(id, body);
  return c.json(successResponse(exec));
});

automationRouter.delete('/executions/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AutomationService(wsId);
  await service.deleteExecution(id);
  return c.json(successResponse({ success: true }));
});

automationRouter.get('/executions/:id/logs', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AutomationService(wsId);
  const logs = await service.getExecutionLogs(id);
  return c.json(successResponse(logs));
});

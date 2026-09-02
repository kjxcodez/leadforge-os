import { OpenAPIHono } from '@hono/zod-openapi';
import { WorkspaceMemoryRepository } from '../repositories/workspace-memory/workspace-memory.repository.js';
import { successResponse } from '../utils/index.js';
import { getWorkspaceId } from './common.js';
import { NotFoundError } from '../errors/index.js';

export const memoryRouter = new OpenAPIHono();

// 1. Get Memory Key
memoryRouter.get('/:scope/:key', async (c) => {
  const wsId = getWorkspaceId(c);
  const scope = c.req.param('scope');
  const key = c.req.param('key');
  const repo = new WorkspaceMemoryRepository(wsId);
  const memory = await repo.getMemory(scope, key);
  if (!memory) throw new NotFoundError(`Memory for ${scope}:${key} not found`);
  return c.json(successResponse(memory));
});

// 2. Set Memory Key
memoryRouter.post('/:scope/:key', async (c) => {
  const wsId = getWorkspaceId(c);
  const scope = c.req.param('scope');
  const key = c.req.param('key');
  const body = await c.req.json();
  const repo = new WorkspaceMemoryRepository(wsId);
  const memory = await repo.setMemory(scope, key, body.value !== undefined ? body.value : body);
  return c.json(successResponse(memory));
});

// 3. Delete Memory Key
memoryRouter.delete('/:scope/:key', async (c) => {
  const wsId = getWorkspaceId(c);
  const scope = c.req.param('scope');
  const key = c.req.param('key');
  const repo = new WorkspaceMemoryRepository(wsId);
  const deleted = await repo.deleteMemory(scope, key);
  return c.json(successResponse({ deleted }));
});

// 4. List All Keys in Scope
memoryRouter.get('/:scope', async (c) => {
  const wsId = getWorkspaceId(c);
  const scope = c.req.param('scope');
  const repo = new WorkspaceMemoryRepository(wsId);
  const list = await repo.listScope(scope);
  return c.json(successResponse(list));
});

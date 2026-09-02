import { ForbiddenError } from '../errors/index.js';

export function getUserId(c: any): string {
  const user = c.get('user');
  const userId = user?.id || user?._id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  return userId.toString();
}

export function getWorkspaceId(c: any): string {
  const wsId = c.get('workspaceId');
  if (!wsId) throw new ForbiddenError('Workspace context required.');
  return wsId.toString();
}

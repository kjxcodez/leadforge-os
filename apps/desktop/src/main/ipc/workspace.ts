import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';

/**
 * Registers workspace management and membership/invitations IPC channels.
 */
export function registerWorkspaceIpc(sdk: SdkClient) {
  safeRegister('workspaces:create', async (_event, payload) => {
    console.log('Main Process: Creating workspace:', payload);
    return sdk.workspaces.create(payload);
  });

  safeRegister('workspaces:list', async () => {
    console.log('Main Process: Listing user workspaces');
    return sdk.workspaces.list();
  });

  safeRegister('workspaces:update', async (_event, payload) => {
    console.log('Main Process: Updating workspace details:', payload);
    return sdk.workspaces.update(payload.id, payload.dto);
  });

  safeRegister('workspaces:delete', async (_event, payload) => {
    console.log('Main Process: Deleting workspace:', payload);
    return sdk.workspaces.delete(workspaceIdOrToken(payload));
  });

  safeRegister('workspaces:get', async (_event, payload) => {
    console.log('Main Process: Fetching workspace:', payload);
    return sdk.workspaces.get(workspaceIdOrToken(payload));
  });

  // Members Management
  safeRegister('workspaces:members:list', async (_event, payload) => {
    console.log('Main Process: Listing members for workspace:', payload);
    return sdk.workspaces.listMembers(workspaceIdOrToken(payload));
  });

  safeRegister('workspaces:members:invite', async (_event, payload) => {
    console.log('Main Process: Inviting user to workspace:', payload);
    return sdk.workspaces.inviteMember(payload.workspaceId || payload.id, { email: payload.email, role: payload.role });
  });

  safeRegister('workspaces:members:updateRole', async (_event, payload) => {
    console.log('Main Process: Updating workspace member role:', payload);
    return sdk.workspaces.updateMemberRole(payload.id, payload.userId, payload.role);
  });

  safeRegister('workspaces:members:remove', async (_event, payload) => {
    console.log('Main Process: Removing member from workspace:', payload);
    return sdk.workspaces.removeMember(payload.id, payload.userId);
  });

  safeRegister('workspaces:members:leave', async (_event, payload) => {
    console.log('Main Process: Leaving workspace:', payload);
    return sdk.workspaces.leave(workspaceIdOrToken(payload));
  });

  safeRegister('workspaces:members:transferOwnership', async (_event, payload) => {
    console.log('Main Process: Transferring workspace ownership:', payload);
    return sdk.workspaces.transferOwnership(payload.id, payload.newOwnerId);
  });

  // Invitations
  safeRegister('workspaces:invites:list', async () => {
    console.log('Main Process: Listing pending user invites');
    return sdk.workspaces.listPendingInvites();
  });

  safeRegister('workspaces:invites:accept', async (_event, payload) => {
    console.log('Main Process: Accepting invite:', payload);
    return sdk.workspaces.acceptInvite(payload);
  });

  safeRegister('workspaces:invites:decline', async (_event, payload) => {
    console.log('Main Process: Declining invite:', payload);
    return sdk.workspaces.declineInvite(payload);
  });
}

/**
 * Handles payload unpacking to resolve workspaceId.
 */
function workspaceIdOrToken(payload: any): string {
  if (typeof payload === 'string') return payload;
  return payload.id || payload.workspaceId || '';
}

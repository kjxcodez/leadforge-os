import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  createWorkspaceDtoSchema,
  updateWorkspaceDtoSchema,
  inviteMemberDtoSchema,
  updateMemberRoleDtoSchema,
  acceptInviteDtoSchema,
  WorkspaceRole,
  createCompanyDtoSchema,
  updateCompanyDtoSchema,
  createContactDtoSchema,
  updateContactDtoSchema,
  createCampaignDtoSchema,
  updateCampaignDtoSchema
} from '@leadforge/schema';
import { WorkspaceService } from '../services/workspace/workspace.service.js';
import { CompanyService } from '../services/company/company.service.js';
import { ContactService } from '../services/contact/contact.service.js';
import { CampaignService } from '../services/campaign/campaign.service.js';
import { OutreachService } from '../services/outreach/outreach.service.js';
import { successResponse } from '../utils/index.js';
import { ForbiddenError } from '../errors/index.js';

export const companiesRouter = new OpenAPIHono();
export const contactsRouter = new OpenAPIHono();
export const campaignsRouter = new OpenAPIHono();
export const outreachRouter = new OpenAPIHono();
export const workspacesRouter = new OpenAPIHono();

const workspaceService = new WorkspaceService();

// Helper to get active user ID from context
function getUserId(c: any): string {
  const user = c.get('user');
  const userId = user?.id || user?._id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  return userId.toString();
}

// Helper to get active workspace ID from context
function getWorkspaceId(c: any): string {
  const wsId = c.get('workspaceId');
  if (!wsId) throw new ForbiddenError('Workspace context required.');
  return wsId.toString();
}

// ---------------------------------------------------------------------------
// 1. List User Workspaces
// ---------------------------------------------------------------------------
const listWorkspacesRoute = createRoute({
  method: 'get',
  path: '/',
  summary: 'List User Workspaces',
  tags: ['Workspace'],
  responses: {
    200: { description: 'List of workspaces retrieved successfully' }
  }
});

workspacesRouter.openapi(listWorkspacesRoute, async (c) => {
  const userId = getUserId(c);
  const workspaces = await workspaceService.listUserWorkspaces(userId);
  return c.json(successResponse(workspaces));
});

// ---------------------------------------------------------------------------
// 2. Get Workspace Details
// ---------------------------------------------------------------------------
const getWorkspaceRoute = createRoute({
  method: 'get',
  path: '/{id}',
  summary: 'Get Workspace Details',
  tags: ['Workspace'],
  request: {
    params: z.object({ id: z.string() })
  },
  responses: {
    200: { description: 'Workspace details retrieved' },
    404: { description: 'Workspace not found' }
  }
});

workspacesRouter.openapi(getWorkspaceRoute, async (c) => {
  const { id } = c.req.valid('param');
  const workspace = await workspaceService.getWorkspaceById(id);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 3. Create Workspace
// ---------------------------------------------------------------------------
const createWorkspaceRoute = createRoute({
  method: 'post',
  path: '/',
  summary: 'Create Workspace',
  tags: ['Workspace'],
  request: {
    body: {
      content: {
        'application/json': { schema: createWorkspaceDtoSchema }
      }
    }
  },
  responses: {
    200: { description: 'Workspace created successfully' }
  }
});

workspacesRouter.openapi(createWorkspaceRoute, async (c) => {
  const body = c.req.valid('json');
  const userId = getUserId(c);
  const user = (c as any).get('user') as any;
  const workspace = await workspaceService.createWorkspace({
    ...body,
    ownerId: userId,
    ownerEmail: user?.email ?? ''
  });
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 4. Update Workspace
// ---------------------------------------------------------------------------
const updateWorkspaceRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  summary: 'Update Workspace',
  tags: ['Workspace'],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': { schema: updateWorkspaceDtoSchema }
      }
    }
  },
  responses: {
    200: { description: 'Workspace updated successfully' }
  }
});

workspacesRouter.openapi(updateWorkspaceRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const userId = getUserId(c);
  const workspace = await workspaceService.updateWorkspace(id, body, userId);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 5. Delete Workspace (Soft Delete)
// ---------------------------------------------------------------------------
const deleteWorkspaceRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: 'Soft Delete Workspace',
  tags: ['Workspace'],
  request: {
    params: z.object({ id: z.string() })
  },
  responses: {
    200: { description: 'Workspace deleted successfully' }
  }
});

workspacesRouter.openapi(deleteWorkspaceRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = getUserId(c);
  await workspaceService.softDeleteWorkspace(id, userId);
  return c.json(successResponse({ success: true }));
});

// ---------------------------------------------------------------------------
// 6. Invite Member
// ---------------------------------------------------------------------------
const inviteMemberRoute = createRoute({
  method: 'post',
  path: '/{id}/invite',
  summary: 'Invite Member to Workspace',
  tags: ['Workspace Members'],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': { schema: inviteMemberDtoSchema }
      }
    }
  },
  responses: {
    200: { description: 'Member invited successfully' }
  }
});

workspacesRouter.openapi(inviteMemberRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const userId = getUserId(c);
  const workspace = await workspaceService.inviteMember(id, body, userId);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 7. List Workspace Members
// ---------------------------------------------------------------------------
const listMembersRoute = createRoute({
  method: 'get',
  path: '/{id}/members',
  summary: 'List Workspace Members',
  tags: ['Workspace Members'],
  request: {
    params: z.object({ id: z.string() })
  },
  responses: {
    200: { description: 'Workspace members listed successfully' }
  }
});

workspacesRouter.openapi(listMembersRoute, async (c) => {
  const { id } = c.req.valid('param');
  const workspace = await workspaceService.getWorkspaceById(id);
  return c.json(successResponse(workspace.members));
});

// ---------------------------------------------------------------------------
// 8. Update Member Role
// ---------------------------------------------------------------------------
const updateMemberRoleRoute = createRoute({
  method: 'patch',
  path: '/{id}/members/{memberId}/role',
  summary: 'Update Member Role',
  tags: ['Workspace Members'],
  request: {
    params: z.object({ id: z.string(), memberId: z.string() }),
    body: {
      content: {
        'application/json': { schema: updateMemberRoleDtoSchema }
      }
    }
  },
  responses: {
    200: { description: 'Role updated successfully' }
  }
});

workspacesRouter.openapi(updateMemberRoleRoute, async (c) => {
  const { id, memberId } = c.req.valid('param');
  const { role } = c.req.valid('json');
  const userId = getUserId(c);
  const workspace = await workspaceService.updateMemberRole(
    id,
    memberId,
    role as WorkspaceRole,
    userId
  );
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 9. Remove Member
// ---------------------------------------------------------------------------
const removeMemberRoute = createRoute({
  method: 'delete',
  path: '/{id}/members/{memberId}',
  summary: 'Remove Member from Workspace',
  tags: ['Workspace Members'],
  request: {
    params: z.object({ id: z.string(), memberId: z.string() })
  },
  responses: {
    200: { description: 'Member removed successfully' }
  }
});

workspacesRouter.openapi(removeMemberRoute, async (c) => {
  const { id, memberId } = c.req.valid('param');
  const userId = getUserId(c);
  const workspace = await workspaceService.removeMember(id, memberId, userId);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 10. Leave Workspace
// ---------------------------------------------------------------------------
const leaveWorkspaceRoute = createRoute({
  method: 'post',
  path: '/{id}/leave',
  summary: 'Leave Workspace',
  tags: ['Workspace Members'],
  request: {
    params: z.object({ id: z.string() })
  },
  responses: {
    200: { description: 'Left workspace successfully' }
  }
});

workspacesRouter.openapi(leaveWorkspaceRoute, async (c) => {
  const { id } = c.req.valid('param');
  const userId = getUserId(c);
  const workspace = await workspaceService.leaveWorkspace(id, userId);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 11. Transfer Ownership
// ---------------------------------------------------------------------------
const transferOwnershipRoute = createRoute({
  method: 'post',
  path: '/{id}/transfer-ownership',
  summary: 'Transfer Workspace Ownership',
  tags: ['Workspace Members'],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ newOwnerId: z.string() })
        }
      }
    }
  },
  responses: {
    200: { description: 'Ownership transferred successfully' }
  }
});

workspacesRouter.openapi(transferOwnershipRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { newOwnerId } = c.req.valid('json');
  const userId = getUserId(c);
  const workspace = await workspaceService.transferOwnership(id, newOwnerId, userId);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 12. List Pending Invitations (for logged-in user)
// ---------------------------------------------------------------------------
const listUserInvitesRoute = createRoute({
  method: 'get',
  path: '/invites/pending',
  summary: 'List User Pending Invitations',
  tags: ['Workspace Invitations'],
  responses: {
    200: { description: 'Pending invites retrieved' }
  }
});

workspacesRouter.openapi(listUserInvitesRoute, async (c) => {
  const user = (c as any).get('user');
  if (!user || !user.email) {
    return c.json(successResponse([]));
  }
  const invites = await workspaceService.listPendingUserInvitesByEmail(user.email);
  return c.json(successResponse(invites));
});

// ---------------------------------------------------------------------------
// 13. Accept Invitation
// ---------------------------------------------------------------------------
const acceptInviteRoute = createRoute({
  method: 'post',
  path: '/invites/accept',
  summary: 'Accept Invitation',
  tags: ['Workspace Invitations'],
  request: {
    body: {
      content: {
        'application/json': { schema: acceptInviteDtoSchema }
      }
    }
  },
  responses: {
    200: { description: 'Invitation accepted' }
  }
});

workspacesRouter.openapi(acceptInviteRoute, async (c) => {
  const { token } = c.req.valid('json');
  const userId = getUserId(c);
  const workspace = await workspaceService.acceptInvite(token, userId);
  return c.json(successResponse(workspace));
});

// ---------------------------------------------------------------------------
// 14. Decline Invitation
// ---------------------------------------------------------------------------
const declineInviteRoute = createRoute({
  method: 'post',
  path: '/invites/decline',
  summary: 'Decline Invitation',
  tags: ['Workspace Invitations'],
  request: {
    body: {
      content: {
        'application/json': { schema: acceptInviteDtoSchema } // Reuses token schema
      }
    }
  },
  responses: {
    200: { description: 'Invitation declined' }
  }
});

workspacesRouter.openapi(declineInviteRoute, async (c) => {
  const { token } = c.req.valid('json');
  const userId = getUserId(c);
  const workspace = await workspaceService.declineInvite(token, userId);
  return c.json(successResponse(workspace));
});

// ── Companies Router ──────────────────────────────────────────────────────

companiesRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '100');
  const service = new CompanyService(wsId);
  const result = await service.listCompanies(page, limit);
  return c.json(successResponse(result.data));
});

companiesRouter.get('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new CompanyService(wsId);
  const company = await service.getCompanyById(id);
  return c.json(successResponse(company));
});

companiesRouter.post('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new CompanyService(wsId);
  const company = await service.createCompany({ ...body, workspaceId: wsId });
  return c.json(successResponse(company));
});

companiesRouter.patch('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const service = new CompanyService(wsId);
  const company = await service.updateCompany(id, body);
  return c.json(successResponse(company));
});

companiesRouter.delete('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new CompanyService(wsId);
  await service.deleteCompany(id);
  return c.json(successResponse({ success: true }));
});

// ── Contacts Router ───────────────────────────────────────────────────────

contactsRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '100');
  const service = new ContactService(wsId);
  const result = await service.listContacts(page, limit);
  return c.json(successResponse(result.data));
});

contactsRouter.get('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new ContactService(wsId);
  const contact = await service.getContactById(id);
  return c.json(successResponse(contact));
});

contactsRouter.post('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new ContactService(wsId);
  const contact = await service.createContact({ ...body, workspaceId: wsId });
  return c.json(successResponse(contact));
});

contactsRouter.patch('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const service = new ContactService(wsId);
  const contact = await service.updateContact(id, body);
  return c.json(successResponse(contact));
});

contactsRouter.delete('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new ContactService(wsId);
  await service.deleteContact(id);
  return c.json(successResponse({ success: true }));
});

// ── Campaigns Router ──────────────────────────────────────────────────────

campaignsRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '100');
  const service = new CampaignService(wsId);
  const result = await service.listCampaigns(page, limit);
  return c.json(successResponse(result.data));
});

campaignsRouter.get('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new CampaignService(wsId);
  const campaign = await service.getCampaignById(id);
  return c.json(successResponse(campaign));
});

campaignsRouter.post('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new CampaignService(wsId);
  const campaign = await service.createCampaign({ ...body, workspaceId: wsId });
  return c.json(successResponse(campaign));
});

campaignsRouter.patch('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const service = new CampaignService(wsId);
  const campaign = await service.updateCampaign(id, body);
  return c.json(successResponse(campaign));
});

campaignsRouter.delete('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new CampaignService(wsId);
  await service.deleteCampaign(id);
  return c.json(successResponse({ success: true }));
});

campaignsRouter.post('/:id/schedule', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new OutreachService(wsId);
  await service.scheduleCampaign(id);
  return c.json(successResponse({ success: true }));
});

// ── Outreach Email Accounts & Templates Router ──────────────────────────────

outreachRouter.get('/accounts', async (c) => {
  const wsId = getWorkspaceId(c);
  const service = new OutreachService(wsId);
  const accounts = await service.listEmailAccounts();
  return c.json(successResponse(accounts));
});

outreachRouter.post('/accounts', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new OutreachService(wsId);
  const account = await service.createEmailAccount(body);
  return c.json(successResponse(account));
});

outreachRouter.delete('/accounts/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new OutreachService(wsId);
  await service.deleteEmailAccount(id);
  return c.json(successResponse({ success: true }));
});

outreachRouter.post('/accounts/:id/verify', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new OutreachService(wsId);
  const verified = await service.testConnection(id);
  return c.json(successResponse({ verified }));
});

outreachRouter.post('/accounts/:id/disconnect', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new OutreachService(wsId);
  await service.disconnectEmailAccount(id);
  return c.json(successResponse({ success: true }));
});

outreachRouter.post('/accounts/:id/reconnect', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const service = new OutreachService(wsId);
  const account = await service.reconnectEmailAccount(id, body);
  return c.json(successResponse(account));
});

outreachRouter.get('/templates', async (c) => {
  const wsId = getWorkspaceId(c);
  const service = new OutreachService(wsId);
  const templates = await service.listTemplates();
  return c.json(successResponse(templates));
});

outreachRouter.post('/templates', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = await c.req.json();
  const service = new OutreachService(wsId);
  const template = await service.createTemplate(body);
  return c.json(successResponse(template));
});

outreachRouter.delete('/templates/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new OutreachService(wsId);
  await service.deleteTemplate(id);
  return c.json(successResponse({ success: true }));
});

outreachRouter.get('/templates/:id/preview', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const contactId = c.req.query('contactId');
  const service = new OutreachService(wsId);
  const preview = await service.previewTemplate(id, contactId);
  return c.json(successResponse(preview));
});

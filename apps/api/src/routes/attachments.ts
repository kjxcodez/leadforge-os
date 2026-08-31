import { OpenAPIHono, z } from '@hono/zod-openapi';
import { AttachmentService } from '../services/attachment/attachment.service.js';
import { successResponse } from '../utils/index.js';
import { ForbiddenError } from '../errors/index.js';

export const attachmentsRouter = new OpenAPIHono();

function getWorkspaceId(c: any): string {
  const wsId = c.get('workspaceId');
  if (!wsId) throw new ForbiddenError('Workspace context required.');
  return wsId.toString();
}

const uploadSchema = z.object({
  googleConnectionId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
  metadata: z.record(z.any()).optional()
});

attachmentsRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const service = new AttachmentService(wsId);
  const list = await service.list();
  return c.json(successResponse(list));
});

attachmentsRouter.get('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AttachmentService(wsId);
  const attachment = await service.get(id);
  if (!attachment) {
    return c.json({ error: 'Attachment not found' }, 404);
  }
  return c.json(successResponse(attachment));
});

attachmentsRouter.post('/upload', async (c) => {
  const wsId = getWorkspaceId(c);
  const body = uploadSchema.parse(await c.req.json());
  const buffer = Buffer.from(body.contentBase64, 'base64');

  const service = new AttachmentService(wsId);
  const attachment = await service.upload({
    googleConnectionId: body.googleConnectionId,
    filename: body.filename,
    mimeType: body.mimeType,
    data: buffer,
    metadata: body.metadata
  });

  return c.json(successResponse(attachment), 201);
});

attachmentsRouter.get('/:id/download', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AttachmentService(wsId);
  const { buffer, attachment } = await service.download(id);

  return c.json(
    successResponse({
      id: attachment._id.toString(),
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      contentBase64: buffer.toString('base64')
    })
  );
});

attachmentsRouter.delete('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AttachmentService(wsId);
  await service.delete(id);
  return c.json(successResponse({ success: true }));
});

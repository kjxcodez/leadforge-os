import { OpenAPIHono, z } from '@hono/zod-openapi';
import { AttachmentService } from '../services/attachment/attachment.service.js';
import { successResponse } from '../utils/index.js';
import { ForbiddenError } from '../errors/index.js';
import { logger } from '../config/index.js';

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

function sanitizeAttachment(doc: any): any {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj._id) obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  if (!obj.driveUrl && obj.fileId) {
    obj.driveUrl = `https://drive.google.com/file/d/${obj.fileId}/view`;
  }
  return obj;
}

const linkSchema = z.object({
  googleConnectionId: z.string().min(1),
  fileId: z.string().min(1)
});

attachmentsRouter.get('/', async (c) => {
  const wsId = getWorkspaceId(c);
  const search = c.req.query('search') || undefined;
  const category = c.req.query('category') || undefined;
  const connectionId = c.req.query('connectionId') || undefined;
  const page = c.req.query('page') ? parseInt(c.req.query('page')!) : undefined;
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;

  const service = new AttachmentService(wsId);
  const list = await service.list({ search, category, connectionId, page, limit });
  return c.json(successResponse(list.map(sanitizeAttachment)));
});

attachmentsRouter.get('/:id', async (c) => {
  const wsId = getWorkspaceId(c);
  const id = c.req.param('id');
  const service = new AttachmentService(wsId);
  const attachment = await service.get(id);
  if (!attachment) {
    return c.json({ error: 'Attachment not found' }, 404);
  }
  return c.json(successResponse(sanitizeAttachment(attachment)));
});

attachmentsRouter.post('/upload', async (c) => {
  const wsId = getWorkspaceId(c);
  const reqId = (c.get as any)('requestId') || 'unknown';
  const body = uploadSchema.parse(await c.req.json());
  const buffer = Buffer.from(body.contentBase64, 'base64');

  logger.info(
    {
      correlationId: reqId,
      workspaceId: wsId,
      connectionId: body.googleConnectionId,
      filename: body.filename,
      mimeType: body.mimeType,
      size: buffer.length
    },
    'Processing attachment upload request'
  );

  const service = new AttachmentService(wsId);
  const attachment = await service.upload({
    googleConnectionId: body.googleConnectionId,
    filename: body.filename,
    mimeType: body.mimeType,
    data: buffer,
    metadata: body.metadata
  });

  logger.info(
    {
      correlationId: reqId,
      workspaceId: wsId,
      attachmentId: attachment._id.toString(),
      fileId: attachment.fileId,
      filename: attachment.filename
    },
    'Attachment uploaded and persisted successfully'
  );

  return c.json(successResponse(sanitizeAttachment(attachment)), 201);
});

attachmentsRouter.post('/link', async (c) => {
  const wsId = getWorkspaceId(c);
  const reqId = (c.get as any)('requestId') || 'unknown';
  const body = linkSchema.parse(await c.req.json());

  logger.info(
    {
      correlationId: reqId,
      workspaceId: wsId,
      connectionId: body.googleConnectionId,
      fileId: body.fileId
    },
    'Processing Drive file link request'
  );

  const service = new AttachmentService(wsId);
  const attachment = await service.linkDriveFile(body.googleConnectionId, body.fileId);

  return c.json(successResponse(sanitizeAttachment(attachment)), 201);
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
      driveUrl: attachment.driveUrl || `https://drive.google.com/file/d/${attachment.fileId}/view`,
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

import { Hono } from 'hono';
import { TrackingService } from '../services/tracking/tracking.service.js';

export const trackingRouter = new Hono();

/**
 * Public Open Tracking Pixel endpoint:
 * GET /t/open/:token or /api/v1/tracking/open/:token
 */
trackingRouter.get('/open/:token', async (c) => {
  const token = c.req.param('token');
  const userAgent = c.req.header('user-agent');
  const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip');

  const metadata: { userAgent?: string; ip?: string } = {};
  if (userAgent) metadata.userAgent = userAgent;
  if (ip) metadata.ip = ip;

  const gifBuffer = await TrackingService.handleOpen(token, metadata);

  return new Response(gifBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': gifBuffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });
});

/**
 * Public Click Tracking Redirect endpoint:
 * GET /t/click/:token or /api/v1/tracking/click/:token
 */
trackingRouter.get('/click/:token', async (c) => {
  const token = c.req.param('token');
  const userAgent = c.req.header('user-agent');
  const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip');

  const metadata: { userAgent?: string; ip?: string } = {};
  if (userAgent) metadata.userAgent = userAgent;
  if (ip) metadata.ip = ip;

  const targetUrl = await TrackingService.handleClick(token, metadata);

  if (!targetUrl) {
    return c.text('Link not found or expired.', 404);
  }

  return c.redirect(targetUrl, 302);
});

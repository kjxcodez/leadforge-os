import { OpenAPIHono, z } from '@hono/zod-openapi';
import { router as healthRouter } from './health/index.js';
import { router as authRouter } from './auth/index.js';
import {
  companiesRouter,
  contactsRouter,
  campaignsRouter,
  outreachRouter,
  workspacesRouter
} from './business.js';
import { automationRouter } from './automation.js';
import { emailRouter } from './email/index.js';

import { authMiddleware, workspaceMiddleware, rateLimiter } from '../middleware/index.js';
import { BetaApplicantModel } from '../db/models/index.js';
import { logger } from '../config/index.js';

const apiRouter = new OpenAPIHono();

// Zod Input Validation Schema for Beta Applications
const BetaApplySchema = z.object({
  email: z.string().email('Invalid email address'),
  platform: z.enum(['win', 'mac-arm', 'mac-intel', 'linux'], {
    errorMap: () => ({ message: 'Invalid platform selection' })
  }),
  motivation: z.string().min(10, 'Motivation must be at least 10 characters').max(1000, 'Motivation must not exceed 1000 characters')
});

// Mount System Health Check
apiRouter.route('/', healthRouter);

// Mount Better Auth credentials endpoints
apiRouter.route('/auth', authRouter);

// Public route to collect beta applications with rate limiting and schema validation
apiRouter.post(
  '/beta-apply',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many applications from this IP. Please try again later.' }),
  async (c) => {
    try {
      const body = await c.req.json();
      const payload = BetaApplySchema.parse(body);
      const { email, platform, motivation } = payload;

      // Prevent duplicate applications
      const existing = await BetaApplicantModel.findOne({ email: email.toLowerCase() });
      if (existing) {
        return c.json({ success: false, error: 'This email is already registered for beta access.' }, 400);
      }

      // Save application
      await BetaApplicantModel.create({
        email: email.toLowerCase(),
        platform,
        motivation
      });

      logger.info({ email, platform }, 'New beta applicant registered successfully.');
      return c.json({ success: true });
    } catch (err: any) {
      logger.error({ err }, 'Failed to save beta applicant details.');
      return c.json({ success: false, error: 'Internal server error' }, 500);
    }
  }
);

// Protect business and workspace endpoints
apiRouter.use('/companies/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/contacts/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/campaigns/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/outreach/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/workspaces/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/automation/*', authMiddleware, workspaceMiddleware);
apiRouter.use('/email/*', authMiddleware, workspaceMiddleware);

// Mount empty placeholder business routers
apiRouter.route('/companies', companiesRouter);
apiRouter.route('/contacts', contactsRouter);
apiRouter.route('/campaigns', campaignsRouter);
apiRouter.route('/outreach', outreachRouter);
apiRouter.route('/workspaces', workspacesRouter);
apiRouter.route('/automation', automationRouter);
apiRouter.route('/email', emailRouter);

export { apiRouter };
export { healthRouter, authRouter };

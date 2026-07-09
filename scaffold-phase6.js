const fs = require('fs');
const path = require('path');

const valSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\validation\\src';

const files = {
  // fields
  'fields/common.ts': `
import { z } from 'zod';
import { isValidObjectId } from '@leadforge/shared';

export const objectIdField = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid ObjectId format',
});

export const emailField = z.string().email({ message: 'Invalid email address' });

export const urlField = z.string().url({ message: 'Invalid URL format' }).nullable();

export const nameField = z.string().min(1, { message: 'Name must not be empty' }).max(100);

export const phoneField = z.string().regex(/^\\+?[1-9]\\d{1,14}$/, { message: 'Invalid phone number' }).nullable();
`,
  'fields/index.ts': `
export * from './common';
`,

  // entities
  'entities/company.ts': `
import { z } from 'zod';
import { objectIdField, nameField, urlField } from '../fields/common';

export const companyStatusSchema = z.enum(['LEAD', 'QUALIFIED', 'CUSTOMER', 'ARCHIVED']);

export const companySchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  domain: urlField,
  industry: z.string().nullable(),
  size: z.string().nullable(),
  location: z.string().nullable(),
  status: companyStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
`,
  'entities/contact.ts': `
import { z } from 'zod';
import { objectIdField, nameField, emailField, phoneField, urlField } from '../fields/common';

export const contactStatusSchema = z.enum(['NEW', 'CONTACTED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED']);

export const contactSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  companyId: objectIdField.nullable(),
  firstName: nameField,
  lastName: z.string().nullable(),
  email: emailField.nullable(),
  phone: phoneField,
  title: z.string().nullable(),
  linkedinUrl: urlField,
  status: contactStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
`,
  'entities/campaign.ts': `
import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common';

export const campaignStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']);

export const campaignStepSchema = z.object({
  id: objectIdField,
  type: z.string(),
  delayDays: z.number().int().nonnegative(),
  templateId: objectIdField,
});

export const campaignSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  status: campaignStatusSchema,
  steps: z.array(campaignStepSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
`,
  'entities/workflow.ts': `
import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common';

export const workflowStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ERROR']);

export const workflowStepTypeSchema = z.enum(['DISCOVER', 'ENRICH', 'VERIFY', 'QUALIFY', 'SEND']);

export const workflowStepSchema = z.object({
  id: objectIdField,
  type: workflowStepTypeSchema,
  config: z.record(z.any()),
  nextStepIds: z.array(objectIdField),
});

export const workflowSchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  name: nameField,
  status: workflowStatusSchema,
  trigger: z.string(),
  steps: z.array(workflowStepSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
`,
  'entities/workspace.ts': `
import { z } from 'zod';
import { objectIdField, nameField } from '../fields/common';

export const workspaceSettingsSchema = z.object({
  defaultTimezone: z.string().default('UTC'),
});

export const workspaceSchema = z.object({
  id: objectIdField,
  name: nameField,
  settings: workspaceSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
`,
  'entities/index.ts': `
export * from './company';
export * from './contact';
export * from './campaign';
export * from './workflow';
export * from './workspace';
`,

  // dto
  'dto/company.ts': `
import { z } from 'zod';
import { nameField, urlField } from '../fields/common';
import { companyStatusSchema } from '../entities/company';
import { paginationParamsSchema } from '../common/pagination';

export const createCompanyDtoSchema = z.object({
  name: nameField,
  domain: urlField.optional(),
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: companyStatusSchema.optional(),
});

export const updateCompanyDtoSchema = createCompanyDtoSchema.partial();

export const companyFiltersSchema = paginationParamsSchema.extend({
  name: z.string().optional(),
  domain: z.string().optional(),
  status: companyStatusSchema.optional(),
  industry: z.string().optional(),
});
`,
  'dto/contact.ts': `
import { z } from 'zod';
import { objectIdField, nameField, emailField, phoneField, urlField } from '../fields/common';
import { contactStatusSchema } from '../entities/contact';
import { paginationParamsSchema } from '../common/pagination';

export const createContactDtoSchema = z.object({
  companyId: objectIdField.nullable().optional(),
  firstName: nameField,
  lastName: z.string().nullable().optional(),
  email: emailField.nullable().optional(),
  phone: phoneField.optional(),
  title: z.string().nullable().optional(),
  linkedinUrl: urlField.optional(),
  status: contactStatusSchema.optional(),
});

export const updateContactDtoSchema = createContactDtoSchema.partial();

export const contactFiltersSchema = paginationParamsSchema.extend({
  companyId: objectIdField.optional(),
  email: z.string().optional(),
  status: contactStatusSchema.optional(),
});
`,
  'dto/campaign.ts': `
import { z } from 'zod';
import { nameField, objectIdField } from '../fields/common';
import { campaignStatusSchema } from '../entities/campaign';
import { paginationParamsSchema } from '../common/pagination';

export const createCampaignStepDtoSchema = z.object({
  type: z.string(),
  delayDays: z.number().int().nonnegative(),
  templateId: objectIdField,
});

export const createCampaignDtoSchema = z.object({
  name: nameField,
  status: campaignStatusSchema.optional(),
  steps: z.array(createCampaignStepDtoSchema).optional(),
});

export const updateCampaignDtoSchema = createCampaignDtoSchema.partial();

export const campaignFiltersSchema = paginationParamsSchema.extend({
  status: campaignStatusSchema.optional(),
});
`,
  'dto/auth.ts': `
import { z } from 'zod';
import { emailField } from '../fields/common';

export const loginDtoSchema = z.object({
  email: emailField,
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
});

export const registerDtoSchema = z.object({
  email: emailField,
  name: z.string().min(1, { message: 'Name is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).optional(),
});

export const forgotPasswordDtoSchema = z.object({
  email: emailField,
});

export const resetPasswordDtoSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  newPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});
`,
  'dto/workspace.ts': `
import { z } from 'zod';
import { nameField } from '../fields/common';
import { workspaceSettingsSchema } from '../entities/workspace';

export const createWorkspaceDtoSchema = z.object({
  name: nameField,
  settings: workspaceSettingsSchema.partial().optional(),
});

export const updateWorkspaceDtoSchema = createWorkspaceDtoSchema.partial();
`,
  'dto/outreach.ts': `
import { z } from 'zod';
import { objectIdField } from '../fields/common';
import { paginationParamsSchema } from '../common/pagination';

export const outreachChannelSchema = z.enum(['EMAIL', 'LINKEDIN', 'CALL']);

export const emailMessageSchema = z.object({
  messageId: z.string(),
  threadId: z.string().optional(),
  subject: z.string(),
  body: z.string(),
});

export const createOutreachDtoSchema = z.object({
  contactId: objectIdField,
  campaignId: objectIdField.nullable().optional(),
  channel: outreachChannelSchema,
  messageDetails: emailMessageSchema.optional(),
});

export const outreachFiltersSchema = paginationParamsSchema.extend({
  contactId: objectIdField.optional(),
  campaignId: objectIdField.optional(),
  channel: outreachChannelSchema.optional(),
  status: z.string().optional(),
});
`,
  'dto/index.ts': `
export * from './company';
export * from './contact';
export * from './campaign';
export * from './auth';
export * from './workspace';
export * from './outreach';
`,

  // common
  'common/pagination.ts': `
import { z } from 'zod';

export const sortOrderSchema = z.enum(['asc', 'desc']);

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema.optional(),
});

export const cursorParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
`,
  'common/index.ts': `
export * from './pagination';
`,

  // root index
  'index.ts': `
export * from './fields';
export * from './entities';
export * from './dto';
export * from './common';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(valSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Validation package scaffolded.");

import { z } from 'zod';
import { OpportunityStage } from '../enums/index.js';
import { objectIdField, nameField } from '../fields/common.js';

export const opportunityStageSchema = z.nativeEnum(OpportunityStage);

export const opportunitySchema = z.object({
  id: objectIdField,
  workspaceId: objectIdField,
  companyId: objectIdField,
  name: nameField,
  value: z.number().nullable(),
  stage: opportunityStageSchema,
  expectedCloseDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Opportunity = z.infer<typeof opportunitySchema>;

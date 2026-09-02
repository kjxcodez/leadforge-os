import { z } from 'zod';
import { OpportunityStage } from '../enums/index.js';
import { entityIdField, nameField } from '../fields/common.js';

export const opportunityStageSchema = z.nativeEnum(OpportunityStage);

export const opportunitySchema = z.object({
  id: entityIdField,
  workspaceId: entityIdField,
  companyId: entityIdField,
  name: nameField,
  value: z.number().nullable(),
  stage: opportunityStageSchema,
  expectedCloseDate: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type Opportunity = z.infer<typeof opportunitySchema>;

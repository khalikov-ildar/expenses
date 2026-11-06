import { z } from 'zod';

export const createExpenseGroupSchema = z.object({
  groupName: z.string().trim().min(3).max(128),
  baseCurrency: z.string().length(3),
  inviteeIds: z.array(z.string().min(1)),
});
export type CreateExpenseGroupDto = z.infer<typeof createExpenseGroupSchema>;

export const createExpenseGroupResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseCurrency: z.string().length(3),
});

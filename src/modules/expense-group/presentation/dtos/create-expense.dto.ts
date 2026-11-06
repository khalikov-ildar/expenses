import { z } from 'zod';

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1).max(256),
  /** Decimal string, deliberately not a JS number. */
  amount: z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/),
  currency: z.currencyCode(),
  paidByMemberId: z.string().min(1),
  participantMemberIds: z.array(z.string().min(1)).min(1),
});
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export const createExpenseResponseSchema = z.object({ id: z.string() });

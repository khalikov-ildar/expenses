import { z } from 'zod';

export const groupBalancesResponseSchema = z.object({
  groupId: z.string(),
  currency: z.string(),
  balances: z.array(
    z.object({
      memberId: z.string(),
      status: z.enum(['INVITED', 'ACTIVE', 'LEFT', 'DECLINED', 'EXPIRED']),
      paidMinor: z.string(),
      owedMinor: z.string(),
      netMinor: z.string(),
    }),
  ),
});

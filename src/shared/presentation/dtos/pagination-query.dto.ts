import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;

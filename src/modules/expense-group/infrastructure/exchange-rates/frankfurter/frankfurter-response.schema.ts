import { z } from 'zod';

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const frankfurterResponseSchema = z.object({
  date: z.string().refine(isIsoDate, 'Expected an ISO calendar date.'),
  base: z.string().regex(/^[A-Z]{3}$/i),
  quote: z.string().regex(/^[A-Z]{3}$/i),
  rate: z.number().finite().positive(),
});

export type FrankfurterResponse = z.infer<typeof frankfurterResponseSchema>;

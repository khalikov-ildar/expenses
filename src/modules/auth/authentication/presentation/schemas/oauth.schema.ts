import { z } from 'zod';

export const oauthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type OAuthRequest = z.infer<typeof oauthSchema>;

import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.email(),
  // Was: z.string() — accepted empty and 1-character passwords.
  password: z.string().min(8).max(128),
});

export type RegisterRequest = z.infer<typeof registerSchema>;

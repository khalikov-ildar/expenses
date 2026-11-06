import { z } from 'zod';

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

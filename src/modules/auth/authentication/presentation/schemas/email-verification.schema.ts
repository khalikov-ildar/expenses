import { z } from 'zod';

export const requestEmailVerificationSchema = z.object({
  email: z.email(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type RequestEmailVerificationRequest = z.infer<typeof requestEmailVerificationSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;

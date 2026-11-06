import { IdentityId } from '@/shared/domain/id/auth.js';

export interface EmailVerificationMessage {
  userId: IdentityId;
  to: string;
  name: string | null;
  verificationToken: string;
}

export abstract class EmailVerificationSender {
  abstract send(message: EmailVerificationMessage): Promise<void>;
}

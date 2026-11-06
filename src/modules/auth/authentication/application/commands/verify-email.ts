import { Injectable } from '@nestjs/common';
import { EmailVerificationService } from '@/modules/auth/identity/application/services/email-verification.service.js';

export interface VerifyEmailCommand {
  token: string;
}

@Injectable()
export class VerifyEmailHandler {
  constructor(private readonly emailVerification: EmailVerificationService) {}

  async execute(cmd: VerifyEmailCommand): Promise<void> {
    await this.emailVerification.verify(cmd.token);
  }
}

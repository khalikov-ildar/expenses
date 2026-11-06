import { Injectable } from '@nestjs/common';
import { EmailVerificationService } from '@/modules/auth/identity/application/services/email-verification.service.js';

export interface RequestEmailVerificationCommand {
  email: string;
}

@Injectable()
export class RequestEmailVerificationHandler {
  constructor(private readonly emailVerification: EmailVerificationService) {}

  async execute(cmd: RequestEmailVerificationCommand): Promise<void> {
    await this.emailVerification.requestForEmail(cmd.email);
  }
}

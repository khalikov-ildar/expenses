import { Injectable } from '@nestjs/common';
import {
  EmailVerificationMessage,
  EmailVerificationSender,
} from '../../application/ports/email-verification.sender.js';
import { Resend } from 'resend';
import { EmailVerificationConfig } from '@/shared/infrastructure/config/env.schema.js';

@Injectable()
export class ResendEmailVerificationSender implements EmailVerificationSender {
  private readonly client: Resend;
  private readonly senderAddress: string;

  constructor(cfg: EmailVerificationConfig) {
    this.client = new Resend(cfg.emailApiKey);
    this.senderAddress = cfg.emailSenderAddress;
  }

  async send(message: EmailVerificationMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      to: message.to,
      subject: 'Verify your email address',
      text: `Your email verification token is: ${message.verificationToken}`,
      from: this.senderAddress,
    });

    if (error) {
      throw new Error('Email verification delivery failed');
    }
  }
}

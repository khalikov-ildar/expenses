import { Injectable } from '@nestjs/common';
import {
  EmailVerificationTokenGenerator,
  GeneratedEmailVerificationToken,
} from '../../application/ports/email-verification.token-generator.js';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class RandomEmailVerificationTokenGenerator implements EmailVerificationTokenGenerator {
  generate(): GeneratedEmailVerificationToken {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('base64url');
  }
}

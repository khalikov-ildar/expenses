import { randomBytes, timingSafeEqual } from 'crypto';
import { RequestIntegrityService } from '../../application/ports/request-integrity.service.js';

export class DefaultRequestIntegrityService implements RequestIntegrityService {
  generateCsrfToken(): string {
    return this.getHexRandomBytes();
  }

  isCsrfTokenValid(token: string, expected: string): boolean {
    return this.safeEqual(token, expected);
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private getHexRandomBytes() {
    return randomBytes(32).toString('hex');
  }
}

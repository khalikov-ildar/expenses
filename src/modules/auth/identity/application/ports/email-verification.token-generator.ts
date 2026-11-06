export interface GeneratedEmailVerificationToken {
  token: string;
  tokenHash: string;
}

export abstract class EmailVerificationTokenGenerator {
  abstract generate(): GeneratedEmailVerificationToken;
  abstract hash(token: string): string;
}

export abstract class TokenHasher {
  abstract hashToken(token: string): string;
  abstract compare(token: string, hashedToken: string): boolean;
}

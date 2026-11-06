import { TokenPair } from './token-provider.js';

export abstract class TokenIssuer {
  abstract issue(userId: string): Promise<TokenPair>;
}

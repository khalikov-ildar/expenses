import { AuthKinds } from '@/modules/auth/identity/domain/external-identity.js';
import { OAuthClientResolver } from '../services/oauth-client.resolver.js';
import { AuthenticationResult, AuthenticationStrategy } from './authentication.strategy.js';
import { Injectable } from '@nestjs/common';
import { AuthStrategy } from './authentication-strategy.decorator.js';

@Injectable()
@AuthStrategy(AuthKinds.google)
export class GoogleOAuthStrategy implements AuthenticationStrategy<typeof AuthKinds.google> {
  readonly provider = AuthKinds.google;

  constructor(private clientRegistry: OAuthClientResolver) {}

  async authenticate(input: { code: string; codeVerifier: string }): Promise<AuthenticationResult> {
    const client = this.clientRegistry.resolve(this.provider);
    const profile = await client.exchangeCode(input);
    return {
      email: profile.email,
      provider: this.provider,
      emailVerified: profile.emailVerified,
      providerUserId: profile.providerUserId,
      name: profile.name ?? null,
    };
  }
}

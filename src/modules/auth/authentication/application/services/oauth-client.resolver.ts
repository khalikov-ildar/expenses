import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { ExternalOAuthClient } from './external-oauth.client.js';

export abstract class OAuthClientResolver {
  abstract resolve(provider: AuthKind): ExternalOAuthClient;
}

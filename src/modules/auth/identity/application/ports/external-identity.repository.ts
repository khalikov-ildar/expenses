import { AuthKind, ExternalIdentity } from '@/modules/auth/identity/domain/external-identity.js';

export abstract class ExternalIdentityRepository {
  abstract find(provider: AuthKind, providerUserId: string): Promise<ExternalIdentity | null>;
  abstract save(identity: ExternalIdentity): Promise<void>;
}

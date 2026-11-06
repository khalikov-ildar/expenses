import { IdentityId } from '@/shared/domain/id/auth.js';
import { Brand, createIdFactory } from '@/shared/domain/id/index.js';

export const AuthKinds = {
  password: 'password',
  google: 'google',
  github: 'github',
} as const;
export type AuthKind = keyof typeof AuthKinds;

export type OAuthProvider = Exclude<AuthKind, 'password'>;

export type ExternalIdentityId = Brand<string, 'ExternalIdentityId'>;
export const ExternalIdentityIdFactory = createIdFactory<ExternalIdentityId>();

export class ExternalIdentity {
  constructor(
    public readonly id: ExternalIdentityId,
    public readonly provider: string,
    public readonly providerUserId: string,
    public readonly userId: IdentityId,
  ) {}
}

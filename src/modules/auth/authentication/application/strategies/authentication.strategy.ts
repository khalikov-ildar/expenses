import { AuthKind, AuthKinds } from '@/modules/auth/identity/domain/external-identity.js';

export type AuthenticationResult = {
  provider: AuthKind;
  providerUserId: string;
  emailVerified: boolean;
  email: string;
  name: string | null;
};

export type AuthInputMap = {
  [AuthKinds.password]: { email: string; password: string };
  [AuthKinds.google]: { code: string };
  [AuthKinds.github]: { code: string };
};

export abstract class AuthenticationStrategy<Kind extends AuthKind, Input = AuthInputMap[Kind]> {
  abstract provider: Kind;

  abstract authenticate(input: Input): Promise<AuthenticationResult>;
}

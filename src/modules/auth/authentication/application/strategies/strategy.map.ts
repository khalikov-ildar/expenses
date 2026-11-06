import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { AuthenticationStrategy } from './authentication.strategy.js';
import { GithubOAuthStrategy } from './github.oauth-strategy.js';
import { GoogleOAuthStrategy } from './google.oauth-strategy.js';
import { PasswordAuthenticationStrategy } from './password.auth-strategy.js';

const strategyMap = {
  google: GoogleOAuthStrategy,
  github: GithubOAuthStrategy,
  password: PasswordAuthenticationStrategy,
} as const satisfies Record<AuthKind, any>;
export type Strategy = {
  [K in keyof typeof strategyMap]: InstanceType<(typeof strategyMap)[K]>;
};

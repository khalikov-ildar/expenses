import { createDomainErrorFactory, DomainError, DomainErrorCategory } from '@shared/domain/domain-error.js';
import { RefreshTokenId } from '@auth/session/domain/refresh-token.js';
import { IdentityId } from '@/shared/domain/id/auth.js';

export const authenticationFailedError = createDomainErrorFactory({
  code: 'unauthorized',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Invalid credentials',
}).simple();

export const userAlreadyExistsError = createDomainErrorFactory({
  code: 'user_exists_conflict',
  category: DomainErrorCategory.CONFLICT,
  defaultMessage: 'User already exists',
}).withMetadata((meta: { email: string }) => `User with email ${meta.email} already exists`);

export const emailNotVerifiedError = createDomainErrorFactory({
  code: 'email_not_verified',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Email address has not been verified',
}).simple();

export const emailVerificationTokenInvalidError = createDomainErrorFactory({
  code: 'email_verification_token_invalid',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Invalid or expired email verification token',
}).simple();

export const userNotFoundError = createDomainErrorFactory({
  code: 'user_not_found',
  category: DomainErrorCategory.NOT_FOUND,
  defaultMessage: 'User not found',
}).withMetadata((meta: { id: IdentityId }) => `User with id ${meta.id} not found`);

export const refreshTokenNotFoundError = createDomainErrorFactory({
  code: 'refresh_token_not_found',
  category: DomainErrorCategory.NOT_FOUND,
  defaultMessage: 'Refresh token not found',
}).withMetadata((meta: { id: RefreshTokenId }) => `Refresh token with id ${meta.id} not found`);

export const refreshTokenRevokedError = createDomainErrorFactory({
  code: 'refresh_token_revoked',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Refresh token has been revoked',
}).simple();

export const refreshTokenReuseDetectedError = createDomainErrorFactory({
  code: 'refresh_token_reuse_detected',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Refresh token reuse detected',
}).simple();

export const refreshTokenExpiredError = createDomainErrorFactory({
  code: 'refresh_token_expired',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Refresh token has expired',
}).simple();

export const invalidTokenPayloadError = createDomainErrorFactory({
  code: 'invalid_token_payload',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Invalid token payload',
}).simple();

export const oauthProviderNotSupportedError = createDomainErrorFactory({
  code: 'oauth_provider_not_supported',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'OAuth provider is not supported',
}).withMetadata((meta: { provider: string }) => `Provider: ${meta.provider} is not supported`);

export const oauthStrategyNotConfiguredError = createDomainErrorFactory({
  code: 'oauth_strategy_not_configured',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'OAuth strategy is not configured',
}).withMetadata((meta: { provider: string }) => `No strategy registered for provider: ${meta.provider}`);

export const unknownAuthTypeError = createDomainErrorFactory({
  code: 'unknown_auth_type',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'Unknown auth type',
}).withMetadata((meta: { authType: unknown }) => `Unknown auth type: ${String(meta.authType)}`);

export const oauthTokenExchangeFailedError = createDomainErrorFactory({
  code: 'oauth_token_exchange_failed',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'Failed to exchange code for tokens',
}).withMetadata(
  (meta: { provider: string; status: number; body: string }) => `Failed to exchange code for tokens (${meta.provider})`,
);

export const oauthUserInfoFetchFailedError = createDomainErrorFactory({
  code: 'oauth_user_info_fetch_failed',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'Failed to fetch user info',
}).withMetadata(
  (meta: { provider: string; status: number; body: string }) => `Failed to fetch user info (${meta.provider})`,
);

export const oauthEmailsFetchFailedError = createDomainErrorFactory({
  code: 'oauth_emails_fetch_failed',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'Failed to fetch user emails',
}).withMetadata(
  (meta: { provider: string; status: number; body: string }) => `Failed to fetch user emails (${meta.provider})`,
);

export const oauthEmailNotResolvedError = createDomainErrorFactory({
  code: 'oauth_email_not_resolved',
  category: DomainErrorCategory.NOT_FOUND,
  defaultMessage: 'Failed to resolve OAuth email',
}).withMetadata((meta: { provider: string }) => `Failed to resolve ${meta.provider} email`);

export const oauthEmailNotVerifiedError = createDomainErrorFactory({
  code: 'oauth_email_not_verified',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'OAuth email is not verified',
}).withMetadata((meta: { provider: string }) => `OAuth email is not verified (${meta.provider})`);

export const oauthTransactionInvalidError = createDomainErrorFactory({
  code: 'oauth_transaction_invalid',
  category: DomainErrorCategory.UNAUTHORIZED,
  defaultMessage: 'Invalid or expired OAuth transaction',
}).simple();

export const oauthAccountLinkRequiredError = createDomainErrorFactory({
  code: 'oauth_account_link_required',
  category: DomainErrorCategory.CONFLICT,
  defaultMessage: 'OAuth account requires explicit account linking',
}).simple();

export const oauthIdentityAlreadyLinkedError = createDomainErrorFactory({
  code: 'oauth_identity_already_linked',
  category: DomainErrorCategory.CONFLICT,
  defaultMessage: 'OAuth identity is already linked to another account',
}).simple();

export const userHasNoPasswordError = createDomainErrorFactory({
  code: 'user_has_no_password',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'User has no password set. Use OAuth or set password first.',
}).simple();

export const passwordMismatchError = createDomainErrorFactory({
  code: 'password_mismatch',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'Provided password does not match user password',
}).simple();

export const samePasswordError = createDomainErrorFactory({
  code: 'same_password',
  category: DomainErrorCategory.INVALID,
  defaultMessage: 'New password must be different from current password',
}).simple();

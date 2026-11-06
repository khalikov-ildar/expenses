import { AccessTokenId } from '@/modules/auth/session/domain/access-token.id.js';
import { RefreshTokenFamilyId } from '@/modules/auth/session/domain/refresh-token-family.js';
import { RefreshTokenId } from '@/modules/auth/session/domain/refresh-token.js';
import { IdentityId } from '@/shared/domain/id/auth.js';

export abstract class BaseApplicationContext {
  abstract userId: IdentityId;
}

export abstract class AuthApplicationContext extends BaseApplicationContext {
  abstract jti: RefreshTokenId | AccessTokenId;
  abstract refreshToken?: string;
  abstract familyId?: RefreshTokenFamilyId;
}

export abstract class ApplicationContextAccessor {
  abstract get baseContext(): BaseApplicationContext;
  abstract get authContext(): AuthApplicationContext;
}

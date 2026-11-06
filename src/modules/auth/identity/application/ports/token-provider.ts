import { RefreshTokenFamilyId } from '@/modules/auth/session/domain/refresh-token-family.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { AccessTokenId } from '@auth/session/domain/access-token.id.js';
import { RefreshTokenId } from '@auth/session/domain/refresh-token.js';

export interface AccessTokenPayload {
  sub: string;
  jti: AccessTokenId;
  tokenUse: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: RefreshTokenId;
  familyId: RefreshTokenFamilyId;
  tokenUse: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPairSignPayload {
  sub: string;
  accessJti: AccessTokenId;
  refreshJti: RefreshTokenId;
  familyId: RefreshTokenFamilyId;
}

export interface JtiPair {
  accessJti: AccessTokenId;
  refreshJti: RefreshTokenId;
}

export interface DecodedToken {
  exp: number;
}

export abstract class TokenProvider {
  abstract signTokenPair(payload: TokenPairSignPayload): Promise<TokenPair>;
  abstract verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  abstract verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
  abstract decode<Decoded extends DecodedToken = DecodedToken>(token: string): Decoded | null;
  abstract getJtiPair(): JtiPair;
}

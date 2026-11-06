import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { SetMetadata } from '@nestjs/common';

export const AUTH_STRATEGY_METADATA = 'AUTH_STRATEGY_METADATA';
export const AuthStrategy = (type: AuthKind) => SetMetadata(AUTH_STRATEGY_METADATA, type);

import { AuthKind } from '@/modules/auth/identity/domain/external-identity.js';
import { SetMetadata } from '@nestjs/common';

export const AUTH_CLIENT_METADATA = 'AUTH_CLIENT_METADATA';
export const AuthClient = (type: AuthKind) => SetMetadata(AUTH_CLIENT_METADATA, type);

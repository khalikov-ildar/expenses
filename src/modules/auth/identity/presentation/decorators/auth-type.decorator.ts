import { SetMetadata } from '@nestjs/common';
import { AuthTypes } from '../types/auth-type.js';

export const AUTH_TYPE_METADATA = 'AuthTypeMetadata';

export const AuthType = (...types: AuthTypes[]) => SetMetadata(AUTH_TYPE_METADATA, types);

import { SetMetadata } from '@nestjs/common';
import { AuthTypes } from './auth-type.js';

export interface SecurityOptions {
  auth?: AuthTypes;
  csrf?: boolean;
}

export const SECURITY_METADATA = Symbol('SECURITY_METADATA');

export const Security = (options: SecurityOptions) => SetMetadata(SECURITY_METADATA, options);

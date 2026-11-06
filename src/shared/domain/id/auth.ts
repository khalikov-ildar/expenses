import { Brand, createIdFactory } from './index.js';

export type IdentityId = Brand<string, 'IdentityId'>;
export const AuthUserIdFactory = createIdFactory<IdentityId>();

import { Brand, createIdFactory } from '@shared/domain/id/index.js';

export type AccessTokenId = Brand<string, 'AccessTokenId'>;
export const AccessTokenIdFactory = createIdFactory<AccessTokenId>();

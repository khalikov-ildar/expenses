import { AccessTokenId } from '@/modules/auth/session/domain/access-token.id.js';
import { RefreshTokenFamilyId } from '@/modules/auth/session/domain/refresh-token-family.js';
import { RefreshTokenId } from '@/modules/auth/session/domain/refresh-token.js';
import { AuthApplicationContext, BaseApplicationContext } from '@/shared/application/ports/application-context.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class AlsApplicationContextAccessor extends AuthApplicationContext {
  private readonly als: AsyncLocalStorage<AuthApplicationContext> = new AsyncLocalStorage();

  get baseContext(): BaseApplicationContext {
    return this.store;
  }
  get authContext(): AuthApplicationContext {
    return this.store;
  }

  private get store(): AuthApplicationContext {
    const store = this.als.getStore();
    if (!store) {
      throw new Error('No store found');
    }
    return store;
  }

  run<T>(store: AuthApplicationContext, callback: () => T): T {
    return this.als.run(store, callback);
  }

  setValue<T extends keyof AuthApplicationContext>(k: T, v: AuthApplicationContext[T]): typeof this {
    this.store[k] = v;
    return this;
  }

  get jti(): RefreshTokenId | AccessTokenId {
    return this.store.jti;
  }
  get refreshToken(): string | undefined {
    return this.store.refreshToken;
  }
  get familyId(): RefreshTokenFamilyId | undefined {
    return this.store.familyId;
  }
  get userId(): IdentityId {
    return this.store.userId;
  }
}

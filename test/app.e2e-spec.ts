/**
 * HTTP/application end-to-end suite for the controllers in the supplied source snapshot.
 *
 * This boots the real Nest controllers and real application command/query handlers.
 * Persistence, external identity providers, email delivery, and signed JWT creation are
 * replaced with deterministic in-memory adapters so the suite is hermetic.
 */
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import { INestApplication, Injectable, Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationController } from '@/modules/auth/authentication/presentation/authentication.controller.js';
import { SessionController } from '@/modules/auth/session/presentation/session.controller.js';
import { MeHandler } from '@/modules/auth/session/application/commands/me.js';
import { RefreshTokenHandler } from '@/modules/auth/session/application/commands/refresh-token.js';
import { ExpenseGroupController } from '@/modules/expense-group/presentation/group.controller.js';

import { RegisterUserHandler } from '@/modules/auth/authentication/application/commands/register-user.js';
import { LoginCommandHandler } from '@/modules/auth/authentication/application/commands/login.js';
import { LogoutCommandHandler } from '@/modules/auth/authentication/application/commands/logout.js';
import { AuthenticateUserHandler } from '@/modules/auth/authentication/application/commands/authenticate.js';
import { LinkOAuthAccountHandler } from '@/modules/auth/authentication/application/commands/link-oauth-account.js';
import { RequestEmailVerificationHandler } from '@/modules/auth/authentication/application/commands/request-email-verification.js';
import { VerifyEmailHandler } from '@/modules/auth/authentication/application/commands/verify-email.js';
import { ChangePasswordHandler } from '@/modules/auth/authentication/application/commands/change-password.js';
import { OAuthClientResolver } from '@/modules/auth/authentication/application/services/oauth-client.resolver.js';
import { OAuthTransactionService } from '@/modules/auth/authentication/application/services/oauth-transaction.service.js';
import { OAuthTransactionPurpose } from '@/modules/auth/authentication/application/oauth/oauth-transaction.js';
import { oauthTransactionInvalidError, oauthProviderNotSupportedError } from '@/modules/auth/identity/domain/errors.js';
import { AuthHttpService } from '@/modules/auth/identity/presentation/auth.http.service.js';
import { RequestIntegrityService } from '@/modules/auth/identity/application/ports/request-integrity.service.js';
import { RequestIntegrityStorage } from '@/modules/auth/identity/infrastructure/security/request-integrity.storage.js';
import {
  csrfCookieToken,
  oauthBrowserBindingCookieToken,
} from '@/modules/auth/identity/infrastructure/security/cookie.integrity.storage.js';
import { SecurityGuard } from '@/modules/auth/identity/presentation/guards/security.guard.js';
import { JwtGuard } from '@/modules/auth/identity/presentation/guards/jwt.guard.js';
import {
  TokenProvider,
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
  TokenPairSignPayload,
  JtiPair,
  DecodedToken,
} from '@/modules/auth/identity/application/ports/token-provider.js';
import { AuthApplicationContext, BaseApplicationContext } from '@/shared/application/ports/application-context.js';
import { AlsApplicationContextAccessor } from '@/shared/infrastructure/context/als.application-context.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { Clock } from '@/shared/domain/clock.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';
import { Aggregate, DomainEvent } from '@/shared/domain/aggregate.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { DomainErrorFilter } from '@/shared/infrastructure/filters/domain-error.filter.js';

import { CreateExpenseGroup } from '@/modules/expense-group/application/commands/create-group.js';
import { MakeDecisionOnInvitation } from '@/modules/expense-group/application/commands/decide-invitation.js';
import { LeaveGroup } from '@/modules/expense-group/application/commands/leave-group.js';
import { CreateExpense } from '@/modules/expense-group/application/commands/create-expense.js';
import { GetGroupBalances } from '@/modules/expense-group/application/queries/get-group-balances.js';
import { ExpireGroupInvitations } from '@/modules/expense-group/application/commands/expire-invitations.js';
import { ExpenseGroupRepository } from '@/modules/expense-group/application/ports/expense-group.repository.js';
import { GroupMemberRepository } from '@/modules/expense-group/application/ports/group-member.repository.js';
import { GroupInvitationRepository } from '@/modules/expense-group/application/ports/invitation.repository.js';
import { ExpenseRepository } from '@/modules/expense-group/application/ports/expense.repository.js';
import {
  GroupBalanceRepository,
  GroupMemberBalance,
} from '@/modules/expense-group/application/ports/group-balance.repository.js';
import { ExchangeRateProvider } from '@/modules/expense-group/application/ports/exchange-rate.provider.js';
import { EqualSplitCalculator } from '@/modules/expense-group/domain/equal-split.calculator.js';
import { Currency } from '@/modules/expense-group/domain/currency.js';
import { ExchangeRate } from '@/modules/expense-group/domain/exchange-rate.js';
import {
  ExpenseGroup,
  ExpenseGroupId,
  ExpenseGroupIdFactory,
  ExpenseGroupStatus,
} from '@/modules/expense-group/domain/expense-group.js';
import { Expense, ExpenseId, ExpenseIdFactory } from '@/modules/expense-group/domain/expense.js';
import {
  GroupInvitation,
  GroupInvitationIdFactory,
  GroupInvitationStatus,
} from '@/modules/expense-group/domain/group-invitation.js';
import {
  ExpenseGroupMember,
  GroupMemberId,
  GroupMemberIdFactory,
  GroupMemberStatus,
} from '@/modules/expense-group/domain/group-member.js';
import { CsrfHeaderName } from '@/modules/auth/identity/presentation/types/csrf.js';
import { RefreshTokenKey } from '@/modules/auth/identity/presentation/types/refresh-token.key.js';

const AUTH_COOKIE_PATH = '/auth';
const CSRF_COOKIE = csrfCookieToken;
const OAUTH_BINDING_COOKIE = oauthBrowserBindingCookieToken;

@Injectable()
class E2EClock implements Clock {
  private instant = new Date('2026-01-01T12:00:00.000Z');

  now(): Date {
    return new Date(this.instant);
  }
  nowInMs(): number {
    return this.instant.getTime();
  }
  fromMs(ms: number): Date {
    return new Date(ms);
  }
  after(ms: number): Date {
    return new Date(this.instant.getTime() + ms);
  }
  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }
  reset(): void {
    this.instant = new Date('2026-01-01T12:00:00.000Z');
  }
}

@Injectable()
class E2ETransactionManager implements TransactionManager {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
  async startRequest<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
  isActive(): boolean {
    return false;
  }
}

@Injectable()
class E2EStore {
  readonly groups = new Map<string, ExpenseGroup>();
  readonly members = new Map<string, ExpenseGroupMember>();
  readonly invitations = new Map<string, GroupInvitation>();
  readonly expenses = new Map<string, Expense>();
  readonly outboxEventTypes: string[] = [];
  readonly fxRates = new Map<string, { numerator: bigint; denominator: bigint }>();

  reset(): void {
    this.groups.clear();
    this.members.clear();
    this.invitations.clear();
    this.expenses.clear();
    this.outboxEventTypes.length = 0;
    this.fxRates.clear();
  }
}

function cloneGroup(group: ExpenseGroup): ExpenseGroup {
  return ExpenseGroup.rehydrate(group.id, group.name, group.status, group.createdBy, group.baseCurrency);
}

function cloneMember(member: ExpenseGroupMember): ExpenseGroupMember {
  return ExpenseGroupMember.rehydrate({
    id: member.id,
    identityId: member.identityId,
    groupId: member.groupId,
    status: member.status,
    joinedAt: member.joinedAt,
    endedAt: member.endedAt,
  });
}

function cloneInvitation(invitation: GroupInvitation): GroupInvitation {
  return GroupInvitation.rehydrate({
    id: invitation.id,
    inviterId: invitation.inviterId,
    inviteeId: invitation.inviteeId,
    groupId: invitation.groupId,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
  });
}

@Injectable()
class E2EExpenseGroupRepository extends ExpenseGroupRepository {
  constructor(private readonly store: E2EStore) {
    super();
  }

  async getById(id: ExpenseGroupId): Promise<ExpenseGroup> {
    const group = this.store.groups.get(id);
    if (!group)
      throw DomainErrors.notFound('expense_group.not_found', 'The expense group was not found.', { groupId: id });
    return cloneGroup(group);
  }

  async lockById(_id: ExpenseGroupId): Promise<void> {
    /* single-process adapter */
  }

  async cancelIfCancellable(id: ExpenseGroupId): Promise<boolean> {
    const current = this.store.groups.get(id);
    if (!current || current.status !== ExpenseGroupStatus.PENDING) return false;
    current.cancel();
    this.store.groups.set(id, cloneGroup(current));
    return true;
  }

  async save(group: ExpenseGroup): Promise<void> {
    this.store.groups.set(group.id, cloneGroup(group));
  }

  async findCandidatesForActivation(): Promise<ExpenseGroup[]> {
    throw new Error('Group activation is not exposed by the current production module; see KNOWN-GAPS.md.');
  }

  async changeStatus(
    id: ExpenseGroupId,
    _status: ExpenseGroupStatus,
    _expectedStatus: ExpenseGroupStatus,
  ): Promise<boolean> {
    throw new Error('The production repository contract has no group ID parameter; see KNOWN-GAPS.md.');
  }
}

@Injectable()
class E2EGroupMemberRepository extends GroupMemberRepository {
  constructor(private readonly store: E2EStore) {
    super();
  }

  async getById(id: GroupMemberId): Promise<ExpenseGroupMember> {
    const member = this.store.members.get(id);
    if (!member)
      throw DomainErrors.notFound('expense_group.member.not_found', 'The group member was not found.', {
        memberId: id,
      });
    return cloneMember(member);
  }

  async getByIds(ids: GroupMemberId[]): Promise<ExpenseGroupMember[]> {
    return ids.flatMap((id) => {
      const member = this.store.members.get(id);
      return member ? [cloneMember(member)] : [];
    });
  }

  async countActiveByGroup(groupId: ExpenseGroupId): Promise<number> {
    return [...this.store.members.values()].filter(
      (m) => m.groupId === groupId && m.status === GroupMemberStatus.ACTIVE,
    ).length;
  }

  async getActiveByGroupAndIdentity(groupId: ExpenseGroupId, identityId: IdentityId): Promise<ExpenseGroupMember> {
    const member = [...this.store.members.values()].find(
      (m) => m.groupId === groupId && m.identityId === identityId && m.status === GroupMemberStatus.ACTIVE,
    );
    if (!member) {
      throw DomainErrors.notFound('expense_group.member.not_found', 'The active group member was not found.', {
        groupId,
        identityId,
      });
    }
    return cloneMember(member);
  }

  async saveMany(members: ExpenseGroupMember[]): Promise<void> {
    for (const member of members) this.store.members.set(member.id, cloneMember(member));
  }

  async saveStatusChange(member: ExpenseGroupMember, expectedStatus: GroupMemberStatus): Promise<boolean> {
    const current = this.store.members.get(member.id);
    if (!current || current.status !== expectedStatus) return false;
    this.store.members.set(member.id, cloneMember(member));
    return true;
  }
}

@Injectable()
class E2EGroupInvitationRepository extends GroupInvitationRepository {
  constructor(private readonly store: E2EStore) {
    super();
  }

  async getExpiredCandidates(now: Date, amount: number): Promise<GroupInvitation[]> {
    return [...this.store.invitations.values()]
      .filter((inv) => inv.status === GroupInvitationStatus.PENDING && inv.expiresAt <= now)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, amount)
      .map(cloneInvitation);
  }

  async getById(id: ReturnType<typeof GroupInvitationIdFactory.create>): Promise<GroupInvitation> {
    const invitation = this.store.invitations.get(id);
    if (!invitation)
      throw DomainErrors.notFound('expense_group.invitation.not_found', 'The invitation was not found.', {
        invitationId: id,
      });
    return cloneInvitation(invitation);
  }

  async countPendingForGroup(groupId: ExpenseGroupId): Promise<number> {
    return [...this.store.invitations.values()].filter(
      (inv) => inv.groupId === groupId && inv.status === GroupInvitationStatus.PENDING,
    ).length;
  }

  async saveMany(invitations: GroupInvitation[]): Promise<void> {
    for (const invitation of invitations) this.store.invitations.set(invitation.id, cloneInvitation(invitation));
  }

  async saveStatusChange(invitation: GroupInvitation, expectedStatus: GroupInvitationStatus): Promise<boolean> {
    const current = this.store.invitations.get(invitation.id);
    if (!current || current.status !== expectedStatus) return false;
    this.store.invitations.set(invitation.id, cloneInvitation(invitation));
    return true;
  }

  async cancelForGroup(groupId: ExpenseGroupId): Promise<number> {
    let count = 0;
    for (const [id, current] of this.store.invitations) {
      if (current.groupId !== groupId || current.status !== GroupInvitationStatus.PENDING) continue;
      const updated = cloneInvitation(current);
      // The domain has no cancel operation, so rehydrate the status transition explicitly,
      // matching the persistence adapter's bulk status update.
      this.store.invitations.set(
        id,
        GroupInvitation.rehydrate({
          id: updated.id,
          inviterId: updated.inviterId,
          inviteeId: updated.inviteeId,
          groupId: updated.groupId,
          expiresAt: updated.expiresAt,
          status: GroupInvitationStatus.CANCELLED,
        }),
      );
      count++;
    }
    return count;
  }
}

@Injectable()
class E2EExpenseRepository extends ExpenseRepository {
  constructor(private readonly store: E2EStore) {
    super();
  }
  async getById(id: ExpenseId): Promise<Expense> {
    const expense = this.store.expenses.get(id);
    if (!expense)
      throw DomainErrors.notFound('expense_group.expense.not_found', 'The expense was not found.', { expenseId: id });
    return expense;
  }
  async save(expense: Expense): Promise<void> {
    this.store.expenses.set(expense.id, expense);
  }
}

@Injectable()
class E2EGroupBalanceRepository extends GroupBalanceRepository {
  constructor(private readonly store: E2EStore) {
    super();
  }

  async getByGroupId(groupId: ExpenseGroupId): Promise<GroupMemberBalance[]> {
    const members = [...this.store.members.values()].filter((m) => m.groupId === groupId);
    return members.map((member) => {
      let paidMinor = 0n;
      let owedMinor = 0n;
      for (const expense of this.store.expenses.values()) {
        if (expense.groupId !== groupId) continue;
        if (expense.paidByMemberId === member.id) paidMinor += expense.baseAmount.minorUnits;
        for (const participant of expense.participants) {
          if (participant.memberId === member.id) owedMinor += participant.amountMinor;
        }
      }
      return { memberId: member.id, status: member.status, paidMinor, owedMinor };
    });
  }
}

@Injectable()
class E2EExchangeRateProvider extends ExchangeRateProvider {
  constructor(
    private readonly store: E2EStore,
    private readonly clock: E2EClock,
  ) {
    super();
  }

  async getRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    const quote = this.store.fxRates.get(`${from.code}:${to.code}`);
    if (!quote) {
      throw DomainErrors.invalid(
        'expense_group.fx.provider_not_configured',
        'No exchange-rate provider has been configured.',
        {
          from: from.code,
          to: to.code,
        },
      );
    }
    return ExchangeRate.create({
      from,
      to,
      numerator: quote.numerator,
      denominator: quote.denominator,
      provider: 'e2e-fixed-rate',
      quotedAt: this.clock.now(),
    });
  }
}

@Injectable()
class E2EOutboxRepository extends OutboxRepository {
  constructor(private readonly store: E2EStore) {
    super();
  }
  async saveEvents(aggregates: Aggregate<string, DomainEvent<string, string, unknown>>[]): Promise<void> {
    for (const aggregate of aggregates) {
      for (const event of aggregate.pullDomainEvents()) this.store.outboxEventTypes.push(event.type);
    }
  }
}

const e2eLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

@Injectable()
class E2ETokenProvider extends TokenProvider {
  async signTokenPair(payload: TokenPairSignPayload): Promise<TokenPair> {
    return { accessToken: `access-${payload.sub}`, refreshToken: `refresh-${payload.sub}` };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    if (!token.startsWith('access-') || token.length <= 'access-'.length) throw new Error('Invalid test access token');
    const sub = token.slice('access-'.length);
    return { sub, jti: `access-jti-${sub}` as AccessTokenPayload['jti'], tokenUse: 'access' };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    if (!token.startsWith('refresh-') || token.length <= 'refresh-'.length)
      throw new Error('Invalid test refresh token');
    const sub = token.slice('refresh-'.length);
    return {
      sub,
      jti: `refresh-jti-${sub}` as RefreshTokenPayload['jti'],
      familyId: `family-${sub}` as RefreshTokenPayload['familyId'],
      tokenUse: 'refresh',
    };
  }

  decode<Decoded extends DecodedToken = DecodedToken>(_token: string): Decoded | null {
    return { exp: Math.floor(Date.now() / 1000) + 3600 } as Decoded;
  }

  getJtiPair(): JtiPair {
    return {
      accessJti: 'access-jti-test' as JtiPair['accessJti'],
      refreshJti: 'refresh-jti-test' as JtiPair['refreshJti'],
    };
  }
}

@Injectable()
class E2ERequestIntegrityService extends RequestIntegrityService {
  generateCsrfToken(): string {
    return 'csrf-e2e-token';
  }
  isCsrfTokenValid(token: string, against: string): boolean {
    return token === against;
  }
}

@Injectable()
class E2ERequestIntegrityStorage extends RequestIntegrityStorage {
  setCsrfToken(token: string, ttl: number, res: import('express').Response): void {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: ttl,
      path: AUTH_COOKIE_PATH,
    });
  }
  getCsrfToken(req: import('express').Request): string | undefined {
    return req.cookies?.[CSRF_COOKIE];
  }
  setOAuthBrowserBinding(binding: string, ttl: number, res: import('express').Response): void {
    res.cookie(OAUTH_BINDING_COOKIE, binding, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: ttl,
      path: AUTH_COOKIE_PATH,
    });
  }
  getOAuthBrowserBinding(req: import('express').Request): string | undefined {
    return req.cookies?.[OAUTH_BINDING_COOKIE];
  }
  clearOAuthBrowserBinding(res: import('express').Response): void {
    res.clearCookie(OAUTH_BINDING_COOKIE, { path: AUTH_COOKIE_PATH });
  }
  clearCsrfToken(res: import('express').Response): void {
    res.clearCookie(CSRF_COOKIE, { path: AUTH_COOKIE_PATH });
  }
}

@Injectable()
class E2EAuthHttpService extends AuthHttpService {
  constructor(integrity: RequestIntegrityService, storage: RequestIntegrityStorage) {
    // This subclass deliberately bypasses production configuration; all cookie details
    // remain aligned with AuthHttpService's public cookie contract.
    super(
      {
        now: () => new Date(),
        nowInMs: () => Date.now(),
        fromMs: (ms: number) => new Date(ms),
        after: (ms: number) => new Date(Date.now() + ms),
      } as Clock,
      { authCookieSecure: false, authCookieSameSite: 'lax' } as any,
      { oauthStateTtl: 600_000 } as any,
      { refreshTtl: 2_592_000_000 } as any,
      integrity,
      storage,
    );
  }
}

class E2EOAuthTransactionStore {
  private counter = 0;
  private readonly transactions = new Map<
    string,
    {
      provider: string;
      purpose: OAuthTransactionPurpose;
      userId: IdentityId | null;
      binding: string;
      codeVerifier: string;
      expiresAt: Date;
      consumed: boolean;
    }
  >();

  reset(): void {
    this.counter = 0;
    this.transactions.clear();
  }

  expire(state: string): void {
    const transaction = this.transactions.get(state);
    if (transaction) transaction.expiresAt = new Date(0);
  }

  async start(input: {
    provider: string;
    purpose: OAuthTransactionPurpose;
    userId: IdentityId | null;
    browserBinding?: string;
  }) {
    const n = ++this.counter;
    const state = `e2e-state-${n}`;
    const binding = input.browserBinding ?? `e2e-browser-${n}`;
    const codeVerifier = `e2e-verifier-${n}`;
    this.transactions.set(state, {
      provider: input.provider,
      purpose: input.purpose,
      userId: input.userId,
      binding,
      codeVerifier,
      expiresAt: new Date(Date.now() + 600_000),
      consumed: false,
    });
    return { state, codeChallenge: `challenge-${n}`, codeVerifier, browserBinding: binding };
  }

  async consume(input: { provider: string; state: string; browserBinding: string; now: Date }) {
    const tx = this.transactions.get(input.state);
    if (
      !tx ||
      tx.consumed ||
      tx.provider !== input.provider ||
      tx.binding !== input.browserBinding ||
      tx.expiresAt <= input.now
    ) {
      throw oauthTransactionInvalidError();
    }
    tx.consumed = true;
    return { purpose: tx.purpose, userId: tx.userId, codeVerifier: tx.codeVerifier };
  }
}

class E2EAuthMocks {
  readonly register = {
    execute: vi.fn(async (dto: { email: string; name: string }) => ({
      id: 'registered-user',
      email: dto.email,
      name: dto.name,
    })),
  };
  readonly login = {
    execute: vi.fn(async (dto: { email: string }) => {
      const user = dto.email.split('@')[0] || 'login-user';
      return { userId: user as IdentityId, accessToken: `access-${user}`, refreshToken: `refresh-${user}` };
    }),
  };
  readonly logout = { execute: vi.fn(async () => undefined) };
  readonly authenticate = {
    execute: vi.fn(async (provider: string) => ({
      accessToken: `access-oauth-${provider}`,
      refreshToken: `refresh-oauth-${provider}`,
    })),
  };
  readonly linkOAuth = {
    execute: vi.fn(async (input: { userId: IdentityId }) => ({
      accessToken: `access-${input.userId}`,
      refreshToken: `refresh-${input.userId}`,
    })),
  };
  readonly requestVerification = { execute: vi.fn(async () => undefined) };
  readonly verifyEmail = { execute: vi.fn(async () => undefined) };
  readonly changePassword = { execute: vi.fn(async () => undefined) };
  readonly refresh = {
    execute: vi.fn(async () => ({ accessToken: 'access-alice-refreshed', refreshToken: 'refresh-alice-refreshed' })),
  };
  readonly oauthTransactions = new E2EOAuthTransactionStore();
  readonly oauthClientResolver = {
    resolve: vi.fn((provider: string) => {
      if (provider !== 'google' && provider !== 'github')
        throw oauthProviderNotSupportedError({ metadata: { provider } });
      return {
        getAuthorizationUrl: ({ state, codeChallenge }: { state: string; codeChallenge: string }) =>
          `https://mock-${provider}.example/authorize?state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}`,
      };
    }),
  };

  reset(): void {
    for (const entry of [
      this.register,
      this.login,
      this.logout,
      this.authenticate,
      this.linkOAuth,
      this.requestVerification,
      this.verifyEmail,
      this.changePassword,
      this.refresh,
    ]) {
      entry.execute.mockClear();
    }
    this.oauthClientResolver.resolve.mockClear();
    this.oauthTransactions.reset();
  }
}

@Module({
  controllers: [AuthenticationController, SessionController, ExpenseGroupController],
  providers: [
    E2EStore,
    E2EClock,
    E2ETransactionManager,
    { provide: Clock, useExisting: E2EClock },
    { provide: TransactionManager, useExisting: E2ETransactionManager },
    { provide: ApplicationLogger, useValue: e2eLogger },
    { provide: OutboxRepository, useClass: E2EOutboxRepository },

    { provide: ExpenseGroupRepository, useClass: E2EExpenseGroupRepository },
    { provide: GroupMemberRepository, useClass: E2EGroupMemberRepository },
    { provide: GroupInvitationRepository, useClass: E2EGroupInvitationRepository },
    { provide: ExpenseRepository, useClass: E2EExpenseRepository },
    { provide: GroupBalanceRepository, useClass: E2EGroupBalanceRepository },
    { provide: ExchangeRateProvider, useClass: E2EExchangeRateProvider },
    CreateExpenseGroup,
    MakeDecisionOnInvitation,
    LeaveGroup,
    CreateExpense,
    GetGroupBalances,
    ExpireGroupInvitations,
    EqualSplitCalculator,

    AlsApplicationContextAccessor,
    { provide: BaseApplicationContext, useExisting: AlsApplicationContextAccessor },
    { provide: AuthApplicationContext, useExisting: AlsApplicationContextAccessor },
    { provide: TokenProvider, useClass: E2ETokenProvider },
    E2ERequestIntegrityService,
    { provide: RequestIntegrityService, useExisting: E2ERequestIntegrityService },
    E2ERequestIntegrityStorage,
    { provide: RequestIntegrityStorage, useExisting: E2ERequestIntegrityStorage },
    E2EAuthHttpService,
    { provide: AuthHttpService, useExisting: E2EAuthHttpService },
    JwtGuard,
    SecurityGuard,
    { provide: APP_GUARD, useExisting: SecurityGuard },

    E2EAuthMocks,
    { provide: RegisterUserHandler, useFactory: (m: E2EAuthMocks) => m.register, inject: [E2EAuthMocks] },
    { provide: LoginCommandHandler, useFactory: (m: E2EAuthMocks) => m.login, inject: [E2EAuthMocks] },
    { provide: LogoutCommandHandler, useFactory: (m: E2EAuthMocks) => m.logout, inject: [E2EAuthMocks] },
    { provide: AuthenticateUserHandler, useFactory: (m: E2EAuthMocks) => m.authenticate, inject: [E2EAuthMocks] },
    { provide: LinkOAuthAccountHandler, useFactory: (m: E2EAuthMocks) => m.linkOAuth, inject: [E2EAuthMocks] },
    {
      provide: RequestEmailVerificationHandler,
      useFactory: (m: E2EAuthMocks) => m.requestVerification,
      inject: [E2EAuthMocks],
    },
    { provide: VerifyEmailHandler, useFactory: (m: E2EAuthMocks) => m.verifyEmail, inject: [E2EAuthMocks] },
    { provide: ChangePasswordHandler, useFactory: (m: E2EAuthMocks) => m.changePassword, inject: [E2EAuthMocks] },
    { provide: OAuthClientResolver, useFactory: (m: E2EAuthMocks) => m.oauthClientResolver, inject: [E2EAuthMocks] },
    { provide: OAuthTransactionService, useFactory: (m: E2EAuthMocks) => m.oauthTransactions, inject: [E2EAuthMocks] },
    {
      provide: 'E2E_ME_HANDLER',
      useFactory: (als: AlsApplicationContextAccessor) => ({
        execute: vi.fn(async () => ({
          id: als.userId,
          name: `User ${als.userId}`,
          email: `${als.userId}@example.test`,
        })),
      }),
      inject: [AlsApplicationContextAccessor],
    },
    { provide: 'E2E_REFRESH_HANDLER', useFactory: (m: E2EAuthMocks) => m.refresh, inject: [E2EAuthMocks] },
    { provide: MeHandler, useExisting: 'E2E_ME_HANDLER' },
    { provide: RefreshTokenHandler, useExisting: 'E2E_REFRESH_HANDLER' },
  ],
})
class E2EApplicationModule {}

async function createE2EApplication() {
  const moduleRef = await Test.createTestingModule({ imports: [E2EApplicationModule] }).compile();
  const app = moduleRef.createNestApplication();
  const als = moduleRef.get(AlsApplicationContextAccessor);

  app.use(cookieParser());
  app.use((_req: any, _res: any, next: any) => als.run({} as AuthApplicationContext, next));
  app.useGlobalPipes(new StandardSchemaValidationPipe({ transform: true }));
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  return {
    app,
    store: moduleRef.get(E2EStore),
    clock: moduleRef.get(E2EClock),
    authMocks: moduleRef.get(E2EAuthMocks),
    expireInvitations: moduleRef.get(ExpireGroupInvitations),
  };
}

function bearer(userId: string) {
  return `Bearer access-${userId}`;
}

function seedGroup(
  store: E2EStore,
  clock: E2EClock,
  input: {
    id?: string;
    status?: ExpenseGroupStatus;
    baseCurrency?: string;
    creator?: string;
    members: Array<{ id: string; userId: string; status?: GroupMemberStatus }>;
  },
) {
  const groupId = ExpenseGroupIdFactory.create(input.id ?? 'group-e2e');
  const creator = AuthUserIdFactory.create(input.creator ?? 'alice');
  const group = ExpenseGroup.rehydrate(
    groupId,
    'E2E group',
    input.status ?? ExpenseGroupStatus.ACTIVE,
    creator,
    Currency.create(input.baseCurrency ?? 'EUR'),
  );
  store.groups.set(groupId, group);

  const members = input.members.map((item) => {
    const memberId = GroupMemberIdFactory.create(item.id);
    const identityId = AuthUserIdFactory.create(item.userId);
    const member =
      item.status === GroupMemberStatus.INVITED
        ? ExpenseGroupMember.createInvited(memberId, identityId, groupId)
        : item.status && item.status !== GroupMemberStatus.ACTIVE
          ? ExpenseGroupMember.rehydrate({
              id: memberId,
              identityId,
              groupId,
              status: item.status,
              joinedAt: null,
              endedAt: clock.now(),
            })
          : ExpenseGroupMember.createActive(memberId, identityId, groupId, clock.now());
    store.members.set(memberId, member);
    return member;
  });
  return { groupId, members };
}

function cookiePair(setCookie: string[] | undefined, name: string): string {
  const value = (setCookie ?? []).find((cookie) => cookie.startsWith(`${name}=`));
  if (!value) throw new Error(`Expected ${name} cookie in Set-Cookie header`);
  return value.split(';', 1)[0];
}

let app: INestApplication;
let store: E2EStore;
let clock: E2EClock;
let authMocks: E2EAuthMocks;
let expireInvitations: ExpireGroupInvitations;

beforeAll(async () => {
  const testing = await createE2EApplication();
  app = testing.app;
  store = testing.store;
  clock = testing.clock;
  authMocks = testing.authMocks;
  expireInvitations = testing.expireInvitations;
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  store.reset();
  clock.reset();
  authMocks.reset();
  e2eLogger.info.mockClear();
  e2eLogger.warn.mockClear();
  e2eLogger.error.mockClear();
  e2eLogger.debug.mockClear();
});

describe('Authentication HTTP journeys', () => {
  it('registers a user and rejects invalid registration payloads', async () => {
    const created = await request(app.getHttpServer()).post('/auth/register').send({
      name: 'Alice Example',
      email: 'alice@example.test',
      password: 'correct horse battery staple',
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: 'registered-user', email: 'alice@example.test', name: 'Alice Example' });
    expect(authMocks.register.execute).toHaveBeenCalledOnce();

    authMocks.register.execute.mockRejectedValueOnce(
      DomainErrors.conflict('user_exists_conflict', 'User already exists'),
    );
    const duplicate = await request(app.getHttpServer()).post('/auth/register').send({
      name: 'Alice Example',
      email: 'alice@example.test',
      password: 'another secret',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('user_exists_conflict');

    const invalid = await request(app.getHttpServer()).post('/auth/register').send({
      name: 'Alice',
      email: 'not-an-email',
      password: 'secret',
    });
    expect(invalid.status).toBe(400);
  });

  it('logs in, issues an access token, and sets scoped HttpOnly refresh and readable CSRF cookies', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'alice@example.test',
      password: 'secret',
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: 'access-alice' });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(
      cookies.some(
        (cookie) =>
          cookie.startsWith('refreshToken=refresh-alice;') && /HttpOnly/i.test(cookie) && /Path=\/auth/i.test(cookie),
      ),
    ).toBe(true);
    expect(
      cookies.some((cookie) => cookie.startsWith(`${CSRF_COOKIE}=csrf-e2e-token;`) && !/HttpOnly/i.test(cookie)),
    ).toBe(true);
  });

  it('validates login and email-verification request/confirmation payloads', async () => {
    const invalidLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'bad', password: 'x' });
    expect(invalidLogin.status).toBe(400);

    authMocks.login.execute.mockRejectedValueOnce(DomainErrors.unauthorized('unauthorized', 'Invalid credentials'));
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.test', password: 'wrong' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe('unauthorized');

    const requested = await request(app.getHttpServer())
      .post('/auth/email-verification/request')
      .send({ email: 'alice@example.test' });
    expect(requested.status).toBe(202);
    expect(authMocks.requestVerification.execute).toHaveBeenCalledWith({ email: 'alice@example.test' });

    const badRequest = await request(app.getHttpServer())
      .post('/auth/email-verification/request')
      .send({ email: 'bad' });
    expect(badRequest.status).toBe(400);

    const invalidToken = await request(app.getHttpServer()).post('/auth/email-verification/verify').send({ token: '' });
    expect(invalidToken.status).toBe(400);

    authMocks.verifyEmail.execute.mockRejectedValueOnce(
      DomainErrors.unauthorized('email_verification_token_invalid', 'Invalid or expired email verification token'),
    );
    const expiredToken = await request(app.getHttpServer())
      .post('/auth/email-verification/verify')
      .send({ token: 'expired-token' });
    expect(expiredToken.status).toBe(401);

    const verified = await request(app.getHttpServer())
      .post('/auth/email-verification/verify')
      .send({ token: 'one-time-token' });
    expect(verified.status).toBe(204);
    expect(authMocks.verifyEmail.execute).toHaveBeenCalledWith({ token: 'one-time-token' });
  });

  it('requires a bearer access token for /auth/me and password change', async () => {
    expect((await request(app.getHttpServer()).get('/auth/me')).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Basic abc')).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer malformed')).status).toBe(
      401,
    );
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', bearer('alice'));
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ id: 'alice', name: 'User alice', email: 'alice@example.test' });

    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/change-password')
          .send({ oldPassword: 'old', newPassword: 'new' })
      ).status,
    ).toBe(401);
    const invalidChange = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', bearer('alice'))
      .send({ oldPassword: 'old', newPassword: '' });
    expect(invalidChange.status).toBe(400);
    const changed = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', bearer('alice'))
      .send({ oldPassword: 'old', newPassword: 'new' });
    expect(changed.status).toBe(204);
    expect(authMocks.changePassword.execute).toHaveBeenCalledWith({ oldPassword: 'old', newPassword: 'new' });
  });

  it('requires a refresh cookie and matching CSRF cookie/header to rotate a session', async () => {
    expect((await request(app.getHttpServer()).post('/auth/refresh')).status).toBe(401);

    const noHeader = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${RefreshTokenKey}=refresh-alice; ${csrfCookieToken}=csrf-e2e-token`);
    expect(noHeader.status).toBe(401);

    const mismatch = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${RefreshTokenKey}=refresh-alice; ${csrfCookieToken}=csrf-e2e-token`)
      .set(CsrfHeaderName, 'wrong');
    expect(mismatch.status).toBe(401);

    const success = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${RefreshTokenKey}=refresh-alice; ${csrfCookieToken}=csrf-e2e-token`)
      .set(CsrfHeaderName, 'csrf-e2e-token');

    expect(success.status).toBe(200);
    expect(success.body).toEqual({ accessToken: 'access-alice-refreshed' });
    expect(
      (success.headers['set-cookie'] as unknown as string[]).some((cookie) =>
        cookie.startsWith('refreshToken=refresh-alice-refreshed;'),
      ),
      csrfCookieToken,
    ).toBe(true);
  });

  it('logs out only with a valid refresh cookie and CSRF proof, and clears auth cookies', async () => {
    const rejected = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${RefreshTokenKey}=refresh-alice; ${csrfCookieToken}=csrf-e2e-token`);
    expect(rejected.status).toBe(401);

    const success = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${RefreshTokenKey}=refresh-alice; ${csrfCookieToken}=csrf-e2e-token`)
      .set(CsrfHeaderName, 'csrf-e2e-token');
    expect(success.status).toBe(204);
    expect(authMocks.logout.execute).toHaveBeenCalledOnce();
    const cookies = success.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('refreshToken=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith(`${CSRF_COOKIE}=;`))).toBe(true);
  });

  it('starts Google/GitHub OAuth, consumes the browser-bound state once, and rejects replay or missing binding', async () => {
    const invalidCallback = await request(app.getHttpServer())
      .post('/auth/oauth/google/callback')
      .send({ code: '', state: '' });
    expect(invalidCallback.status).toBe(400);

    const start = await request(app.getHttpServer()).get('/auth/oauth/google/start');
    expect(start.status).toBe(200);
    expect(start.body.authUrl).toContain('https://mock-google.example/authorize');
    const bindingCookie = cookiePair(start.headers['set-cookie'] as unknown as string[], OAUTH_BINDING_COOKIE);
    const state = new URL(start.body.authUrl).searchParams.get('state')!;

    const missingBinding = await request(app.getHttpServer())
      .post('/auth/oauth/google/callback')
      .send({ code: 'provider-code', state });
    expect(missingBinding.status).toBe(401);

    const wrongProvider = await request(app.getHttpServer())
      .post('/auth/oauth/github/callback')
      .set('Cookie', bindingCookie)
      .send({ code: 'provider-code', state });
    expect(wrongProvider.status).toBe(401);

    const wrongBrowser = await request(app.getHttpServer())
      .post('/auth/oauth/google/callback')
      .set('Cookie', `${OAUTH_BINDING_COOKIE}=another-browser`)
      .send({ code: 'provider-code', state });
    expect(wrongBrowser.status).toBe(401);

    const callback = await request(app.getHttpServer())
      .post('/auth/oauth/google/callback')
      .set('Cookie', bindingCookie)
      .send({ code: 'provider-code', state });
    expect(callback.status).toBe(200);
    expect(callback.body).toEqual({ accessToken: 'access-oauth-google' });
    expect(authMocks.authenticate.execute).toHaveBeenCalledWith('google', {
      code: 'provider-code',
      codeVerifier: expect.any(String),
    });

    const replay = await request(app.getHttpServer())
      .post('/auth/oauth/google/callback')
      .set('Cookie', bindingCookie)
      .send({ code: 'provider-code', state });
    expect(replay.status).toBe(401);

    const github = await request(app.getHttpServer()).get('/auth/oauth/github/start');
    expect(github.status).toBe(200);
    expect(github.body.authUrl).toContain('https://mock-github.example/authorize');
    const githubBinding = cookiePair(github.headers['set-cookie'] as unknown as string[], OAUTH_BINDING_COOKIE);
    const githubState = new URL(github.body.authUrl).searchParams.get('state')!;
    const githubCallback = await request(app.getHttpServer())
      .get(`/auth/oauth/github/callback?code=github-code&state=${encodeURIComponent(githubState)}`)
      .set('Cookie', githubBinding);
    expect(githubCallback.status).toBe(200);
    expect(authMocks.authenticate.execute).toHaveBeenCalledWith('github', {
      code: 'github-code',
      codeVerifier: expect.any(String),
    });

    const expiring = await request(app.getHttpServer()).get('/auth/oauth/google/start');
    const expiringBinding = cookiePair(expiring.headers['set-cookie'] as unknown as string[], OAUTH_BINDING_COOKIE);
    const expiringState = new URL(expiring.body.authUrl).searchParams.get('state')!;
    authMocks.oauthTransactions.expire(expiringState);
    const expiredCallback = await request(app.getHttpServer())
      .post('/auth/oauth/google/callback')
      .set('Cookie', expiringBinding)
      .send({ code: 'provider-code', state: expiringState });
    expect(expiredCallback.status).toBe(401);

    expect((await request(app.getHttpServer()).get('/auth/oauth/facebook/start')).status).toBe(400);
  });

  it('requires authentication for explicit OAuth linking and links back to the initiating actor', async () => {
    expect((await request(app.getHttpServer()).get('/auth/oauth/google/link/start')).status).toBe(401);

    const start = await request(app.getHttpServer())
      .get('/auth/oauth/google/link/start')
      .set('Authorization', bearer('alice'));
    expect(start.status).toBe(200);
    const bindingCookie = cookiePair(start.headers['set-cookie'] as unknown as string[], OAUTH_BINDING_COOKIE);
    const state = new URL(start.body.authUrl).searchParams.get('state')!;

    const callback = await request(app.getHttpServer())
      .get(`/auth/oauth/google/callback?code=provider-code&state=${encodeURIComponent(state)}`)
      .set('Cookie', bindingCookie);
    expect(callback.status).toBe(200);
    expect(authMocks.linkOAuth.execute).toHaveBeenCalledWith({
      provider: 'google',
      code: 'provider-code',
      codeVerifier: expect.any(String),
      userId: 'alice',
    });
  });
});

describe('Expense-group HTTP and application journeys', () => {
  it('creates a pending group, creator membership, invitee memberships, and invitation outbox events', async () => {
    const response = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Weekend trip', baseCurrency: 'eur', inviteeIds: ['bob', 'carol'] });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Weekend trip', baseCurrency: 'EUR' });
    const groupId = response.body.id as string;
    const group = store.groups.get(groupId)!;
    expect(group.status).toBe(ExpenseGroupStatus.PENDING);

    const memberships = [...store.members.values()].filter((member) => member.groupId === groupId);
    expect(memberships.map((member) => member.status).sort()).toEqual(
      [GroupMemberStatus.ACTIVE, GroupMemberStatus.INVITED, GroupMemberStatus.INVITED].sort(),
    );
    expect([...store.invitations.values()].filter((invitation) => invitation.groupId === groupId)).toHaveLength(2);
    expect(store.outboxEventTypes).toHaveLength(2);
    expect(store.outboxEventTypes.every((type) => type === 'group-invitation.created')).toBe(true);
  });

  it('protects group creation and validates its payload and invitee uniqueness constraints', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/expense-group')
          .send({ groupName: 'Trip', baseCurrency: 'EUR', inviteeIds: [] })
      ).status,
    ).toBe(401);

    const invalid = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'ab', baseCurrency: 'EURO', inviteeIds: [] });
    expect(invalid.status).toBe(400);

    const unsupportedCurrency = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Weekend trip', baseCurrency: 'ZZZ', inviteeIds: [] });

    expect(unsupportedCurrency.status).toBe(400);
    expect(unsupportedCurrency.body.code).toBe('expense_group.currency.unsupported');

    const duplicate = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Weekend trip', baseCurrency: 'EUR', inviteeIds: ['bob', 'bob'] });
    expect(duplicate.status).toBe(409);

    const selfInvite = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Weekend trip', baseCurrency: 'EUR', inviteeIds: ['alice'] });
    expect(selfInvite.status).toBe(409);
    expect(store.groups.size).toBe(0);
    expect(store.invitations.size).toBe(0);
  });

  it('accepts an invitation only for its invitee and keeps membership/invitation state consistent', async () => {
    const created = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Trip group', baseCurrency: 'EUR', inviteeIds: ['bob'] });
    const invitation = [...store.invitations.values()][0];

    const wrongActor = await request(app.getHttpServer())
      .post(`/invitation/${invitation.id}/accept`)
      .set('Authorization', bearer('carol'));
    expect(wrongActor.status).toBe(403);

    const accepted = await request(app.getHttpServer())
      .post(`/invitation/${invitation.id}/accept`)
      .set('Authorization', bearer('bob'));
    expect(accepted.status).toBe(201);
    expect(store.invitations.get(invitation.id)?.status).toBe(GroupInvitationStatus.ACCEPTED);
    const invitee = [...store.members.values()].find((member) => member.identityId === 'bob');
    expect(invitee?.status).toBe(GroupMemberStatus.ACTIVE);
    expect(store.outboxEventTypes).toContain('group-invitation.accepted');
    expect(store.groups.get(created.body.id)?.status).toBe(ExpenseGroupStatus.PENDING);
  });

  it('rejects an invitation and prevents a second decision', async () => {
    await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Trip group', baseCurrency: 'EUR', inviteeIds: ['bob'] });
    const invitation = [...store.invitations.values()][0];

    const rejected = await request(app.getHttpServer())
      .post(`/invitation/${invitation.id}/reject`)
      .set('Authorization', bearer('bob'));
    expect(rejected.status).toBe(201);
    expect(store.invitations.get(invitation.id)?.status).toBe(GroupInvitationStatus.REJECTED);
    expect([...store.members.values()].find((member) => member.identityId === 'bob')?.status).toBe(
      GroupMemberStatus.DECLINED,
    );
    expect(store.outboxEventTypes).toContain('group-invitation.rejected');

    const repeated = await request(app.getHttpServer())
      .post(`/invitation/${invitation.id}/accept`)
      .set('Authorization', bearer('bob'));
    expect(repeated.status).toBe(409);
  });

  it('rejects an invitation at its exact expiry boundary', async () => {
    await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Expiring group', baseCurrency: 'EUR', inviteeIds: ['bob'] });
    const invitation = [...store.invitations.values()][0];
    clock.advance(7 * 24 * 60 * 60 * 1000);

    const response = await request(app.getHttpServer())
      .post(`/invitation/${invitation.id}/accept`)
      .set('Authorization', bearer('bob'));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('expense_group.invitation.expired');
    expect(store.invitations.get(invitation.id)?.status).toBe(GroupInvitationStatus.PENDING);
  });

  it('allows a member to leave while other members remain active', async () => {
    const { groupId, members } = seedGroup(store, clock, {
      id: 'leave-group',
      status: ExpenseGroupStatus.ACTIVE,
      members: [
        { id: 'member-a', userId: 'alice' },
        { id: 'member-b', userId: 'bob' },
      ],
    });

    const response = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/leave`)
      .set('Authorization', bearer('alice'));
    expect(response.status).toBe(201);
    expect(store.members.get(members[0].id)?.status).toBe(GroupMemberStatus.LEFT);
    expect(store.groups.get(groupId)?.status).toBe(ExpenseGroupStatus.ACTIVE);
  });

  it('cancels a pending group and its outstanding invitations when its last active member leaves', async () => {
    const groupId = ExpenseGroupIdFactory.create('pending-last-member-group');
    const creatorId = AuthUserIdFactory.create('alice');
    const inviterMemberId = GroupMemberIdFactory.create('member-alice');
    const inviteeMemberId = GroupMemberIdFactory.create('member-bob');
    const group = ExpenseGroup.rehydrate(
      groupId,
      'Pending group',
      ExpenseGroupStatus.PENDING,
      creatorId,
      Currency.create('EUR'),
    );
    store.groups.set(groupId, group);
    store.members.set(
      inviterMemberId,
      ExpenseGroupMember.createActive(inviterMemberId, creatorId, groupId, clock.now()),
    );
    store.members.set(
      inviteeMemberId,
      ExpenseGroupMember.createInvited(inviteeMemberId, AuthUserIdFactory.create('bob'), groupId),
    );
    const invitation = GroupInvitation.rehydrate({
      id: GroupInvitationIdFactory.create('invitation-to-bob'),
      inviterId: inviterMemberId,
      inviteeId: inviteeMemberId,
      groupId,
      expiresAt: clock.after(60_000),
      status: GroupInvitationStatus.PENDING,
    });
    store.invitations.set(invitation.id, invitation);

    const response = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/leave`)
      .set('Authorization', bearer('alice'));
    expect(response.status).toBe(201);
    expect(store.members.get(inviterMemberId)?.status).toBe(GroupMemberStatus.LEFT);
    expect(store.groups.get(groupId)?.status).toBe(ExpenseGroupStatus.CANCELLED);
    expect(store.invitations.get(invitation.id)?.status).toBe(GroupInvitationStatus.CANCELLED);
  });

  it('does not allow a non-member to leave a group', async () => {
    const { groupId } = seedGroup(store, clock, {
      id: 'not-member-group',
      members: [{ id: 'member-a', userId: 'alice' }],
    });
    const response = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/leave`)
      .set('Authorization', bearer('mallory'));
    expect(response.status).toBe(404);
  });

  it('creates equal-split expenses with exact minor units and exposes correct balances', async () => {
    const { groupId, members } = seedGroup(store, clock, {
      id: 'expense-group',
      status: ExpenseGroupStatus.ACTIVE,
      members: [
        { id: 'member-a', userId: 'alice' },
        { id: 'member-b', userId: 'bob' },
        { id: 'member-c', userId: 'carol' },
      ],
    });

    const created = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({
        description: 'Dinner',
        amount: '10.00',
        currency: 'EUR',
        paidByMemberId: members[0].id,
        participantMemberIds: [members[2].id, members[1].id, members[0].id],
      });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(store.outboxEventTypes).toContain('expense-group.expense.created');

    const balances = await request(app.getHttpServer())
      .get(`/expense-group/${groupId}/balances`)
      .set('Authorization', bearer('alice'));
    expect(balances.status).toBe(200);
    expect(balances.body).toMatchObject({ groupId, currency: 'EUR' });
    const byMember = Object.fromEntries(balances.body.balances.map((balance: any) => [balance.memberId, balance]));
    expect(byMember[members[0].id]).toMatchObject({ paidMinor: '1000', owedMinor: '334', netMinor: '666' });
    expect(byMember[members[1].id]).toMatchObject({ paidMinor: '0', owedMinor: '333', netMinor: '-333' });
    expect(byMember[members[2].id]).toMatchObject({ paidMinor: '0', owedMinor: '333', netMinor: '-333' });
  });

  it('converts foreign-currency expenses using a rational quote before splitting', async () => {
    const { groupId, members } = seedGroup(store, clock, {
      id: 'fx-group',
      status: ExpenseGroupStatus.ACTIVE,
      baseCurrency: 'EUR',
      members: [
        { id: 'member-a', userId: 'alice' },
        { id: 'member-b', userId: 'bob' },
      ],
    });
    store.fxRates.set('USD:EUR', { numerator: 9n, denominator: 10n });

    const created = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({
        description: 'Taxi',
        amount: '10.00',
        currency: 'USD',
        paidByMemberId: members[0].id,
        participantMemberIds: [members[0].id, members[1].id],
      });
    expect(created.status).toBe(201);

    const balances = await request(app.getHttpServer())
      .get(`/expense-group/${groupId}/balances`)
      .set('Authorization', bearer('alice'));
    const byMember = Object.fromEntries(balances.body.balances.map((balance: any) => [balance.memberId, balance]));
    expect(byMember[members[0].id]).toMatchObject({ paidMinor: '900', owedMinor: '450', netMinor: '450' });
    expect(byMember[members[1].id]).toMatchObject({ paidMinor: '0', owedMinor: '450', netMinor: '-450' });
  });

  it('rejects invalid, duplicate, zero, and over-precision expense amounts/participants', async () => {
    const { groupId, members } = seedGroup(store, clock, {
      id: 'validation-expense-group',
      status: ExpenseGroupStatus.ACTIVE,
      members: [
        { id: 'member-a', userId: 'alice' },
        { id: 'member-b', userId: 'bob' },
      ],
    });
    const base = {
      description: 'Lunch',
      amount: '10.00',
      currency: 'EUR',
      paidByMemberId: members[0].id,
      participantMemberIds: [members[0].id],
    };

    const numberAmount = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, amount: 10 });
    expect(numberAmount.status).toBe(400);

    const zero = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, amount: '0' });
    expect(zero.status).toBe(400);

    const negative = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, amount: '-1.00' });
    expect(negative.status).toBe(400);

    const blankDescription = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, description: '   ' });
    expect(blankDescription.status).toBe(400);

    const overPrecision = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, amount: '1.001' });
    expect(overPrecision.status).toBe(400);

    const duplicateParticipants = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, participantMemberIds: [members[0].id, members[0].id] });
    expect(duplicateParticipants.status).toBe(400);

    const emptyParticipants = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...base, participantMemberIds: [] });
    expect(emptyParticipants.status).toBe(400);

    expect(store.expenses.size).toBe(0);
  });

  it('rejects expenses for inactive groups, inactive/nonexistent payers, participants, and actors', async () => {
    const pending = seedGroup(store, clock, {
      id: 'inactive-expense-group',
      status: ExpenseGroupStatus.PENDING,
      members: [
        { id: 'member-a', userId: 'alice' },
        { id: 'member-b', userId: 'bob' },
      ],
    });
    const expenseBody = {
      description: 'Dinner',
      amount: '4.00',
      currency: 'EUR',
      paidByMemberId: pending.members[0].id,
      participantMemberIds: [pending.members[0].id],
    };
    const inactive = await request(app.getHttpServer())
      .post(`/expense-group/${pending.groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send(expenseBody);
    expect(inactive.status).toBe(409);

    const active = seedGroup(store, clock, {
      id: 'active-membership-group',
      status: ExpenseGroupStatus.ACTIVE,
      members: [
        { id: 'member-c', userId: 'alice' },
        { id: 'member-d', userId: 'bob', status: GroupMemberStatus.LEFT },
      ],
    });
    const inactiveParticipant = await request(app.getHttpServer())
      .post(`/expense-group/${active.groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...expenseBody, paidByMemberId: active.members[0].id, participantMemberIds: [active.members[1].id] });
    expect(inactiveParticipant.status).toBe(403);

    const nonMemberActor = await request(app.getHttpServer())
      .post(`/expense-group/${active.groupId}/expenses`)
      .set('Authorization', bearer('mallory'))
      .send({ ...expenseBody, paidByMemberId: active.members[0].id, participantMemberIds: [active.members[0].id] });
    expect(nonMemberActor.status).toBe(404);

    const missingPayer = await request(app.getHttpServer())
      .post(`/expense-group/${active.groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({ ...expenseBody, paidByMemberId: 'not-a-member', participantMemberIds: [active.members[0].id] });
    expect(missingPayer.status).toBe(403);
  });

  it('fails closed when no FX quote is configured and rejects reads from non-members or inactive groups', async () => {
    const { groupId, members } = seedGroup(store, clock, {
      id: 'no-fx-group',
      status: ExpenseGroupStatus.ACTIVE,
      baseCurrency: 'EUR',
      members: [
        { id: 'member-a', userId: 'alice' },
        { id: 'member-b', userId: 'bob' },
      ],
    });
    const noQuote = await request(app.getHttpServer())
      .post(`/expense-group/${groupId}/expenses`)
      .set('Authorization', bearer('alice'))
      .send({
        description: 'Foreign dinner',
        amount: '5.00',
        currency: 'USD',
        paidByMemberId: members[0].id,
        participantMemberIds: [members[0].id],
      });
    expect(noQuote.status).toBe(400);
    expect(noQuote.body.code).toBe('expense_group.fx.provider_not_configured');

    expect(
      (
        await request(app.getHttpServer())
          .get(`/expense-group/${groupId}/balances`)
          .set('Authorization', bearer('mallory'))
      ).status,
    ).toBe(404);

    const { groupId: pendingId } = seedGroup(store, clock, {
      id: 'pending-balance-group',
      status: ExpenseGroupStatus.PENDING,
      members: [{ id: 'member-c', userId: 'alice' }],
    });
    const pendingBalances = await request(app.getHttpServer())
      .get(`/expense-group/${pendingId}/balances`)
      .set('Authorization', bearer('alice'));
    expect(pendingBalances.status).toBe(409);
  });

  it('expires pending invitations in bounded batches and updates the invited membership', async () => {
    const created = await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Expiry batch', baseCurrency: 'EUR', inviteeIds: ['bob', 'carol'] });
    expect(created.status).toBe(201);
    const invitationIds = [...store.invitations.keys()];
    clock.advance(8 * 24 * 60 * 60 * 1000);

    expect(await expireInvitations.execute(0)).toBe(0);
    expect(await expireInvitations.execute(1001)).toBe(0);
    expect(await expireInvitations.execute(1)).toBe(1);
    expect([...store.invitations.values()].filter((inv) => inv.status === GroupInvitationStatus.EXPIRED)).toHaveLength(
      1,
    );
    expect([...store.members.values()].filter((member) => member.status === GroupMemberStatus.EXPIRED)).toHaveLength(1);
    expect(await expireInvitations.execute(10)).toBe(1);
    expect(invitationIds.every((id) => store.invitations.get(id)?.status === GroupInvitationStatus.EXPIRED)).toBe(true);
    expect(await expireInvitations.execute(10)).toBe(0);
  });

  it('allows only one concurrent decision for the same invitation', async () => {
    await request(app.getHttpServer())
      .post('/expense-group')
      .set('Authorization', bearer('alice'))
      .send({ groupName: 'Concurrency group', baseCurrency: 'EUR', inviteeIds: ['bob'] });
    const invitation = [...store.invitations.values()][0];

    const [accept, reject] = await Promise.all([
      request(app.getHttpServer()).post(`/invitation/${invitation.id}/accept`).set('Authorization', bearer('bob')),
      request(app.getHttpServer()).post(`/invitation/${invitation.id}/reject`).set('Authorization', bearer('bob')),
    ]);
    expect([accept.status, reject.status].filter((status) => status === 201)).toHaveLength(1);
    expect([accept.status, reject.status].filter((status) => status === 409)).toHaveLength(1);
    expect([GroupInvitationStatus.ACCEPTED, GroupInvitationStatus.REJECTED]).toContain(
      store.invitations.get(invitation.id)?.status,
    );
  });
});

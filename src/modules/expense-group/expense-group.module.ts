import { Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExpenseGroupController } from './presentation/group.controller.js';
import { ExpenseGroupRepository } from './application/ports/expense-group.repository.js';
import { PrismaExpenseGroupRepostiory } from './infrastructure/repositories/prisma.expense-group.repo.js';
import { GroupInvitationRepository } from './application/ports/invitation.repository.js';
import { PrismaGroupInvitationRepository } from './infrastructure/repositories/prisma.invitation-repo.js';
import { CreateExpenseGroup } from './application/commands/create-group.js';
import { GroupMemberRepository } from './application/ports/group-member.repository.js';
import { PrismaGroupMemberRepository } from './infrastructure/repositories/prisma.group-member.repository.js';
import { LeaveGroup } from './application/commands/leave-group.js';
import { MakeDecisionOnInvitation } from './application/commands/decide-invitation.js';
import { ExpireGroupInvitations } from './application/commands/expire-invitations.js';
import { ExpenseRepository } from './application/ports/expense.repository.js';
import { PrismaExpenseRepository } from './infrastructure/repositories/prisma.expense.repository.js';
import { CreateExpense } from './application/commands/create-expense.js';
import { EqualSplitCalculator } from './domain/equal-split.calculator.js';
import { ExchangeRateProvider } from './application/ports/exchange-rate.provider.js';
import { FrankfurterExchangeRateProvider } from './infrastructure/exchange-rates/frankfurter.exchange-rate.provider.js';
import { ExchangeRateCache } from './application/ports/exchange-rate-cache.js';
import { RedisExchangeRateCache } from './infrastructure/exchange-rates/redis-exchange-rate.cache.js';
import { FrankfurterApiClient } from './infrastructure/exchange-rates/frankfurter/frankfurter-api.client.js';
import { GroupBalanceRepository } from './application/ports/group-balance.repository.js';
import { PrismaGroupBalanceRepository } from './infrastructure/repositories/prisma.group-balance.repo.js';
import { GetGroupBalances } from './application/queries/get-group-balances.js';
import { OutboxRelay } from '@/worker/outbox.relay.js';
import { CheckGroupForActivation } from './application/commands/check-group-for-activation.js';
import { GetExpensesForGroup } from './application/queries/get-expenses.js';
import { GetCurrentGroups } from './application/queries/get-current-groups.js';
import { GetPendingInvitations } from './application/queries/get-pending-invitations.js';
import { IdentityModule } from '@/modules/auth/identity/identity.module.js';
import { GroupNotificationsGateway } from './presentation/websocket/group-notifications.gateway.js';
import { GroupRealtimeNotificationHandler } from './application/handlers/group-realtime-notification.handler.js';
import { RealtimeNotificationPublisher } from './application/ports/realtime-notification.publisher.js';
import { SocketIoRealtimeNotificationPublisher } from './infrastructure/websocket/socket-io-realtime-notification.publisher.js';
import { ExpireGroupInvitationsScheduler } from './infrastructure/scheduling/expire-group-invitations.scheduler.js';

const repositories: Provider[] = [
  { provide: ExpenseGroupRepository, useClass: PrismaExpenseGroupRepostiory },
  { provide: GroupInvitationRepository, useClass: PrismaGroupInvitationRepository },
  { provide: GroupMemberRepository, useClass: PrismaGroupMemberRepository },
  { provide: GroupBalanceRepository, useClass: PrismaGroupBalanceRepository },
  { provide: ExpenseRepository, useClass: PrismaExpenseRepository },
];

const commands: Provider[] = [
  CreateExpenseGroup,
  LeaveGroup,
  MakeDecisionOnInvitation,
  ExpireGroupInvitations,
  CreateExpense,
  EqualSplitCalculator,
  CheckGroupForActivation,
  OutboxRelay,
];

const queries: Provider[] = [GetGroupBalances, GetExpensesForGroup, GetCurrentGroups, GetPendingInvitations];

const exchangeRateProviders: Provider[] = [
  { provide: ExchangeRateProvider, useClass: FrankfurterExchangeRateProvider },
  { provide: ExchangeRateCache, useClass: RedisExchangeRateCache },
  FrankfurterApiClient,
];

@Module({
  imports: [HttpModule, IdentityModule],
  providers: [
    ...repositories,
    ...commands,
    ...queries,
    ...exchangeRateProviders,
    GroupNotificationsGateway,
    SocketIoRealtimeNotificationPublisher,
    { provide: RealtimeNotificationPublisher, useExisting: SocketIoRealtimeNotificationPublisher },
    GroupRealtimeNotificationHandler,
    ExpireGroupInvitationsScheduler,
  ],
  controllers: [ExpenseGroupController],
  exports: [GroupRealtimeNotificationHandler],
})
export class ExpenseGroupModule {}

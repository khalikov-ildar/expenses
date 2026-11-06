import { Injectable } from '@nestjs/common';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { executeWithLogging } from '../command-logging.js';
import { Clock } from '@/shared/domain/clock.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { OutboxRepository } from '@/shared/application/ports/outbox.repository.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { ExpenseGroupRepository } from '../ports/expense-group.repository.js';
import { GroupMemberRepository } from '../ports/group-member.repository.js';
import { ExpenseRepository } from '../ports/expense.repository.js';
import { ExchangeRateProvider } from '../ports/exchange-rate.provider.js';
import { Currency, Money } from '../../domain/currency.js';
import { ExchangeRate } from '../../domain/exchange-rate.js';
import { EqualSplitCalculator } from '../../domain/equal-split.calculator.js';
import { Expense, ExpenseIdFactory } from '../../domain/expense.js';
import { ExpenseGroupIdFactory, ExpenseGroupStatus } from '../../domain/expense-group.js';
import { GroupMemberIdFactory, GroupMemberStatus } from '../../domain/group-member.js';

export class CreateExpenseCommand {
  constructor(
    readonly groupId: string,
    readonly description: string,
    readonly amount: string,
    readonly currency: string,
    readonly paidByMemberId: string,
    readonly participantMemberIds: string[],
    readonly actorId: IdentityId,
  ) {}
}

@Injectable()
export class CreateExpense {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly groupRepo: ExpenseGroupRepository,
    private readonly memberRepo: GroupMemberRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly exchangeRateProvider: ExchangeRateProvider,
    private readonly splitCalculator: EqualSplitCalculator,
    private readonly outboxRepo: OutboxRepository,
    private readonly clock: Clock,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(cmd: CreateExpenseCommand): Promise<{ id: string }> {
    return executeWithLogging(
      this.logger,
      'expense_group.expense.create',
      { group_id: cmd.groupId, actor_id: cmd.actorId },
      async () => {
        const groupId = ExpenseGroupIdFactory.create(cmd.groupId);
        const payerId = GroupMemberIdFactory.create(cmd.paidByMemberId);
        const participantIds = cmd.participantMemberIds.map(GroupMemberIdFactory.create);
        if (participantIds.length === 0 || new Set(participantIds).size !== participantIds.length) {
          throw DomainErrors.invalid(
            'expense_group.expense.invalid_participants',
            'At least one unique participant is required.',
          );
        }

        // Fetch group and FX quote before acquiring the row lock; never hold a DB transaction over network I/O.
        const initialGroup = await this.groupRepo.getById(groupId);
        if (initialGroup.status !== ExpenseGroupStatus.ACTIVE) {
          throw DomainErrors.conflict(
            'expense_group.group.not_active',
            'Expenses can only be created in an active group.',
            {
              groupId,
              status: initialGroup.status,
            },
          );
        }
        const originalCurrency = Currency.create(cmd.currency);
        const originalAmount = Money.fromDecimal(cmd.amount, originalCurrency);
        const baseCurrency = initialGroup.baseCurrency;
        const exchangeRate: ExchangeRate | null = originalCurrency.equals(baseCurrency)
          ? null
          : await this.exchangeRateProvider.getRate(originalCurrency, baseCurrency);
        if (exchangeRate && (!exchangeRate.from.equals(originalCurrency) || !exchangeRate.to.equals(baseCurrency))) {
          throw DomainErrors.invalid(
            'expense_group.fx.provider_returned_wrong_pair',
            'The exchange-rate provider returned a quote for a different currency pair.',
          );
        }
        const baseAmount = exchangeRate
          ? exchangeRate.convert(originalAmount)
          : Money.fromMinorUnits(originalAmount.minorUnits, baseCurrency);

        const expenseId = ExpenseIdFactory.random();
        const expense = await this.transactionManager.run(async () => {
          await this.groupRepo.lockById(groupId);
          const group = await this.groupRepo.getById(groupId);
          if (group.status !== ExpenseGroupStatus.ACTIVE) {
            throw DomainErrors.conflict(
              'expense_group.group.not_active',
              'Expenses can only be created in an active group.',
              {
                groupId,
                status: group.status,
              },
            );
          }
          if (!group.baseCurrency.equals(baseCurrency)) {
            throw DomainErrors.conflict(
              'expense_group.group.base_currency_changed',
              'The group base currency changed while the expense was being prepared.',
            );
          }

          const creator = await this.memberRepo.getActiveByGroupAndIdentity(groupId, cmd.actorId);
          const requestedIds = [payerId, ...participantIds];
          const memberships = await this.memberRepo.getByIds(requestedIds);
          const membershipsById = new Map(memberships.map((member) => [member.id, member]));
          for (const memberId of requestedIds) {
            const member = membershipsById.get(memberId);
            if (!member || member.groupId !== groupId || member.status !== GroupMemberStatus.ACTIVE) {
              throw DomainErrors.forbidden(
                'expense_group.expense.member_not_active',
                'The payer and all participants must be active members of this group.',
                { memberId },
              );
            }
          }

          const shares = this.splitCalculator.calculate(baseAmount.minorUnits, participantIds);
          const created = Expense.create(
            {
              id: expenseId,
              groupId,
              createdByMemberId: creator.id,
              paidByMemberId: payerId,
              description: cmd.description,
              originalAmount,
              baseAmount,
              exchangeRate,
              participants: shares,
              createdAt: this.clock.now(),
            },
            this.clock,
          );
          await this.expenseRepo.save(created);
          await this.outboxRepo.saveEvents([created]);
          return created;
        });

        return { id: expense.id };
      },
    );
  }
}

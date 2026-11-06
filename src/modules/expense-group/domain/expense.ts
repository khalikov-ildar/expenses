import { Aggregate, DomainEvent, DomainEventIdFactory } from '@/shared/domain/aggregate.js';
import { Brand, createIdFactory } from '@/shared/domain/id/index.js';
import { Clock } from '@/shared/domain/clock.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { ExpenseGroupId } from './expense-group.js';
import { GroupMemberId } from './group-member.js';
import { Money } from './currency.js';
import { ExchangeRate } from './exchange-rate.js';

export type ExpenseId = Brand<string, 'ExpenseId'>;
export const ExpenseIdFactory = createIdFactory<ExpenseId>();

export const ExpenseCreatedType = 'expense-group.expense.created' as const;
export interface ExpenseCreatedPayload {
  groupId: ExpenseGroupId;
  createdByMemberId: GroupMemberId;
  paidByMemberId: GroupMemberId;
  originalAmountMinor: string;
  originalCurrency: string;
  baseAmountMinor: string;
  baseCurrency: string;
  participantCount: number;
}
export class ExpenseCreatedEvent implements DomainEvent<typeof ExpenseCreatedType, ExpenseId, ExpenseCreatedPayload> {
  readonly occuredAt: Date;
  constructor(
    readonly id: ReturnType<typeof DomainEventIdFactory.random>,
    readonly type: typeof ExpenseCreatedType,
    readonly aggregateId: ExpenseId,
    readonly payload: ExpenseCreatedPayload,
    clock: Clock,
  ) {
    this.occuredAt = clock.now();
  }
}
export type ExpenseDomainEvent = ExpenseCreatedEvent;

export interface ExpenseParticipant {
  readonly memberId: GroupMemberId;
  readonly amountMinor: bigint;
}

export interface RehydrateExpensePayload {
  id: ExpenseId;
  groupId: ExpenseGroupId;
  createdByMemberId: GroupMemberId;
  paidByMemberId: GroupMemberId;
  description: string;
  originalAmount: Money;
  baseAmount: Money;
  exchangeRate: ExchangeRate | null;
  participants: ExpenseParticipant[];
  createdAt: Date;
}

export class Expense extends Aggregate<ExpenseId, ExpenseDomainEvent> {
  private constructor(
    id: ExpenseId,
    readonly groupId: ExpenseGroupId,
    readonly createdByMemberId: GroupMemberId,
    readonly paidByMemberId: GroupMemberId,
    readonly description: string,
    readonly originalAmount: Money,
    readonly baseAmount: Money,
    readonly exchangeRate: ExchangeRate | null,
    readonly participants: readonly ExpenseParticipant[],
    readonly createdAt: Date,
  ) {
    super(id);
    if (!description.trim() || description.length > 256) {
      throw DomainErrors.invalid('expense_group.expense.invalid_description', 'Expense description must contain 1 to 256 characters.');
    }
    if (participants.length === 0 || participants.some((p) => p.amountMinor < 0n) || participants.reduce((sum, p) => sum + p.amountMinor, 0n) !== baseAmount.minorUnits) {
      throw DomainErrors.invalid('expense_group.expense.invalid_participant_allocation', 'Participant allocations must sum exactly to the converted expense amount.');
    }
    if (new Set(participants.map((participant) => participant.memberId)).size !== participants.length) {
      throw DomainErrors.invalid('expense_group.expense.duplicate_participant', 'An expense participant may only appear once.');
    }
    if (originalAmount.currency.equals(baseAmount.currency)) {
      if (exchangeRate !== null) {
        throw DomainErrors.invalid('expense_group.expense.unexpected_exchange_rate', 'Same-currency expenses must not carry an exchange-rate quote.');
      }
    } else if (
      !exchangeRate ||
      !exchangeRate.from.equals(originalAmount.currency) ||
      !exchangeRate.to.equals(baseAmount.currency)
    ) {
      throw DomainErrors.invalid('expense_group.expense.missing_exchange_rate', 'A matching exchange-rate quote is required for cross-currency expenses.');
    }
  }

  static create(input: RehydrateExpensePayload, clock: Clock): Expense {
    const description = input.description.trim();
    if (!description || description.length > 256) {
      throw DomainErrors.invalid('expense_group.expense.invalid_description', 'Expense description must contain 1 to 256 characters.');
    }
    const expense = new Expense(
      input.id,
      input.groupId,
      input.createdByMemberId,
      input.paidByMemberId,
      description,
      input.originalAmount,
      input.baseAmount,
      input.exchangeRate,
      [...input.participants],
      new Date(input.createdAt),
    );
    expense.addDomainEvent(new ExpenseCreatedEvent(
      DomainEventIdFactory.random(),
      ExpenseCreatedType,
      expense.id,
      {
        groupId: expense.groupId,
        createdByMemberId: expense.createdByMemberId,
        paidByMemberId: expense.paidByMemberId,
        originalAmountMinor: expense.originalAmount.minorUnits.toString(),
        originalCurrency: expense.originalAmount.currency.code,
        baseAmountMinor: expense.baseAmount.minorUnits.toString(),
        baseCurrency: expense.baseAmount.currency.code,
        participantCount: expense.participants.length,
      },
      clock,
    ));
    return expense;
  }

  static rehydrate(input: RehydrateExpensePayload): Expense {
    return new Expense(
      input.id,
      input.groupId,
      input.createdByMemberId,
      input.paidByMemberId,
      input.description,
      input.originalAmount,
      input.baseAmount,
      input.exchangeRate,
      [...input.participants],
      new Date(input.createdAt),
    );
  }
}

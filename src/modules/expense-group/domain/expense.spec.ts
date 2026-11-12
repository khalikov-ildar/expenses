import type { Clock } from '@/shared/domain/clock.js';
import { Currency, Money } from './currency.js';
import { Expense, ExpenseIdFactory, type RehydrateExpensePayload } from './expense.js';
import { ExchangeRate } from './exchange-rate.js';
import { ExpenseGroupIdFactory } from './expense-group.js';
import { GroupMemberIdFactory } from './group-member.js';

describe('Expense', () => {
  const eur = Currency.create('EUR');
  const usd = Currency.create('USD');
  const now = new Date('2026-11-12T10:00:00.000Z');
  const clock = {
    now: () => new Date(now),
    nowInMs: () => now.getTime(),
    fromMs: (ms: number) => new Date(ms),
    after: (ms: number) => new Date(now.getTime() + ms),
  } satisfies Clock;

  const creatorId = GroupMemberIdFactory.create('member-creator');
  const payerId = GroupMemberIdFactory.create('member-payer');
  const participantA = GroupMemberIdFactory.create('member-a');
  const participantB = GroupMemberIdFactory.create('member-b');

  const baseInput: RehydrateExpensePayload = {
    id: ExpenseIdFactory.create('expense-1'),
    groupId: ExpenseGroupIdFactory.create('group-1'),
    createdByMemberId: creatorId,
    paidByMemberId: payerId,
    description: '  Train tickets  ',
    originalAmount: Money.fromMinorUnits(1_000n, eur),
    baseAmount: Money.fromMinorUnits(1_000n, eur),
    exchangeRate: null,
    participants: [
      { memberId: participantA, amountMinor: 600n },
      { memberId: participantB, amountMinor: 400n },
    ],
    createdAt: now,
  };

  function createExpense(overrides: Partial<RehydrateExpensePayload> = {}) {
    return Expense.create({ ...baseInput, ...overrides }, clock);
  }

  test('creates an expense when participant allocations sum exactly to the expense amount', () => {
    const expense = createExpense();

    expect(expense.description).toBe('Train tickets');
    expect(expense.baseAmount.minorUnits).toBe(1_000n);
    expect(expense.participants).toEqual([
      { memberId: participantA, amountMinor: 600n },
      { memberId: participantB, amountMinor: 400n },
    ]);
  });

  test('emits an expense-created event describing the persisted business facts', () => {
    const expense = createExpense();

    expect(expense.pullDomainEvents()).toEqual([
      expect.objectContaining({
        type: 'expense-group.expense.created',
        aggregateId: expense.id,
        occuredAt: now,
        payload: {
          groupId: expense.groupId,
          createdByMemberId: creatorId,
          paidByMemberId: payerId,
          originalAmountMinor: '1000',
          originalCurrency: 'EUR',
          baseAmountMinor: '1000',
          baseCurrency: 'EUR',
          participantCount: 2,
        },
      }),
    ]);
  });

  test('rejects allocations that do not sum to the converted expense amount', () => {
    expect(() =>
      createExpense({
        participants: [
          { memberId: participantA, amountMinor: 600n },
          { memberId: participantB, amountMinor: 399n },
        ],
      }),
    ).toThrow();
  });

  test('rejects negative participant allocations even when the total still matches', () => {
    expect(() =>
      createExpense({
        participants: [
          { memberId: participantA, amountMinor: 1_001n },
          { memberId: participantB, amountMinor: -1n },
        ],
      }),
    ).toThrow();
  });

  test('rejects duplicate participant identities', () => {
    expect(() =>
      createExpense({
        participants: [
          { memberId: participantA, amountMinor: 500n },
          { memberId: participantA, amountMinor: 500n },
        ],
      }),
    ).toThrow();
  });

  test('requires a matching exchange-rate snapshot for a cross-currency expense', () => {
    const originalAmount = Money.fromMinorUnits(1_000n, usd);
    const baseAmount = Money.fromMinorUnits(920n, eur);
    const matchingRate = ExchangeRate.create({
      from: usd,
      to: eur,
      numerator: 92n,
      denominator: 100n,
      provider: 'test-provider',
      quotedAt: now,
    });

    expect(() =>
      createExpense({
        originalAmount,
        baseAmount,
        exchangeRate: null,
      }),
    ).toThrow();

    expect(() =>
      createExpense({
        originalAmount,
        baseAmount,
        exchangeRate: ExchangeRate.create({
          from: usd,
          to: Currency.create('GBP'),
          numerator: 92n,
          denominator: 100n,
          provider: 'test-provider',
          quotedAt: now,
        }),
      }),
    ).toThrow();

    expect(() => createExpense({ originalAmount, baseAmount, exchangeRate: matchingRate })).not.toThrow();
  });

  test('rejects an exchange-rate snapshot for a same-currency expense', () => {
    const unnecessaryRate = ExchangeRate.create({
      from: usd,
      to: eur,
      numerator: 92n,
      denominator: 100n,
      provider: 'test-provider',
      quotedAt: now,
    });

    expect(() => createExpense({ exchangeRate: unnecessaryRate })).toThrow();
  });

  test('rejects an empty or oversized description', () => {
    expect(() => createExpense({ description: '   ' })).toThrow();
    expect(() => createExpense({ description: 'x'.repeat(257) })).toThrow();
  });
});

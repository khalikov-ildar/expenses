import { GroupMemberIdFactory } from './group-member.js';
import { EqualSplitCalculator } from './equal-split.calculator.js';

describe('EqualSplitCalculator', () => {
  const calculator = new EqualSplitCalculator();

  test('distributes the entire amount and assigns remainder by member ID, not input order', () => {
    const shares = calculator.calculate(1_000n, [
      GroupMemberIdFactory.create('member-c'),
      GroupMemberIdFactory.create('member-a'),
      GroupMemberIdFactory.create('member-b'),
    ]);

    expect(shares).toEqual([
      { memberId: 'member-a', amountMinor: 334n },
      { memberId: 'member-b', amountMinor: 333n },
      { memberId: 'member-c', amountMinor: 333n },
    ]);
    expect(shares.reduce((total, share) => total + share.amountMinor, 0n)).toBe(1_000n);
  });

  test('allows zero-value shares when the amount is smaller than the participant count', () => {
    const shares = calculator.calculate(1n, [
      GroupMemberIdFactory.create('member-c'),
      GroupMemberIdFactory.create('member-a'),
      GroupMemberIdFactory.create('member-b'),
    ]);

    expect(shares).toEqual([
      { memberId: 'member-a', amountMinor: 1n },
      { memberId: 'member-b', amountMinor: 0n },
      { memberId: 'member-c', amountMinor: 0n },
    ]);
  });

  test('rejects an empty participant set', () => {
    expect(() => calculator.calculate(100n, [])).toThrow();
  });

  test.each([0n, -1n])('rejects non-positive total %s', (amount) => {
    expect(() => calculator.calculate(amount, [GroupMemberIdFactory.create('member-a')])).toThrow();
  });

  test('rejects duplicate participants', () => {
    const memberId = GroupMemberIdFactory.create('member-a');

    expect(() => calculator.calculate(100n, [memberId, memberId])).toThrow();
  });
});

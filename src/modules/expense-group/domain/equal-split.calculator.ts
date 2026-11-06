import { DomainErrors } from '@/shared/domain/domain-error.js';
import { GroupMemberId } from './group-member.js';

export interface MemberShare {
  memberId: GroupMemberId;
  amountMinor: bigint;
}

/** Equal split with deterministic remainder assignment by ascending membership ID. */
export class EqualSplitCalculator {
  calculate(totalMinor: bigint, memberIds: readonly GroupMemberId[]): MemberShare[] {
    if (totalMinor <= 0n || memberIds.length === 0) {
      throw DomainErrors.invalid('expense_group.split.invalid_input', 'An equal split requires a positive amount and at least one participant.');
    }
    if (new Set(memberIds).size !== memberIds.length) {
      throw DomainErrors.invalid('expense_group.split.duplicate_participant', 'An expense participant may only appear once.');
    }

    const ordered = [...memberIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const divisor = BigInt(ordered.length);
    const baseShare = totalMinor / divisor;
    const remainder = Number(totalMinor % divisor);

    return ordered.map((memberId, index) => ({
      memberId,
      amountMinor: baseShare + (index < remainder ? 1n : 0n),
    }));
  }
}

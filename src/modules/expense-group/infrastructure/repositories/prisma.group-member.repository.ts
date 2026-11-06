import { PrismaClientProvider } from '@/shared/infrastructure/database/transaction/prisma.client-provider.js';
import { Injectable } from '@nestjs/common';
import { GroupMemberRepository } from '../../application/ports/group-member.repository.js';
import {
  ExpenseGroupMember,
  GroupMemberId,
  GroupMemberIdFactory,
  GroupMemberStatus,
} from '../../domain/group-member.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';
import { IdentityId, AuthUserIdFactory } from '@/shared/domain/id/auth.js';
import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';
import { ExpenseGroupId, ExpenseGroupIdFactory } from '../../domain/expense-group.js';
import { db } from '@/shared/infrastructure/database/prisma/db.js';

type MemberRow = NonNullable<Awaited<ReturnType<typeof db.orm.public.Member.first>>>;

@Injectable()
export class PrismaGroupMemberRepository implements GroupMemberRepository {
  constructor(private prisma: PrismaClientProvider) {}

  async getByIds(ids: GroupMemberId[]): Promise<ExpenseGroupMember[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.client.orm.public.Member.where((m) => m.id.in(ids)).all();
    return rows.map((row) => this.toDomain(row));
  }

  async getById(id: GroupMemberId): Promise<ExpenseGroupMember> {
    const member = await this.prisma.client.orm.public.Member.first({ id });

    if (!member) {
      throw DomainErrors.notFound('expense_group.member.not_found', 'The group member does not exist.', {
        memberId: id,
      });
    }

    return this.toDomain(member);
  }

  async getActiveByGroupId(groupId: ExpenseGroupId): Promise<ExpenseGroupMember[]> {
    const members = await this.prisma.client.orm.public.Member.where({
      groupId,
      status: GroupMemberStatus.ACTIVE,
    }).all();

    return members.map((member) => this.toDomain(member));
  }

  async countActiveByGroup(groupId: ExpenseGroupId): Promise<number> {
    // Was: fetch the whole group with all ACTIVE members included, then take
    // .length, and throw a bare `new Error()` when the group is missing.
    const result = await this.prisma.client.orm.public.Member.where({
      groupId,
      status: GroupMemberStatus.ACTIVE,
    }).aggregate((a) => ({ count: a.count() }));
    return result.count;
  }

  async getActiveByGroupAndIdentity(groupId: ExpenseGroupId, identityId: IdentityId): Promise<ExpenseGroupMember> {
    const member = await this.prisma.client.orm.public.Member.where({
      groupId,
      identityId,
      status: GroupMemberStatus.ACTIVE,
    }).first();
    if (!member) {
      throw DomainErrors.notFound('expense_group.member.not_found', 'The group member does not exist.', {
        identityId,
        groupId,
      });
    }

    return this.toDomain(member);
  }

  async saveMany(ms: ExpenseGroupMember[]): Promise<void> {
    await this.prisma.client.orm.public.Member.createAll(
      ms.map((m) => ({
        id: m.id,
        identityId: m.identityId,
        groupId: m.groupId,
        status: m.status,
        joinedAt: m.joinedAt === null ? null : fromDate(m.joinedAt),
        endedAt: m.endedAt === null ? null : fromDate(m.endedAt),
      })),
    );
  }

  async saveStatusChange(m: ExpenseGroupMember, expectedStatus: GroupMemberStatus): Promise<boolean> {
    const client = this.prisma.client.orm.public;
    const updatedRows = await client.Member.where({ id: m.id, status: expectedStatus }).updateAndCount({
      status: m.status,
      joinedAt: m.joinedAt === null ? null : fromDate(m.joinedAt),
      endedAt: m.endedAt === null ? null : fromDate(m.endedAt),
    });
    return updatedRows === 1;
  }

  private toDomain(member: MemberRow): ExpenseGroupMember {
    return ExpenseGroupMember.rehydrate({
      id: GroupMemberIdFactory.create(member.id),
      identityId: AuthUserIdFactory.create(member.identityId),
      joinedAt: member.joinedAt ? fromInstant(member.joinedAt) : null,
      status: member.status,
      endedAt: member.endedAt ? fromInstant(member.endedAt) : null,
      groupId: ExpenseGroupIdFactory.create(member.groupId),
    });
  }
}

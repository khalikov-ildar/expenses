#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f9dec8b1ac42e9d6586b3a91b7e73e7291b8a81fccfccbaa6e1d44336bbfc767/contract';
import endContract from '../../snapshots/f9dec8b1ac42e9d6586b3a91b7e73e7291b8a81fccfccbaa6e1d44336bbfc767/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'emailVerificationToken',
        columns: [
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'expense',
        columns: [
          col('baseAmountMinor', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('baseCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdByMemberId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('exchangeRateDenominator', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('exchangeRateNumerator', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('exchangeRateProvider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('exchangeRateQuotedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('groupId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('originalAmountMinor', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('originalCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paidByMemberId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'expenseGroup',
        columns: [
          col('baseCurrency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('createdByIdentityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'expenseGroup_status_check_91fcbd87',
            "\"status\" IN ('PENDING', 'ACTIVE', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'expenseGroupInvitation',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expenseGroupId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inviteeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inviterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'expenseGroupInvitation_status_check_d85c7349',
            "\"status\" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'expenseParticipant',
        columns: [
          col('amountMinor', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('expenseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('groupId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('memberId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['expenseId', 'memberId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'externalIdentity',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'member',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('endedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('groupId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('identityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('INVITED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'member_status_check_978abec9',
            "\"status\" IN ('INVITED', 'ACTIVE', 'LEFT', 'DECLINED', 'EXPIRED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'oAuthTransaction',
        columns: [
          col('browserBindingHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('codeVerifier', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stateHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'outboxEvent',
        columns: [
          col('aggregateId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('aggregateType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('leaseOwner', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('leaseUntil', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('nextAttemptAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'outboxEvent_status_check_a1492ded',
            "\"status\" IN ('PENDING', 'PROCESSED', 'DEAD_LETTER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'refreshToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('familyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('generation', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('parentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('replacedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('revoked', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('revokedReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'refreshToken_revokedReason_check_9e2303fc',
            "\"revokedReason\" IN ('ROTATED', 'LOGOUT', 'REUSE_DETECTED', 'PASSWORD_CHANGED', 'SECURITY_EVENT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'refreshTokenFamily',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('revokedReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'refreshTokenFamily_revokedReason_check_9e2303fc',
            "\"revokedReason\" IN ('ROTATED', 'LOGOUT', 'REUSE_DETECTED', 'PASSWORD_CHANGED', 'SECURITY_EVENT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('emailVerifiedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'emailVerificationToken',
        constraint: 'emailVerificationToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'expense',
        constraint: 'expense_id_groupId_key',
        columns: ['id', 'groupId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'expenseGroupInvitation',
        constraint: 'expenseGroupInvitation_expenseGroupId_inviteeId_key',
        columns: ['expenseGroupId', 'inviteeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'externalIdentity',
        constraint: 'provider_providerUserId',
        columns: ['provider', 'providerUserId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'member',
        constraint: 'member_id_groupId_key',
        columns: ['id', 'groupId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'oAuthTransaction',
        constraint: 'oAuthTransaction_stateHash_key',
        columns: ['stateHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refreshToken',
        constraint: 'refreshToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refreshToken',
        constraint: 'refreshToken_familyId_generation_key',
        columns: ['familyId', 'generation'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailVerificationToken',
        index: 'emailVerificationToken_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailVerificationToken',
        index: 'emailVerificationToken_userId_consumedAt_idx_f20d882c',
        columns: ['userId', 'consumedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailVerificationToken',
        index: 'emailVerificationToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_createdByMemberId_groupId_idx_4f383860',
        columns: ['createdByMemberId', 'groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_createdByMemberId_idx_24edab95',
        columns: ['createdByMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_groupId_createdAt_idx_bac1e421',
        columns: ['groupId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_groupId_idx_e2fb5578',
        columns: ['groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_paidByMemberId_groupId_idx_973e4146',
        columns: ['paidByMemberId', 'groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_paidByMemberId_idx_e98587e6',
        columns: ['paidByMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseGroupInvitation',
        index: 'expenseGroupInvitation_expenseGroupId_idx_98e4d394',
        columns: ['expenseGroupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseGroupInvitation',
        index: 'expenseGroupInvitation_inviteeId_idx_3a8b78f7',
        columns: ['inviteeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseGroupInvitation',
        index: 'expenseGroupInvitation_inviterId_idx_c2d8c6d6',
        columns: ['inviterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseParticipant',
        index: 'expenseParticipant_expenseId_groupId_idx_0eadd446',
        columns: ['expenseId', 'groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseParticipant',
        index: 'expenseParticipant_groupId_memberId_idx_d2a4bf87',
        columns: ['groupId', 'memberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseParticipant',
        index: 'expenseParticipant_memberId_expenseId_idx_c77d8ab6',
        columns: ['memberId', 'expenseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expenseParticipant',
        index: 'expenseParticipant_memberId_groupId_idx_26965ae1',
        columns: ['memberId', 'groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'externalIdentity',
        index: 'externalIdentity_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'member',
        index: 'member_groupId_idx_e2fb5578',
        columns: ['groupId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'member',
        index: 'member_identityId_groupId_status_idx_99208072',
        columns: ['identityId', 'groupId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'oAuthTransaction',
        index: 'oAuthTransaction_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'oAuthTransaction',
        index: 'oAuthTransaction_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_aggregateType_aggregateId_occurredAt_idx_c7f8430f',
        columns: ['aggregateType', 'aggregateId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_leaseUntil_idx_1fd0ae7c',
        columns: ['leaseUntil'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_status_nextAttemptAt_leaseUntil_idx_c1c4107b',
        columns: ['status', 'nextAttemptAt', 'leaseUntil'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refreshToken',
        index: 'refreshToken_familyId_idx_3d03045e',
        columns: ['familyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refreshTokenFamily',
        index: 'refreshTokenFamily_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refreshTokenFamily',
        index: 'refreshTokenFamily_userId_revokedAt_idx_eae4cbef',
        columns: ['userId', 'revokedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_id_email_idx_ecc32872',
        columns: ['id', 'email'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'emailVerificationToken',
        foreignKey: {
          name: 'emailVerificationToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense',
        foreignKey: {
          name: 'expense_groupId_fkey',
          columns: ['groupId'],
          references: { schema: 'public', table: 'expenseGroup', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense',
        foreignKey: {
          name: 'expense_createdByMemberId_groupId_fkey',
          columns: ['createdByMemberId', 'groupId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'groupId'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expense',
        foreignKey: {
          name: 'expense_paidByMemberId_groupId_fkey',
          columns: ['paidByMemberId', 'groupId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'groupId'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenseGroupInvitation',
        foreignKey: {
          name: 'expenseGroupInvitation_expenseGroupId_fkey',
          columns: ['expenseGroupId'],
          references: { schema: 'public', table: 'expenseGroup', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenseGroupInvitation',
        foreignKey: {
          name: 'expenseGroupInvitation_inviterId_fkey',
          columns: ['inviterId'],
          references: { schema: 'public', table: 'member', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenseGroupInvitation',
        foreignKey: {
          name: 'expenseGroupInvitation_inviteeId_fkey',
          columns: ['inviteeId'],
          references: { schema: 'public', table: 'member', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenseParticipant',
        foreignKey: {
          name: 'expenseParticipant_expenseId_groupId_fkey',
          columns: ['expenseId', 'groupId'],
          references: { schema: 'public', table: 'expense', columns: ['id', 'groupId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'expenseParticipant',
        foreignKey: {
          name: 'expenseParticipant_memberId_groupId_fkey',
          columns: ['memberId', 'groupId'],
          references: { schema: 'public', table: 'member', columns: ['id', 'groupId'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'externalIdentity',
        foreignKey: {
          name: 'externalIdentity_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'member',
        foreignKey: {
          name: 'member_groupId_fkey',
          columns: ['groupId'],
          references: { schema: 'public', table: 'expenseGroup', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refreshToken',
        foreignKey: {
          name: 'refreshToken_familyId_fkey',
          columns: ['familyId'],
          references: { schema: 'public', table: 'refreshTokenFamily', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refreshTokenFamily',
        foreignKey: {
          name: 'refreshTokenFamily_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

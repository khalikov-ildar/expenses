import { JsonValue } from '@prisma/orm-postgres/target/codec-types';
import { Aggregate, DomainEvent } from '@shared/domain/aggregate.js';
import { ClaimedOutboxEvent, OutboxRepository } from '@shared/application/ports/outbox.repository.js';
import { PrismaClientProvider } from '@shared/infrastructure/database/transaction/prisma.client-provider.js';
import { db } from '@shared/infrastructure/database/prisma/db.js';
import { fromDate, fromInstant } from '@/shared/domain/date.converter.js';
import { Injectable } from '@nestjs/common';

type OrmOutboxEvent = Parameters<typeof db.orm.public.OutboxEvent.createAll>[0][number];

const evt = db.sql.public.outboxEvent.columns;

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private prismaProvider: PrismaClientProvider) {}

  async saveEvents(aggregates: Aggregate<string, DomainEvent<string, string, unknown>>[]) {
    const events = aggregates.flatMap((aggregate) => {
      const aggregateType = aggregate.constructor.name;

      return aggregate.pullDomainEvents().map((e) => this.mapEventToOrm(e, aggregateType));
    });
    if (events.length === 0) {
      return;
    }

    await this.prismaProvider.client.orm.public.OutboxEvent.createAll(events);
  }

  async claimPendingBatch(limit: number, leaseMs: number, owner: string, now: Date): Promise<ClaimedOutboxEvent[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs);

    const plan = db.raw.sql`
      WITH picked AS (
        SELECT "id"
        FROM "outboxEvent"
        WHERE "status" = 'PENDING'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now.toISOString()})
          AND ("leaseUntil" IS NULL OR "leaseUntil" < ${now.toISOString()})
        ORDER BY "occurredAt", "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "outboxEvent" AS o
      SET "leaseOwner" = ${owner},
          "leaseUntil" = ${leaseUntil.toISOString()},
          "attempts" = o."attempts" + 1,
          "updatedAt" = ${now.toISOString()}
      FROM picked
      WHERE o."id" = picked."id"
      RETURNING
        o."id",
        o."type",
        o."aggregateType",
        o."aggregateId",
        o."occurredAt",
        o."payload",
        o."attempts"
    `.returnsRow({
      id: evt.id,
      type: evt.type,
      aggregateType: evt.aggregateType,
      aggregateId: evt.aggregateId,
      occurredAt: evt.occurredAt,
      payload: evt.payload,
      attempts: evt.attempts,
    });

    const rows = await this.prismaProvider.runtime.query(plan.build());
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      occurredAt: fromInstant(row.occurredAt),
      payload: row.payload,
      attempts: row.attempts,
    }));
  }

  async markPublished(id: string, now: Date): Promise<void> {
    await this.prismaProvider.client.orm.public.OutboxEvent.where({ id }).update({
      status: 'PROCESSED',
      publishedAt: fromDate(now),
      leaseOwner: null,
      leaseUntil: null,
      lastError: null,
    });
  }

  async markFailed(id: string, error: unknown, retryDelayMs: number, maxAttempts: number, now: Date): Promise<void> {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const row = await this.prismaProvider.client.orm.public.OutboxEvent.first({ id });
    const attempts = row?.attempts ?? 0;

    if (attempts >= maxAttempts) {
      await this.prismaProvider.client.orm.public.OutboxEvent.where({ id }).update({
        status: 'DEAD_LETTER',
        lastError: message,
        leaseOwner: null,
        leaseUntil: null,
      });
      return;
    }

    await this.prismaProvider.client.orm.public.OutboxEvent.where({ id }).update({
      status: 'PENDING',
      lastError: message,
      nextAttemptAt: fromDate(new Date(now.getTime() + retryDelayMs)),
      leaseOwner: null,
      leaseUntil: null,
    });
  }

  private mapEventToOrm(e: DomainEvent<string, string, unknown>, aggregateType: string): OrmOutboxEvent {
    return {
      id: e.id,
      aggregateId: e.aggregateId,
      occurredAt: Temporal.Instant.fromEpochMilliseconds(e.occuredAt.getTime()),
      payload: e.payload as JsonValue,
      type: e.type,
      aggregateType,
    };
  }
}

import { Aggregate, DomainEvent } from '@shared/domain/aggregate.js';

export interface ClaimedOutboxEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: unknown;
  /** Number of delivery attempts so far (incremented when the event is claimed). */
  attempts: number;
}

export abstract class OutboxRepository {
  abstract saveEvents(aggregates: Aggregate<string, DomainEvent<string, string, unknown>>[]): Promise<void>;

  /**
   * Atomically claims up to `limit` deliverable events for this instance.
   * Must be safe for concurrent callers (SKIP LOCKED) and must honour the
   * lease so a crashed instance does not permanently pin events.
   */
  abstract claimPendingBatch(
    limit: number,
    leaseMs: number,
    owner: string,
    now: Date,
  ): Promise<ClaimedOutboxEvent[]>;

  abstract markPublished(id: string, now: Date): Promise<void>;

  /**
   * Records a failed delivery attempt. Moves the event to DEAD_LETTER once
   * attempts reach `maxAttempts`; otherwise schedules a retry.
   */
  abstract markFailed(id: string, error: unknown, retryDelayMs: number, maxAttempts: number, now: Date): Promise<void>;
}

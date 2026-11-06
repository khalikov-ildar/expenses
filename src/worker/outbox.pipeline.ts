import { ClaimedOutboxEvent, OutboxRepository } from '@/shared/application/ports/outbox.repository.js';
import { ApplicationLogger } from '@/shared/application/ports/application-logger.js';
import { TransactionManager } from '@/shared/application/ports/transaction-manager.js';
import { OutboxConfig, RedisConfig } from '@/shared/infrastructure/config/env.schema.js';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Clock } from '@/shared/domain/clock.js';
import { OutboxEventDispatcher } from '@/shared/application/ports/outbox-event-dispatcher.js';

const BATCH_SIZE = 25;
const LEASE_MS = 60_000;
const RETRY_DELAY_MS = 30_000;
const INSTANCE_ID = randomUUID();

/**
 * Completes the transactional-outbox loop. Events are written to the
 * outbox table in the same transaction as the aggregate change; this
 * pipeline relays them to BullMQ with at-least-once semantics:
 *
 *  - claims are leased and skip-locked, so many instances can run safely
 *  - failed publishes back off and eventually dead-letter
 *  - queue/worker connections are closed on shutdown
 * Event routing is delegated to the application OutboxEventDispatcher port.
 */
@Injectable()
export class OutboxPipeline implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly outboxRepo: OutboxRepository,
    private readonly outboxCfg: OutboxConfig,
    private readonly redisCfg: RedisConfig,
    private readonly logger: ApplicationLogger,
    private readonly clock: Clock,
    private readonly eventDispatcher: OutboxEventDispatcher,
  ) {}

  onModuleInit(): void {
    const connection = {
      host: this.redisCfg.redisHost,
      port: this.redisCfg.redisPort,
      // username: this.redisCfg.redisUsername || undefined,
      password: this.redisCfg.redisPassword || undefined,
      maxRetriesPerRequest: null,
    } as const;

    this.queue = new Queue(this.outboxCfg.outboxJobQueue, { connection });

    this.worker = new Worker(
      this.outboxCfg.outboxJobQueue,
      async (job: Job<{ event: ClaimedOutboxEvent }>) => this.eventDispatcher.dispatch(job.data.event),
      { connection, concurrency: 5 },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        'shared.outbox.job_failed',
        { event_id: job?.data?.event?.id, event_type: job?.data?.event?.type },
        error,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.worker?.close(), this.queue?.close()]);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { waitForCompletion: true })
  async relay(): Promise<void> {
    await this.transactionManager.startRequest(async () => {
      const events = await this.outboxRepo.claimPendingBatch(BATCH_SIZE, LEASE_MS, INSTANCE_ID, this.clock.now());

      for (const event of events) {
        try {
          await this.queue.add(
            this.outboxCfg.outboxJobName,
            { event },
            {
              jobId: event.id,
              attempts: this.outboxCfg.outboxMaxRetries,
              backoff: { type: 'exponential', delay: 1000 },
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 24 * 3600 },
            },
          );
          await this.outboxRepo.markPublished(event.id, this.clock.now());
          this.logger.info('shared.outbox.published', { event_id: event.id, event_type: event.type });
        } catch (error) {
          await this.outboxRepo.markFailed(
            event.id,
            error,
            RETRY_DELAY_MS,
            this.outboxCfg.outboxMaxRetries,
            this.clock.now(),
          );
          this.logger.error('shared.outbox.publish_failed', { event_id: event.id, event_type: event.type }, error);
        }
      }
    });
  }
}

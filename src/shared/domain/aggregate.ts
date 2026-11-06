import { Brand, createIdFactory } from './id/index.js';

export type DomainEventId = Brand<string, 'DomainEventId'>;
export const DomainEventIdFactory = createIdFactory<DomainEventId>();

export interface DomainEvent<TType extends string, TAggregateId extends string, TPayload> {
  readonly id: DomainEventId;
  readonly type: TType;
  readonly aggregateId: TAggregateId;
  readonly occuredAt: Date;
  readonly payload: TPayload;
}

export abstract class Aggregate<TId extends string, TEvent extends DomainEvent<string, TId, unknown>> {
  private readonly domainEvents: TEvent[] = [];

  protected addDomainEvent(event: TEvent): void {
    this.domainEvents.push(event);
  }

  public pullDomainEvents(): TEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }

  constructor(private readonly _id: TId) {}

  public get id() {
    return this._id;
  }
}

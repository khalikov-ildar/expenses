import { Brand, createIdFactory } from '@shared/domain/id/index.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Currency } from './currency.js';
import { DomainErrors } from '@/shared/domain/domain-error.js';

export type ExpenseGroupId = Brand<string, 'ExpenseGroupId'>;
export const ExpenseGroupIdFactory = createIdFactory<ExpenseGroupId>();

export const ExpenseGroupStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
} as const;
export type ExpenseGroupStatus = keyof typeof ExpenseGroupStatus;

export class ExpenseGroup {
  private constructor(
    private readonly _id: ExpenseGroupId,
    private _name: string,
    private _status: ExpenseGroupStatus,
    private _createdBy: IdentityId,
    private readonly _baseCurrency: Currency,
  ) {}

  static create(id: ExpenseGroupId, name: string, createdBy: IdentityId, baseCurrency: Currency): ExpenseGroup {
    return new ExpenseGroup(id, name, ExpenseGroupStatus.PENDING, createdBy, baseCurrency);
  }

  static rehydrate(
    id: ExpenseGroupId,
    name: string,
    status: ExpenseGroupStatus,
    createdBy: IdentityId,
    baseCurrency: Currency,
  ): ExpenseGroup {
    return new ExpenseGroup(id, name, status, createdBy, baseCurrency);
  }

  activate(): void {
    this.assertPending();
    this._status = ExpenseGroupStatus.ACTIVE;
  }
  cancel(): void {
    this.assertPending();
    this._status = ExpenseGroupStatus.CANCELLED;
  }

  private assertPending(): void {
    if (this._status !== ExpenseGroupStatus.PENDING) {
      throw DomainErrors.invalid('expense_group.invalid_status', 'Group status must be pending', {
        status: this._status,
      });
    }
  }

  get id() {
    return this._id;
  }
  get name() {
    return this._name;
  }
  get status() {
    return this._status;
  }
  get createdBy() {
    return this._createdBy;
  }
  get baseCurrency() {
    return this._baseCurrency;
  }
}

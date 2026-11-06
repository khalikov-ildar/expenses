export abstract class TransactionManager {
  abstract run<T>(work: () => Promise<T>): Promise<T>;

  abstract isActive(): boolean;

  abstract startRequest<T>(work: () => Promise<T>): Promise<T>;
}

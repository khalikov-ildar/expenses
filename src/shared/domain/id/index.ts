import { uuidv7 } from 'uuidv7';

export type Brand<T, B extends string> = T & { readonly __brand: B };

export const createIdFactory = <T extends Brand<unknown, string>>() => ({
  create: (id: string): T => id as unknown as T,
  random: (): T => uuidv7() as unknown as T,
});

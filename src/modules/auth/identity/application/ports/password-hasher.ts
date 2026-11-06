export abstract class PasswordHasher {
  abstract dummyHash: string;
  abstract compare(input: string, hash: string): Promise<boolean>;
  abstract hash(input: string): Promise<string>;
}

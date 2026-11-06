import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@/modules/auth/identity/application/ports/password-hasher.js';
import { compare, genSalt, hash, hashSync, genSaltSync } from 'bcrypt';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  public readonly dummyHash: string;

  constructor() {
    this.dummyHash = hashSync('some_arbitrary_string23!', genSaltSync(10));
  }

  async compare(input: string, hash: string): Promise<boolean> {
    return compare(input, hash);
  }
  async hash(input: string): Promise<string> {
    const salt = await genSalt(10);
    return hash(input, salt);
  }
}

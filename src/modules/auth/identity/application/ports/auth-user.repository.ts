import { AuthUser } from '@/modules/auth/identity/domain/auth-user.js';

export abstract class AuthUserRepository {
  abstract findById(id: string): Promise<AuthUser | null>;
  abstract findByEmail(email: string): Promise<AuthUser | null>;
  abstract save(user: AuthUser): Promise<void>;
  abstract update(user: AuthUser): Promise<void>;
}

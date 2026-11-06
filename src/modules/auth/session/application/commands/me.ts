import { AuthUserRepository } from '@/modules/auth/identity/application/ports/auth-user.repository.js';
import { userNotFoundError } from '@/modules/auth/identity/domain/errors.js';
import { BaseApplicationContext } from '@/shared/application/ports/application-context.js';
import { IdentityId } from '@/shared/domain/id/auth.js';
import { Injectable } from '@nestjs/common';

export interface MeOutput {
  id: IdentityId;
  name: string;
  email: string;
}

@Injectable()
export class MeHandler {
  constructor(
    private context: BaseApplicationContext,
    private userRepo: AuthUserRepository,
  ) {}

  async execute(): Promise<MeOutput> {
    const userId = this.context.userId;
    const user = await this.userRepo.findById(userId);
    if (!user) throw userNotFoundError({ metadata: { id: userId } });
    return {
      id: user.id,
      name: user.name as string,
      email: user.email,
    };
  }
}

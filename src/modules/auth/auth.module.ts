import { Module } from '@nestjs/common';
import { AuthenticationModule } from './authentication/authentication.module.js';
import { SessionModule } from './session/session.module.js';

@Module({ imports: [AuthenticationModule, SessionModule] })
export class AuthModule {}

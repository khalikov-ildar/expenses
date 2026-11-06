import { Controller, Get, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RefreshTokenHandler } from '../application/commands/refresh-token.js';
import { MeHandler } from '../application/commands/me.js';
import { AuthHttpService } from '../../identity/presentation/auth.http.service.js';
import { MeApi } from './swagger/me.decorator.js';
import { RefreshApi } from './swagger/refresh.decorator.js';
import type { Response } from 'express';

@ApiTags('Authentication')
@Controller()
export class SessionController {
  constructor(
    private refreshHandler: RefreshTokenHandler,
    private meHandler: MeHandler,
    private authHttpService: AuthHttpService,
  ) {}

  @Get('auth/me')
  @MeApi()
  async me() {
    return this.meHandler.execute();
  }

  @Post('auth/refresh')
  @RefreshApi()
  async refresh(@Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.refreshHandler.execute();
    return this.authHttpService.handleTokens(accessToken, refreshToken, res);
  }
}

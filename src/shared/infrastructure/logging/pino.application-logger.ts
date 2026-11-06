import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ApplicationLogFields, ApplicationLogger } from '@/shared/application/ports/application-logger.js';

@Injectable()
export class PinoApplicationLogger implements ApplicationLogger {
  constructor(private readonly logger: PinoLogger) {}

  info(event: string, fields: ApplicationLogFields = {}): void {
    this.logger.info(fields, event);
  }

  warn(event: string, fields: ApplicationLogFields = {}): void {
    this.logger.warn(fields, event);
  }

  error(event: string, fields: ApplicationLogFields = {}, error?: unknown): void {
    if (error instanceof Error) {
      this.logger.error({ ...fields, err: error }, event);
      return;
    }

    this.logger.error(fields, event);
  }

  debug(event: string, fields: ApplicationLogFields = {}): void {
    this.logger.debug(fields, event);
  }
}

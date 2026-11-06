import { type Response, type Request } from 'express';

export abstract class RequestIntegrityStorage {
  abstract setCsrfToken(token: string, ttl: number, res: Response): void;
  abstract getCsrfToken(req: Request): string | undefined;

  abstract setOAuthBrowserBinding(binding: string, ttl: number, res: Response): void;
  abstract getOAuthBrowserBinding(req: Request): string | undefined;
  abstract clearOAuthBrowserBinding(res: Response): void;
  abstract clearCsrfToken(res: Response): void;
}

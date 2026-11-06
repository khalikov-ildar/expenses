export interface IntegrityTokens {
  csrfToken: string;
}

export abstract class RequestIntegrityService {
  abstract generateCsrfToken(): string;
  abstract isCsrfTokenValid(token: string, against: string): boolean;
}

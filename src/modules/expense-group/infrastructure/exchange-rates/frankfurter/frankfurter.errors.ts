export class FrankfurterTransportError extends Error {
  constructor(cause: unknown) {
    super('Failed to communicate with Frankfurter API.', { cause });
    this.name = FrankfurterTransportError.name;
  }
}

export class FrankfurterProtocolError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = FrankfurterProtocolError.name;
  }
}

export class FrankfurterHttpError extends Error {
  constructor(
    readonly status: number,
    cause?: unknown,
  ) {
    super(`Frankfurter returned HTTP ${status}.`, { cause });
    this.name = FrankfurterHttpError.name;
  }
}

/**
 * A stale quote is a valid fallback only when the remote dependency is
 * temporarily unreachable or explicitly asks the caller to retry later.
 * Malformed payloads and permanent 4xx responses are deliberately excluded.
 */
export function isTransientFrankfurterFailure(error: unknown): boolean {
  if (error instanceof FrankfurterTransportError) {
    return true;
  }

  if (!(error instanceof FrankfurterHttpError)) {
    return false;
  }

  return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
}

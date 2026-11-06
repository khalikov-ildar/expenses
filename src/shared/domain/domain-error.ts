export const DomainErrorCategory = {
  INVALID: 'INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type DomainErrorCategory = (typeof DomainErrorCategory)[keyof typeof DomainErrorCategory];

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly category: DomainErrorCategory,
    message: string,
    public readonly metadata: Readonly<Record<string, unknown>> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'DomainError';

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}
export const DomainErrors = {
  invalid(code: string, message: string, metadata?: Record<string, unknown>) {
    return new DomainError(code, DomainErrorCategory.INVALID, message, metadata);
  },

  unauthorized(code: string, message: string, metadata?: Record<string, unknown>) {
    return new DomainError(code, DomainErrorCategory.UNAUTHORIZED, message, metadata);
  },

  forbidden(code: string, message: string, metadata?: Record<string, unknown>) {
    return new DomainError(code, DomainErrorCategory.FORBIDDEN, message, metadata);
  },

  notFound(code: string, message: string, metadata?: Record<string, unknown>) {
    return new DomainError(code, DomainErrorCategory.NOT_FOUND, message, metadata);
  },

  conflict(code: string, message: string, metadata?: Record<string, unknown>) {
    return new DomainError(code, DomainErrorCategory.CONFLICT, message, metadata);
  },

  unavailable(
    code: string,
    message: string,
    metadata?: Record<string, unknown>,
    cause?: unknown,
  ) {
    return new DomainError(code, DomainErrorCategory.UNAVAILABLE, message, metadata, { cause });
  },
};

export interface DomainErrorDetails<Metadata extends Record<string, unknown>> {
  message?: string;
  metadata?: Metadata;
}

export interface RequiredDomainErrorDetails<Metadata extends Record<string, unknown>> {
  message?: string;
  metadata: Metadata;
}

export interface CreateDomainErrorFactoryParams {
  category: DomainErrorCategory;
  code: string;
  defaultMessage: string;
}

export function createDomainErrorFactory(params: CreateDomainErrorFactoryParams) {
  return {
    withMetadata<Metadata extends Record<string, unknown>>(message: (metadata: Metadata) => string) {
      return (details?: DomainErrorDetails<Metadata>): DomainError => {
        const resolvedMessage =
          details?.metadata !== undefined ? message(details.metadata) : (details?.message ?? params.defaultMessage);
        return new DomainError(params.code, params.category, resolvedMessage, details?.metadata);
      };
    },
    simple() {
      return (details?: { message?: string; metadata?: Record<string, unknown> }): DomainError => {
        return new DomainError(
          params.code,
          params.category,
          details?.message ?? params.defaultMessage,
          details?.metadata,
        );
      };
    },
  };
}

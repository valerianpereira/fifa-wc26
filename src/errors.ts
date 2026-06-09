export type ErrorCode =
  | 'NO_PROVIDER_CONFIGURED'
  | 'RATE_LIMIT'
  | 'PROVIDER_UNREACHABLE'
  | 'SCHEMA_MISMATCH'
  | 'NOT_FOUND'
  | 'CACHE_MISS_OFFLINE'
  | 'CONFIG_INVALID';

export class WC26Error extends Error {
  constructor(public code: ErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = 'WC26Error';
  }
}

const EXIT: Record<ErrorCode, number> = {
  NO_PROVIDER_CONFIGURED: 3,
  PROVIDER_UNREACHABLE: 4,
  CACHE_MISS_OFFLINE: 4,
  NOT_FOUND: 5,
  RATE_LIMIT: 1,
  SCHEMA_MISMATCH: 1,
  CONFIG_INVALID: 1,
};

export function exitCodeFor(code: ErrorCode): number {
  return EXIT[code];
}

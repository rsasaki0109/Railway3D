export type DataClientErrorCode =
  | 'NETWORK'
  | 'HTTP'
  | 'SCHEMA_INCOMPATIBLE'
  | 'SCHEMA_INVALID'
  | 'CHECKSUM_MISMATCH'
  | 'ASSET_NOT_FOUND'
  | 'HOST_NOT_ALLOWED'
  | 'ABORTED';

export interface DataClientErrorDetails {
  readonly code: DataClientErrorCode;
  readonly message: string;
  readonly url?: string;
  readonly status?: number;
  readonly cause?: unknown;
}

export class DataClientError extends Error {
  readonly code: DataClientErrorCode;
  readonly url: string | undefined;
  readonly status: number | undefined;
  override readonly cause: unknown | undefined;

  constructor(details: DataClientErrorDetails) {
    super(details.message, { cause: details.cause });
    this.name = 'DataClientError';
    this.code = details.code;
    this.url = details.url;
    this.status = details.status;
    this.cause = details.cause;
  }
}

export function isDataClientError(error: unknown): error is DataClientError {
  return error instanceof DataClientError;
}

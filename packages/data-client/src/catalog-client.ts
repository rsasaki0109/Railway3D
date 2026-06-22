import type { DataClientCache } from './cache';
import { fetchJson, type RetryOptions } from './asset-loader';
import { validateCatalog, type Railway3DCatalog } from './schema-validator';

export interface DataClientOptions {
  readonly baseUrl: string | URL;
  readonly allowedHosts?: readonly string[];
  readonly fetchFn?: typeof fetch;
  readonly cache?: DataClientCache;
  readonly retry?: RetryOptions;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export class CatalogClient {
  private readonly options: DataClientOptions;

  constructor(options: DataClientOptions) {
    this.options = options;
  }

  async fetchCatalog(
    href = 'catalog/catalog.v1.json',
    request: RequestOptions = {},
  ): Promise<Railway3DCatalog> {
    const value = await fetchJson(href, withRequestSignal(this.options, request.signal));
    return validateCatalog(value);
  }
}

function withRequestSignal(options: DataClientOptions, signal: AbortSignal | undefined) {
  return signal === undefined ? options : { ...options, signal };
}

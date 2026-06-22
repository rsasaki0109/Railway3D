import type { Railway3DDatasetManifest } from '@railway3d/schema';

import type { DataClientCache } from './cache';
import { DataClientError } from './errors';
import { resolveAssetUrl } from './asset-resolver';

export interface RetryOptions {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly jitterMs: number;
}

export interface FetchOptions {
  readonly baseUrl: string | URL;
  readonly allowedHosts?: readonly string[];
  readonly fetchFn?: typeof fetch;
  readonly cache?: DataClientCache;
  readonly retry?: RetryOptions;
  readonly signal?: AbortSignal;
}

export interface LoadedAsset {
  readonly url: URL;
  readonly bytes: Uint8Array;
  readonly response: Response;
}

const defaultRetry: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 20,
  jitterMs: 5,
};

export async function fetchJson(urlOrHref: string, options: FetchOptions): Promise<unknown> {
  const asset = await fetchBytes(urlOrHref, options);
  const text = new TextDecoder().decode(asset.bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new DataClientError({
      code: 'SCHEMA_INVALID',
      message: `JSON parsing failed for ${asset.url.toString()}`,
      url: asset.url.toString(),
      cause,
    });
  }
}

export async function fetchBytes(urlOrHref: string, options: FetchOptions): Promise<LoadedAsset> {
  const url = resolveAssetUrl(urlOrHref, options);
  const response = await fetchResponse(url, options);
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  return { url, bytes, response };
}

export async function loadManifestAsset(
  manifest: Railway3DDatasetManifest,
  assetId: string,
  options: FetchOptions,
): Promise<LoadedAsset> {
  const asset = manifest.assets.find((candidate) => candidate.id === assetId);
  if (asset === undefined) {
    throw new DataClientError({
      code: 'ASSET_NOT_FOUND',
      message: `Asset not found in manifest: ${assetId}`,
    });
  }

  const loaded = await fetchBytes(asset.href, options);
  await verifySha256(loaded.bytes, asset.checksum, loaded.url.toString());
  return loaded;
}

async function fetchResponse(url: URL, options: FetchOptions): Promise<Response> {
  const cached = await options.cache?.get(url.toString());
  if (cached !== undefined) {
    return cached;
  }

  const fetchFn = options.fetchFn ?? fetch;
  const retry = options.retry ?? defaultRetry;
  let attempt = 0;

  while (true) {
    if (isSignalAborted(options.signal)) {
      throw new DataClientError({
        code: 'ABORTED',
        message: `Request aborted before fetch: ${url.toString()}`,
        url: url.toString(),
      });
    }

    try {
      const requestInit: RequestInit = { method: 'GET' };
      if (options.signal !== undefined) {
        requestInit.signal = options.signal;
      }
      const response = await fetchFn(url, requestInit);

      if (response.ok) {
        await options.cache?.set(url.toString(), response.clone());
        return response;
      }

      if (!isRetryableStatus(response.status) || attempt >= retry.maxRetries) {
        throw new DataClientError({
          code: 'HTTP',
          message: `HTTP ${response.status} while fetching ${url.toString()}`,
          status: response.status,
          url: url.toString(),
        });
      }
    } catch (cause) {
      if (isAbortError(cause) || isSignalAborted(options.signal)) {
        throw new DataClientError({
          code: 'ABORTED',
          message: `Request aborted: ${url.toString()}`,
          url: url.toString(),
          cause,
        });
      }

      if (cause instanceof DataClientError && cause.code !== 'HTTP') {
        throw cause;
      }

      if (cause instanceof DataClientError && cause.code === 'HTTP') {
        throw cause;
      }

      if (attempt >= retry.maxRetries) {
        throw new DataClientError({
          code: 'NETWORK',
          message: `Network error while fetching ${url.toString()}`,
          url: url.toString(),
          cause,
        });
      }
    }

    attempt += 1;
    await delay(
      retry.baseDelayMs * 2 ** (attempt - 1) + deterministicJitter(url, attempt, retry.jitterMs),
    );
  }
}

async function verifySha256(bytes: Uint8Array, expected: string, url: string): Promise<void> {
  const actual = await sha256Hex(bytes);
  const actualDescriptor = `sha256:${actual}`;
  if (actualDescriptor.toLowerCase() !== expected.toLowerCase()) {
    throw new DataClientError({
      code: 'CHECKSUM_MISMATCH',
      message: `Checksum mismatch for ${url}`,
      url,
    });
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copiedBytes = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copiedBytes.buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function deterministicJitter(url: URL, attempt: number, jitterMs: number): number {
  if (jitterMs <= 0) {
    return 0;
  }
  const seed = `${url.toString()}:${attempt}`;
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }
  return hash % (jitterMs + 1);
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadManifestAsset } from './asset-loader';
import { resolveAssetUrl } from './asset-resolver';
import { MemoryDataClientCache } from './cache';
import { CatalogClient } from './catalog-client';
import { DataClientError } from './errors';
import { ManifestClient } from './manifest-client';

interface FixtureServer {
  readonly baseUrl: string;
  readonly requests: ReadonlyMap<string, number>;
  close(): Promise<void>;
  set(path: string, handler: FixtureHandler): void;
}

type FixtureHandler = (request: IncomingMessage, response: ServerResponse) => void;

const assetText = '{"ok":true}';

const validManifest = {
  schemaVersion: '1.0.0',
  datasetId: 'synthetic-golden',
  datasetVersion: '0.1.0-fixture',
  title: { en: 'Synthetic Golden Fixture' },
  description: { en: 'Synthetic Golden Fixture' },
  regionCodes: ['fixture'],
  bounds: [0, -0.01, 0.03, 0.01],
  horizontalCrs: 'EPSG:4326',
  canonicalVerticalDatum: 'LOCAL_ENGINEERING_DATUM',
  generatedAt: '2026-06-22T00:00:00Z',
  generator: {
    name: 'railway3d-pipeline',
    version: '0.0.0',
    gitCommit: 'fixture',
    configChecksum: checksum('config'),
  },
  sourceIds: ['synthetic-authoring-2026-06'],
  assets: [
    {
      id: 'asset-json',
      kind: 'metadata',
      href: 'assets/asset.json',
      mediaType: 'application/json',
      checksum: checksum(assetText),
    },
  ],
  entityCounts: {
    operators: 1,
    lines: 1,
    routes: 1,
    alignments: 1,
    segments: 1,
    stations: 1,
    profileSamples: 1,
  },
  attributionHtml: 'Synthetic fixture only.',
  notices: ['Synthetic fixture only.'],
  compatibility: {
    minAppVersion: '0.1.0',
    maxSchemaMajor: 1,
  },
};

const validCatalog = {
  schemaVersion: '1.0.0',
  datasets: [
    {
      datasetId: 'synthetic-golden',
      datasetVersion: '0.1.0-fixture',
      schemaVersion: '1.0.0',
      manifestHref: 'catalog/datasets/synthetic-golden.json',
      title: { en: 'Synthetic Golden Fixture' },
    },
  ],
};

describe('asset URL resolution', () => {
  it('resolves relative and absolute URLs against an allowed host', () => {
    const relative = resolveAssetUrl('data/asset.json', {
      baseUrl: 'https://example.test/base/catalog.v1.json',
      allowedHosts: ['example.test'],
    });
    const absolute = resolveAssetUrl('https://example.test/data/asset.json', {
      baseUrl: 'https://example.test/base/catalog.v1.json',
      allowedHosts: ['example.test'],
    });

    expect(relative.toString()).toBe('https://example.test/base/data/asset.json');
    expect(absolute.toString()).toBe('https://example.test/data/asset.json');
  });

  it('rejects forbidden schemes, disallowed hosts, and path traversal', () => {
    expectErrorCode(() =>
      resolveAssetUrl('javascript:alert(1)', {
        baseUrl: 'https://example.test/catalog.v1.json',
        allowedHosts: ['example.test'],
      }),
    ).toBe('HOST_NOT_ALLOWED');

    expectErrorCode(() =>
      resolveAssetUrl('https://evil.test/asset.json', {
        baseUrl: 'https://example.test/catalog.v1.json',
        allowedHosts: ['example.test'],
      }),
    ).toBe('HOST_NOT_ALLOWED');

    expectErrorCode(() =>
      resolveAssetUrl('../private.json', {
        baseUrl: 'https://example.test/catalog/catalog.v1.json',
        allowedHosts: ['example.test'],
      }),
    ).toBe('ASSET_NOT_FOUND');
  });
});

describe('data client HTTP loading', () => {
  let server: FixtureServer;

  beforeEach(async () => {
    server = await startFixtureServer();
    server.set('/catalog/catalog.v1.json', jsonResponse(validCatalog));
    server.set('/catalog/datasets/synthetic-golden.json', jsonResponse(validManifest));
    server.set('/catalog/datasets/assets/asset.json', textResponse(assetText));
  });

  afterEach(async () => {
    await server.close();
  });

  it('loads catalog, manifest, and checksummed asset', async () => {
    const options = clientOptions(server);
    const catalog = await new CatalogClient(options).fetchCatalog();
    const manifestHref = catalog.datasets[0]?.manifestHref;
    if (manifestHref === undefined) {
      throw new Error('Missing fixture manifest href.');
    }

    const manifest = await new ManifestClient(options).fetchManifest(manifestHref);
    const loaded = await loadManifestAsset(manifest, 'asset-json', {
      ...options,
      baseUrl: new URL(manifestHref, server.baseUrl),
    });

    expect(new TextDecoder().decode(loaded.bytes)).toBe(assetText);
  });

  it('uses cache entries without a second network request', async () => {
    const cache = new MemoryDataClientCache();
    const client = new CatalogClient({ ...clientOptions(server), cache });

    await client.fetchCatalog();
    await client.fetchCatalog();

    expect(server.requests.get('/catalog/catalog.v1.json')).toBe(1);
  });

  it('retries temporary GET failures and does not retry 404', async () => {
    let temporaryAttempts = 0;
    server.set('/temporary.json', (_request, response) => {
      temporaryAttempts += 1;
      if (temporaryAttempts < 3) {
        response.writeHead(503, { 'content-type': 'text/plain' });
        response.end('temporary');
        return;
      }
      jsonResponse(validCatalog)(_request, response);
    });
    server.set('/missing.json', textResponse('missing', 404));

    const options = clientOptions(server);
    await new CatalogClient(options).fetchCatalog('temporary.json');
    await expect(new CatalogClient(options).fetchCatalog('missing.json')).rejects.toMatchObject({
      code: 'HTTP',
      status: 404,
    });

    expect(temporaryAttempts).toBe(3);
    expect(server.requests.get('/missing.json')).toBe(1);
  });

  it('maps network failures to NETWORK', async () => {
    const closed = await startFixtureServer();
    const baseUrl = closed.baseUrl;
    await closed.close();

    await expect(
      new CatalogClient(clientOptions({ ...server, baseUrl })).fetchCatalog(),
    ).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('maps AbortSignal cancellation to ABORTED', async () => {
    server.set('/slow.json', (_request, response) => {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(validCatalog));
      }, 200);
    });
    const controller = new AbortController();
    const promise = new CatalogClient(clientOptions(server)).fetchCatalog('slow.json', {
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('rejects schema-invalid and incompatible catalog and manifest payloads', async () => {
    server.set('/invalid-catalog.json', jsonResponse({ schemaVersion: '1.0.0' }));
    server.set(
      '/incompatible-catalog.json',
      jsonResponse({
        schemaVersion: '1.0.0',
        datasets: [{ datasetId: 'future', schemaVersion: '2.0.0', manifestHref: 'future.json' }],
      }),
    );
    server.set('/invalid-manifest.json', jsonResponse({ schemaVersion: '1.0.0' }));
    server.set(
      '/incompatible-manifest.json',
      jsonResponse({ ...validManifest, schemaVersion: '2.0.0' }),
    );

    const options = clientOptions(server);
    await expect(
      new CatalogClient(options).fetchCatalog('invalid-catalog.json'),
    ).rejects.toMatchObject({
      code: 'SCHEMA_INVALID',
    });
    await expect(
      new CatalogClient(options).fetchCatalog('incompatible-catalog.json'),
    ).rejects.toMatchObject({
      code: 'SCHEMA_INCOMPATIBLE',
    });
    await expect(
      new ManifestClient(options).fetchManifest('invalid-manifest.json'),
    ).rejects.toMatchObject({
      code: 'SCHEMA_INVALID',
    });
    await expect(
      new ManifestClient(options).fetchManifest('incompatible-manifest.json'),
    ).rejects.toMatchObject({
      code: 'SCHEMA_INCOMPATIBLE',
    });
  });

  it('rejects missing assets and checksum mismatches without retrying', async () => {
    server.set('/assets/asset.json', textResponse(assetText));
    const options = clientOptions(server);
    const manifestAsset = validManifest.assets[0];
    if (manifestAsset === undefined) {
      throw new Error('Missing fixture manifest asset.');
    }
    const badManifest = {
      ...validManifest,
      assets: [{ ...manifestAsset, checksum: checksum('different') }],
    };

    await expect(loadManifestAsset(validManifest, 'missing', options)).rejects.toMatchObject({
      code: 'ASSET_NOT_FOUND',
    });
    await expect(loadManifestAsset(badManifest, 'asset-json', options)).rejects.toMatchObject({
      code: 'CHECKSUM_MISMATCH',
    });
    expect(server.requests.get('/assets/asset.json')).toBe(1);
    expect(server.requests.get('/catalog/datasets/assets/asset.json')).toBeUndefined();
  });
});

function clientOptions(server: Pick<FixtureServer, 'baseUrl'>) {
  const url = new URL(server.baseUrl);
  return {
    baseUrl: server.baseUrl,
    allowedHosts: [url.host],
    retry: { maxRetries: 2, baseDelayMs: 1, jitterMs: 0 },
  };
}

function checksum(value: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function jsonResponse(value: unknown, status = 200): FixtureHandler {
  return (_request, response) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(value));
  };
}

function textResponse(value: string, status = 200): FixtureHandler {
  return (_request, response) => {
    response.writeHead(status, { 'content-type': 'text/plain' });
    response.end(value);
  };
}

async function startFixtureServer(): Promise<FixtureServer> {
  const handlers = new Map<string, FixtureHandler>();
  const requests = new Map<string, number>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    requests.set(url.pathname, (requests.get(url.pathname) ?? 0) + 1);
    const handler = handlers.get(url.pathname);
    if (handler === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }
    handler(request, response);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    baseUrl: `http://127.0.0.1:${serverPort(server)}/`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
    set(path, handler) {
      handlers.set(path, handler);
    },
  };
}

function serverPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Fixture server did not expose a TCP port.');
  }
  return (address as AddressInfo).port;
}

function expectErrorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof DataClientError) {
      return expect(error.code);
    }
    throw error;
  }
  throw new Error('Expected DataClientError.');
}

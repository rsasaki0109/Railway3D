import type { Railway3DDatasetManifest } from '@railway3d/schema';

import { fetchJson } from './asset-loader';
import type { DataClientOptions, RequestOptions } from './catalog-client';
import { validateManifest } from './schema-validator';

export class ManifestClient {
  private readonly options: DataClientOptions;

  constructor(options: DataClientOptions) {
    this.options = options;
  }

  async fetchManifest(
    href: string,
    request: RequestOptions = {},
  ): Promise<Railway3DDatasetManifest> {
    const value = await fetchJson(href, withRequestSignal(this.options, request.signal));
    return validateManifest(value);
  }
}

function withRequestSignal(options: DataClientOptions, signal: AbortSignal | undefined) {
  return signal === undefined ? options : { ...options, signal };
}

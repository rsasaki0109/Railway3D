import Ajv2020 from 'ajv/dist/2020.js';
import type { Railway3DDatasetManifest } from '@railway3d/schema';

import { DataClientError } from './errors';

export interface CatalogDatasetEntry {
  readonly datasetId: string;
  readonly datasetVersion?: string;
  readonly schemaVersion: string;
  readonly manifestHref: string;
  readonly title?: Record<string, string>;
}

export interface Railway3DCatalog {
  readonly schemaVersion: '1.0.0';
  readonly datasets: readonly CatalogDatasetEntry[];
}

const catalogSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { const: '1.0.0' },
    datasets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          datasetId: { type: 'string', minLength: 1 },
          datasetVersion: { type: 'string' },
          schemaVersion: { type: 'string', minLength: 1 },
          manifestHref: { type: 'string', minLength: 1 },
          title: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['datasetId', 'schemaVersion', 'manifestHref'],
      },
    },
  },
  required: ['schemaVersion', 'datasets'],
} as const;

const manifestSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: true,
  properties: {
    schemaVersion: { const: '1.0.0' },
    datasetId: { type: 'string', minLength: 1 },
    datasetVersion: { type: 'string', minLength: 1 },
    title: { type: 'object' },
    description: { type: 'object' },
    regionCodes: { type: 'array', items: { type: 'string' } },
    bounds: {
      type: 'array',
      prefixItems: [
        { type: 'number', minimum: -180, maximum: 180 },
        { type: 'number', minimum: -90, maximum: 90 },
        { type: 'number', minimum: -180, maximum: 180 },
        { type: 'number', minimum: -90, maximum: 90 },
      ],
      items: { type: 'number' },
      minItems: 4,
      maxItems: 4,
    },
    horizontalCrs: { const: 'EPSG:4326' },
    canonicalVerticalDatum: { type: 'string' },
    generatedAt: { type: 'string' },
    generator: { type: 'object' },
    sourceIds: { type: 'array', items: { type: 'string' } },
    assets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string', minLength: 1 },
          href: { type: 'string', minLength: 1 },
          checksum: { type: 'string', pattern: '^sha256:[a-fA-F0-9]{64}$' },
          mediaType: { type: 'string', minLength: 1 },
        },
        required: ['id', 'href', 'checksum', 'mediaType'],
      },
    },
    entityCounts: { type: 'object' },
    attributionHtml: { type: 'string' },
    notices: { type: 'array', items: { type: 'string' } },
    compatibility: {
      type: 'object',
      additionalProperties: true,
      properties: {
        minAppVersion: { type: 'string' },
        maxSchemaMajor: { const: 1 },
      },
      required: ['minAppVersion', 'maxSchemaMajor'],
    },
  },
  required: [
    'schemaVersion',
    'datasetId',
    'datasetVersion',
    'title',
    'description',
    'regionCodes',
    'bounds',
    'horizontalCrs',
    'canonicalVerticalDatum',
    'generatedAt',
    'generator',
    'sourceIds',
    'assets',
    'entityCounts',
    'attributionHtml',
    'notices',
    'compatibility',
  ],
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateCatalogShape = ajv.compile<Railway3DCatalog>(catalogSchema);
const validateManifestShape = ajv.compile<Railway3DDatasetManifest>(manifestSchema);

export function validateCatalog(value: unknown): Railway3DCatalog {
  assertSupportedSchemaVersion(value, 'Catalog');
  if (!validateCatalogShape(value)) {
    throw new DataClientError({
      code: 'SCHEMA_INVALID',
      message: `Catalog schema validation failed: ${ajv.errorsText(validateCatalogShape.errors)}`,
    });
  }

  const incompatible = value.datasets.find((entry) => schemaMajor(entry.schemaVersion) !== 1);
  if (incompatible !== undefined) {
    throw new DataClientError({
      code: 'SCHEMA_INCOMPATIBLE',
      message: `Unsupported catalog dataset schema major: ${incompatible.schemaVersion}`,
    });
  }

  return value;
}

export function validateManifest(value: unknown): Railway3DDatasetManifest {
  assertSupportedSchemaVersion(value, 'Manifest');
  if (!validateManifestShape(value)) {
    throw new DataClientError({
      code: 'SCHEMA_INVALID',
      message: `Manifest schema validation failed: ${ajv.errorsText(validateManifestShape.errors)}`,
    });
  }

  if (schemaMajor(value.schemaVersion) !== 1 || value.compatibility.maxSchemaMajor !== 1) {
    throw new DataClientError({
      code: 'SCHEMA_INCOMPATIBLE',
      message: `Unsupported manifest schema version: ${value.schemaVersion}`,
    });
  }

  return value;
}

function schemaMajor(version: string): number | null {
  const firstPart = version.split('.', 1)[0];
  if (firstPart === undefined || firstPart === '') {
    return null;
  }
  const parsed = Number.parseInt(firstPart, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertSupportedSchemaVersion(value: unknown, label: string): void {
  if (!isRecord(value)) {
    return;
  }
  const version = value.schemaVersion;
  if (typeof version === 'string' && schemaMajor(version) !== 1) {
    throw new DataClientError({
      code: 'SCHEMA_INCOMPATIBLE',
      message: `${label} schema major is not supported: ${version}`,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

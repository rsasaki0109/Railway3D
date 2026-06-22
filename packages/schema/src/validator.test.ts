import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDatasetValidator, type JsonSchema } from './validator';

interface MutableDataset {
  routes: Array<{ lineId: string }>;
  stations: Array<{ centroid: [number, number] }>;
  profiles: Array<{
    verticalDatum?: string;
    samples: Array<{ railElevationM: number | null; provenance: unknown[] }>;
  }>;
}

const repoRoot = path.resolve(__dirname, '../../..');
const schemaDir = path.join(repoRoot, 'schemas/v1');
const fixturePath = path.join(repoRoot, 'data/sample/synthetic-golden/v1/dataset.json');

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function loadSchemas(): Promise<JsonSchema[]> {
  const files = (await readdir(schemaDir)).filter((file) => file.endsWith('.schema.json'));
  return Promise.all(files.map((file) => readJson<JsonSchema>(path.join(schemaDir, file))));
}

async function loadFixture(): Promise<MutableDataset> {
  return readJson<MutableDataset>(fixturePath);
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Missing test fixture item at index ${index}`);
  }
  return item;
}

describe('Railway3D dataset schema validation', () => {
  it('accepts the golden synthetic fixture', async () => {
    const validate = createDatasetValidator(await loadSchemas());
    expect(validate(await loadFixture())).toEqual([]);
  });

  it('rejects a profile with missing vertical datum', async () => {
    const validate = createDatasetValidator(await loadSchemas());
    const dataset = await loadFixture();
    delete dataset.profiles[0]?.verticalDatum;

    expect(validate(dataset).map((issue) => issue.code)).toContain('SCHEMA_INVALID');
  });

  it('rejects invalid longitude and latitude values', async () => {
    const validate = createDatasetValidator(await loadSchemas());
    const dataset = await loadFixture();
    at(dataset.stations, 0).centroid = [181, 91];

    expect(validate(dataset).map((issue) => issue.code)).toContain('SCHEMA_INVALID');
  });

  it('rejects dangling entity references', async () => {
    const validate = createDatasetValidator(await loadSchemas());
    const dataset = await loadFixture();
    at(dataset.routes, 0).lineId = 'r3d:zz:synthetic:line:missing';

    expect(validate(dataset).map((issue) => issue.code)).toContain('DANGLING_REFERENCE');
  });

  it('rejects high-confidence measurements without provenance', async () => {
    const validate = createDatasetValidator(await loadSchemas());
    const dataset = await loadFixture();
    at(at(dataset.profiles, 0).samples, 1).provenance = [];

    expect(validate(dataset).map((issue) => issue.code)).toContain('SCHEMA_INVALID');
  });

  it('accepts null rail elevation without coercing it to zero', async () => {
    const validate = createDatasetValidator(await loadSchemas());
    const dataset = await loadFixture();
    expect(at(dataset.profiles, 0).samples.some((sample) => sample.railElevationM === null)).toBe(
      true,
    );
    expect(validate(dataset)).toEqual([]);
  });
});

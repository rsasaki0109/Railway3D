import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatasetValidator } from '../dist/validator.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const schemaDir = path.join(repoRoot, 'schemas/v1');
const fixturePath =
  process.argv[2] ?? path.join(repoRoot, 'data/sample/synthetic-golden/v1/dataset.json');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const schemaFiles = (await readdir(schemaDir)).filter((file) => file.endsWith('.schema.json'));
const schemas = await Promise.all(schemaFiles.map((file) => readJson(path.join(schemaDir, file))));
const dataset = await readJson(fixturePath);
const validate = createDatasetValidator(schemas);
const issues = validate(dataset);

if (issues.length > 0) {
  console.error(JSON.stringify(issues, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Validated ${fixturePath}`);
}

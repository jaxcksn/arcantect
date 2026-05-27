/**
 * Generates puzzle.schema.json from the Zod puzzle schema.
 * Run via: pnpm --filter @arcantect/scorer generate-schema
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { PuzzleJsonSchema } from './puzzle-schema.zod.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const jsonSchema = z.toJSONSchema(PuzzleJsonSchema);

const output = JSON.stringify(jsonSchema, null, 2);
writeFileSync(join(__dirname, '..', 'puzzle.schema.json'), output);
console.log('Generated puzzle.schema.json');

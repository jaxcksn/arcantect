/**
 * Re-exports every type and schema from puzzle-schema.zod.ts so callers
 * can import from either path. The Zod file is the source of truth.
 */
export type {
  InlineDetect,
  AntiPatternJson,
  RequirementJson,
  OptimizationJson,
  RubricJson,
  InitialNodeJson,
  PuzzleJson,
} from './puzzle-schema.zod.ts';

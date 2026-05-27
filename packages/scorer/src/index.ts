// Main entry point for @arcantect/scorer

export { scoreGraph } from './scorer.ts';

export type {
  ScoreResult,
  Violation,
  RequirementResult,
  Requirement,
  AntiPattern,
  Rubric,
  PuzzleContext,
  ScorerNode,
  ScorerEdge,
  AnnotatedGraph,
  Zone,
  FlowType,
  RawNode,
  RawEdge,
} from './types.ts';

export {
  hasNodeOfType,
  countNodesOfType,
  hasEdgeBetweenTypes,
  hasDirectPath,
  allNodesInZone,
  puzzleHasTag,
} from './rubric-helpers.ts';

export { antiPatterns, detectAntiPatterns } from './antipatterns.ts';

export { compileRubric } from './puzzle-compiler.ts';
export type {
  PuzzleJson,
  RubricJson,
  RequirementJson,
  AntiPatternJson,
  InlineDetect,
  InitialNodeJson,
  OptimizationJson,
} from './puzzle-schema.ts';
export {
  PuzzleJsonSchema,
  RubricJsonSchema,
  RequirementJsonSchema,
  AntiPatternJsonSchema,
  InlineDetectSchema,
  InitialNodeJsonSchema,
  OptimizationJsonSchema,
} from './puzzle-schema.zod.ts';

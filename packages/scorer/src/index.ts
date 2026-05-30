// Main entry point for @arcantect/scorer

export { scoreGraph } from './scorer.ts';

export type {
  ScoreResult,
  Violation,
  RequirementResult,
  CapabilityResult,
  RestrictionResult,
  Requirement,
  CapabilityGoal,
  Restriction,
  Rubric,
  PuzzleContext,
  ScorerNode,
  ScorerEdge,
  AnnotatedGraph,
  FlowType,
  RawNode,
  RawEdge,
  TradeoffDimension,
  TradeoffProfile,
  TradeoffWeights,
} from './types.ts';

export {
  hasNodeOfType,
  countNodesOfType,
  hasEdgeBetweenTypes,
  hasDirectPath,
  puzzleHasTag,
} from './rubric-helpers.ts';

export { restrictions, detectRestrictions } from './restrictions.ts';

export { compileRubric } from './puzzle-compiler.ts';
export type {
  PuzzleJson,
  RubricJson,
  RequirementJson,
  CapabilityGoalJson,
  RestrictionJson,
  InlineDetect,
  InitialNodeJson,
  OptimizationJson,
} from './puzzle-schema.ts';
export {
  PuzzleJsonSchema,
  RubricJsonSchema,
  RequirementJsonSchema,
  CapabilityGoalJsonSchema,
  RestrictionJsonSchema,
  InlineDetectSchema,
  InitialNodeJsonSchema,
  OptimizationJsonSchema,
} from './puzzle-schema.zod.ts';

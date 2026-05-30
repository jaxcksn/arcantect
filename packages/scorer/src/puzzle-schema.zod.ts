import { z } from 'zod';

// ---------------------------------------------------------------------------
// InlineDetect — detect expression for inline restrictions
// ---------------------------------------------------------------------------

export const InlineDetectSchema = z.object({
  op: z.literal('canReach'),
  from: z.array(z.string()),
  to: z.array(z.string()),
  skip: z.array(z.string()).optional(),
  message: z.string(),
});

export type InlineDetect = z.infer<typeof InlineDetectSchema>;

// ---------------------------------------------------------------------------
// RestrictionJson
// ---------------------------------------------------------------------------

export const RestrictionJsonSchema = z.union([
  z.object({ ref: z.string() }),
  z.object({ id: z.string(), label: z.string(), hint: z.string(), detect: InlineDetectSchema }),
]);

export type RestrictionJson = z.infer<typeof RestrictionJsonSchema>;

// ---------------------------------------------------------------------------
// RequirementJson
// ---------------------------------------------------------------------------

export const RequirementJsonSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
  bonus: z.boolean().optional(),
});

export type RequirementJson = z.infer<typeof RequirementJsonSchema>;

// ---------------------------------------------------------------------------
// CapabilityGoalJson
// ---------------------------------------------------------------------------

export const CapabilityGoalJsonSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
});

export type CapabilityGoalJson = z.infer<typeof CapabilityGoalJsonSchema>;

// ---------------------------------------------------------------------------
// OptimizationJson
// ---------------------------------------------------------------------------

export const OptimizationJsonSchema = z.object({
  maxNodes: z.number().int().positive(),
  maxEdges: z.number().int().positive(),
});

export type OptimizationJson = z.infer<typeof OptimizationJsonSchema>;

// ---------------------------------------------------------------------------
// RubricJson
// Supports both `hardConstraints` (new) and `requirements` (deprecated alias).
// At least one must be present and non-empty.
// ---------------------------------------------------------------------------

export const RubricJsonSchema = z.object({
  hardConstraints: z.array(RequirementJsonSchema).optional(),
  /** @deprecated Use hardConstraints instead. Treated as an alias during parsing. */
  requirements: z.array(RequirementJsonSchema).optional(),
  capabilityGoals: z.array(CapabilityGoalJsonSchema).optional(),
  tradeoffWeights: z.record(z.string(), z.number()).optional(),
  tradeoffThreshold: z.number().optional(),
  restrictions: z.array(RestrictionJsonSchema).optional(),
  optimization: OptimizationJsonSchema.optional(),
  datalogRules: z.string().optional(),
}).refine(
  data => ((data.hardConstraints ?? data.requirements) ?? []).length > 0,
  { message: 'hardConstraints (or deprecated requirements) must have at least 1 item' },
);

export type RubricJson = z.infer<typeof RubricJsonSchema>;

// ---------------------------------------------------------------------------
// InitialNodeJson
// ---------------------------------------------------------------------------

export const InitialNodeJsonSchema = z.object({
  id: z.string(),
  nodeType: z.string(),
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  deletable: z.boolean().optional(),
});

export type InitialNodeJson = z.infer<typeof InitialNodeJsonSchema>;

// ---------------------------------------------------------------------------
// PuzzleJson — the top-level serialisable puzzle definition
// ---------------------------------------------------------------------------

export const PuzzleJsonSchema = z.object({
  id: z.string(),
  title: z.string(),
  shortDescription: z.string().optional(),
  /** Story-flavoured prompt. Use ",," as a paragraph break. */
  prompt: z.string(),
  context: z.object({ tags: z.array(z.string()) }),
  initialNodes: z.array(InitialNodeJsonSchema).optional(),
  rubric: RubricJsonSchema,
});

export type PuzzleJson = z.infer<typeof PuzzleJsonSchema>;

import { z } from 'zod';

// ---------------------------------------------------------------------------
// InlineDetect — detect expression for inline anti-patterns
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
// AntiPatternJson
// ---------------------------------------------------------------------------

export const AntiPatternJsonSchema = z.union([
  z.object({ ref: z.string() }),
  z.object({ id: z.string(), detect: InlineDetectSchema }),
]);

export type AntiPatternJson = z.infer<typeof AntiPatternJsonSchema>;

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
// OptimizationJson
// ---------------------------------------------------------------------------

export const OptimizationJsonSchema = z.object({
  maxNodes: z.number().int().positive(),
  maxEdges: z.number().int().positive(),
});

export type OptimizationJson = z.infer<typeof OptimizationJsonSchema>;

// ---------------------------------------------------------------------------
// RubricJson
// ---------------------------------------------------------------------------

export const RubricJsonSchema = z.object({
  requirements: z.array(RequirementJsonSchema).min(1),
  antiPatterns: z.array(AntiPatternJsonSchema).optional(),
  optimization: OptimizationJsonSchema.optional(),
  datalogRules: z.string().optional(),
});

export type RubricJson = z.infer<typeof RubricJsonSchema>;

// ---------------------------------------------------------------------------
// InitialNodeJson
// ---------------------------------------------------------------------------

export const InitialNodeJsonSchema = z.object({
  id: z.string(),
  nodeType: z.string(),
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

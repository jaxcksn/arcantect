import type { AnnotatedGraph, Restriction, Requirement, Rubric, TradeoffWeights } from './types.ts'
import type {
  RestrictionJson,
  InlineDetect,
  RequirementJson,
  RubricJson,
} from './puzzle-schema.ts'
import { restrictions as builtinRestrictions } from './restrictions.ts'
import { canReach } from './graph.ts'

// ---------------------------------------------------------------------------
// Inline detect evaluator
// ---------------------------------------------------------------------------

function evalInlineDetect(det: InlineDetect, id: string, graph: AnnotatedGraph) {
  const fromTypes = new Set(det.from)
  const toTypes = new Set(det.to)
  const fromIds = new Set(graph.nodes.filter(n => fromTypes.has(n.runeType)).map(n => n.id))
  const toIds = new Set(graph.nodes.filter(n => toTypes.has(n.runeType)).map(n => n.id))
  if (fromIds.size === 0 || toIds.size === 0) return []
  const skipIds = det.skip
    ? new Set(graph.nodes.filter(n => det.skip!.includes(n.runeType)).map(n => n.id))
    : undefined
  if (!canReach(fromIds, toIds, graph.edges, skipIds)) return []
  return [{ restriction: id, message: det.message }]
}

// ---------------------------------------------------------------------------
// Compilers
// ---------------------------------------------------------------------------

function compileRequirement(req: RequirementJson): Requirement {
  return {
    id: req.id,
    label: req.label,
    hint: req.hint,
    bonus: req.bonus,
  }
}

function compileRestriction(r: RestrictionJson): Restriction {
  if ('ref' in r) {
    const found = Object.values(builtinRestrictions).find(b => b.id === r.ref)
    if (!found) throw new Error(`Unknown built-in restriction ref: "${r.ref}"`)
    return found
  }
  const { id, label, hint, detect } = r
  return {
    id,
    label,
    hint,
    detect: (graph: AnnotatedGraph) => evalInlineDetect(detect, id, graph),
  }
}

/**
 * Compile a JSON rubric definition into a live Rubric with callable
 * detect functions.  Safe to call at module load time.
 */
export function compileRubric(rubric: RubricJson): Rubric {
  // Support deprecated `requirements` as an alias for `hardConstraints`.
  const hardConstraints = rubric.hardConstraints ?? rubric.requirements ?? []
  return {
    hardConstraints: hardConstraints.map(compileRequirement),
    capabilityGoals: rubric.capabilityGoals,
    tradeoffWeights: rubric.tradeoffWeights as TradeoffWeights | undefined,
    tradeoffThreshold: rubric.tradeoffThreshold,
    restrictions: rubric.restrictions?.map(compileRestriction),
    optimization: rubric.optimization,
    datalogRules: rubric.datalogRules,
  }
}

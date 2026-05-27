import type { AnnotatedGraph, AntiPattern, Requirement, Rubric } from './types.ts'
import type {
  AntiPatternJson,
  InlineDetect,
  RequirementJson,
  RubricJson,
} from './puzzle-schema.ts'
import { antiPatterns as builtinAntiPatterns } from './antipatterns.ts'
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
  return [{ antipattern: id, message: det.message }]
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

function compileAntiPattern(ap: AntiPatternJson): AntiPattern {
  if ('ref' in ap) {
    const found = Object.values(builtinAntiPatterns).find(b => b.id === ap.ref)
    if (!found) throw new Error(`Unknown built-in anti-pattern ref: "${ap.ref}"`)
    return found
  }
  const { id, detect } = ap
  return {
    id,
    detect: (graph: AnnotatedGraph) => evalInlineDetect(detect, id, graph),
  }
}

/**
 * Compile a JSON rubric definition into a live Rubric with callable
 * detect functions.  Safe to call at module load time.
 */
export function compileRubric(rubric: RubricJson): Rubric {
  return {
    requirements: rubric.requirements.map(compileRequirement),
    antiPatterns: rubric.antiPatterns?.map(compileAntiPattern),
    optimization: rubric.optimization,
    datalogRules: rubric.datalogRules,
  }
}

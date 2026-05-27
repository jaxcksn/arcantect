import type {
  RawNode,
  RawEdge,
  Rubric,
  PuzzleContext,
  ScoreResult,
  RequirementResult,
  AnnotatedGraph,
  Violation,
} from './types.ts'
import { normalizeNodes, normalizeEdges } from './normalize.ts'
import { inferZones, annotateEdgeCrossings } from './zones.ts'
import { parseProgram, evaluate, violations as dlViolations, requirementResults as dlRequirementResults } from '@arcantect/datalog'
import { graphToFacts, ZONE_SEED_RULES } from './datalog-factgen.ts'

/**
 * Pure, synchronous scoring function.
 * Accepts raw ReactFlow node/edge arrays — no @xyflow/react dependency needed.
 * Requirements are evaluated exclusively via Datalog rules in rubric.datalogRules.
 */
export function scoreGraph(
  rawNodes: readonly RawNode[],
  rawEdges: readonly RawEdge[],
  rubric: Rubric,
  puzzleContext: PuzzleContext,
): ScoreResult {
  // 1. Normalise raw input into the internal model
  const nodes = normalizeNodes(rawNodes)
  const edges = normalizeEdges(rawEdges, nodes)

  // 2. Zone inference (mutates node.zone in place)
  inferZones(nodes, edges)

  // 3. Mark cross-zone edges (mutates edge.crossesZone in place)
  annotateEdgeCrossings(edges, nodes)

  // 4. Build the annotated graph passed to all detectors
  const graph: AnnotatedGraph = { nodes, edges, puzzle: puzzleContext }

  // 5. Initialise requirement results from rubric metadata — Datalog is the
  //    sole authority for setting passed: true.
  let requirementResults: RequirementResult[] = rubric.requirements.map(req => ({
    id: req.id,
    label: req.label,
    hint: req.hint,
    passed: false,
    bonus: req.bonus ?? false,
  }))

  // 6. Detect anti-patterns selected by this puzzle's rubric.
  let violations: Violation[] = (rubric.antiPatterns ?? []).flatMap(ap => ap.detect(graph))

  // 7. Datalog — the sole mechanism for evaluating requirements.
  if (rubric.datalogRules) {
    const edb = graphToFacts(nodes, edges, puzzleContext.tags)
    const dlRules = parseProgram(ZONE_SEED_RULES + '\n' + rubric.datalogRules)
    const dlResult = evaluate(dlRules, edb)

    const mergedRequirements = dlRequirementResults(dlResult)
    requirementResults = requirementResults.map(existing => {
      const dl = mergedRequirements.find(r => r.id === existing.id)
      return dl !== undefined ? { ...existing, passed: dl.passed } : existing
    })
    mergedRequirements
      .filter(r => !requirementResults.some(e => e.id === r.id))
      .forEach(r => requirementResults.push({
        id: r.id,
        label: r.id,
        hint: '',
        passed: r.passed,
        bonus: false,
      }))

    const mergedViolations = dlViolations(dlResult)
    violations = [
      ...violations,
      ...mergedViolations.map(v => ({
        antipattern: v.id,
        message: v.nodeId ? `Node ${v.nodeId} violates ${v.id}` : `Anti-pattern: ${v.id}`,
        nodeIds: v.nodeId ? [v.nodeId] : undefined,
      })),
    ]
  }

  // 8. Pass when every non-bonus requirement is satisfied and no violations.
  const coreRequirementsPassed =
    rubric.requirements.filter(r => !(r.bonus ?? false)).length === 0 ||
    requirementResults.filter(r => !r.bonus).every(r => r.passed)
  const passed = coreRequirementsPassed && violations.length === 0

  // 9. Perfect tier: passed, all bonuses complete, and within the optimization budget.
  const bonusRequirementsPassed = requirementResults.filter(r => r.bonus).every(r => r.passed)
  const perfect =
    passed &&
    bonusRequirementsPassed &&
    rubric.optimization != null &&
    nodes.length <= rubric.optimization.maxNodes &&
    edges.length <= rubric.optimization.maxEdges

  return {
    violations,
    requirementResults,
    passed,
    perfect,
  }
}

import type {
  RawNode,
  RawEdge,
  Rubric,
  PuzzleContext,
  ScoreResult,
  RequirementResult,
  RestrictionResult,
  AnnotatedGraph,
  Violation,
  TradeoffProfile,
  TradeoffDimension,
  TradeoffWeights,
  CapabilityResult,
  ScorerNode,
} from './types.ts'
import { normalizeNodes, normalizeEdges } from './normalize.ts'
import {
  parseProgram,
  evaluate,
  violations as dlViolations,
  requirementResults as dlRequirementResults,
  capgoalResults as dlCapgoalResults,
} from '@arcantect/datalog'
import { graphToFacts } from './datalog-factgen.ts'

const ZERO_PROFILE: TradeoffProfile = {
  latency: 0,
  cost: 0,
  complexity: 0,
  operability: 0,
  throughput: 0,
  security: 0,
  consistency: 0,
  blastRadius: 0,
}

function aggregateTradeoffs(nodes: ScorerNode[]): TradeoffProfile {
  const profile = { ...ZERO_PROFILE }
  for (const node of nodes) {
    for (const [dim, delta] of Object.entries(node.tradeoffs ?? {})) {
      profile[dim as TradeoffDimension] += delta as number
    }
  }
  return profile
}

function calcTradeoffScore(profile: TradeoffProfile, weights: TradeoffWeights): number {
  return Object.entries(weights).reduce((sum, [dim, w]) => {
    return sum + (profile[dim as TradeoffDimension] ?? 0) * (w ?? 0)
  }, 0)
}

function calcStars(
  passed: boolean,
  capabilityResults: CapabilityResult[],
  tradeoffScore: number,
  rubric: Rubric,
  nodeCount: number,
  edgeCount: number,
): 1 | 2 | 3 {
  if (!passed) return 1
  const allCapsPassed = capabilityResults.every(r => r.passed)
  if (!allCapsPassed) return 1
  const aboveThreshold =
    rubric.tradeoffThreshold == null ||
    tradeoffScore >= rubric.tradeoffThreshold
  const withinBudget =
    rubric.optimization == null ||
    (nodeCount <= rubric.optimization.maxNodes &&
      edgeCount <= rubric.optimization.maxEdges)
  return aboveThreshold && withinBudget ? 3 : 2
}

/**
 * Pure, synchronous scoring function.
 * Accepts raw ReactFlow node/edge arrays — no @xyflow/react dependency needed.
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

  // 2. Build the annotated graph passed to all detectors
  const graph: AnnotatedGraph = { nodes, edges, puzzle: puzzleContext }

  // 3. Initialise hard constraint results from rubric metadata — Datalog is
  //    the sole authority for setting passed: true.
  let hardConstraintResults: RequirementResult[] = rubric.hardConstraints.map(req => ({
    id: req.id,
    label: req.label,
    hint: req.hint,
    passed: false,
    bonus: req.bonus ?? false,
  }))

  // 4. Initialise capability results from rubric metadata.
  let capabilityResults: CapabilityResult[] = (rubric.capabilityGoals ?? []).map(goal => ({
    id: goal.id,
    label: goal.label,
    hint: goal.hint,
    passed: false,
  }))

  // 5. Evaluate restrictions — each is always surfaced in the panel.
  const restrictionResults: RestrictionResult[] = (rubric.restrictions ?? []).map(r => ({
    id: r.id,
    label: r.label,
    hint: r.hint,
    passed: r.detect(graph).length === 0,
  }))

  // 6. Aggregate tradeoff profile from all placed nodes.
  const tradeoffProfile = aggregateTradeoffs(nodes)

  // 7. Datalog — evaluates both req() and capgoal() predicates; also yields violations.
  let violations: Violation[] = []
  if (rubric.datalogRules) {
    const edb = graphToFacts(nodes, edges, puzzleContext.tags)
    const dlRules = parseProgram(rubric.datalogRules)
    const dlResult = evaluate(dlRules, edb)

    // Merge req() results into hard constraint results.
    const mergedReqs = dlRequirementResults(dlResult)
    hardConstraintResults = hardConstraintResults.map(existing => {
      const dl = mergedReqs.find(r => r.id === existing.id)
      return dl !== undefined ? { ...existing, passed: dl.passed } : existing
    })
    // Append any Datalog req IDs not in the rubric (backward-compat).
    mergedReqs
      .filter(r => !hardConstraintResults.some(e => e.id === r.id))
      .forEach(r => hardConstraintResults.push({
        id: r.id,
        label: r.id,
        hint: '',
        passed: r.passed,
        bonus: false,
      }))

    // Merge capgoal() results into capability results.
    const mergedCaps = dlCapgoalResults(dlResult)
    capabilityResults = capabilityResults.map(existing => {
      const dl = mergedCaps.find(r => r.id === existing.id)
      return dl !== undefined ? { ...existing, passed: dl.passed } : existing
    })

    violations = dlViolations(dlResult).map(v => ({
      restriction: v.id,
      message: v.nodeId ? `Node ${v.nodeId} violates ${v.id}` : `Violation: ${v.id}`,
      nodeIds: v.nodeId ? [v.nodeId] : undefined,
    }))
  }

  // 8. Passed when every non-bonus hard constraint is satisfied, all restrictions
  //    hold, and there are no violations.
  const coreConstraintsPassed =
    rubric.hardConstraints.filter(r => !(r.bonus ?? false)).length === 0 ||
    hardConstraintResults.filter(r => !r.bonus).every(r => r.passed)
  const restrictionsAllPass = restrictionResults.every(r => r.passed)
  const passed = coreConstraintsPassed && restrictionsAllPass && violations.length === 0

  // 9. Star rating.
  const tradeoffScore = calcTradeoffScore(tradeoffProfile, rubric.tradeoffWeights ?? {})
  const stars = passed
    ? calcStars(passed, capabilityResults, tradeoffScore, rubric, nodes.length, edges.length)
    : 1

  return {
    violations,
    hardConstraintResults,
    capabilityResults,
    tradeoffProfile,
    restrictionResults,
    passed,
    stars,
  }
}
